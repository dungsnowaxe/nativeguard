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
      "react-native-pager-view": "6.9.1"
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
              packageName: "react-native-pager-view",
              allowedVersions: "6.9.1",
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

  const pagerFinding = report.findings.find(finding => finding.packageName === "react-native-pager-view");
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
      "react-native-pager-view": "^6.9.0"
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
              "react-native-pager-view": "^6.9.0"
            }
          },
          "node_modules/expo": {
            version: "54.0.0"
          },
          "node_modules/react-native": {
            version: "0.81.0"
          },
          "node_modules/react-native-pager-view": {
            version: "6.9.1"
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
              packageName: "react-native-pager-view",
              allowedVersions: "6.9.1",
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

  const pagerFinding = report.findings.find(finding => finding.packageName === "react-native-pager-view");
  assert.equal(pagerFinding?.status, "accepted-exception");
  assert.equal(report.policy?.activeExceptions.length, 1);
  assert.equal(report.dependencySnapshot.dependencies["react-native-pager-view"], "^6.9.0");
  assert.equal(
    report.dependencyGraph?.nodes.find(node => node.packageName === "react-native-pager-view")?.installedVersion,
    "6.9.1"
  );
});

test("does not apply exceptions when lockfile version falls outside allowedVersions", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "react-native-pager-view": "^6.9.0"
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
              "react-native-pager-view": "^6.9.0"
            }
          },
          "node_modules/expo": {
            version: "54.0.0"
          },
          "node_modules/react-native": {
            version: "0.81.0"
          },
          "node_modules/react-native-pager-view": {
            version: "6.10.0"
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
              packageName: "react-native-pager-view",
              allowedVersions: "6.9.0",
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

  const pagerFinding = report.findings.find(finding => finding.packageName === "react-native-pager-view");
  assert.equal(pagerFinding?.status, "risky");
  assert.equal(report.policy?.activeExceptions.length, 0);
});

test("reports stale exceptions and applies CI policy", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "react-native-pager-view": "6.9.1"
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
              packageName: "react-native-pager-view",
              allowedVersions: "6.9.1",
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
  assert.ok(report.findings.some(finding => finding.id === "finding-stale-exception-react-native-pager-view"));
});

test("explains risky packages with graph, rules, findings, and actions", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "react-native-pager-view": "6.9.1"
    },
    directories: ["ios", "android"],
    lockfile: "npm"
  });

  const explanation = await explainPackage({
    rootDir: root,
    cliVersion: "0.0.0",
    packageName: "react-native-pager-view",
    now: new Date("2026-07-11T00:00:00.000Z")
  });

  assert.equal(explanation.packageName, "react-native-pager-view");
  assert.equal(explanation.status, "risky");
  assert.equal(explanation.declaredRange, "6.9.1");
  assert.equal(explanation.direct, true);
  assert.deepEqual(explanation.installedVersions, ["6.9.1"]);
  assert.equal(explanation.matchingRules[0]?.id, "expo-sdk-54-react-native-pager-view-scroll-lock");
  assert.ok(explanation.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-pager-view-scroll-lock"));
  assert.ok(explanation.recommendedActions.some(action => action.type === "bump"));
});

test("explains active package exceptions", async () => {
  const root = await fixture({
    dependencies: {
      expo: "54.0.0",
      "react-native": "0.81.0",
      "react-native-pager-view": "6.9.1"
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
              packageName: "react-native-pager-view",
              allowedVersions: "6.9.1",
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
    packageName: "react-native-pager-view",
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
  assert.equal(report.schemaVersion, "1.0.0");
  assert.ok(report.dependencyGraph);
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
  dependencies?: Record<string, string>;
  packageJson?: Record<string, unknown>;
  directories?: string[];
  lockfile?: "npm" | "yarn" | "pnpm" | "bun";
  lockfileContent?: string;
  files?: Record<string, string>;
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

  for (const [relativePath, content] of Object.entries(options.files ?? {})) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  return root;
}
