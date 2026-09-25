export const DOCTOR_REPORT_SCHEMA_VERSION = "1.0.0";
export const CONFIG_SCHEMA_VERSION = "1.0.0";
export const LOCKFILE_SCHEMA_VERSION = "1.0.0";
export const SNAPSHOT_SCHEMA_VERSION = "1.0.0";
export const PR_REVIEW_SCHEMA_VERSION = "1.0.0";
export const RULE_SCHEMA_VERSION = "1.0.0";

export const PROJECT_KINDS = ["expo-managed", "expo-prebuild", "bare-react-native", "expo-go"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type PackageManagerName = "npm" | "yarn" | "pnpm" | "bun" | "unknown";
export type FindingSeverity = "info" | "warning" | "error";
export const STABILITY_STATUSES = ["stable", "accepted-exception", "risky", "unsupported"] as const;
export type StabilityStatus = (typeof STABILITY_STATUSES)[number];
export const RECOMMENDATION_ACTIONS = ["bump", "pin", "leave", "exclude"] as const;
export type RecommendationAction = (typeof RECOMMENDATION_ACTIONS)[number];
export const RECOMMENDATION_SURFACES = ["eas", "local-native", "runtime"] as const;
export type RecommendationSurface = (typeof RECOMMENDATION_SURFACES)[number];
export type CanonicalStatus = "green" | "blue" | "yellow" | "red" | "unknown";
export type PolicyStatus = CanonicalStatus | "stale-exception";
export type Confidence = "low" | "medium" | "high";
export type RuleLifecycleStatus = "proposed" | "reproduced" | "trusted" | "stale" | "retired";
export type NativePackageClassification =
  | "js-only"
  | "expo-module"
  | "native-module"
  | "config-plugin"
  | "autolinked-native-package"
  | "unknown"
  | "private"
  | "abandoned"
  | "deprecated";
export type RecommendedActionType =
  | "bump"
  | "pin"
  | "downgrade"
  | "exclude"
  | "override"
  | "resolution"
  | "package-extension"
  | "config-change"
  | "patch"
  | "replacement"
  | "manual-verification";
export type VerificationType =
  | "typescript"
  | "expo-doctor"
  | "pod-install"
  | "gradle-sync"
  | "ios-build"
  | "android-build"
  | "android-release-build"
  | "visual-smoke-test"
  | "manual";

export interface ProjectProfile {
  root: string;
  kind: ProjectKind;
  packageManager: PackageManagerName;
  packageManagerVersion?: string;
  expoVersion?: string;
  expoSdkMajor?: string;
  reactNativeVersion?: string;
  newArchitectureEnabled?: boolean;
  hasIosProject: boolean;
  hasAndroidProject: boolean;
  hasGeneratedNativeProjects?: boolean;
  hasExpoRouter?: boolean;
  hasExpoModules?: boolean;
  expoModulesPackages?: string[];
  newArchitecture?: {
    enabled?: boolean;
    sources: string[];
  };
  workspace?: {
    root: string;
    type: "npm" | "pnpm" | "yarn" | "unknown";
    isWorkspaceRoot: boolean;
  };
  lockfileState?: {
    path?: string;
    present: boolean;
    fresh?: boolean;
  };
  detectionConfidence?: Confidence;
}

export interface ToolchainContext {
  packageManager: PackageManagerName;
  nodeVersion?: string;
  packageManagerVersion?: string;
  expoCliVersion?: string;
  cocoaPodsVersion?: string;
  xcodeVersion?: string;
  gradleVersion?: string;
  androidGradlePluginVersion?: string;
  kotlinVersion?: string;
  androidSdk?: {
    minSdk?: string;
    targetSdk?: string;
    compileSdk?: string;
  };
  easProfile?: {
    name: string;
    platform?: "ios" | "android" | "all";
  };
  missingContext: string[];
}

export interface NativeGuardEnvironmentReport {
  schemaVersion: typeof DOCTOR_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  nativeguard: {
    cliVersion: string;
  };
  project: ProjectProfile;
  toolchain: ToolchainContext;
  redaction: {
    applied: boolean;
    hiddenFields: string[];
  };
}

export interface NativeGuardConfig {
  schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  rules: {
    source: string;
    version?: string;
  };
  ci: {
    failOn: PolicyStatus[];
    warnOn: PolicyStatus[];
  };
  exceptions: LocalException[];
  redaction: {
    hidePrivateScopes: boolean;
    hideAbsolutePaths: boolean;
    hiddenPackageScopes?: string[];
  };
}

export interface LocalException {
  packageName: string;
  allowedVersions: string;
  reason: string;
  owner: string;
  expiresAt: string;
  requiredVerification: VerificationType[];
  ruleId?: string;
}

export interface DependencySnapshot {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  resolvedVersions?: Record<string, string>;
  unresolvedSpecifiers?: Record<string, string>;
  lockfile?: {
    path: string;
    lockfileVersion?: number;
    packageCount: number;
    fresh?: boolean;
  };
}

export interface EvidenceRecord {
  type: "docs" | "github_issue" | "release_note" | "package_metadata" | "manual";
  url?: string;
  summary: string;
  confidence: Confidence;
}

export interface RuleContext {
  projectKinds: ProjectKind[];
  expoSdk?: string[];
  reactNative?: string[];
  packageManagers?: PackageManagerName[];
  platforms?: Array<"ios" | "android" | "web">;
  newArchitecture?: boolean;
}

export interface RecommendedAction {
  type: RecommendedActionType;
  packageName?: string;
  to?: string;
  note: string;
  requiresApproval?: boolean;
}

export interface RemediationAction {
  type: RecommendationAction | "patch" | "manual-check";
  packageName?: string;
  to?: string;
  note: string;
  surfaces?: RecommendationSurface[];
}

export interface Recommendation {
  action: RecommendationAction;
  packageName: string;
  evidence: EvidenceRecord[];
  surfaces: RecommendationSurface[];
  from?: string;
  to?: string;
  note?: string;
  ruleId?: string;
}

export interface CompatibilityIssueMetadata {
  reason: string;
  fixedVersion?: string;
  patchedVersion?: string;
  patchFile?: string;
}

export interface CompatibilityRule {
  schemaVersion: typeof RULE_SCHEMA_VERSION;
  id: string;
  packageName: string;
  affectedRange: string;
  context: {
    projectKinds: ProjectKind[];
    expoSdk?: string[];
    reactNative?: string[];
    packageManagers?: PackageManagerName[];
    newArchitecture?: boolean;
    requiresPackages?: string[];
  };
  unless?: {
    packageName?: string;
    range: string;
  };
  outcome: StabilityStatus;
  confidence: Confidence;
  summary: string;
  issue?: CompatibilityIssueMetadata;
  evidence: EvidenceRecord[];
  remediation: RemediationAction[];
  surfaces?: RecommendationSurface[];
}

export interface CompatibilityRuleV1 {
  schemaVersion: typeof RULE_SCHEMA_VERSION;
  id: string;
  packageName: string;
  affectedVersions: string;
  contexts: RuleContext;
  severity: FindingSeverity;
  status: CanonicalStatus;
  lifecycle: RuleLifecycleStatus;
  confidence: Confidence;
  symptoms: string[];
  recommendedActions: RecommendedAction[];
  requiredVerification: VerificationType[];
  evidence: EvidenceRecord[];
  owner: string;
  createdAt: string;
  reviewAfter: string;
  safeVersions?: string[];
  unsafeVersions?: string[];
  replacementPackages?: string[];
  notes?: string;
}

export interface DependencyGraphNode {
  packageName: string;
  installedVersion: string;
  declaredRange?: string;
  direct: boolean;
  dependencyPath: string[];
  lockfileSource?: string;
  packageManager: PackageManagerName;
  classification: NativePackageClassification;
  patched: boolean;
  overridden: boolean;
  peerDependencyMismatches: string[];
  matchingRuleIds: string[];
}

export interface DuplicateDependency {
  packageName: string;
  versions: string[];
}

export interface DependencyGraph {
  nodes: DependencyGraphNode[];
  duplicates: DuplicateDependency[];
  duplicateReact: DuplicateDependency[];
  duplicateReactNative: DuplicateDependency[];
  patchedPackages: string[];
  overrides: Record<string, string>;
  resolutions: Record<string, string>;
  packageExtensions: Record<string, unknown>;
}

export interface NativeGuardSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  nativeguard: {
    cliVersion: string;
    rulesPackage: {
      name: string;
      version: string;
    };
  };
  project: ProjectProfile;
  toolchain: ToolchainContext;
  dependencyGraphFingerprint: string;
  projectContextFingerprint: string;
  rulePackVersion: string;
  dependencyNodes: DependencyGraphNode[];
  exceptions: LocalException[];
  redaction: {
    applied: boolean;
    hiddenFields: string[];
  };
}

export interface DependencyGraphChange {
  packageName: string;
  changeType: "added" | "removed" | "changed";
  beforeVersion?: string;
  afterVersion?: string;
  direct: boolean;
}

export interface SnapshotComparison {
  baseGeneratedAt: string;
  headGeneratedAt: string;
  changedPackages: DependencyGraphChange[];
  addedPackages: DependencyGraphChange[];
  removedPackages: DependencyGraphChange[];
  changedPackageVersions: DependencyGraphChange[];
  newDuplicateReact: DuplicateDependency[];
  newDuplicateReactNative: DuplicateDependency[];
}

export interface PackageExplanation {
  packageName: string;
  queryVersion?: string;
  project: ProjectProfile;
  nodes: DependencyGraphNode[];
  declaredRange?: string;
  installedVersions: string[];
  direct: boolean;
  classification: NativePackageClassification | "not-installed";
  status: StabilityStatus | "unknown";
  findings: Finding[];
  matchingRules: CompatibilityRule[];
  activeExceptions: LocalException[];
  staleExceptions: LocalException[];
  recommendedActions: RemediationAction[];
  evidence: EvidenceRecord[];
  unknownReason?: string;
}

export interface NativeGuardFindingV1 {
  id: string;
  packageName?: string;
  ruleId?: string;
  severity: FindingSeverity;
  status: CanonicalStatus;
  title: string;
  detail: string;
  affectedContext: RuleContext;
  confidence: Confidence;
  evidence: EvidenceRecord[];
  recommendedActions: RecommendedAction[];
  requiredVerification: VerificationType[];
}

export interface NativeGuardReportV1 {
  schemaVersion: typeof DOCTOR_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  nativeguard: {
    cliVersion: string;
    rulesPackage: {
      name: string;
      version: string;
    };
  };
  project: ProjectProfile;
  toolchain: ToolchainContext;
  summary: {
    status: CanonicalStatus;
    findingCounts: Record<FindingSeverity, number>;
    unknownCount: number;
    staleExceptionCount: number;
  };
  dependencyNodes: DependencyGraphNode[];
  findings: NativeGuardFindingV1[];
  unknowns: NativeGuardFindingV1[];
  exceptions: LocalException[];
  staleExceptions: LocalException[];
  recommendedActions: RecommendedAction[];
  requiredVerification: VerificationType[];
  exitDecision: {
    exitCode: 0 | 1 | 2 | 3 | 4 | 5;
    reason: string;
  };
  redaction: {
    applied: boolean;
    hiddenFields: string[];
  };
}

export interface PrReviewReport {
  schemaVersion: typeof PR_REVIEW_SCHEMA_VERSION;
  generatedAt: string;
  status: CanonicalStatus;
  project: ProjectProfile;
  changedPackages: DependencyGraphNode[];
  newRisks: NativeGuardFindingV1[];
  knownExceptions: LocalException[];
  staleExceptions: LocalException[];
  requiredActions: RecommendedAction[];
  verificationChecklist: VerificationType[];
  evidence: EvidenceRecord[];
}

export interface PackageIssue {
  packageName: string;
  installedVersion: string;
  affectedRange: string;
  status: StabilityStatus;
  severity: FindingSeverity;
  ruleId: string;
  reason: string;
  fixedVersion?: string;
  patchedVersion?: string;
  patchFile?: string;
  recommendation?: string;
  evidence: EvidenceRecord[];
  remediation: RemediationAction[];
}

export interface Finding {
  id: string;
  ruleId?: string;
  packageName?: string;
  severity: FindingSeverity;
  status: StabilityStatus;
  title: string;
  detail: string;
  confidence: Confidence;
  issue?: PackageIssue;
  evidence: EvidenceRecord[];
  remediation: RemediationAction[];
  surfaces?: RecommendationSurface[];
}

export interface DoctorReport {
  schemaVersion: typeof DOCTOR_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  nativeguard: {
    cliVersion: string;
    rulesPackage: {
      name: string;
      version: string;
    };
  };
  project: ProjectProfile;
  dependencySnapshot: DependencySnapshot;
  dependencyGraph?: DependencyGraph;
  summary: {
    status: StabilityStatus;
    findingCounts: Record<FindingSeverity, number>;
  };
  policy?: {
    ci: NativeGuardConfig["ci"];
    activeExceptions: LocalException[];
    staleExceptions: LocalException[];
    exitDecision: {
      exitCode: 0 | 1;
      reason: string;
    };
  };
  packageIssues: PackageIssue[];
  findings: Finding[];
  recommendations: Recommendation[];
  nextActions: string[];
  acceptedExceptions?: AcceptedException[];
}

export interface AcceptedException {
  packageName: string;
  version: string;
  reason: string;
  findingId?: string;
  ruleId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface NativeGuardLockfile {
  schemaVersion: typeof LOCKFILE_SCHEMA_VERSION;
  generatedAt: string;
  nativeguard: DoctorReport["nativeguard"];
  project: ProjectProfile;
  packageManager: PackageManagerName;
  dependencySnapshot: DependencySnapshot;
  summary: DoctorReport["summary"];
  recommendations?: Recommendation[];
  acceptedExceptions: AcceptedException[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCompatibilityRule(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["rule must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "id", errors);
  requireString(value, "packageName", errors);
  requireString(value, "affectedRange", errors);
  requireString(value, "outcome", errors);
  requireString(value, "confidence", errors);
  requireString(value, "summary", errors);

  if (!isRecord(value.context)) {
    errors.push("context must be an object");
  } else if (!Array.isArray(value.context.projectKinds)) {
    errors.push("context.projectKinds must be an array");
  }

  if (!Array.isArray(value.evidence)) {
    errors.push("evidence must be an array");
  }
  if (!Array.isArray(value.remediation)) {
    errors.push("remediation must be an array");
  }
  if (value.surfaces !== undefined && (!Array.isArray(value.surfaces) || !value.surfaces.every(isRecommendationSurface))) {
    errors.push(`surfaces must contain only ${RECOMMENDATION_SURFACES.join("|")}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateCompatibilityRuleV1(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["rule must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "id", errors);
  requireString(value, "packageName", errors);
  requireString(value, "affectedVersions", errors);
  requireString(value, "severity", errors);
  requireString(value, "status", errors);
  requireString(value, "lifecycle", errors);
  requireString(value, "confidence", errors);
  requireString(value, "owner", errors);
  requireString(value, "createdAt", errors);
  requireString(value, "reviewAfter", errors);

  if (!isRecord(value.contexts)) {
    errors.push("contexts must be an object");
  } else if (!Array.isArray(value.contexts.projectKinds)) {
    errors.push("contexts.projectKinds must be an array");
  }

  requireArray(value, "symptoms", errors);
  requireArray(value, "recommendedActions", errors);
  requireArray(value, "requiredVerification", errors);
  requireArray(value, "evidence", errors);

  return { valid: errors.length === 0, errors };
}

export function validateNativeGuardConfig(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["config must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  if (!isRecord(value.rules)) {
    errors.push("rules must be an object");
  } else {
    requireString(value.rules, "source", errors);
  }

  if (!isRecord(value.ci)) {
    errors.push("ci must be an object");
  } else {
    if (!Array.isArray(value.ci.failOn)) errors.push("ci.failOn must be an array");
    if (!Array.isArray(value.ci.warnOn)) errors.push("ci.warnOn must be an array");
  }

  requireArray(value, "exceptions", errors);

  if (!isRecord(value.redaction)) {
    errors.push("redaction must be an object");
  } else {
    requireBoolean(value.redaction, "hidePrivateScopes", errors);
    requireBoolean(value.redaction, "hideAbsolutePaths", errors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateDoctorReport(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["report must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "generatedAt", errors);
  if (!isRecord(value.nativeguard)) errors.push("nativeguard must be an object");
  if (!isRecord(value.project)) {
    errors.push("project must be an object");
  } else {
    if (!isProjectKind(value.project.kind)) {
      errors.push(`project.kind must be one of ${PROJECT_KINDS.join("|")}`);
    }
    requireString(value.project, "root", errors, "project.root");
  }
  if (!isRecord(value.dependencySnapshot)) errors.push("dependencySnapshot must be an object");
  if (!isRecord(value.summary)) {
    errors.push("summary must be an object");
  } else if (!isStabilityStatus(value.summary.status)) {
    errors.push(`summary.status must be one of ${STABILITY_STATUSES.join("|")}`);
  }
  if (!Array.isArray(value.packageIssues)) errors.push("packageIssues must be an array");
  if (!Array.isArray(value.findings)) errors.push("findings must be an array");
  if (!Array.isArray(value.recommendations)) {
    errors.push("recommendations must be an array");
  } else {
    value.recommendations.forEach((recommendation, index) => {
      validateRecommendation(recommendation, index, errors);
    });
  }
  if (!Array.isArray(value.nextActions)) errors.push("nextActions must be an array");
  if (value.acceptedExceptions !== undefined) {
    validateAcceptedExceptionEntries(value.acceptedExceptions, errors, "acceptedExceptions");
  }

  return { valid: errors.length === 0, errors };
}

export function validateRecommendation(
  value: unknown,
  index = 0,
  errors: string[] = []
): ValidationResult {
  if (!isRecord(value)) {
    errors.push(`recommendations[${index}] must be an object`);
    return { valid: false, errors };
  }

  if (!isRecommendationAction(value.action)) {
    errors.push(`recommendations[${index}].action must be one of ${RECOMMENDATION_ACTIONS.join("|")}`);
  }
  requireString(value, "packageName", errors, `recommendations[${index}].packageName`);
  if (!Array.isArray(value.evidence)) {
    errors.push(`recommendations[${index}].evidence must be an array`);
  }
  if (!Array.isArray(value.surfaces) || value.surfaces.length === 0) {
    errors.push(`recommendations[${index}].surfaces must be a non-empty array`);
  } else if (!value.surfaces.every(isRecommendationSurface)) {
    errors.push(
      `recommendations[${index}].surfaces must contain only ${RECOMMENDATION_SURFACES.join("|")}`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function isProjectKind(value: unknown): value is ProjectKind {
  return PROJECT_KINDS.some(kind => kind === value);
}

export function isStabilityStatus(value: unknown): value is StabilityStatus {
  return STABILITY_STATUSES.some(status => status === value);
}

export function isRecommendationAction(value: unknown): value is RecommendationAction {
  return RECOMMENDATION_ACTIONS.some(action => action === value);
}

export function isRecommendationSurface(value: unknown): value is RecommendationSurface {
  return RECOMMENDATION_SURFACES.some(surface => surface === value);
}

export function validateNativeGuardReportV1(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["report must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "generatedAt", errors);
  if (!isRecord(value.nativeguard)) errors.push("nativeguard must be an object");
  if (!isRecord(value.project)) errors.push("project must be an object");
  if (!isRecord(value.toolchain)) errors.push("toolchain must be an object");
  if (!isRecord(value.summary)) errors.push("summary must be an object");
  requireArray(value, "dependencyNodes", errors);
  requireArray(value, "findings", errors);
  requireArray(value, "unknowns", errors);
  requireArray(value, "exceptions", errors);
  requireArray(value, "staleExceptions", errors);
  requireArray(value, "recommendedActions", errors);
  requireArray(value, "requiredVerification", errors);
  if (!isRecord(value.exitDecision)) errors.push("exitDecision must be an object");
  if (!isRecord(value.redaction)) errors.push("redaction must be an object");

  return { valid: errors.length === 0, errors };
}

export function validateNativeGuardEnvironmentReport(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["environment report must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "generatedAt", errors);
  if (!isRecord(value.nativeguard)) errors.push("nativeguard must be an object");
  if (!isRecord(value.project)) errors.push("project must be an object");
  if (!isRecord(value.toolchain)) {
    errors.push("toolchain must be an object");
  } else {
    requireString(value.toolchain, "packageManager", errors);
    requireArray(value.toolchain, "missingContext", errors);
  }
  if (!isRecord(value.redaction)) errors.push("redaction must be an object");

  return { valid: errors.length === 0, errors };
}

export function validateLockfile(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["lockfile must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "generatedAt", errors);
  if (!isRecord(value.nativeguard)) errors.push("nativeguard must be an object");
  if (!isRecord(value.project)) errors.push("project must be an object");
  if (!isRecord(value.dependencySnapshot)) errors.push("dependencySnapshot must be an object");
  if (!isRecord(value.summary)) errors.push("summary must be an object");
  if (value.acceptedExceptions === undefined) {
    errors.push("acceptedExceptions must be an array");
  } else {
    validateAcceptedExceptionEntries(value.acceptedExceptions, errors, "acceptedExceptions");
  }
  if (value.recommendations !== undefined && !Array.isArray(value.recommendations)) {
    errors.push("recommendations must be an array");
  }

  return { valid: errors.length === 0, errors };
}

function validateAcceptedExceptionEntries(value: unknown, errors: string[], label: string): void {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${label}[${index}] must be an object`);
      return;
    }
    requireString(entry, "packageName", errors, `${label}[${index}].packageName`);
    requireString(entry, "version", errors, `${label}[${index}].version`);
    if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
      errors.push(`${label}[${index}].reason must be a non-empty string`);
    }
  });
}

export function validateNativeGuardSnapshot(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["snapshot must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "generatedAt", errors);
  if (!isRecord(value.nativeguard)) errors.push("nativeguard must be an object");
  if (!isRecord(value.project)) errors.push("project must be an object");
  if (!isRecord(value.toolchain)) errors.push("toolchain must be an object");
  requireString(value, "dependencyGraphFingerprint", errors);
  requireString(value, "projectContextFingerprint", errors);
  requireString(value, "rulePackVersion", errors);
  requireArray(value, "dependencyNodes", errors);
  requireArray(value, "exceptions", errors);
  if (!isRecord(value.redaction)) errors.push("redaction must be an object");

  return { valid: errors.length === 0, errors };
}

export function validatePrReviewReport(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["pr review report must be an object"] };
  }

  requireString(value, "schemaVersion", errors);
  requireString(value, "generatedAt", errors);
  requireString(value, "status", errors);
  if (!isRecord(value.project)) errors.push("project must be an object");
  requireArray(value, "changedPackages", errors);
  requireArray(value, "newRisks", errors);
  requireArray(value, "knownExceptions", errors);
  requireArray(value, "staleExceptions", errors);
  requireArray(value, "requiredActions", errors);
  requireArray(value, "verificationChecklist", errors);
  requireArray(value, "evidence", errors);

  return { valid: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
  label = key
): void {
  if (typeof value[key] !== "string" || value[key].length === 0) {
    errors.push(`${label} must be a non-empty string`);
  }
}

function requireBoolean(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (typeof value[key] !== "boolean") {
    errors.push(`${key} must be a boolean`);
  }
}

function requireArray(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (!Array.isArray(value[key])) {
    errors.push(`${key} must be an array`);
  }
}
