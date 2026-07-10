export const DOCTOR_REPORT_SCHEMA_VERSION = "1.0.0";
export const LOCKFILE_SCHEMA_VERSION = "1.0.0";
export const RULE_SCHEMA_VERSION = "1.0.0";

export type ProjectKind = "expo-prebuild" | "bare-react-native" | "expo-go";
export type PackageManagerName = "npm" | "yarn" | "pnpm" | "bun" | "unknown";
export type FindingSeverity = "info" | "warning" | "error";
export type StabilityStatus = "stable" | "accepted-exception" | "risky" | "unsupported";
export type Confidence = "low" | "medium" | "high";

export interface ProjectProfile {
  root: string;
  kind: ProjectKind;
  packageManager: PackageManagerName;
  packageManagerVersion?: string;
  expoVersion?: string;
  reactNativeVersion?: string;
  hasIosProject: boolean;
  hasAndroidProject: boolean;
}

export interface DependencySnapshot {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  lockfile?: {
    path: string;
    lockfileVersion?: number;
    packageCount: number;
  };
}

export interface EvidenceRecord {
  type: "docs" | "github_issue" | "release_note" | "package_metadata" | "manual";
  url?: string;
  summary: string;
  confidence: Confidence;
}

export interface RemediationAction {
  type: "bump" | "pin" | "exclude" | "patch" | "manual-check";
  packageName?: string;
  to?: string;
  note: string;
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
  };
  outcome: StabilityStatus;
  confidence: Confidence;
  summary: string;
  issue?: CompatibilityIssueMetadata;
  evidence: EvidenceRecord[];
  remediation: RemediationAction[];
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
  summary: {
    status: StabilityStatus;
    findingCounts: Record<FindingSeverity, number>;
  };
  packageIssues: PackageIssue[];
  findings: Finding[];
  nextActions: string[];
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
  if (!isRecord(value.project)) errors.push("project must be an object");
  if (!isRecord(value.dependencySnapshot)) errors.push("dependencySnapshot must be an object");
  if (!isRecord(value.summary)) errors.push("summary must be an object");
  if (!Array.isArray(value.packageIssues)) errors.push("packageIssues must be an array");
  if (!Array.isArray(value.findings)) errors.push("findings must be an array");
  if (!Array.isArray(value.nextActions)) errors.push("nextActions must be an array");

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
  if (!Array.isArray(value.acceptedExceptions)) errors.push("acceptedExceptions must be an array");

  return { valid: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (typeof value[key] !== "string" || value[key].length === 0) {
    errors.push(`${key} must be a non-empty string`);
  }
}
