import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadBundledRules, RULES_PACKAGE } from "@nativeguard/rules";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  LOCKFILE_SCHEMA_VERSION,
  isRecommendationAction,
  type AcceptedException,
  type CompatibilityRule,
  type DependencySnapshot,
  type DoctorReport,
  type Finding,
  type NativeGuardLockfile,
  type PackageIssue,
  type PackageManagerName,
  type ProjectKind,
  type ProjectProfile,
  type Recommendation,
  type RecommendationSurface,
  type StabilityStatus,
  validateLockfile
} from "@nativeguard/schema";

export class NativeGuardError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

export interface AnalyzeOptions {
  rootDir: string;
  cliVersion: string;
  now?: Date;
  sdk?: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function analyzeProject(options: AnalyzeOptions): Promise<DoctorReport> {
  const root = path.resolve(options.rootDir);
  const packageJson = await readPackageJson(root);
  const profile = await detectProjectProfile(root, packageJson);
  const dependencySnapshot = await createDependencySnapshot(root, packageJson);
  const expoSdkMajor = resolveExpoSdkMajor(options.sdk, dependencySnapshot, profile);
  const analyzedProfile = expoSdkMajor ? { ...profile, expoSdkMajor } : profile;
  const generatedAt = (options.now ?? new Date()).toISOString();
  const nativeguard = {
    cliVersion: options.cliVersion,
    rulesPackage: RULES_PACKAGE
  };
  const snapshot = await readNativeGuardLockfile(root);
  const acceptedExceptions = snapshot?.acceptedExceptions ?? [];

  switch (analyzedProfile.kind) {
    case "bare-react-native":
      return createUnsupportedBareReactNativeReport({
        generatedAt,
        nativeguard,
        project: analyzedProfile,
        dependencySnapshot,
        acceptedExceptions
      });
    case "expo-prebuild":
    case "expo-go":
      break;
    default: {
      const exhaustive: never = analyzedProfile.kind;
      throw new NativeGuardError(`Unhandled project kind: ${String(exhaustive)}`, "UNSUPPORTED_PROJECT");
    }
  }

  const findings = applyAcceptedExceptions(
    evaluateRules(loadBundledRules(), analyzedProfile, dependencySnapshot),
    acceptedExceptions
  );
  const recommendations = createRecommendations(findings, analyzedProfile);
  const summary = summarizeFindings(findings, analyzedProfile.packageManager);
  const packageIssues = findings.flatMap(finding => (finding.issue ? [finding.issue] : []));

  return {
    schemaVersion: DOCTOR_REPORT_SCHEMA_VERSION,
    generatedAt,
    nativeguard,
    project: analyzedProfile,
    dependencySnapshot,
    summary,
    packageIssues,
    findings,
    recommendations,
    nextActions: createNextActions(summary.status, analyzedProfile),
    acceptedExceptions
  };
}

export function parseExpoSdkMajor(version: string): string | undefined {
  const normalized = version.trim().replace(/^[~^=v]+/, "");
  const match = normalized.match(/^(\d+)/);
  return match?.[1];
}

export async function writeNativeGuardLockfile(report: DoctorReport, rootDir: string): Promise<string> {
  const existing = await readNativeGuardLockfile(rootDir);
  const lockfile: NativeGuardLockfile = {
    schemaVersion: LOCKFILE_SCHEMA_VERSION,
    generatedAt: report.generatedAt,
    nativeguard: report.nativeguard,
    project: report.project,
    packageManager: report.project.packageManager,
    dependencySnapshot: report.dependencySnapshot,
    summary: report.summary,
    recommendations: report.recommendations,
    acceptedExceptions: report.acceptedExceptions ?? existing?.acceptedExceptions ?? []
  };

  const outputPath = path.join(rootDir, "nativeguard-lock.json");
  await writeFile(outputPath, `${JSON.stringify(lockfile, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function readNativeGuardLockfile(rootDir: string): Promise<NativeGuardLockfile | undefined> {
  const lockfilePath = path.join(rootDir, "nativeguard-lock.json");
  try {
    const raw = await readFile(lockfilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const result = validateLockfile(parsed);
    if (!result.valid) {
      throw new NativeGuardError(
        `nativeguard-lock.json is invalid: ${result.errors.join(", ")}`,
        "INVALID_LOCKFILE"
      );
    }
    const lockfile = parsed as NativeGuardLockfile;
    if (lockfile.schemaVersion !== LOCKFILE_SCHEMA_VERSION) {
      throw new NativeGuardError(
        `Unsupported nativeguard-lock.json schema version: ${lockfile.schemaVersion}`,
        "UNSUPPORTED_LOCKFILE_SCHEMA"
      );
    }
    return lockfile;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  }
}

export async function detectProjectProfile(root: string, packageJson: PackageJson): Promise<ProjectProfile> {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const expoVersion = dependencies.expo;
  const reactNativeVersion = dependencies["react-native"];
  const hasIosProject = await exists(path.join(root, "ios"));
  const hasAndroidProject = await exists(path.join(root, "android"));
  const packageManager = await detectPackageManager(root);
  const newArchitectureEnabled = await detectNewArchitectureEnabled(root);
  const architecture =
    newArchitectureEnabled === undefined ? {} : { newArchitectureEnabled };

  if (expoVersion && (hasIosProject || hasAndroidProject)) {
    return {
      root,
      kind: "expo-prebuild",
      packageManager,
      expoVersion,
      ...(reactNativeVersion ? { reactNativeVersion } : {}),
      ...architecture,
      hasIosProject,
      hasAndroidProject
    };
  }

  if (reactNativeVersion && (hasIosProject || hasAndroidProject)) {
    return {
      root,
      kind: "bare-react-native",
      packageManager,
      ...(expoVersion ? { expoVersion } : {}),
      reactNativeVersion,
      ...architecture,
      hasIosProject,
      hasAndroidProject
    };
  }

  if (expoVersion) {
    return {
      root,
      kind: "expo-go",
      packageManager,
      expoVersion,
      ...(reactNativeVersion ? { reactNativeVersion } : {}),
      ...architecture,
      hasIosProject,
      hasAndroidProject
    };
  }

  throw new NativeGuardError(
    "No supported Expo or React Native project was detected. Expected expo or react-native dependencies in package.json.",
    "UNSUPPORTED_PROJECT"
  );
}

export async function detectPackageManager(root: string): Promise<PackageManagerName> {
  if (await exists(path.join(root, "package-lock.json"))) return "npm";
  if (await exists(path.join(root, "yarn.lock"))) return "yarn";
  if (await exists(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(root, "bun.lockb")) || (await exists(path.join(root, "bun.lock")))) return "bun";
  return "unknown";
}

async function detectNewArchitectureEnabled(root: string): Promise<boolean | undefined> {
  for (const fileName of ["app.json", "app.config.json"]) {
    try {
      const raw = await readFile(path.join(root, fileName), "utf8");
      const parsed: unknown = JSON.parse(raw);
      const enabled = newArchitectureFromConfig(parsed);
      if (enabled !== undefined) return enabled;
    } catch (error) {
      if (isNodeError(error, "ENOENT")) continue;
      throw error;
    }
  }
  return undefined;
}

function newArchitectureFromConfig(value: unknown): boolean | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const expo = asRecord(record.expo) ?? record;
  if (typeof expo.newArchEnabled === "boolean") return expo.newArchEnabled;

  const android = asRecord(expo.android)?.newArchEnabled;
  const ios = asRecord(expo.ios)?.newArchEnabled;
  if (android === false || ios === false) return false;
  if (android === true || ios === true) return true;
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

async function readPackageJson(root: string): Promise<PackageJson> {
  try {
    const raw = await readFile(path.join(root, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new NativeGuardError("package.json was not found in the current project.", "MISSING_PACKAGE_JSON");
    }
    throw error;
  }
}

async function createDependencySnapshot(root: string, packageJson: PackageJson): Promise<DependencySnapshot> {
  const npmLockfile = await readNpmLockfile(root);
  return {
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
    ...(npmLockfile?.resolvedVersions && Object.keys(npmLockfile.resolvedVersions).length > 0
      ? { resolvedVersions: npmLockfile.resolvedVersions }
      : {}),
    ...(npmLockfile?.lockfile ? { lockfile: npmLockfile.lockfile } : {})
  };
}

interface NpmLockfilePackage {
  version?: string;
}

interface ParsedNpmLockfile {
  lockfile?: DependencySnapshot["lockfile"];
  resolvedVersions?: Record<string, string>;
}

async function readNpmLockfile(root: string): Promise<ParsedNpmLockfile | undefined> {
  const lockfilePath = path.join(root, "package-lock.json");
  try {
    const raw = await readFile(lockfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      lockfileVersion?: number;
      packages?: Record<string, NpmLockfilePackage>;
    };
    const resolvedVersions = collectResolvedVersions(parsed.packages ?? {});
    return {
      lockfile: {
        path: "package-lock.json",
        ...(parsed.lockfileVersion ? { lockfileVersion: parsed.lockfileVersion } : {}),
        packageCount: parsed.packages ? Object.keys(parsed.packages).length : 0
      },
      ...(Object.keys(resolvedVersions).length > 0 ? { resolvedVersions } : {})
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  }
}

function collectResolvedVersions(packages: Record<string, NpmLockfilePackage>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(packages)) {
    const match = key.match(/^node_modules\/(@[^/]+\/[^/]+|[^/]+)$/);
    const packageName = match?.[1];
    if (packageName && value.version) {
      resolved[packageName] = value.version;
    }
  }
  return resolved;
}

function evaluateRules(
  rules: CompatibilityRule[],
  profile: ProjectProfile,
  snapshot: DependencySnapshot
): Finding[] {
  const allDependencies = {
    ...snapshot.dependencies,
    ...snapshot.devDependencies
  };
  const findings: Finding[] = [];

  for (const rule of rules) {
    const declaredVersion = allDependencies[rule.packageName];
    const installedVersion = snapshot.resolvedVersions?.[rule.packageName] ?? declaredVersion;
    if (!ruleMatchesProfile(rule, profile)) continue;
    if (!requiredPackagesInstalled(rule, snapshot, allDependencies)) continue;
    if (rule.packageName !== "react-native" && !installedVersion) continue;
    if (installedVersion && !versionMatchesRange(installedVersion, rule.affectedRange)) continue;
    if (unlessConstraintMatches(rule, snapshot, allDependencies)) continue;
    const severity = rule.outcome === "risky" ? "error" : rule.outcome === "accepted-exception" ? "warning" : "info";
    const issue =
      installedVersion && rule.issue
        ? createPackageIssue(rule, installedVersion, severity)
        : undefined;

    findings.push({
      id: `finding-${rule.id}`,
      ruleId: rule.id,
      packageName: rule.packageName,
      severity,
      status: rule.outcome,
      title: rule.summary,
      detail: `${rule.packageName} ${rule.affectedRange} matched NativeGuard rule ${rule.id}.`,
      confidence: rule.confidence,
      ...(issue ? { issue } : {}),
      evidence: rule.evidence,
      remediation: rule.remediation,
      ...(rule.surfaces ? { surfaces: rule.surfaces } : {})
    });
  }

  if (profile.packageManager !== "npm") {
    findings.push({
      id: `finding-package-manager-${profile.packageManager}`,
      severity: "warning",
      status: "unsupported",
      title: `${profile.packageManager} support is not complete yet`,
      detail: "NativeGuard detected the package manager but first-version analysis is npm-first.",
      confidence: "high",
      evidence: [],
      remediation: [{ type: "manual-check", note: "Use the report as advisory until this package manager is fully supported." }]
    });
  }

  return findings;
}

function applyAcceptedExceptions(findings: Finding[], exceptions: AcceptedException[]): Finding[] {
  if (exceptions.length === 0) return findings;
  return findings.map(finding => {
    if (!findingHasOnlyLeaveOrExcludeRemediation(finding)) return finding;
    const installedVersion = finding.issue?.installedVersion;
    if (!installedVersion) return finding;
    const accepted = exceptions.find(exception =>
      acceptedExceptionMatches(exception, finding, installedVersion)
    );
    if (!accepted) return finding;
    return {
      ...finding,
      status: "accepted-exception",
      severity: "warning",
      detail: `${finding.detail} Recorded as an accepted exception: ${accepted.reason}`,
      ...(finding.issue
        ? {
            issue: {
              ...finding.issue,
              status: "accepted-exception",
              severity: "warning"
            }
          }
        : {})
    };
  });
}

function findingHasOnlyLeaveOrExcludeRemediation(finding: Finding): boolean {
  const actions = finding.remediation.filter(action => isRecommendationAction(action.type));
  return (
    actions.length > 0 &&
    actions.every(action => action.type === "leave" || action.type === "exclude")
  );
}

function acceptedExceptionMatches(
  exception: AcceptedException,
  finding: Finding,
  installedVersion: string
): boolean {
  if (exception.version !== installedVersion) return false;
  if (exception.ruleId !== undefined && exception.ruleId !== finding.ruleId) return false;
  if (exception.findingId !== undefined && exception.findingId !== finding.id) return false;
  const packageNames = new Set(
    [finding.packageName, finding.issue?.packageName, ...finding.remediation.map(action => action.packageName)].filter(
      (name): name is string => Boolean(name)
    )
  );
  return packageNames.has(exception.packageName);
}

function createPackageIssue(
  rule: CompatibilityRule,
  installedVersion: string,
  severity: PackageIssue["severity"]
): PackageIssue {
  const primaryRemediation = rule.remediation.find(action => action.to) ?? rule.remediation[0];
  return {
    packageName: rule.packageName,
    installedVersion,
    affectedRange: rule.affectedRange,
    status: rule.outcome,
    severity,
    ruleId: rule.id,
    reason: rule.issue?.reason ?? rule.summary,
    ...(rule.issue?.fixedVersion ? { fixedVersion: rule.issue.fixedVersion } : {}),
    ...(rule.issue?.patchedVersion ? { patchedVersion: rule.issue.patchedVersion } : {}),
    ...(rule.issue?.patchFile ? { patchFile: rule.issue.patchFile } : {}),
    ...(primaryRemediation ? { recommendation: primaryRemediation.note } : {}),
    evidence: rule.evidence,
    remediation: rule.remediation
  };
}

function createRecommendations(findings: Finding[], profile: ProjectProfile): Recommendation[] {
  const fallbackSurfaces = surfacesForProject(profile.kind);
  const recommendations: Recommendation[] = [];

  for (const finding of findings) {
    for (const remediation of finding.remediation) {
      if (!isRecommendationAction(remediation.type)) continue;
      const surfaces = remediation.surfaces ?? finding.surfaces ?? fallbackSurfaces;
      recommendations.push({
        action: remediation.type,
        packageName: remediation.packageName ?? finding.packageName ?? finding.ruleId ?? finding.id,
        evidence: finding.evidence,
        surfaces,
        ...(finding.issue?.installedVersion ? { from: finding.issue.installedVersion } : {}),
        ...(remediation.to ? { to: remediation.to } : {}),
        ...(remediation.note ? { note: remediation.note } : {}),
        ...(finding.ruleId ? { ruleId: finding.ruleId } : {})
      });
    }
  }

  return recommendations;
}

function createUnsupportedBareReactNativeReport(options: {
  generatedAt: string;
  nativeguard: DoctorReport["nativeguard"];
  project: ProjectProfile;
  dependencySnapshot: DependencySnapshot;
  acceptedExceptions: AcceptedException[];
}): DoctorReport {
  const findings: Finding[] = [
    {
      id: "finding-unsupported-bare-react-native",
      severity: "error",
      status: "unsupported",
      title: "Bare React Native is not supported yet",
      detail:
        "NativeGuard detected a bare React Native project and skipped compatibility analysis. This result is unsupported, not stable.",
      confidence: "high",
      evidence: [],
      remediation: [
        {
          type: "manual-check",
          note: "Analyze an Expo prebuild project, or wait for dedicated bare React Native support."
        }
      ]
    }
  ];

  return {
    schemaVersion: DOCTOR_REPORT_SCHEMA_VERSION,
    generatedAt: options.generatedAt,
    nativeguard: options.nativeguard,
    project: options.project,
    dependencySnapshot: options.dependencySnapshot,
    summary: {
      status: "unsupported",
      findingCounts: { info: 0, warning: 0, error: 1 }
    },
    packageIssues: [],
    findings,
    recommendations: [],
    nextActions: createNextActions("unsupported", options.project),
    acceptedExceptions: options.acceptedExceptions
  };
}

function surfacesForProject(kind: ProjectKind): RecommendationSurface[] {
  switch (kind) {
    case "expo-prebuild":
      return ["eas", "local-native"];
    case "expo-go":
      return ["runtime"];
    case "bare-react-native":
      return ["local-native"];
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function resolveExpoSdkMajor(
  sdkFlag: string | undefined,
  snapshot: DependencySnapshot,
  profile: ProjectProfile
): string | undefined {
  if (sdkFlag !== undefined) {
    const parsed = parseExpoSdkMajor(sdkFlag);
    if (!parsed) {
      throw new NativeGuardError(
        `Invalid Expo SDK value "${sdkFlag}". Expected a major version such as 54.`,
        "INVALID_SDK"
      );
    }
    return parsed;
  }

  const expoVersion = snapshot.resolvedVersions?.expo ?? profile.expoVersion;
  return expoVersion ? parseExpoSdkMajor(expoVersion) : undefined;
}

function ruleMatchesProfile(rule: CompatibilityRule, profile: ProjectProfile): boolean {
  if (!rule.context.projectKinds.includes(profile.kind)) return false;
  if (rule.context.packageManagers && !rule.context.packageManagers.includes(profile.packageManager)) return false;
  if (rule.context.expoSdk && !ruleMatchesSdk(rule, profile.expoSdkMajor)) return false;
  if (rule.context.reactNative && !matchesAnyVersionPattern(profile.reactNativeVersion, rule.context.reactNative)) return false;
  if (rule.context.newArchitecture !== undefined && profile.newArchitectureEnabled !== rule.context.newArchitecture) {
    return false;
  }
  return true;
}

function requiredPackagesInstalled(
  rule: CompatibilityRule,
  snapshot: DependencySnapshot,
  declared: Record<string, string>
): boolean {
  const required = rule.context.requiresPackages;
  if (!required || required.length === 0) return true;
  return required.every(packageName => Boolean(resolvedOrDeclaredVersion(snapshot, declared, packageName)));
}

function unlessConstraintMatches(
  rule: CompatibilityRule,
  snapshot: DependencySnapshot,
  declared: Record<string, string>
): boolean {
  if (!rule.unless) return false;
  const packageName = rule.unless.packageName ?? rule.packageName;
  const version = resolvedOrDeclaredVersion(snapshot, declared, packageName);
  return Boolean(version && versionMatchesRange(version, rule.unless.range));
}

function resolvedOrDeclaredVersion(
  snapshot: DependencySnapshot,
  declared: Record<string, string>,
  packageName: string
): string | undefined {
  return snapshot.resolvedVersions?.[packageName] ?? declared[packageName];
}

function ruleMatchesSdk(rule: CompatibilityRule, sdkMajor: string | undefined): boolean {
  const required = rule.context.expoSdk;
  if (!required || required.length === 0) return true;
  if (!sdkMajor) return false;
  return required.some(pattern => sdkPatternMatches(sdkMajor, pattern));
}

function sdkPatternMatches(sdkMajor: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  const comparator = trimmed.match(/^(<=|>=|<|>)\s*(\d+)/);
  if (comparator) {
    const sdk = Number(sdkMajor);
    const target = Number(comparator[2]);
    const operator = comparator[1];
    if (!Number.isFinite(sdk) || !Number.isFinite(target) || !operator) return false;
    if (operator !== "<" && operator !== "<=" && operator !== ">" && operator !== ">=") {
      return false;
    }
    switch (operator) {
      case "<":
        return sdk < target;
      case "<=":
        return sdk <= target;
      case ">":
        return sdk > target;
      case ">=":
        return sdk >= target;
      default: {
        const exhaustive: never = operator;
        return exhaustive;
      }
    }
  }
  return parseExpoSdkMajor(trimmed) === sdkMajor;
}

function matchesAnyVersionPattern(version: string | undefined, patterns: string[]): boolean {
  if (!version) return false;
  return patterns.some(pattern => versionMatchesRange(version, pattern));
}

function versionMatchesRange(version: string, range: string): boolean {
  const normalized = normalizeVersion(version);
  if (!normalized) return false;
  const trimmedRange = range.trim();
  if (trimmedRange === "*") return true;
  if (/^\d+$/.test(trimmedRange)) {
    const min = normalizeVersion(`${trimmedRange}.0.0`);
    const max = normalizeVersion(`${Number(trimmedRange) + 1}.0.0`);
    return Boolean(min && max && compareVersions(normalized, min) >= 0 && compareVersions(normalized, max) < 0);
  }

  const hyphenRange = trimmedRange.match(/^(.+)\s+-\s+(.+)$/);
  if (hyphenRange) {
    const min = normalizeVersion(hyphenRange[1] ?? "");
    const max = upperBoundForPattern(hyphenRange[2] ?? "");
    return Boolean(min && max && compareVersions(normalized, min) >= 0 && compareVersions(normalized, max) < 0);
  }

  const comparatorRange = trimmedRange.match(/^(<=|>=|<|>)\s*(.+)$/);
  if (comparatorRange) {
    const operator = comparatorRange[1];
    const target = normalizeVersion(comparatorRange[2] ?? "");
    if (!operator || !target) return false;
    const comparison = compareVersions(normalized, target);
    if (operator === "<") return comparison < 0;
    if (operator === "<=") return comparison <= 0;
    if (operator === ">") return comparison > 0;
    return comparison >= 0;
  }

  if (trimmedRange.startsWith("~")) {
    const min = normalizeVersion(trimmedRange.slice(1));
    if (!min) return false;
    const max = [min.major, min.minor + 1, 0] as const;
    return compareVersions(normalized, min) >= 0 && compareVersions(normalized, versionParts(max)) < 0;
  }

  if (trimmedRange.endsWith(".x")) {
    const min = normalizeVersion(trimmedRange.replace(/\.x$/, ".0"));
    const max = upperBoundForPattern(trimmedRange);
    return Boolean(min && max && compareVersions(normalized, min) >= 0 && compareVersions(normalized, max) < 0);
  }

  const exact = normalizeVersion(trimmedRange);
  return Boolean(exact && compareVersions(normalized, exact) === 0);
}

function upperBoundForPattern(pattern: string): ParsedVersion | undefined {
  const parts = pattern.trim().split(".");
  const wildcardIndex = parts.findIndex(part => part.toLowerCase() === "x" || part === "*");
  if (wildcardIndex === -1) {
    const exact = normalizeVersion(pattern);
    if (!exact) return undefined;
    return versionParts([exact.major, exact.minor, exact.patch + 1]);
  }

  const normalized = normalizeVersion(parts.map(part => (part.toLowerCase() === "x" || part === "*" ? "0" : part)).join("."));
  if (!normalized) return undefined;
  if (wildcardIndex === 0) return versionParts([normalized.major + 1, 0, 0]);
  if (wildcardIndex === 1) return versionParts([normalized.major + 1, 0, 0]);
  return versionParts([normalized.major, normalized.minor + 1, 0]);
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function normalizeVersion(version: string): ParsedVersion | undefined {
  const withoutRangePrefix = version.trim().replace(/^[~^=v]+/, "");
  const match = withoutRangePrefix.match(/^(\d+)(?:\.(\d+|x))?(?:\.(\d+|x))?/i);
  if (!match || match[1]?.toLowerCase() === "x") return undefined;
  return {
    major: Number(match[1]),
    minor: match[2] && match[2].toLowerCase() !== "x" ? Number(match[2]) : 0,
    patch: match[3] && match[3].toLowerCase() !== "x" ? Number(match[3]) : 0
  };
}

function versionParts(parts: readonly [number, number, number]): ParsedVersion {
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2]
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function summarizeFindings(
  findings: Finding[],
  packageManager: PackageManagerName
): DoctorReport["summary"] {
  const findingCounts = {
    info: findings.filter(finding => finding.severity === "info").length,
    warning: findings.filter(finding => finding.severity === "warning").length,
    error: findings.filter(finding => finding.severity === "error").length
  };

  let status: StabilityStatus = "stable";
  if (findingCounts.error > 0) {
    status = "risky";
  } else if (packageManager !== "npm") {
    status = "unsupported";
  } else if (findingCounts.warning > 0) {
    status = "accepted-exception";
  }

  return { status, findingCounts };
}

function createNextActions(status: StabilityStatus, profile: ProjectProfile): string[] {
  if (profile.kind === "bare-react-native") {
    return [
      "Bare React Native is not supported yet. NativeGuard skipped analysis and did not classify this project as stable."
    ];
  }
  if (profile.packageManager !== "npm") {
    return ["NativeGuard detected this package manager, but full analysis is not implemented yet."];
  }
  switch (status) {
    case "stable":
      return ["Keep dependencies pinned and rerun NativeGuard before accepting dependency upgrade PRs."];
    case "accepted-exception":
      return [
        "Leave/exclude findings listed in nativeguard-lock.json acceptedExceptions are accepted, not new risk. Edit that snapshot by hand; NativeGuard does not mutate package manager lockfiles."
      ];
    case "risky":
      return ["Review risky findings before upgrading or releasing this app."];
    case "unsupported":
      return ["This project profile is unsupported. NativeGuard did not produce a stable compatibility result."];
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && (error as { code?: unknown }).code === code;
}

export type {
  DependencySnapshot,
  DoctorReport,
  Finding,
  NativeGuardLockfile,
  PackageManagerName,
  ProjectKind,
  ProjectProfile,
  Recommendation
};
