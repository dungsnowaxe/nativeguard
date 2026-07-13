import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG_SCHEMA_VERSION,
  LOCKFILE_SCHEMA_VERSION,
  PR_REVIEW_SCHEMA_VERSION,
  RULE_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  validateCompatibilityRule,
  validateCompatibilityRuleV1,
  validateDoctorReport,
  validateLockfile,
  validateNativeGuardConfig,
  validateNativeGuardEnvironmentReport,
  validateNativeGuardReportV1,
  validateNativeGuardSnapshot,
  validatePrReviewReport
} from "./index.js";

test("validates compatibility rules", () => {
  const result = validateCompatibilityRule({
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "expo-sdk-54-react-native-svg",
    packageName: "react-native-svg",
    affectedRange: "15.8.0 - 15.10.x",
    context: { projectKinds: ["expo-prebuild"], expoSdk: ["54"] },
    outcome: "accepted-exception",
    confidence: "medium",
    summary: "Use a safe off-matrix version for Android rendering fixes.",
    evidence: [{ type: "manual", summary: "Curated seed record.", confidence: "medium" }],
    remediation: [{ type: "exclude", packageName: "react-native-svg", note: "Add expo.install.exclude." }]
  });

  assert.equal(result.valid, true);
});

test("rejects invalid rules", () => {
  const result = validateCompatibilityRule({ id: "missing-fields" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("validates v1 compatibility rules", () => {
  const result = validateCompatibilityRuleV1({
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "react-native-svg-expo-54-android-fabric-regression",
    packageName: "react-native-svg",
    affectedVersions: ">=15.8.0 <15.11.2",
    contexts: { projectKinds: ["expo-prebuild"], expoSdk: ["54"], platforms: ["android"] },
    severity: "warning",
    status: "yellow",
    lifecycle: "trusted",
    confidence: "medium",
    symptoms: ["Android rendering regression"],
    recommendedActions: [{ type: "bump", packageName: "react-native-svg", to: "15.11.2", note: "Use fixed version." }],
    requiredVerification: ["android-release-build"],
    evidence: [{ type: "manual", summary: "Curated seed record.", confidence: "medium" }],
    owner: "nativeguard-maintainers",
    createdAt: "2026-07-11",
    reviewAfter: "2026-10-11"
  });

  assert.equal(result.valid, true);
});

test("validates nativeguard config", () => {
  const result = validateNativeGuardConfig({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    rules: { source: "@nativeguard/rules", version: "2026.07.11" },
    ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
    exceptions: [],
    redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
  });

  assert.equal(result.valid, true);
});

test("validates report shape", () => {
  const result = validateDoctorReport({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    nativeguard: {},
    project: {},
    dependencySnapshot: {},
    summary: {},
    packageIssues: [],
    findings: [],
    nextActions: []
  });

  assert.equal(result.valid, true);
});

test("validates v1 report shape", () => {
  const result = validateNativeGuardReportV1({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    nativeguard: { cliVersion: "0.0.0", rulesPackage: { name: "@nativeguard/rules", version: "0.0.0" } },
    project: {},
    toolchain: { packageManager: "npm", missingContext: [] },
    summary: { status: "green", findingCounts: { info: 0, warning: 0, error: 0 }, unknownCount: 0, staleExceptionCount: 0 },
    dependencyNodes: [],
    findings: [],
    unknowns: [],
    exceptions: [],
    staleExceptions: [],
    recommendedActions: [],
    requiredVerification: [],
    exitDecision: { exitCode: 0, reason: "No blocking findings." },
    redaction: { applied: false, hiddenFields: [] }
  });

  assert.equal(result.valid, true);
});

test("validates lockfile shape", () => {
  const result = validateLockfile({
    schemaVersion: LOCKFILE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    nativeguard: {},
    project: {},
    packageManager: "npm",
    dependencySnapshot: {},
    summary: {},
    acceptedExceptions: []
  });

  assert.equal(result.valid, true);
});

test("validates snapshot shape", () => {
  const result = validateNativeGuardSnapshot({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    nativeguard: { cliVersion: "0.0.0", rulesPackage: { name: "@nativeguard/rules", version: "0.0.0" } },
    project: {},
    toolchain: { packageManager: "npm", missingContext: [] },
    dependencyGraphFingerprint: "graph",
    projectContextFingerprint: "context",
    rulePackVersion: "0.0.0",
    dependencyNodes: [],
    exceptions: [],
    redaction: { applied: false, hiddenFields: [] }
  });

  assert.equal(result.valid, true);
});

test("validates environment report shape", () => {
  const result = validateNativeGuardEnvironmentReport({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    nativeguard: { cliVersion: "0.0.0" },
    project: {},
    toolchain: { packageManager: "npm", missingContext: [] },
    redaction: { applied: true, hiddenFields: ["project.root"] }
  });

  assert.equal(result.valid, true);
});

test("validates PR review report shape", () => {
  const result = validatePrReviewReport({
    schemaVersion: PR_REVIEW_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    status: "green",
    project: {},
    changedPackages: [],
    newRisks: [],
    knownExceptions: [],
    staleExceptions: [],
    requiredActions: [],
    verificationChecklist: [],
    evidence: []
  });

  assert.equal(result.valid, true);
});
