import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { RECOMMENDATION_ACTIONS, RECOMMENDATION_SURFACES, validateDoctorReport } from "@nativeguard/schema";
import {
  analyzeProject,
  readNativeGuardLockfile,
  writeNativeGuardLockfile
} from "./index.js";

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

const curatedRuleFixtures = [
  {
    dir: "sdk54-reanimated-worklets",
    ruleId: "sdk54-reanimated-requires-worklets-0.5.1",
    action: "bump"
  },
  {
    dir: "sdk53-ban-reanimated-4",
    ruleId: "sdk53-ban-reanimated-4",
    action: "pin"
  },
  {
    dir: "sdk54-legacy-arch-reanimated",
    ruleId: "sdk54-legacy-arch-reanimated-v3",
    action: "pin"
  },
  {
    dir: "sdk53-pager-view",
    ruleId: "pager-view-min-6.7.1-on-rn-079",
    action: "bump"
  },
  {
    dir: "sentry-expo-sdk54",
    ruleId: "ban-sentry-expo-on-sdk-ge-50",
    action: "exclude"
  },
  {
    dir: "flash-list-v2-legacy-arch",
    ruleId: "flash-list-v2-requires-new-arch",
    action: "pin"
  },
  {
    dir: "sdk54-screens-expo-go",
    ruleId: "sdk54-pin-screens-tilde-4.16",
    action: "pin"
  },
  {
    dir: "sdk54-nativewind-rngh",
    ruleId: "nativewind-min-4.2.1-with-rngh-sdk54",
    action: "bump"
  }
] as const;

test("wedge: doctor JSON freezes recommendations[] action, evidence, and surfaces", async () => {
  const report = await analyzeProject({
    rootDir: path.join(fixturesRoot, "sentry-expo-sdk54"),
    cliVersion: "0.0.0"
  });
  const validation = validateDoctorReport(report);
  assert.equal(validation.valid, true, validation.errors.join(", "));
  assert.ok(report.recommendations.length > 0);
  for (const recommendation of report.recommendations) {
    assert.equal(RECOMMENDATION_ACTIONS.includes(recommendation.action), true);
    assert.ok(Array.isArray(recommendation.evidence));
    assert.ok(recommendation.evidence.length > 0);
    assert.ok(recommendation.surfaces.length > 0);
    assert.ok(recommendation.surfaces.every(surface => RECOMMENDATION_SURFACES.includes(surface)));
  }
});

test("wedge: --sdk filters Expo-major-scoped rules", async () => {
  const root = path.join(fixturesRoot, "sdk53-pager-view");
  const sdk53 = await analyzeProject({ rootDir: root, cliVersion: "0.0.0", sdk: "53" });
  const sdk54 = await analyzeProject({ rootDir: root, cliVersion: "0.0.0", sdk: "54" });
  assert.equal(sdk53.project.expoSdkMajor, "53");
  assert.ok(sdk53.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  assert.equal(sdk54.project.expoSdkMajor, "54");
  assert.equal(
    sdk54.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
    false
  );
});

test("wedge: rules match npm lockfile-resolved versions, not declared ranges", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-wedge-lock-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: {
        expo: "~53.0.0",
        "react-native": "0.79.5",
        "react-native-pager-view": "^6.0.0"
      }
    })
  );
  await writeFile(
    path.join(root, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": {
          dependencies: {
            expo: "~53.0.0",
            "react-native": "0.79.5",
            "react-native-pager-view": "^6.0.0"
          }
        },
        "node_modules/expo": { version: "53.0.20" },
        "node_modules/react-native": { version: "0.79.5" },
        "node_modules/react-native-pager-view": { version: "6.6.0" }
      }
    })
  );
  await mkdir(path.join(root, "ios"));
  await mkdir(path.join(root, "android"));

  const report = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "^6.0.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.6.0");
  assert.equal(
    report.packageIssues.find(issue => issue.packageName === "react-native-pager-view")?.installedVersion,
    "6.6.0"
  );
});

test("wedge: bare React Native is unsupported, not stable", async () => {
  const report = await analyzeProject({
    rootDir: path.join(fixturesRoot, "bare-react-native"),
    cliVersion: "0.0.0"
  });
  assert.equal(report.project.kind, "bare-react-native");
  assert.equal(report.summary.status, "unsupported");
  assert.notEqual(report.summary.status, "stable");
  assert.deepEqual(report.recommendations, []);
});

for (const fixture of curatedRuleFixtures) {
  test(`wedge: ${fixture.dir} fires ${fixture.ruleId} as ${fixture.action}`, async () => {
    const report = await analyzeProject({
      rootDir: path.join(fixturesRoot, fixture.dir),
      cliVersion: "0.0.0"
    });
    const matched = report.recommendations.filter(recommendation => recommendation.ruleId === fixture.ruleId);
    assert.ok(matched.length > 0);
    assert.ok(matched.some(recommendation => recommendation.action === fixture.action));
    assert.ok(matched.every(recommendation => Array.isArray(recommendation.evidence)));
    assert.ok(matched.every(recommendation => recommendation.surfaces.length > 0));
  });
}

test("wedge: leave/exclude acceptedExceptions round-trip without re-erroring", async () => {
  const root = await copyFixture("sentry-expo-sdk54");
  const risky = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(risky.summary.status, "risky");
  assert.equal(risky.findings[0]?.status, "risky");
  assert.ok(risky.recommendations.some(recommendation => recommendation.action === "exclude"));

  await writeNativeGuardLockfile(risky, root);
  const snapshot = await readNativeGuardLockfile(root);
  assert.ok(snapshot);
  snapshot.acceptedExceptions = [
    {
      packageName: "sentry-expo",
      version: "7.2.0",
      reason: "Migration to @sentry/react-native is scheduled; keep sentry-expo until then.",
      ruleId: "ban-sentry-expo-on-sdk-ge-50"
    }
  ];
  await writeFile(path.join(root, "nativeguard-lock.json"), `${JSON.stringify(snapshot, null, 2)}\n`);

  const accepted = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(accepted.summary.status, "accepted-exception");
  assert.notEqual(accepted.summary.status, "risky");
  assert.equal(accepted.findings[0]?.status, "accepted-exception");
  assert.equal(accepted.findings[0]?.severity, "warning");
  assert.equal(accepted.packageIssues[0]?.status, "accepted-exception");
  assert.deepEqual(accepted.acceptedExceptions, snapshot.acceptedExceptions);

  await writeNativeGuardLockfile(accepted, root);
  const preserved = await readNativeGuardLockfile(root);
  assert.equal(preserved?.acceptedExceptions.length, 1);
  assert.equal(preserved?.acceptedExceptions[0]?.packageName, "sentry-expo");
});

test("wedge: acceptedExceptions do not silence pin/bump findings", async () => {
  const root = await copyFixture("sdk53-pager-view");
  const risky = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  await writeNativeGuardLockfile(risky, root);
  const snapshot = await readNativeGuardLockfile(root);
  assert.ok(snapshot);
  snapshot.acceptedExceptions = [
    {
      packageName: "react-native-pager-view",
      version: "6.6.0",
      reason: "Trying to accept a bump finding should not hide it.",
      ruleId: "pager-view-min-6.7.1-on-rn-079"
    }
  ];
  await writeFile(path.join(root, "nativeguard-lock.json"), `${JSON.stringify(snapshot, null, 2)}\n`);

  const stillRisky = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(stillRisky.summary.status, "risky");
  assert.equal(stillRisky.findings[0]?.status, "risky");
});

async function copyFixture(dir: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `nativeguard-wedge-${dir}-`));
  await cp(path.join(fixturesRoot, dir), root, { recursive: true });
  return root;
}
