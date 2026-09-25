import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
          "react-native-svg": "15.11.2"
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
    assert.deepEqual(parsed.packageIssues, []);
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

test("uses CI policy exit code from config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-ci-policy-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: {
          expo: "54.0.0",
          "react-native": "0.81.0",
          "sentry-expo": "7.2.0"
        }
      },
      null,
      2
    )
  );
  await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  await mkdir(path.join(root, "ios"));
  await mkdir(path.join(root, "android"));
  await writeFile(
    path.join(root, "nativeguard.config.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        rules: { source: "@nativeguard/rules" },
        ci: { failOn: ["red"], warnOn: ["yellow", "unknown", "stale-exception"] },
        exceptions: [],
        redaction: { hidePrivateScopes: true, hideAbsolutePaths: true }
      },
      null,
      2
    )
  );

  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["doctor", "--json", "--ci", "--config", "nativeguard.config.json"]));
    assert.equal(output.exitCode, 1);
    const parsed = JSON.parse(output.stdout) as {
      policy: { exitDecision: { exitCode: number; reason: string } };
    };
    assert.equal(parsed.policy.exitDecision.exitCode, 1);
    assert.match(parsed.policy.exitDecision.reason, /red/);
  } finally {
    process.chdir(previous);
  }
});

test("prints snapshots and compares snapshot files", async () => {
  const baseRoot = await mkdtemp(path.join(os.tmpdir(), "nativeguard-base-snapshot-"));
  const headRoot = await mkdtemp(path.join(os.tmpdir(), "nativeguard-head-snapshot-"));
  await writeFile(
    path.join(baseRoot, "package.json"),
    JSON.stringify({ private: true, dependencies: { expo: "54.0.0", "react-native": "0.81.0" } }, null, 2)
  );
  await writeFile(path.join(baseRoot, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  await writeFile(
    path.join(headRoot, "package.json"),
    JSON.stringify({ private: true, dependencies: { expo: "54.0.0", "react-native": "0.81.0", "react-native-svg": "15.11.2" } }, null, 2)
  );
  await writeFile(path.join(headRoot, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));

  const baseSnapshotPath = path.join(baseRoot, "snapshot.json");
  const headSnapshotPath = path.join(headRoot, "snapshot.json");
  const previous = process.cwd();

  try {
    process.chdir(baseRoot);
    const baseOutput = await captureStdout(() => main(["snapshot", "--json"]));
    assert.equal(baseOutput.exitCode, 0);
    await writeFile(baseSnapshotPath, baseOutput.stdout);

    process.chdir(headRoot);
    const headOutput = await captureStdout(() => main(["snapshot", "--json"]));
    assert.equal(headOutput.exitCode, 0);
    await writeFile(headSnapshotPath, headOutput.stdout);

    const compareOutput = await captureStdout(() => main(["compare", "--json", "--base", baseSnapshotPath, "--head", headSnapshotPath]));
    assert.equal(compareOutput.exitCode, 1);
    const parsed = JSON.parse(compareOutput.stdout) as {
      addedPackages: Array<{ packageName: string }>;
    };
    assert.deepEqual(parsed.addedPackages.map(change => change.packageName), ["react-native-svg"]);
  } finally {
    process.chdir(previous);
  }
});

test("prints PR review reports from snapshot files", async () => {
  const baseRoot = await mkdtemp(path.join(os.tmpdir(), "nativeguard-base-review-pr-"));
  const headRoot = await mkdtemp(path.join(os.tmpdir(), "nativeguard-head-review-pr-"));
  await writeFile(
    path.join(baseRoot, "package.json"),
    JSON.stringify({ private: true, dependencies: { expo: "54.0.0", "react-native": "0.81.0" } }, null, 2)
  );
  await writeFile(path.join(baseRoot, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  await writeFile(
    path.join(headRoot, "package.json"),
    JSON.stringify({ private: true, dependencies: { expo: "54.0.0", "react-native": "0.81.0", "react-native-svg": "15.11.2" } }, null, 2)
  );
  await writeFile(path.join(headRoot, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));

  const baseSnapshotPath = path.join(baseRoot, "snapshot.json");
  const headSnapshotPath = path.join(headRoot, "snapshot.json");
  const previous = process.cwd();

  try {
    process.chdir(baseRoot);
    const baseOutput = await captureStdout(() => main(["snapshot", "--json"]));
    assert.equal(baseOutput.exitCode, 0);
    await writeFile(baseSnapshotPath, baseOutput.stdout);

    process.chdir(headRoot);
    const headOutput = await captureStdout(() => main(["snapshot", "--json"]));
    assert.equal(headOutput.exitCode, 0);
    await writeFile(headSnapshotPath, headOutput.stdout);

    const jsonOutput = await captureStdout(() => main(["review-pr", "--json", "--base", baseSnapshotPath, "--head", headSnapshotPath]));
    assert.equal(jsonOutput.exitCode, 0);
    const parsed = JSON.parse(jsonOutput.stdout) as {
      status: string;
      changedPackages: Array<{ packageName: string }>;
    };
    assert.equal(parsed.status, "yellow");
    assert.deepEqual(parsed.changedPackages.map(change => change.packageName), ["react-native-svg"]);

    const markdownOutput = await captureStdout(() => main([
      "review-pr",
      "--base",
      baseSnapshotPath,
      "--head",
      headSnapshotPath,
      "--format",
      "markdown",
      "--repository",
      "example/app",
      "--base-ref",
      "main",
      "--head-ref",
      "renovate/react-native-svg"
    ]));
    assert.equal(markdownOutput.exitCode, 0);
    assert.match(markdownOutput.stdout, /NativeGuard Stability Check/);
    assert.match(markdownOutput.stdout, /example\/app/);
    assert.match(markdownOutput.stdout, /main\.\.\.renovate\/react-native-svg/);
    assert.match(markdownOutput.stdout, /react-native-svg@15\.11\.2/);
  } finally {
    process.chdir(previous);
  }
});

test("reports the bare React Native fixture as unsupported, not stable", async () => {
  const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/bare-react-native");
  const previous = process.cwd();
  process.chdir(fixtureRoot);
  try {
    const output = await captureStdout(() => main(["doctor", "--json"]));
    assert.equal(output.exitCode, 1);
    const parsed = parseCapturedJson(output.stdout) as {
      project: { kind: string };
      summary: { status: string };
      packageIssues: unknown[];
      findings: Array<{ status?: string; title?: string }>;
    };
    assert.equal(parsed.project.kind, "bare-react-native");
    assert.equal(parsed.summary.status, "unsupported");
    assert.notEqual(parsed.summary.status, "stable");
    assert.deepEqual(parsed.packageIssues, []);
    assert.equal(parsed.findings[0]?.status, "unsupported");
  } finally {
    process.chdir(previous);
  }
});

test("writes a NativeGuard snapshot with --write-snapshot without changing package-lock.json", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-cli-snapshot-"));
  const packageLock = JSON.stringify({ lockfileVersion: 3, packages: {} });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: { expo: "54.0.0", "react-native": "0.81.0" }
      },
      null,
      2
    )
  );
  await writeFile(path.join(root, "package-lock.json"), packageLock);
  await mkdir(path.join(root, "ios"));

  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["doctor", "--json", "--write-snapshot"]));
    assert.doesNotThrow(() => parseCapturedJson(output.stdout));
    const snapshot = JSON.parse(await readFile(path.join(root, "nativeguard-lock.json"), "utf8")) as {
      recommendations?: unknown[];
    };
    assert.ok(Array.isArray(snapshot.recommendations));
    assert.equal(await readFile(path.join(root, "package-lock.json"), "utf8"), packageLock);
  } finally {
    process.chdir(previous);
  }
});

async function captureStdout(run: () => Promise<number>): Promise<{ exitCode: number; stdout: string }> {
  const originalWrite = process.stdout.write;
  let stdout = "";
  process.stdout.write = ((
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void
  ) => {
    if (typeof chunk !== "string") {
      return originalWrite.call(process.stdout, chunk, encoding as BufferEncoding, callback);
    }
    stdout += chunk;
    const done = typeof encoding === "function" ? encoding : callback;
    done?.();
    return true;
  }) as typeof process.stdout.write;

  try {
    const exitCode = await run();
    return { exitCode, stdout };
  } finally {
    process.stdout.write = originalWrite;
  }
}

function parseCapturedJson(stdout: string): unknown {
  const marker = stdout.lastIndexOf('"schemaVersion"');
  const start = marker === -1 ? stdout.indexOf("{") : stdout.lastIndexOf("{", marker);
  const end = stdout.lastIndexOf("}");
  assert.notEqual(start, -1);
  assert.ok(end > start);
  return JSON.parse(stdout.slice(start, end + 1));
}
