import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "./index.js";

test("prints version", async () => {
  const output = await captureStdout(() => main(["--version"]));
  assert.equal(output.exitCode, 0);
  assert.match(output.stdout, /0\.0\.0/);
});

test("returns non-zero for unsupported projects", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-unsupported-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }, null, 2));

  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["doctor", "--json"]));
    assert.equal(output.exitCode, 1);
    assert.doesNotThrow(() => JSON.parse(output.stdout));
  } finally {
    process.chdir(previous);
  }
});

test("prints doctor JSON and writes lockfile", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-cli-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: {
          expo: "54.0.0",
          "react-native": "0.81.0",
          "react-native-svg": "15.10.0"
        }
      },
      null,
      2
    )
  );
  await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  await mkdir(path.join(root, "ios"));
  await mkdir(path.join(root, "android"));

  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["doctor", "--json", "--write-lockfile"]));
    assert.equal(output.exitCode, 0);
    const parsed = JSON.parse(output.stdout) as {
      project: { kind: string };
      dependencyGraph: { nodes: Array<{ packageName: string }> };
      packageIssues: Array<{ packageName: string; installedVersion: string; affectedRange: string }>;
    };
    assert.equal(parsed.project.kind, "expo-prebuild");
    assert.ok(parsed.dependencyGraph.nodes.some(node => node.packageName === "react-native-svg"));
    assert.deepEqual(
      parsed.packageIssues.map(issue => ({
        packageName: issue.packageName,
        installedVersion: issue.installedVersion,
        affectedRange: issue.affectedRange
      })),
      [
        {
          packageName: "react-native-svg",
          installedVersion: "15.10.0",
          affectedRange: "15.8.0 - 15.10.x"
        }
      ]
    );
  } finally {
    process.chdir(previous);
  }
});

test("prints redacted environment report JSON", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-env-report-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        packageManager: "npm@11.10.0",
        dependencies: {
          expo: "54.0.0",
          "react-native": "0.81.0"
        }
      },
      null,
      2
    )
  );
  await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));

  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["env-report", "--json"]));
    assert.equal(output.exitCode, 0);
    const parsed = JSON.parse(output.stdout) as {
      project: { root: string; kind: string };
      toolchain: { packageManager: string; packageManagerVersion: string };
      redaction: { applied: boolean };
    };
    assert.equal(parsed.project.root, "<redacted>");
    assert.equal(parsed.project.kind, "expo-managed");
    assert.equal(parsed.toolchain.packageManager, "npm");
    assert.equal(parsed.toolchain.packageManagerVersion, "11.10.0");
    assert.equal(parsed.redaction.applied, true);
  } finally {
    process.chdir(previous);
  }
});

async function captureStdout(run: () => Promise<number>): Promise<{ exitCode: number; stdout: string }> {
  const originalWrite = process.stdout.write;
  let stdout = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  try {
    const exitCode = await run();
    return { exitCode, stdout };
  } finally {
    process.stdout.write = originalWrite;
  }
}
