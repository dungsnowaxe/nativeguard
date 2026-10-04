import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { matchWorkspacePattern, resolveDeclaredSpecifiers, resolveWorkspaceContext } from "./workspace.js";
import type { InstallLockfile } from "./lockfiles.js";

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

test("matches workspace globs", () => {
  assert.equal(matchWorkspacePattern("apps/*", "apps/mobile"), true);
  assert.equal(matchWorkspacePattern("apps/*", "apps/mobile/src"), false);
  assert.equal(matchWorkspacePattern("packages/*", "fixtures/unsupported"), false);
});

test("reads the workspace root lockfile for a nested package", async () => {
  const context = await resolveWorkspaceContext(path.join(fixturesRoot, "pnpm-workspace-catalog/apps/mobile"));
  assert.equal(context.packageManager, "pnpm");
  assert.equal(context.importerKey, "apps/mobile");
  assert.equal(path.basename(context.workspaceRoot), "pnpm-workspace-catalog");
  assert.equal(context.lockfileName, "pnpm-lock.yaml");
  assert.equal(context.catalogs.default?.["react-native-pager-view"], "6.6.0");
});

test("does not treat NativeGuard fixtures as members of the repo workspace", async () => {
  const context = await resolveWorkspaceContext(path.join(fixturesRoot, "sdk53-pager-view"));
  assert.equal(context.packageManager, "npm");
  assert.equal(context.workspaceRoot, path.join(fixturesRoot, "sdk53-pager-view"));
});

test("detects bun.lockb without treating a parent pnpm workspace as the lockfile", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-bun-lockb-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, dependencies: { expo: "53.0.20" } })
  );
  await writeFile(path.join(root, "bun.lockb"), Buffer.from("bun-binary-lockfile"));
  await mkdir(path.join(root, "ios"));
  const context = await resolveWorkspaceContext(root);
  assert.equal(context.packageManager, "bun");
  assert.equal(context.lockfileName, "bun.lockb");
});

test("keeps a git URL unresolved when the lockfile resolved a semver", () => {
  const lockfile: InstallLockfile = {
    packageManager: "npm",
    lockfileName: "package-lock.json",
    packageCount: 1,
    resolvedVersions: { "expo-haptics": "14.0.1" },
    entries: [{ packageName: "expo-haptics", version: "14.0.1", importerKey: "." }]
  };
  const resolved = resolveDeclaredSpecifiers(
    { "expo-haptics": "github:expo/expo#sdk-54", "react-native-pager-view": "6.6.0" },
    lockfile,
    {
      packageRoot: "/tmp/app",
      workspaceRoot: "/tmp/app",
      importerKey: ".",
      packageManager: "npm",
      catalogs: {},
      pinOverrides: {}
    },
    {}
  );
  assert.equal(resolved.resolvedVersions["expo-haptics"], "14.0.1");
  assert.equal(resolved.unresolvedSpecifiers["expo-haptics"], "github:expo/expo#sdk-54");
  assert.equal(resolved.unresolvedSpecifiers["react-native-pager-view"], undefined);
});

test("records a non-semver lockfile version and leaves semver ranges alone", () => {
  const lockfile: InstallLockfile = {
    packageManager: "npm",
    lockfileName: "package-lock.json",
    packageCount: 2,
    resolvedVersions: {
      "expo-haptics": "git+https://github.com/expo/expo.git#sdk-54",
      "react-native-pager-view": "6.6.0"
    },
    entries: []
  };
  const resolved = resolveDeclaredSpecifiers(
    {
      "expo-haptics": "*",
      "react-native-pager-view": "^6.7.1",
      "expo-status-bar": "next",
      "expo-font": "workspace:*",
      "expo-constants": "file:../constants"
    },
    lockfile,
    {
      packageRoot: "/tmp/app",
      workspaceRoot: "/tmp/app",
      importerKey: ".",
      packageManager: "npm",
      catalogs: { default: { "expo-linking": "7.0.0" } },
      pinOverrides: {}
    },
    {}
  );
  assert.equal(resolved.unresolvedSpecifiers["expo-haptics"], "git+https://github.com/expo/expo.git#sdk-54");
  assert.equal(resolved.unresolvedSpecifiers["expo-status-bar"], "next");
  assert.equal(resolved.unresolvedSpecifiers["expo-font"], "workspace:*");
  assert.equal(resolved.unresolvedSpecifiers["expo-constants"], "file:../constants");
  assert.equal(resolved.unresolvedSpecifiers["react-native-pager-view"], undefined);
  assert.equal(resolved.resolvedVersions["react-native-pager-view"], "6.6.0");

  const catalog = resolveDeclaredSpecifiers(
    { "expo-linking": "catalog:" },
    undefined,
    {
      packageRoot: "/tmp/app",
      workspaceRoot: "/tmp/app",
      importerKey: ".",
      packageManager: "pnpm",
      catalogs: { default: { "expo-linking": "7.0.0" } },
      pinOverrides: {}
    },
    {}
  );
  assert.equal(catalog.resolvedVersions["expo-linking"], "7.0.0");
  assert.equal(catalog.unresolvedSpecifiers["expo-linking"], undefined);
});
