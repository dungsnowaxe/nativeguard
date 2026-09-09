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
  assert.ok(report.findings.length >= 1);
  assert.ok(Array.isArray(report.recommendations));

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
  assert.equal(report.project.expoSdkMajor, "54");
  assert.equal(report.project.reactNativeVersion, "0.81.5");
  assert.equal(report.dependencySnapshot.lockfile?.packageCount, 8);
  assert.equal(report.dependencySnapshot.dependencies["react-native-svg"], "15.10.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-svg"], "15.10.0");
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
  assert.deepEqual(
    report.recommendations.map(recommendation => ({
      action: recommendation.action,
      packageName: recommendation.packageName,
      to: recommendation.to,
      surfaces: recommendation.surfaces
    })),
    [
      {
        action: "leave",
        packageName: "react-native-svg",
        to: undefined,
        surfaces: ["eas", "local-native"]
      },
      {
        action: "exclude",
        packageName: "react-native-svg",
        to: undefined,
        surfaces: ["eas", "local-native"]
      },
      {
        action: "bump",
        packageName: "react-native-pager-view",
        to: "7.0.2",
        surfaces: ["eas", "local-native"]
      },
      {
        action: "pin",
        packageName: "@sentry/react-native",
        to: "7.13.x",
        surfaces: ["eas", "local-native"]
      },
      {
        action: "exclude",
        packageName: "@sentry/react-native",
        to: undefined,
        surfaces: ["eas", "local-native"]
      },
      {
        action: "pin",
        packageName: "react-native-screens",
        to: "4.19.x",
        surfaces: ["eas", "local-native"]
      },
      {
        action: "bump",
        packageName: "@legendapp/list",
        to: "3.0.6",
        surfaces: ["eas", "local-native"]
      }
    ]
  );
  assert.ok(report.recommendations.every(recommendation => Array.isArray(recommendation.evidence)));
  assert.ok(report.findings.length > 0);
  assert.ok(report.packageIssues.length > 0);
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
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-pager-view": "6.9.1",
      "@legendapp/list": "2.0.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const sdk54 = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    sdk: "54"
  });
  const sdk53 = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    sdk: "53"
  });

  assert.equal(sdk54.project.expoSdkMajor, "54");
  assert.ok(sdk54.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-pager-view-scroll-lock"));
  assert.ok(sdk54.recommendations.some(recommendation => recommendation.packageName === "react-native-pager-view"));

  assert.equal(sdk53.project.expoSdkMajor, "53");
  assert.equal(
    sdk53.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-pager-view-scroll-lock"),
    false
  );
  assert.ok(sdk53.findings.some(finding => finding.ruleId === "legendapp-list-v2-react-native-api-migration"));
  assert.ok(sdk53.recommendations.some(recommendation => recommendation.packageName === "@legendapp/list"));
});

test("matches rules against npm lockfile-resolved versions and keeps declared ranges", async () => {
  const root = await fixture({
    dependencies: {
      expo: "~54.0.0",
      "react-native": "0.81.5",
      "react-native-pager-view": "^6.0.0",
      "react-native-screens": "^4.19.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    resolvedVersions: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-pager-view": "6.9.1",
      "react-native-screens": "4.19.0"
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0"
  });

  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "^6.0.0");
  assert.equal(report.dependencySnapshot.dependencies["react-native-screens"], "^4.19.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.9.1");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-screens"], "4.19.0");
  assert.equal(report.project.expoSdkMajor, "54");
  assert.equal(
    report.packageIssues.find(issue => issue.packageName === "react-native-pager-view")?.installedVersion,
    "6.9.1"
  );
  assert.equal(
    report.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-screens-rn-082-floor"),
    false
  );
});

test("does not match a declared range when the lockfile resolved version is outside the rule", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-screens": ">=4.20.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    resolvedVersions: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-screens": "4.19.0"
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0"
  });

  assert.equal(report.dependencySnapshot.dependencies["react-native-screens"], ">=4.20.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-screens"], "4.19.0");
  assert.equal(
    report.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-screens-rn-082-floor"),
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
