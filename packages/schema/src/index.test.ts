import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCKFILE_SCHEMA_VERSION,
  RULE_SCHEMA_VERSION,
  validateCompatibilityRule,
  validateDoctorReport,
  validateLockfile
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
    nextActions: []
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
