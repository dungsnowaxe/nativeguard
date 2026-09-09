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
    assert.doesNotThrow(() => parseCapturedJson(output.stdout));
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
    const parsed = parseCapturedJson(output.stdout) as {
      project: { kind: string; expoSdkMajor?: string };
      packageIssues: Array<{ packageName: string; installedVersion: string; affectedRange: string }>;
      findings: Array<{ ruleId?: string }>;
      recommendations: Array<{
        action: string;
        packageName: string;
        surfaces: string[];
        evidence: unknown[];
      }>;
    };
    assert.equal(parsed.project.kind, "expo-prebuild");
    assert.equal(parsed.project.expoSdkMajor, "54");
    assert.ok(parsed.findings.length > 0);
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
    assert.deepEqual(
      parsed.recommendations.map(recommendation => ({
        action: recommendation.action,
        packageName: recommendation.packageName,
        surfaces: recommendation.surfaces
      })),
      [
        {
          action: "leave",
          packageName: "react-native-svg",
          surfaces: ["eas", "local-native"]
        },
        {
          action: "exclude",
          packageName: "react-native-svg",
          surfaces: ["eas", "local-native"]
        }
      ]
    );
    assert.ok(parsed.recommendations.every(recommendation => Array.isArray(recommendation.evidence)));
  } finally {
    process.chdir(previous);
  }
});

test("prints a human recommendations table", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-cli-human-"));
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
    const output = await captureStdout(() => main(["doctor"]));
    assert.match(output.stdout, /Recommendations:/);
    assert.match(output.stdout, /Package\s+\|\s+Action\s+\|\s+From\s+\|\s+To\s+\|\s+Surfaces\s+\|\s+Evidence/);
    assert.match(output.stdout, /react-native-pager-view\s+\|\s+bump\s+\|\s+6\.9\.1\s+\|\s+7\.0\.2\s+\|\s+eas,local-native/);
    assert.match(output.stdout, /Findings:/);
  } finally {
    process.chdir(previous);
  }
});

test("filters doctor rules with --sdk", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-cli-sdk-"));
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
    const sdk54 = await captureStdout(() => main(["doctor", "--json", "--sdk", "54"]));
    const sdk53 = await captureStdout(() => main(["doctor", "--json", "--sdk=53"]));
    const parsed54 = parseCapturedJson(sdk54.stdout) as {
      project: { expoSdkMajor?: string };
      findings: Array<{ ruleId?: string }>;
    };
    const parsed53 = parseCapturedJson(sdk53.stdout) as {
      project: { expoSdkMajor?: string };
      findings: Array<{ ruleId?: string }>;
    };

    assert.equal(parsed54.project.expoSdkMajor, "54");
    assert.ok(parsed54.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-pager-view-scroll-lock"));
    assert.equal(parsed53.project.expoSdkMajor, "53");
    assert.equal(
      parsed53.findings.some(finding => finding.ruleId === "expo-sdk-54-react-native-pager-view-scroll-lock"),
      false
    );
    assert.equal(
      parsed53.findings.some(finding => finding.ruleId === "legendapp-list-v2-react-native-api-migration"),
      false
    );
  } finally {
    process.chdir(previous);
  }
});

test("matches CLI JSON analysis against lockfile-resolved versions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-cli-lock-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: {
          expo: "~54.0.0",
          "react-native": "0.81.0",
          "react-native-pager-view": "^6.0.0"
        }
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(root, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": {
          dependencies: {
            expo: "~54.0.0",
            "react-native": "0.81.0",
            "react-native-pager-view": "^6.0.0"
          }
        },
        "node_modules/expo": { version: "54.0.33" },
        "node_modules/react-native": { version: "0.81.5" },
        "node_modules/react-native-pager-view": { version: "6.9.1" }
      }
    })
  );
  await mkdir(path.join(root, "ios"));
  await mkdir(path.join(root, "android"));

  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["doctor", "--json"]));
    const parsed = parseCapturedJson(output.stdout) as {
      project: { expoSdkMajor?: string };
      dependencySnapshot: {
        dependencies: Record<string, string>;
        resolvedVersions?: Record<string, string>;
      };
      packageIssues: Array<{ packageName: string; installedVersion: string }>;
    };

    assert.equal(parsed.project.expoSdkMajor, "54");
    assert.equal(parsed.dependencySnapshot.dependencies["react-native-pager-view"], "^6.0.0");
    assert.equal(parsed.dependencySnapshot.resolvedVersions?.["react-native-pager-view"], "6.9.1");
    assert.equal(
      parsed.packageIssues.find(issue => issue.packageName === "react-native-pager-view")?.installedVersion,
      "6.9.1"
    );
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

function parseCapturedJson(stdout: string): unknown {
  const marker = stdout.lastIndexOf('"schemaVersion"');
  const start = marker === -1 ? stdout.indexOf("{") : stdout.lastIndexOf("{", marker);
  const end = stdout.lastIndexOf("}");
  assert.notEqual(start, -1);
  assert.ok(end > start);
  return JSON.parse(stdout.slice(start, end + 1));
}
