import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCKFILE_SCHEMA_VERSION,
  RECOMMENDATION_ACTIONS,
  RECOMMENDATION_SURFACES,
  RULE_SCHEMA_VERSION,
  validateCompatibilityRule,
  validateDoctorReport,
  validateLockfile,
  validateRecommendation
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
    recommendations: [],
    nextActions: []
  });

  assert.equal(result.valid, true);
});

test("requires recommendations[] on doctor reports", () => {
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

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("recommendations")));
});

test("freezes recommendation action, evidence, and surfaces", () => {
  const result = validateRecommendation({
    action: "bump",
    packageName: "react-native-pager-view",
    evidence: [{ type: "github_issue", summary: "scrollEnabled applied too late", confidence: "high" }],
    surfaces: ["eas", "local-native"]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(RECOMMENDATION_ACTIONS, ["bump", "pin", "leave", "exclude"]);
  assert.deepEqual(RECOMMENDATION_SURFACES, ["eas", "local-native", "runtime"]);
});

test("rejects recommendation actions and surfaces outside the frozen contract", () => {
  const invalidAction = validateRecommendation({
    action: "patch",
    packageName: "react-native-reanimated",
    evidence: [],
    surfaces: ["eas"]
  });
  const invalidSurface = validateRecommendation({
    action: "leave",
    packageName: "react-native-svg",
    evidence: [],
    surfaces: ["ci"]
  });

  assert.equal(invalidAction.valid, false);
  assert.ok(invalidAction.errors.some(error => error.includes("bump|pin|leave|exclude")));
  assert.equal(invalidSurface.valid, false);
  assert.ok(invalidSurface.errors.some(error => error.includes("eas|local-native|runtime")));
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
    recommendations: [],
    acceptedExceptions: []
  });

  assert.equal(result.valid, true);
});

test("allows acceptedExceptions on doctor reports", () => {
  const result = validateDoctorReport({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    nativeguard: {},
    project: {},
    dependencySnapshot: {},
    summary: {},
    packageIssues: [],
    findings: [],
    recommendations: [],
    nextActions: [],
    acceptedExceptions: [
      {
        packageName: "sentry-expo",
        version: "7.2.0",
        reason: "Migration scheduled."
      }
    ]
  });

  assert.equal(result.valid, true);
});
