import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import {
  analyzeProject,
  detectPackageManager,
  detectProjectProfile,
  readNativeGuardLockfile,
  writeNativeGuardLockfile
} from "./index.js";

test("detects Expo prebuild projects", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0", "react-native-svg": "15.11.2" },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const profile = await detectProjectProfile(root, {
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
  });

  assert.equal(profile.kind, "expo-prebuild");
  assert.equal(profile.packageManager, "npm");
});

test("detects bare React Native projects", async () => {
  const root = await fixture({
    dependencies: { "react-native": "0.81.0" },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const profile = await detectProjectProfile(root, {
    dependencies: { "react-native": "0.81.0" }
  });

  assert.equal(profile.kind, "bare-react-native");
});

test("detects Expo Go projects", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" },
    lockfile: "npm"
  });

  const profile = await detectProjectProfile(root, {
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
  });

  assert.equal(profile.kind, "expo-go");
});

test("detects non-npm package managers", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0" },
    lockfile: "yarn"
  });

  assert.equal(await detectPackageManager(root), "yarn");
});

test("analyzes project and writes lockfile", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0", "react-native-svg": "15.11.2" },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    now: new Date("2026-07-09T00:00:00.000Z")
  });

  assert.equal(report.project.kind, "expo-prebuild");
  assert.equal(report.schemaVersion, "1.0.0");
  assert.ok(report.findings.length >= 1);

  const lockfilePath = await writeNativeGuardLockfile(report, root);
  assert.equal(path.basename(lockfilePath), "nativeguard-lock.json");

  const lockfile = await readNativeGuardLockfile(root);
  assert.equal(lockfile?.schemaVersion, "1.0.0");
});

test("analyzes the Expo prebuild issue-version fixture", async () => {
  const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/expo-prebuild");
  const report = await analyzeProject({
    rootDir: fixtureRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-09T00:00:00.000Z")
  });

  assert.equal(report.project.kind, "expo-prebuild");
  assert.equal(report.project.expoVersion, "54.0.33");
  assert.equal(report.project.reactNativeVersion, "0.81.5");
  assert.equal(report.dependencySnapshot.lockfile?.packageCount, 8);
  assert.equal(report.dependencySnapshot.dependencies.uniwind, undefined);
  assert.deepEqual(
    report.packageIssues.map(issue => ({
      packageName: issue.packageName,
      installedVersion: issue.installedVersion,
      affectedRange: issue.affectedRange,
      fixedVersion: issue.fixedVersion
    })),
    [
      {
        packageName: "react-native-svg",
        installedVersion: "15.10.0",
        affectedRange: "15.8.0 - 15.10.x",
        fixedVersion: "15.11.2"
      },
      {
        packageName: "react-native-pager-view",
        installedVersion: "6.9.1",
        affectedRange: "<7.0.2",
        fixedVersion: "7.0.2"
      },
      {
        packageName: "@sentry/react-native",
        installedVersion: "7.2.0",
        affectedRange: "~7.2.0",
        fixedVersion: "7.13.x"
      },
      {
        packageName: "react-native-screens",
        installedVersion: "4.20.0",
        affectedRange: ">=4.20.0",
        fixedVersion: "4.19.x"
      },
      {
        packageName: "@legendapp/list",
        installedVersion: "2.0.0",
        affectedRange: "2.x",
        fixedVersion: "3.0.6"
      }
    ]
  );
  assert.match(report.packageIssues[0]?.reason ?? "", /off-matrix/);
  assert.equal(report.findings.find(finding => finding.ruleId === "expo-sdk-54-react-native-pager-view-scroll-lock")?.issue?.fixedVersion, "7.0.2");
  assert.deepEqual(
    report.findings.map(finding => finding.ruleId).sort(),
    [
      "expo-prebuild-new-architecture-manual-check",
      "expo-sdk-54-react-native-pager-view-scroll-lock",
      "expo-sdk-54-react-native-screens-rn-082-floor",
      "expo-sdk-54-react-native-svg-off-matrix",
      "expo-sdk-54-sentry-react-native-bundled-7-2",
      "legendapp-list-v2-react-native-api-migration"
    ].sort()
  );
  assert.equal(report.summary.status, "risky");
});

async function fixture(options: {
  dependencies: Record<string, string>;
  directories?: string[];
  lockfile?: "npm" | "yarn" | "pnpm" | "bun";
}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-fixture-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, dependencies: options.dependencies }, null, 2)
  );

  for (const directory of options.directories ?? []) {
    await mkdir(path.join(root, directory), { recursive: true });
  }

  if (options.lockfile === "npm") {
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  }
  if (options.lockfile === "yarn") {
    await writeFile(path.join(root, "yarn.lock"), "");
  }
  if (options.lockfile === "pnpm") {
    await writeFile(path.join(root, "pnpm-lock.yaml"), "");
  }
  if (options.lockfile === "bun") {
    await writeFile(path.join(root, "bun.lock"), "");
  }

  return root;
}
