import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { matchWorkspacePattern, resolveWorkspaceContext } from "./workspace.js";

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
