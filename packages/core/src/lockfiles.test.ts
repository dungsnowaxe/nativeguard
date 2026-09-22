import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseBunLock, parseNpmLockfile, parsePnpmLock, parseYarnLock } from "./lockfiles.js";

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

test("parses npm lockfile resolved versions", async () => {
  const raw = await readFile(path.join(fixturesRoot, "lock-npm-range-miss-pager-view/package-lock.json"), "utf8");
  const parsed = parseNpmLockfile(raw);
  assert.equal(parsed.resolvedVersions["react-native-pager-view"], "6.6.0");
  assert.equal(parsed.lockfileVersion, 3);
});

test("parses yarn classic and berry lockfiles", async () => {
  const classic = parseYarnLock(
    await readFile(path.join(fixturesRoot, "lock-yarn-classic-range-miss-pager-view/yarn.lock"), "utf8")
  );
  const berry = parseYarnLock(
    await readFile(path.join(fixturesRoot, "lock-yarn-berry-range-miss-pager-view/yarn.lock"), "utf8")
  );
  assert.equal(classic.lockfileVersion, 1);
  assert.equal(classic.resolvedVersions["react-native-pager-view"], "6.6.0");
  assert.equal(berry.lockfileVersion, 8);
  assert.equal(berry.resolvedVersions["react-native-pager-view"], "6.6.0");
  assert.equal(berry.resolvedVersions.expo, "53.0.20");
});

test("parses pnpm lockfile importer versions including peer suffixes", () => {
  const parsed = parsePnpmLock(
    `lockfileVersion: '9.0'
importers:
  apps/mobile:
    dependencies:
      react-native-pager-view:
        specifier: "catalog:"
        version: 6.6.0(react-native@0.79.5)
packages:
  react-native-pager-view@6.6.0:
    version: 6.6.0
`,
    "apps/mobile"
  );
  assert.equal(parsed.resolvedVersions["react-native-pager-view"], "6.6.0");
  assert.equal(parsed.lockfileVersion, 9);
});

test("parses bun.lock JSONC packages", async () => {
  const raw = await readFile(path.join(fixturesRoot, "lock-bun-range-miss-pager-view/bun.lock"), "utf8");
  const parsed = parseBunLock(raw);
  assert.equal(parsed.resolvedVersions["react-native-pager-view"], "6.6.0");
  assert.equal(parsed.lockfileVersion, 1);
});

test("parses yarn resolutions merged descriptors", async () => {
  const parsed = parseYarnLock(
    await readFile(path.join(fixturesRoot, "yarn-resolutions-pager-view/yarn.lock"), "utf8")
  );
  assert.equal(parsed.resolvedVersions["react-native-pager-view"], "6.6.0");
});
