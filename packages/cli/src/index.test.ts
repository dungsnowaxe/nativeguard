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
          "react-native-pager-view": "6.9.1"
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

test("explains package JSON", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-explain-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: {
          expo: "54.0.0",
          "react-native": "0.81.0",
          "react-native-pager-view": "6.9.1"
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
    const output = await captureStdout(() => main(["explain", "react-native-pager-view", "--json"]));
    assert.equal(output.exitCode, 1);
    const parsed = JSON.parse(output.stdout) as {
      packageName: string;
      status: string;
      matchingRules: Array<{ id: string }>;
    };
    assert.equal(parsed.packageName, "react-native-pager-view");
    assert.equal(parsed.status, "risky");
    assert.equal(parsed.matchingRules[0]?.id, "expo-sdk-54-react-native-pager-view-scroll-lock");
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
