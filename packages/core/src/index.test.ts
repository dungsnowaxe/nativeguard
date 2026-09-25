import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import {
  analyzeProject,
  collectToolchainContext,
  compareNativeGuardSnapshots,
  createDependencyGraph,
  createEnvironmentReport,
  createNativeGuardSnapshot,
  createPrReviewReportFromSnapshots,
  detectPackageManager,
  detectProjectProfile,
  explainPackage,
  loadNativeGuardConfig,
  readNativeGuardSnapshot,
  readNativeGuardLockfile,
  NativeGuardError,
  parseExpoSdkMajor,
  writeNativeGuardSnapshot,
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

test("detects Expo managed projects", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" },
    lockfile: "npm"
  });

  const profile = await detectProjectProfile(root, {
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
  });

  assert.equal(profile.kind, "expo-managed");
  assert.equal(profile.hasGeneratedNativeProjects, false);
});

test("detects non-npm package managers", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0" },
    lockfile: "yarn"
  });

  assert.equal(await detectPackageManager(root), "yarn");
});

test("detects Expo Router, Expo modules, New Architecture, and lockfile freshness", async () => {
  const root = await fixture({
    packageJson: {
      private: true,
      packageManager: "pnpm@11.10.0",
      dependencies: {
        expo: "54.0.0",
        "expo-router": "6.0.0",
        "expo-modules-core": "3.0.0",
        "react-native": "0.81.0"
      },
      expo: {
        newArchEnabled: true
      }
    },
    directories: ["app"],
    lockfile: "pnpm"
  });

  const profile = await detectProjectProfile(root, {
    packageManager: "pnpm@11.10.0",
    dependencies: {
      expo: "54.0.0",
      "expo-router": "6.0.0",
      "expo-modules-core": "3.0.0",
      "react-native": "0.81.0"
    },
    expo: {
      newArchEnabled: true
    }
  });

  assert.equal(profile.kind, "expo-managed");
  assert.equal(profile.packageManager, "pnpm");
  assert.equal(profile.packageManagerVersion, "11.10.0");
  assert.equal(profile.hasExpoRouter, true);
  assert.equal(profile.hasExpoModules, true);
  assert.deepEqual(profile.expoModulesPackages, ["expo-modules-core", "expo-router"]);
  assert.equal(profile.newArchitecture?.enabled, true);
  assert.deepEqual(profile.newArchitecture?.sources, ["package.json:expo.newArchEnabled"]);
  assert.equal(profile.lockfileState?.path, "pnpm-lock.yaml");
  assert.equal(profile.lockfileState?.present, true);
});

test("detects pnpm workspace roots", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-workspace-"));
  await writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  await writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\npackages: {}\n");
  const appRoot = path.join(root, "apps", "mobile");
  await mkdir(appRoot, { recursive: true });
  await writeFile(
    path.join(appRoot, "package.json"),
    JSON.stringify({ private: true, dependencies: { expo: "54.0.0", "react-native": "0.81.0" } }, null, 2)
  );

  const profile = await detectProjectProfile(appRoot, {
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
  });

  assert.equal(profile.packageManager, "pnpm");
  assert.equal(profile.workspace?.root, root);
  assert.equal(profile.workspace?.type, "pnpm");
  assert.equal(profile.workspace?.isWorkspaceRoot, false);
  assert.equal(profile.lockfileState?.path, "../../pnpm-lock.yaml");
});

test("collects toolchain context from native config files", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" },
    directories: ["android/gradle/wrapper"],
    lockfile: "npm",
    files: {
      "android/gradle/wrapper/gradle-wrapper.properties": "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-all.zip\n",
      "android/settings.gradle": "plugins { id 'com.android.application' version '8.7.0' apply false }\n",
      "android/build.gradle": "ext { kotlinVersion = '2.0.21' }\ncompileSdkVersion = 35\nminSdkVersion = 24\ntargetSdkVersion = 35\n",
      "eas.json": JSON.stringify({ build: { production: {} } }, null, 2)
    }
  });

  const toolchain = await collectToolchainContext(root, "npm", {
    packageManager: "npm@11.10.0",
    dependencies: { expo: "54.0.0" }
  });

  assert.equal(toolchain.packageManager, "npm");
  assert.equal(toolchain.packageManagerVersion, "11.10.0");
  assert.equal(toolchain.gradleVersion, "8.10.2");
  assert.equal(toolchain.androidGradlePluginVersion, "8.7.0");
  assert.equal(toolchain.kotlinVersion, "2.0.21");
  assert.deepEqual(toolchain.androidSdk, { compileSdk: "35", targetSdk: "35", minSdk: "24" });
  assert.equal(toolchain.easProfile?.name, "production");
});

test("creates redacted environment reports", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" },
    lockfile: "npm"
  });

  const report = await createEnvironmentReport({
    rootDir: root,
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  assert.equal(report.project.root, "<redacted>");
  assert.equal(report.toolchain.packageManager, "npm");
  assert.equal(report.redaction.applied, true);
  assert.deepEqual(report.redaction.hiddenFields, ["project.root", "project.workspace.root"]);
});

test("detects persistent stage 2 fixtures", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

  const expoManaged = await analyzeProject({
    rootDir: path.join(repoRoot, "fixtures", "expo-managed"),
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });
  assert.equal(expoManaged.project.kind, "expo-managed");
  assert.equal(expoManaged.project.hasExpoRouter, true);
  assert.equal(expoManaged.project.newArchitecture?.enabled, true);

  const pnpmFixture = await detectProjectProfile(path.join(repoRoot, "fixtures", "package-managers", "pnpm"), {
    packageManager: "pnpm@11.10.0",
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
  });
  assert.equal(pnpmFixture.packageManager, "pnpm");
  assert.equal(pnpmFixture.lockfileState?.path, "pnpm-lock.yaml");

  const monorepoFixture = await detectProjectProfile(path.join(repoRoot, "fixtures", "monorepo", "apps", "mobile"), {
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
  });
  assert.equal(monorepoFixture.workspace?.type, "pnpm");
  assert.equal(monorepoFixture.lockfileState?.path, "../../pnpm-lock.yaml");
});

test("builds dependency graph from npm lockfile", async () => {
  const root = await fixture({
    packageJson: {
      private: true,
      dependencies: {
        react: "19.1.0",
        "react-native": "0.81.0",
        "react-native-svg": "15.11.2"
      },
      overrides: {
        "react-native-svg": "15.11.2"
      },
      resolutions: {
        react: "19.1.0"
      },
      pnpm: {
        packageExtensions: {
          "react-native-svg@15.11.2": {
            peerDependencies: {
              react: "*"
            }
          }
        }
      }
    },
    lockfile: "npm",
    lockfileContent: JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              react: "19.1.0",
              "react-native": "0.81.0",
              "react-native-svg": "15.11.2"
            }
          },
          "node_modules/react": {
            version: "19.1.0"
          },
          "node_modules/react-native": {
            version: "0.81.0",
            peerDependencies: {
              react: "*"
            }
          },
          "node_modules/react-native-svg": {
            version: "15.11.2",
            peerDependencies: {
              "react-native": "*"
            }
          },
          "node_modules/some-transitive": {
            version: "1.0.0"
          },
          "node_modules/some-transitive/node_modules/react": {
            version: "18.3.1"
          },
          "node_modules/some-transitive/node_modules/react-native": {
            version: "0.80.0"
          }
        }
      },
      null,
      2
    ),
    files: {
      "patches/react-native-svg+15.11.2.patch": "diff --git a/file b/file\n"
    }
  });

  const packageJson = {
    dependencies: {
      react: "19.1.0",
      "react-native": "0.81.0",
      "react-native-svg": "15.11.2"
    },
    overrides: {
      "react-native-svg": "15.11.2"
    },
    resolutions: {
      react: "19.1.0"
    },
    pnpm: {
      packageExtensions: {
        "react-native-svg@15.11.2": {
          peerDependencies: {
            react: "*"
          }
        }
      }
    }
  };

  const graph = await createDependencyGraph(root, packageJson, "npm");

  assert.equal(graph.nodes.length, 6);
  assert.deepEqual(graph.duplicateReact, [{ packageName: "react", versions: ["18.3.1", "19.1.0"] }]);
  assert.deepEqual(graph.duplicateReactNative, [{ packageName: "react-native", versions: ["0.80.0", "0.81.0"] }]);
  assert.deepEqual(graph.patchedPackages, ["react-native-svg"]);
  assert.equal(graph.overrides["react-native-svg"], "15.11.2");
  assert.equal(graph.resolutions.react, "19.1.0");
  assert.ok(graph.packageExtensions["react-native-svg@15.11.2"]);

  const svg = graph.nodes.find(node => node.packageName === "react-native-svg");
  assert.equal(svg?.direct, true);
  assert.equal(svg?.patched, true);
  assert.equal(svg?.overridden, true);
  assert.equal(svg?.classification, "native-module");

  const nestedReactNative = graph.nodes.find(node => node.packageName === "react-native" && node.installedVersion === "0.80.0");
  assert.deepEqual(nestedReactNative?.dependencyPath, ["some-transitive", "react-native"]);
});

test("builds dependency graph from pnpm lockfile", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      react: "19.1.0",
      "react-native": "0.81.0"
    },
    lockfile: "pnpm",
    lockfileContent: [
      "lockfileVersion: '9.0'",
      "packages:",
      "  /expo@54.0.0:",
      "    resolution: {integrity: sha512-example}",
      "  /react@19.1.0:",
      "    resolution: {integrity: sha512-example}",
      "  /react@18.3.1:",
      "    resolution: {integrity: sha512-example}",
      "  /react-native@0.81.0:",
      "    resolution: {integrity: sha512-example}"
    ].join("\n")
  });

  const graph = await createDependencyGraph(root, {
    dependencies: {
      expo: "54.0.0",
      react: "19.1.0",
      "react-native": "0.81.0"
    }
  }, "pnpm");

  assert.deepEqual(graph.duplicateReact, [{ packageName: "react", versions: ["18.3.1", "19.1.0"] }]);
  assert.equal(graph.nodes.find(node => node.packageName === "expo")?.classification, "js-only");
  assert.equal(graph.nodes.find(node => node.packageName === "react-native")?.classification, "native-module");
});

test("loads nativeguard config", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" },
    lockfile: "npm",
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules", version: "2026.07.11" },
          ci: { failOn: ["red", "stale-exception"], warnOn: ["yellow", "unknown"] },
          exceptions: [],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const config = await loadNativeGuardConfig(root);

  assert.deepEqual(config.ci.failOn, ["red", "stale-exception"]);
  assert.equal(config.rules.version, "2026.07.11");
});

test("applies active exceptions to matching findings", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "sentry-expo": "7.2.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules" },
          ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
          exceptions: [
            {
              packageName: "sentry-expo",
              allowedVersions: "7.2.0",
              reason: "Temporary release exception while Android smoke tests are passing.",
              owner: "@mobile-platform",
              expiresAt: "2026-08-01",
              requiredVerification: ["android-release-build"]
            }
          ],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  const pagerFinding = report.findings.find(finding => finding.packageName === "sentry-expo");
  assert.equal(pagerFinding?.status, "accepted-exception");
  assert.equal(pagerFinding?.severity, "warning");
  assert.equal(report.policy?.activeExceptions.length, 1);
  assert.equal(report.policy?.staleExceptions.length, 0);
  assert.equal(report.summary.status, "accepted-exception");
});

test("matches exceptions against lockfile-resolved versions, not declared ranges", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "sentry-expo": "^7.0.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    lockfileContent: JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              expo: "54.0.0",
              "react-native": "0.81.0",
              "sentry-expo": "^7.0.0"
            }
          },
          "node_modules/expo": {
            version: "54.0.0"
          },
          "node_modules/react-native": {
            version: "0.81.0"
          },
          "node_modules/sentry-expo": {
            version: "7.2.0"
          }
        }
      },
      null,
      2
    ),
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules" },
          ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
          exceptions: [
            {
              packageName: "sentry-expo",
              allowedVersions: "7.2.0",
              reason: "Temporary release exception while Android smoke tests are passing.",
              owner: "@mobile-platform",
              expiresAt: "2026-08-01",
              requiredVerification: ["android-release-build"]
            }
          ],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  const pagerFinding = report.findings.find(finding => finding.packageName === "sentry-expo");
  assert.equal(pagerFinding?.status, "accepted-exception");
  assert.equal(report.policy?.activeExceptions.length, 1);
  assert.equal(report.dependencySnapshot.dependencies["sentry-expo"], "^7.0.0");
  assert.equal(
    report.dependencyGraph?.nodes.find(node => node.packageName === "sentry-expo")?.installedVersion,
    "7.2.0"
  );
});

test("does not apply exceptions when lockfile version falls outside allowedVersions", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "sentry-expo": "^7.0.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    lockfileContent: JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              expo: "54.0.0",
              "react-native": "0.81.0",
              "sentry-expo": "^7.0.0"
            }
          },
          "node_modules/expo": {
            version: "54.0.0"
          },
          "node_modules/react-native": {
            version: "0.81.0"
          },
          "node_modules/sentry-expo": {
            version: "7.3.0"
          }
        }
      },
      null,
      2
    ),
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules" },
          ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
          exceptions: [
            {
              packageName: "sentry-expo",
              allowedVersions: "7.2.0",
              reason: "Pinned exception for an older install that is no longer present.",
              owner: "@mobile-platform",
              expiresAt: "2026-08-01",
              requiredVerification: ["android-release-build"]
            }
          ],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  const pagerFinding = report.findings.find(finding => finding.packageName === "sentry-expo");
  assert.equal(pagerFinding?.status, "risky");
  assert.equal(report.policy?.activeExceptions.length, 0);
});

test("reports stale exceptions and applies CI policy", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "sentry-expo": "7.2.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules" },
          ci: { failOn: ["stale-exception"], warnOn: ["red", "yellow", "unknown"] },
          exceptions: [
            {
              packageName: "sentry-expo",
              allowedVersions: "7.2.0",
              reason: "Expired release exception.",
              owner: "@mobile-platform",
              expiresAt: "2026-01-01",
              requiredVerification: ["android-release-build"]
            }
          ],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const report = await analyzeProject({
    rootDir: root,
    cliVersion: "0.0.0",
    ci: true,
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  assert.equal(report.policy?.staleExceptions.length, 1);
  assert.equal(report.policy?.exitDecision.exitCode, 1);
  assert.match(report.policy?.exitDecision.reason ?? "", /stale-exception/);
  assert.ok(report.findings.some(finding => finding.id === "finding-stale-exception-sentry-expo"));
});

test("explains risky packages with graph, rules, findings, and actions", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "sentry-expo": "7.2.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const explanation = await explainPackage({
    rootDir: root,
    cliVersion: "0.0.0",
    packageName: "sentry-expo",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  assert.equal(explanation.packageName, "sentry-expo");
  assert.equal(explanation.status, "risky");
  assert.equal(explanation.declaredRange, "7.2.0");
  assert.equal(explanation.direct, true);
  assert.deepEqual(explanation.installedVersions, ["7.2.0"]);
  assert.equal(explanation.matchingRules[0]?.id, "ban-sentry-expo-on-sdk-ge-50");
  assert.ok(explanation.findings.some(finding => finding.ruleId === "ban-sentry-expo-on-sdk-ge-50"));
  assert.ok(explanation.recommendedActions.some(action => action.type === "exclude"));
});

test("explains active package exceptions", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "sentry-expo": "7.2.0"
    },
    directories: ["ios", "android"],
    lockfile: "npm",
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules" },
          ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
          exceptions: [
            {
              packageName: "sentry-expo",
              allowedVersions: "7.2.0",
              reason: "Temporary exception.",
              owner: "@mobile-platform",
              expiresAt: "2026-08-01",
              requiredVerification: ["android-release-build"]
            }
          ],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const explanation = await explainPackage({
    rootDir: root,
    cliVersion: "0.0.0",
    packageName: "sentry-expo",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  assert.equal(explanation.status, "accepted-exception");
  assert.equal(explanation.activeExceptions.length, 1);
});

test("explains unknown packages", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0"
    },
    lockfile: "npm"
  });

  const explanation = await explainPackage({
    rootDir: root,
    cliVersion: "0.0.0",
    packageName: "react-native-not-installed",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  assert.equal(explanation.status, "unknown");
  assert.equal(explanation.classification, "not-installed");
  assert.match(explanation.unknownReason ?? "", /not found/);
});

test("creates, writes, reads, and compares snapshots", async () => {
  const baseRoot = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "react-native-svg": "15.10.0"
    },
    lockfile: "npm"
  });
  const headRoot = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "react-native-svg": "15.11.2",
      "react-native-mmkv": "3.0.0"
    },
    lockfile: "npm"
  });

  const base = await createNativeGuardSnapshot({
    rootDir: baseRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });
  const head = await createNativeGuardSnapshot({
    rootDir: headRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-12T00:00:00.000Z")
  });
  const outputPath = path.join(headRoot, "nativeguard-snapshot.json");
  await writeNativeGuardSnapshot(head, outputPath);
  const readBack = await readNativeGuardSnapshot(outputPath);
  const comparison = compareNativeGuardSnapshots(base, readBack);

  assert.equal(readBack.schemaVersion, "1.0.0");
  assert.notEqual(base.dependencyGraphFingerprint, readBack.dependencyGraphFingerprint);
  assert.deepEqual(
    comparison.changedPackages.map(change => ({
      packageName: change.packageName,
      changeType: change.changeType,
      beforeVersion: change.beforeVersion,
      afterVersion: change.afterVersion
    })),
    [
      {
        packageName: "react-native-mmkv",
        changeType: "added",
        beforeVersion: undefined,
        afterVersion: "3.0.0"
      },
      {
        packageName: "react-native-svg",
        changeType: "changed",
        beforeVersion: "15.10.0",
        afterVersion: "15.11.2"
      }
    ]
  );
});

test("creates PR review reports from snapshot changes and duplicate runtime risks", async () => {
  const baseRoot = await fixture({
    dependencies: {
      expo: "54.0.0",
      react: "19.1.0",
      "react-native": "0.81.0"
    },
    lockfile: "npm",
    lockfileContent: JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              expo: "54.0.0",
              react: "19.1.0",
              "react-native": "0.81.0"
            }
          },
          "node_modules/expo": { version: "54.0.0" },
          "node_modules/react": { version: "19.1.0" },
          "node_modules/react-native": { version: "0.81.0" }
        }
      },
      null,
      2
    )
  });
  const headRoot = await fixture({
    dependencies: {
      expo: "54.0.0",
      react: "19.1.0",
      "react-native": "0.81.0"
    },
    lockfile: "npm",
    lockfileContent: JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              expo: "54.0.0",
              react: "19.1.0",
              "react-native": "0.81.0"
            }
          },
          "node_modules/expo": { version: "54.0.0" },
          "node_modules/react": { version: "19.1.0" },
          "node_modules/react-native": { version: "0.81.0" },
          "node_modules/some-transitive": { version: "1.0.0" },
          "node_modules/some-transitive/node_modules/react": { version: "18.3.1" },
          "node_modules/some-transitive/node_modules/react-native": { version: "0.80.0" }
        }
      },
      null,
      2
    ),
    files: {
      "nativeguard.config.json": JSON.stringify(
        {
          schemaVersion: "1.0.0",
          rules: { source: "@nativeguard/rules" },
          ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
          exceptions: [
            {
              packageName: "react-native",
              allowedVersions: "0.81.0",
              reason: "Expired manual verification window.",
              owner: "@mobile-platform",
              expiresAt: "2026-01-01",
              requiredVerification: ["android-build"]
            }
          ],
          redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
        },
        null,
        2
      )
    }
  });

  const base = await createNativeGuardSnapshot({
    rootDir: baseRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-11T00:00:00.000Z")
  });
  const head = await createNativeGuardSnapshot({
    rootDir: headRoot,
    cliVersion: "0.0.0",
    now: new Date("2026-07-12T00:00:00.000Z")
  });

  const report = createPrReviewReportFromSnapshots(base, head, new Date("2026-07-13T00:00:00.000Z"));

  assert.equal(report.status, "red");
  assert.deepEqual(
    report.newRisks.map(risk => risk.id).sort(),
    ["pr-risk-duplicate-react", "pr-risk-duplicate-react-native"]
  );
  assert.ok(report.changedPackages.some(node => node.packageName === "react" && node.installedVersion === "18.3.1"));
  assert.ok(report.changedPackages.some(node => node.packageName === "react-native" && node.installedVersion === "0.80.0"));
  assert.deepEqual(report.staleExceptions.map(exception => exception.packageName), ["react-native"]);
  assert.deepEqual(report.verificationChecklist, ["expo-doctor", "android-build", "ios-build", "manual"]);
  assert.ok(report.requiredActions.some(action => action.requiresApproval === true));
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
  assert.ok(report.dependencyGraph);
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
  assert.deepEqual(report.packageIssues, []);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.recommendations, []);
  assert.equal(report.summary.status, "stable");
  assert.ok(report.dependencyGraph);
});

test("parses Expo SDK major from project versions and --sdk overrides", () => {
  assert.equal(parseExpoSdkMajor("54.0.33"), "54");
  assert.equal(parseExpoSdkMajor("~54.0.0"), "54");
  assert.equal(parseExpoSdkMajor("^53.2.1"), "53");
  assert.equal(parseExpoSdkMajor("v52"), "52");
  assert.equal(parseExpoSdkMajor("54"), "54");
  assert.equal(parseExpoSdkMajor("54.0.0-beta.1"), "54");
  assert.equal(parseExpoSdkMajor("~54.0.0-beta.1"), "54");
  assert.equal(parseExpoSdkMajor("54beta"), "54");
  assert.equal(parseExpoSdkMajor("54-beta.1"), "54");
  assert.equal(parseExpoSdkMajor("54canary"), "54");
  assert.equal(parseExpoSdkMajor("54.0.0-canary-20250729-d8899ae"), "54");
  assert.equal(parseExpoSdkMajor("54.0.0-preview.1"), "54");
  assert.equal(parseExpoSdkMajor("54xyz"), undefined);
  assert.equal(parseExpoSdkMajor("54betafoo"), undefined);
  assert.equal(parseExpoSdkMajor("sdk54"), undefined);
  assert.equal(parseExpoSdkMajor("canary"), undefined);
  assert.equal(parseExpoSdkMajor("latest"), undefined);
  assert.equal(parseExpoSdkMajor(""), undefined);
});

test("rejects garbage --sdk overrides with INVALID_SDK", async () => {
  const root = await fixture({
    dependencies: { expo: "54.0.0", "react-native": "0.81.0" },
    lockfile: "npm"
  });

  await assert.rejects(
    () => analyzeProject({ rootDir: root, cliVersion: "0.0.0", sdk: "54xyz" }),
    (error: unknown) => {
      assert.equal(error instanceof NativeGuardError, true);
      assert.equal((error as NativeGuardError).code, "INVALID_SDK");
      return true;
    }
  );
  await assert.rejects(
    () => analyzeProject({ rootDir: root, cliVersion: "0.0.0", sdk: "canary" }),
    (error: unknown) => {
      assert.equal(error instanceof NativeGuardError, true);
      assert.equal((error as NativeGuardError).code, "INVALID_SDK");
      return true;
    }
  );
});

test("prerelease expo ~54.0.0-beta.1 triggers SDK 54 rules", async () => {
  const report = await analyzeProject({
    rootDir: path.join(fixturesRoot, "sdk54-beta-screens-expo-go"),
    cliVersion: "0.0.0"
  });

  assert.equal(report.project.expoSdkMajor, "54");
  assert.equal(report.project.kind, "expo-managed");
  assert.equal(report.dependencySnapshot.dependencies.expo, "~54.0.0-beta.1");
  assert.equal(report.dependencySnapshot.resolvedVersions?.expo, "54.0.0-beta.1");
  assert.equal(
    report.findings.some(finding => finding.ruleId === "sdk54-pin-screens-tilde-4.16"),
    true
  );
  assert.equal(report.summary.status, "risky");
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

  assert.equal(report.project.kind, "expo-managed");
  assert.equal(report.dependencySnapshot.dependencies["react-native-screens"], ">=4.20.0");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-screens"], "4.16.0");
  assert.equal(
    report.findings.some(finding => finding.ruleId === "sdk54-pin-screens-tilde-4.16"),
    false
  );
});

const lockResolvedPagerViewFixtures = [
  { dir: "lock-npm-range-miss-pager-view", packageManager: "npm", lockfile: "package-lock.json" },
  { dir: "lock-yarn-classic-range-miss-pager-view", packageManager: "yarn", lockfile: "yarn.lock" },
  { dir: "lock-yarn-berry-range-miss-pager-view", packageManager: "yarn", lockfile: "yarn.lock" },
  { dir: "lock-pnpm-range-miss-pager-view", packageManager: "pnpm", lockfile: "pnpm-lock.yaml" },
  { dir: "lock-bun-range-miss-pager-view", packageManager: "bun", lockfile: "bun.lock" }
] as const;

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

for (const lockFixture of lockResolvedPagerViewFixtures) {
  test(`matches lock-resolved pager-view for ${lockFixture.dir}`, async () => {
    const report = await analyzeProject({
      rootDir: path.join(fixturesRoot, lockFixture.dir),
      cliVersion: "0.0.0"
    });

    assert.equal(report.project.packageManager, lockFixture.packageManager);
    assert.equal(report.dependencySnapshot.lockfile?.path, lockFixture.lockfile);
    assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "^6.7.1");
    assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.6.0");
    assert.equal(
      report.packageIssues.find(issue => issue.packageName === "react-native-pager-view")?.installedVersion,
      "6.6.0"
    );
    assert.equal(report.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"), true);
    assert.equal(report.summary.status, "risky");
    assert.equal(
      report.findings.some(
        finding => finding.id.startsWith("finding-package-manager-") && finding.id !== "finding-package-manager-bun-lockb"
      ),
      false
    );
  });
}

test("reads the pnpm workspace catalog from a nested package", async () => {
  const report = await analyzeProject({
    rootDir: path.join(fixturesRoot, "pnpm-workspace-catalog/apps/mobile"),
    cliVersion: "0.0.0"
  });

  assert.equal(report.project.packageManager, "pnpm");
  assert.equal(report.dependencySnapshot.lockfile?.path, "../../pnpm-lock.yaml");
  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "catalog:");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.6.0");
  assert.equal(report.project.expoSdkMajor, "53");
  assert.equal(report.project.reactNativeVersion, "0.79.5");
  assert.equal(report.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"), true);
  assert.equal(report.summary.status, "risky");
});

test("applies yarn resolutions of a known-bad pager-view", async () => {
  const report = await analyzeProject({
    rootDir: path.join(fixturesRoot, "yarn-resolutions-pager-view"),
    cliVersion: "0.0.0"
  });

  assert.equal(report.project.packageManager, "yarn");
  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "^6.7.1");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.6.0");
  assert.equal(report.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"), true);
  assert.equal(report.summary.status, "risky");
});

test("emits unsupported instead of silent stable when catalog: cannot be resolved", async () => {
  const report = await analyzeProject({
    rootDir: path.join(fixturesRoot, "unresolved-catalog"),
    cliVersion: "0.0.0"
  });

  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "catalog:");
  assert.equal(report.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], undefined);
  assert.equal(report.dependencySnapshot.unresolvedSpecifiers?.["react-native-pager-view"], "catalog:");
  assert.equal(report.findings.some(finding => finding.id === "finding-unresolved-versions"), true);
  assert.equal(report.summary.status, "unsupported");
  assert.notEqual(report.summary.status, "stable");
});

test("emits unsupported for bun.lockb without a text bun.lock", async () => {
  const root = await fixture({
    dependencies: {
      expo: "~53.0.0",
      "react-native": "0.79.5",
      "react-native-pager-view": "^6.7.1"
    },
    directories: ["ios", "android"],
    lockfile: "bun.lockb"
  });

  const report = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(report.project.packageManager, "bun");
  assert.equal(report.findings.some(finding => finding.id === "finding-package-manager-bun-lockb"), true);
  assert.equal(report.summary.status, "unsupported");
  assert.notEqual(report.summary.status, "stable");
});

async function fixture(options: {
  dependencies?: Record<string, string>;
  packageJson?: Record<string, unknown>;
  directories?: string[];
  lockfile?: "npm" | "yarn" | "pnpm" | "bun" | "bun.lockb";
  lockfileContent?: string;
  files?: Record<string, string>;
  resolvedVersions?: Record<string, string>;
}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-fixture-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(options.packageJson ?? { private: true, dependencies: options.dependencies }, null, 2)
  );

  for (const directory of options.directories ?? []) {
    await mkdir(path.join(root, directory), { recursive: true });
  }

  if (options.lockfile === "npm") {
    await writeFile(path.join(root, "package-lock.json"), options.lockfileContent ?? JSON.stringify({ lockfileVersion: 3, packages: {} }));
  }
  if (options.lockfile === "yarn") {
    await writeFile(path.join(root, "yarn.lock"), options.lockfileContent ?? "");
  }
  if (options.lockfile === "pnpm") {
    await writeFile(path.join(root, "pnpm-lock.yaml"), options.lockfileContent ?? "");
  }
  if (options.lockfile === "bun") {
    await writeFile(path.join(root, "bun.lock"), "");
  }
  if (options.lockfile === "bun.lockb") {
    await writeFile(path.join(root, "bun.lockb"), "");
  }

  for (const [relativePath, content] of Object.entries(options.files ?? {})) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  if (options.resolvedVersions && options.lockfile === "npm") {
    const declared = options.dependencies ?? {};
    const packages: Record<string, unknown> = { "": { dependencies: declared } };
    for (const [packageName, version] of Object.entries(options.resolvedVersions)) {
      packages[`node_modules/${packageName}`] = { version };
    }
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }, null, 2));
  }

  return root;
}
