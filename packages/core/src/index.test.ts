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
  parseExpoSdkMajor,
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
  assert.equal(report.project.expoSdkMajor, "54");
  assert.equal(report.schemaVersion, "1.0.0");
  assert.ok(Array.isArray(report.findings));
  assert.ok(Array.isArray(report.recommendations));

  const lockfilePath = await writeNativeGuardLockfile(report, root);
  assert.equal(path.basename(lockfilePath), "nativeguard-lock.json");

  const lockfile = await readNativeGuardLockfile(root);
  assert.equal(lockfile?.schemaVersion, "1.0.0");
  assert.ok(Array.isArray(lockfile?.recommendations));
});

test("analyzes the Expo prebuild smoke fixture without retired seed rules", async () => {
  const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/expo-prebuild");
  const report = await analyzeProject({
    rootDir: fixtureRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-09T00:00:00.000Z")
  });

  assert.equal(report.project.kind, "expo-prebuild");
  assert.equal(report.project.expoVersion, "54.0.33");
  assert.equal(report.project.expoSdkMajor, "54");
  assert.equal(report.project.reactNativeVersion, "0.81.5");
  assert.equal(report.dependencySnapshot.lockfile?.packageCount, 8);
  assert.equal(report.dependencySnapshot.dependencies["react-native-svg"], "15.10.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-svg"], "15.10.0");
  assert.equal(report.dependencySnapshot.dependencies.uniwind, undefined);
  assert.deepEqual(report.packageIssues, []);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.recommendations, []);
  assert.equal(report.summary.status, "stable");
});

test("parses Expo SDK major from project versions and --sdk overrides", () => {
  assert.equal(parseExpoSdkMajor("54.0.33"), "54");
  assert.equal(parseExpoSdkMajor("~54.0.0"), "54");
  assert.equal(parseExpoSdkMajor("^53.2.1"), "53");
  assert.equal(parseExpoSdkMajor("v52"), "52");
});

test("filters SDK-scoped rules by the current Expo major", async () => {
  const root = await fixture({
    dependencies: {
      expo: "53.0.20",
      "react-native": "0.79.5",
      "react-native-pager-view": "6.6.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const sdk53 = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    sdk: "53"
  });
  const sdk54 = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    sdk: "54"
  });

  assert.equal(sdk53.project.expoSdkMajor, "53");
  assert.ok(sdk53.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  assert.ok(sdk53.recommendations.some(recommendation => recommendation.packageName === "react-native-pager-view"));

  assert.equal(sdk54.project.expoSdkMajor, "54");
  assert.equal(
    sdk54.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
    false
  );
  assert.equal(
    sdk54.findings.some(finding => finding.ruleId === "legendapp-list-v2-react-native-api-migration"),
    false
  );
});

test("reports bare React Native as unsupported without analyzing or marking stable", async () => {
  const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/bare-react-native");
  const report = await analyzeProject({
    rootDir: fixtureRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-09T00:00:00.000Z")
  });

  assert.equal(report.project.kind, "bare-react-native");
  assert.equal(report.summary.status, "unsupported");
  assert.notEqual(report.summary.status, "stable");
  assert.deepEqual(report.packageIssues, []);
  assert.deepEqual(report.recommendations, []);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]?.status, "unsupported");
  assert.match(report.findings[0]?.detail ?? "", /skipped compatibility analysis/);
  assert.match(report.nextActions[0] ?? "", /not supported/);
});

test("matches rules against npm lockfile-resolved versions and keeps declared ranges", async () => {
  const root = await fixture({
    dependencies: {
      expo: "~53.0.0",
      "react-native": "0.79.5",
      "react-native-pager-view": "^6.0.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    resolvedVersions: {
      expo: "53.0.20",
      "react-native": "0.79.5",
      "react-native-pager-view": "6.6.0"
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0"
  });

  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "^6.0.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.6.0");
  assert.equal(report.project.expoSdkMajor, "53");
  assert.equal(
    report.packageIssues.find(issue => issue.packageName === "react-native-pager-view")?.installedVersion,
    "6.6.0"
  );
  assert.equal(
    report.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
    true
  );
});

test("does not match a declared range when the lockfile resolved version is outside the rule", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-screens": ">=4.20.0"
    },
    lockfile: "npm",
    resolvedVersions: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-screens": "4.16.0"
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0"
  });

  assert.equal(report.project.kind, "expo-go");
  assert.equal(report.dependencySnapshot.dependencies["react-native-screens"], ">=4.20.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-screens"], "4.16.0");
  assert.equal(
    report.findings.some(finding => finding.ruleId === "sdk54-pin-screens-tilde-4.16"),
    false
  );
});

async function fixture(options: {
  dependencies: Record<string, string>;
  directories?: string[];
  lockfile?: "npm" | "yarn" | "pnpm" | "bun";
  resolvedVersions?: Record<string, string>;
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
    const packages: Record<string, { version?: string } | { dependencies: Record<string, string> }> = {
      "": { dependencies: options.dependencies }
    };
    for (const [packageName, version] of Object.entries(options.resolvedVersions ?? {})) {
      packages[`node_modules/${packageName}`] = { version };
    }
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
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
