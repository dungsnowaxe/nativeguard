import { access, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadBundledRules, RULES_PACKAGE } from "@nativeguard/rules";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  LOCKFILE_SCHEMA_VERSION,
  type CompatibilityRule,
  type DependencySnapshot,
  type DoctorReport,
  type Finding,
  type NativeGuardEnvironmentReport,
  type NativeGuardLockfile,
  type PackageIssue,
  type PackageManagerName,
  type ProjectKind,
  type ProjectProfile,
  type StabilityStatus,
  type ToolchainContext,
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
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  expo?: {
    newArchEnabled?: boolean;
  };
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

export async function createEnvironmentReport(options: AnalyzeOptions): Promise<NativeGuardEnvironmentReport> {
  const root = path.resolve(options.rootDir);
  const packageJson = await readPackageJson(root);
  const project = await detectProjectProfile(root, packageJson);
  const toolchain = await collectToolchainContext(root, project.packageManager, packageJson);

  return {
    schemaVersion: DOCTOR_REPORT_SCHEMA_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    nativeguard: {
      cliVersion: options.cliVersion
    },
    project: redactProjectProfile(project),
    toolchain,
    redaction: {
      applied: true,
      hiddenFields: ["project.root", "project.workspace.root"]
    }
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
  const lockfileState = await detectLockfileState(root, packageManager);
  const appConfig = await readExpoAppConfig(root);
  const workspace = await detectWorkspace(root, packageJson);
  const expoModulesPackages = Object.keys(dependencies)
    .filter(name => name === "expo-modules-core" || name.startsWith("expo-"))
    .sort();
  const hasExpoRouter = Boolean(dependencies["expo-router"] || (await exists(path.join(root, "app"))));
  const hasExpoModules = Boolean(expoVersion || expoModulesPackages.length > 0);
  const newArchitecture = await detectNewArchitecture(root, packageJson, appConfig);
  const baseProfile = {
    root,
    packageManager,
    ...(await detectPackageManagerVersion(root, packageManager, packageJson)),
    ...(expoVersion ? { expoVersion } : {}),
    ...(reactNativeVersion ? { reactNativeVersion } : {}),
    hasIosProject,
    hasAndroidProject,
    hasGeneratedNativeProjects: hasIosProject || hasAndroidProject,
    hasExpoRouter,
    hasExpoModules,
    expoModulesPackages,
    newArchitecture,
    ...(workspace ? { workspace } : {}),
    lockfileState,
    detectionConfidence: "high" as const
  };

  if (expoVersion && (hasIosProject || hasAndroidProject)) {
    return {
      ...baseProfile,
      kind: "expo-prebuild",
    };
  }

  if (reactNativeVersion && (hasIosProject || hasAndroidProject)) {
    return {
      ...baseProfile,
      kind: "bare-react-native",
    };
  }

  if (expoVersion) {
    return {
      ...baseProfile,
      kind: "expo-managed"
    };
  }

  throw new NativeGuardError(
    "No supported Expo or React Native project was detected. Expected expo or react-native dependencies in package.json.",
    "UNSUPPORTED_PROJECT"
  );
}

export async function collectToolchainContext(
  root: string,
  packageManager: PackageManagerName,
  packageJson: PackageJson = {}
): Promise<ToolchainContext> {
  const missingContext: string[] = [];
  const packageManagerVersion = (await detectPackageManagerVersion(root, packageManager, packageJson)).packageManagerVersion;
  const easProfile = await detectEasProfile(root);
  const gradleVersion = await readGradleVersion(root);
  const androidGradlePluginVersion = await readAndroidGradlePluginVersion(root);
  const kotlinVersion = await readKotlinVersion(root);
  const androidSdk = await readAndroidSdkVersions(root);

  if (!packageManagerVersion) missingContext.push("packageManagerVersion");
  if (!(await exists(path.join(root, "ios", "Podfile.lock")))) missingContext.push("cocoaPodsVersion");
  if (!gradleVersion) missingContext.push("gradleVersion");
  if (!androidGradlePluginVersion) missingContext.push("androidGradlePluginVersion");
  if (!kotlinVersion) missingContext.push("kotlinVersion");

  return {
    packageManager,
    nodeVersion: process.version,
    ...(packageManagerVersion ? { packageManagerVersion } : {}),
    ...(easProfile ? { easProfile } : {}),
    ...(gradleVersion ? { gradleVersion } : {}),
    ...(androidGradlePluginVersion ? { androidGradlePluginVersion } : {}),
    ...(kotlinVersion ? { kotlinVersion } : {}),
    ...(androidSdk ? { androidSdk } : {}),
    missingContext
  };
}

export async function detectPackageManager(root: string): Promise<PackageManagerName> {
  if (await findLockfile(root, ["package-lock.json"])) return "npm";
  if (await findLockfile(root, ["yarn.lock"])) return "yarn";
  if (await findLockfile(root, ["pnpm-lock.yaml"])) return "pnpm";
  if (await findLockfile(root, ["bun.lockb", "bun.lock"])) return "bun";
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
  const packageManager = await detectPackageManager(root);
  const lockfile = await readLockfile(root, packageManager);
  return {
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
    ...(lockfile ? { lockfile } : {})
  };
}

async function readLockfile(root: string, packageManager: PackageManagerName): Promise<DependencySnapshot["lockfile"]> {
  const lockfilePath = await lockfilePathFor(root, packageManager);
  if (!lockfilePath) return undefined;

  try {
    const raw = await readFile(lockfilePath.absolute, "utf8");
    const parsed = lockfilePath.relative === "package-lock.json"
      ? JSON.parse(raw) as { lockfileVersion?: number; packages?: Record<string, unknown> }
      : undefined;
    const packageCount = parsed?.packages ? Object.keys(parsed.packages).length : countLockfilePackages(raw, lockfilePath.relative);
    const fresh = await isLockfileFresh(root, lockfilePath.absolute);
    return {
      path: lockfilePath.relative,
      ...(parsed?.lockfileVersion ? { lockfileVersion: parsed.lockfileVersion } : {}),
      packageCount,
      ...(fresh === undefined ? {} : { fresh })
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  }
}

async function readExpoAppConfig(root: string): Promise<{ newArchEnabled?: boolean } | undefined> {
  const appJson = await readJsonFile<{ expo?: { newArchEnabled?: boolean } }>(path.join(root, "app.json"));
  if (appJson?.expo && typeof appJson.expo.newArchEnabled === "boolean") {
    return { newArchEnabled: appJson.expo.newArchEnabled };
  }

  const appConfigJson = await readJsonFile<{ expo?: { newArchEnabled?: boolean } }>(path.join(root, "app.config.json"));
  if (appConfigJson?.expo && typeof appConfigJson.expo.newArchEnabled === "boolean") {
    return { newArchEnabled: appConfigJson.expo.newArchEnabled };
  }

  return undefined;
}

async function detectNewArchitecture(
  root: string,
  packageJson: PackageJson,
  appConfig: { newArchEnabled?: boolean } | undefined
): Promise<{ enabled?: boolean; sources: string[] }> {
  const sources: string[] = [];
  let enabled: boolean | undefined;

  if (typeof packageJson.expo?.newArchEnabled === "boolean") {
    enabled = packageJson.expo.newArchEnabled;
    sources.push("package.json:expo.newArchEnabled");
  }

  if (typeof appConfig?.newArchEnabled === "boolean") {
    enabled = appConfig.newArchEnabled;
    sources.push("app.json:expo.newArchEnabled");
  }

  const gradleProperties = await readTextIfExists(path.join(root, "android", "gradle.properties"));
  if (gradleProperties) {
    const match = gradleProperties.match(/^newArchEnabled=(true|false)$/m);
    if (match?.[1]) {
      enabled = match[1] === "true";
      sources.push("android/gradle.properties:newArchEnabled");
    }
  }

  const podfileProperties = await readJsonFile<{ newArchEnabled?: string | boolean }>(
    path.join(root, "ios", "Podfile.properties.json")
  );
  if (typeof podfileProperties?.newArchEnabled === "boolean" || typeof podfileProperties?.newArchEnabled === "string") {
    enabled = podfileProperties.newArchEnabled === true || podfileProperties.newArchEnabled === "true";
    sources.push("ios/Podfile.properties.json:newArchEnabled");
  }

  return {
    ...(enabled === undefined ? {} : { enabled }),
    sources
  };
}

async function detectWorkspace(
  root: string,
  packageJson: PackageJson
): Promise<{ root: string; type: "npm" | "pnpm" | "yarn" | "unknown"; isWorkspaceRoot: boolean } | undefined> {
  const pnpmWorkspaceRoot = await findUp(root, "pnpm-workspace.yaml");
  if (pnpmWorkspaceRoot) {
    return {
      root: pnpmWorkspaceRoot,
      type: "pnpm",
      isWorkspaceRoot: pnpmWorkspaceRoot === root
    };
  }

  const workspaces = packageJson.workspaces;
  const hasPackageJsonWorkspaces = Array.isArray(workspaces) || Array.isArray(workspaces?.packages);
  if (hasPackageJsonWorkspaces) {
    return {
      root,
      type: "npm",
      isWorkspaceRoot: true
    };
  }

  return undefined;
}

async function detectLockfileState(
  root: string,
  packageManager: PackageManagerName
): Promise<{ path?: string; present: boolean; fresh?: boolean }> {
  const lockfile = await lockfilePathFor(root, packageManager);
  if (!lockfile) {
    return { present: false };
  }

  const present = await exists(lockfile.absolute);
  if (!present) {
    return {
      path: lockfile.relative,
      present: false
    };
  }

  const fresh = await isLockfileFresh(root, lockfile.absolute);
  return {
    path: lockfile.relative,
    present: true,
    ...(fresh === undefined ? {} : { fresh })
  };
}

async function detectPackageManagerVersion(
  root: string,
  packageManager: PackageManagerName,
  packageJson: PackageJson
): Promise<Pick<ProjectProfile, "packageManagerVersion">> {
  if (packageJson.packageManager) {
    const [, version] = packageJson.packageManager.split("@");
    if (version) return { packageManagerVersion: version };
  }

  const rootPackageJson = await readJsonFile<PackageJson>(path.join(root, "package.json"));
  if (rootPackageJson?.packageManager) {
    const [, version] = rootPackageJson.packageManager.split("@");
    if (version) return { packageManagerVersion: version };
  }

  if (packageManager === "npm" && process.env.npm_config_user_agent) {
    const match = process.env.npm_config_user_agent.match(/npm\/([^\s]+)/);
    if (match?.[1]) return { packageManagerVersion: match[1] };
  }

  return {};
}

async function detectEasProfile(root: string): Promise<ToolchainContext["easProfile"] | undefined> {
  const easJson = await readJsonFile<{ build?: Record<string, unknown> }>(path.join(root, "eas.json"));
  const profileName = easJson?.build ? Object.keys(easJson.build)[0] : undefined;
  return profileName ? { name: profileName, platform: "all" } : undefined;
}

async function readGradleVersion(root: string): Promise<string | undefined> {
  const wrapper = await readTextIfExists(path.join(root, "android", "gradle", "wrapper", "gradle-wrapper.properties"));
  return wrapper?.match(/gradle-([0-9.]+)-/)?.[1];
}

async function readAndroidGradlePluginVersion(root: string): Promise<string | undefined> {
  const settingsGradle = await readTextIfExists(path.join(root, "android", "settings.gradle"));
  return settingsGradle?.match(/com\.android\.application["']?\s+version\s+["']([^"']+)["']/)?.[1];
}

async function readKotlinVersion(root: string): Promise<string | undefined> {
  const buildGradle = await readTextIfExists(path.join(root, "android", "build.gradle"));
  return buildGradle?.match(/kotlinVersion\s*=\s*["']([^"']+)["']/)?.[1];
}

async function readAndroidSdkVersions(root: string): Promise<ToolchainContext["androidSdk"] | undefined> {
  const buildGradle = await readTextIfExists(path.join(root, "android", "build.gradle"));
  if (!buildGradle) return undefined;
  const compileSdk = buildGradle.match(/compileSdkVersion\s*=?\s*(\d+)/)?.[1];
  const targetSdk = buildGradle.match(/targetSdkVersion\s*=?\s*(\d+)/)?.[1];
  const minSdk = buildGradle.match(/minSdkVersion\s*=?\s*(\d+)/)?.[1];
  if (!compileSdk && !targetSdk && !minSdk) return undefined;
  return {
    ...(compileSdk ? { compileSdk } : {}),
    ...(targetSdk ? { targetSdk } : {}),
    ...(minSdk ? { minSdk } : {})
  };
}

async function isLockfileFresh(root: string, lockfilePath: string): Promise<boolean | undefined> {
  try {
    const [packageJsonStat, lockfileStat] = await Promise.all([
      stat(path.join(root, "package.json")),
      stat(lockfilePath)
    ]);
    return lockfileStat.mtimeMs >= packageJsonStat.mtimeMs;
  } catch {
    return undefined;
  }
}

async function lockfilePathFor(
  root: string,
  packageManager: PackageManagerName
): Promise<{ absolute: string; relative: string } | undefined> {
  if (packageManager === "npm") return findLockfile(root, ["package-lock.json"]);
  if (packageManager === "yarn") return findLockfile(root, ["yarn.lock"]);
  if (packageManager === "pnpm") return findLockfile(root, ["pnpm-lock.yaml"]);
  if (packageManager === "bun") return findLockfile(root, ["bun.lock", "bun.lockb"]);
  return undefined;
}

async function findLockfile(
  root: string,
  fileNames: string[]
): Promise<{ absolute: string; relative: string } | undefined> {
  let current = path.resolve(root);
  while (true) {
    for (const fileName of fileNames) {
      const absolute = path.join(current, fileName);
      if (await exists(absolute)) {
        return {
          absolute,
          relative: path.relative(root, absolute) || fileName
        };
      }
    }

    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function countLockfilePackages(raw: string, lockfileName: string): number {
  if (lockfileName === "pnpm-lock.yaml") {
    return raw.split("\n").filter(line => /^\s{2}\/[^:]+:/.test(line)).length;
  }
  if (lockfileName === "yarn.lock") {
    return raw.split("\n").filter(line => /^[^#\s][^:]+:/.test(line)).length;
  }
  return 0;
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  const raw = await readTextIfExists(filePath);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    throw error;
  }
}

async function findUp(start: string, fileName: string): Promise<string | undefined> {
  let current = path.resolve(start);
  while (true) {
    if (await exists(path.join(current, fileName))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function redactProjectProfile(profile: ProjectProfile): ProjectProfile {
  return {
    ...profile,
    root: "<redacted>",
    ...(profile.workspace
      ? {
          workspace: {
            ...profile.workspace,
            root: "<redacted>"
          }
        }
      : {})
  };
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
  NativeGuardEnvironmentReport,
  NativeGuardLockfile,
  PackageManagerName,
  ProjectKind,
  ProjectProfile,
  ToolchainContext
};
