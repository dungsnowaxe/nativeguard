import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadBundledRules, RULES_PACKAGE } from "@nativeguard/rules";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  LOCKFILE_SCHEMA_VERSION,
  type CompatibilityRule,
  type DependencySnapshot,
  type DoctorReport,
  type Finding,
  type NativeGuardLockfile,
  type PackageIssue,
  type PackageManagerName,
  type ProjectKind,
  type ProjectProfile,
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
  const findings = evaluateRules(loadBundledRules(), profile, dependencySnapshot);
  const summary = summarizeFindings(findings, profile.packageManager);
  const packageIssues = findings.flatMap(finding => (finding.issue ? [finding.issue] : []));

  return {
    schemaVersion: DOCTOR_REPORT_SCHEMA_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    nativeguard: {
      cliVersion: options.cliVersion,
      rulesPackage: RULES_PACKAGE
    },
    project: profile,
    dependencySnapshot,
    summary,
    packageIssues,
    findings,
    nextActions: createNextActions(summary.status, profile.packageManager)
  };
}

export async function writeNativeGuardLockfile(report: DoctorReport, rootDir: string): Promise<string> {
  const lockfile: NativeGuardLockfile = {
    schemaVersion: LOCKFILE_SCHEMA_VERSION,
    generatedAt: report.generatedAt,
    nativeguard: report.nativeguard,
    project: report.project,
    packageManager: report.project.packageManager,
    dependencySnapshot: report.dependencySnapshot,
    summary: report.summary,
    acceptedExceptions: []
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

  if (expoVersion && (hasIosProject || hasAndroidProject)) {
    return {
      root,
      kind: "expo-prebuild",
      packageManager,
      expoVersion,
      ...(reactNativeVersion ? { reactNativeVersion } : {}),
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
  const lockfile = await readNpmLockfile(root);
  return {
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
    ...(lockfile ? { lockfile } : {})
  };
}

async function readNpmLockfile(root: string): Promise<DependencySnapshot["lockfile"]> {
  const lockfilePath = path.join(root, "package-lock.json");
  try {
    const raw = await readFile(lockfilePath, "utf8");
    const parsed = JSON.parse(raw) as { lockfileVersion?: number; packages?: Record<string, unknown> };
    return {
      path: "package-lock.json",
      ...(parsed.lockfileVersion ? { lockfileVersion: parsed.lockfileVersion } : {}),
      packageCount: parsed.packages ? Object.keys(parsed.packages).length : 0
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  }
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
    const installedVersion = allDependencies[rule.packageName];
    if (!ruleMatchesProfile(rule, profile)) continue;
    if (rule.packageName !== "react-native" && !installedVersion) continue;
    if (installedVersion && !versionMatchesRange(installedVersion, rule.affectedRange)) continue;
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
      remediation: rule.remediation
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

function ruleMatchesProfile(rule: CompatibilityRule, profile: ProjectProfile): boolean {
  if (!rule.context.projectKinds.includes(profile.kind)) return false;
  if (rule.context.packageManagers && !rule.context.packageManagers.includes(profile.packageManager)) return false;
  if (rule.context.expoSdk && !matchesAnyVersionPattern(profile.expoVersion, rule.context.expoSdk)) return false;
  if (rule.context.reactNative && !matchesAnyVersionPattern(profile.reactNativeVersion, rule.context.reactNative)) return false;
  return true;
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

function createNextActions(status: StabilityStatus, packageManager: PackageManagerName): string[] {
  if (packageManager !== "npm") {
    return ["NativeGuard detected this package manager, but full analysis is not implemented yet."];
  }
  if (status === "stable") {
    return ["Keep dependencies pinned and rerun NativeGuard before accepting dependency upgrade PRs."];
  }
  if (status === "accepted-exception") {
    return ["Review accepted exceptions and record them in nativeguard-lock.json when intentional."];
  }
  return ["Review risky findings before upgrading or releasing this app."];
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
  ProjectProfile
};
