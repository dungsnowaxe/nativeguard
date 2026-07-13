import test from "node:test";
import assert from "node:assert/strict";
import {
  PR_REVIEW_SCHEMA_VERSION,
  type PrReviewReport
} from "@nativeguard/schema";
import { renderPrReviewComment } from "./index.js";

test("renders a PR review comment", () => {
  const report: PrReviewReport = {
    schemaVersion: PR_REVIEW_SCHEMA_VERSION,
    generatedAt: "2026-07-11T00:00:00.000Z",
    status: "yellow",
    project: {
      root: "/repo",
      kind: "expo-prebuild",
      packageManager: "pnpm",
      expoVersion: "54.0.0",
      reactNativeVersion: "0.81.0",
      hasIosProject: true,
      hasAndroidProject: true
    },
    changedPackages: [
      {
        packageName: "react-native-svg",
        installedVersion: "15.11.2",
        direct: true,
        dependencyPath: ["react-native-svg"],
        packageManager: "pnpm",
        classification: "native-module",
        patched: false,
        overridden: false,
        peerDependencyMismatches: [],
        matchingRuleIds: ["react-native-svg-expo-54-android-fabric-regression"]
      }
    ],
    newRisks: [],
    knownExceptions: [],
    staleExceptions: [],
    requiredActions: [
      {
        type: "exclude",
        packageName: "react-native-svg",
        note: "Add expo.install.exclude for intentional off-matrix version."
      }
    ],
    verificationChecklist: ["android-release-build"],
    evidence: []
  };

  const comment = renderPrReviewComment(report, {
    repository: "example/app",
    baseRef: "main",
    headRef: "renovate/react-native-svg"
  });

  assert.match(comment, /NativeGuard Stability Check/);
  assert.match(comment, /Status: \*\*YELLOW\*\*/);
  assert.match(comment, /react-native-svg@15\.11\.2/);
  assert.match(comment, /android-release-build/);
});
