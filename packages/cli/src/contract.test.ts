import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  PROJECT_KINDS,
  STABILITY_STATUSES,
  validateDoctorReport
} from "@nativeguard/schema";
import { main } from "./index.js";

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

const analysisFixtureClasses = [
  {
    name: "clean",
    dir: "expo-prebuild",
    exitCode: 0,
    status: "stable"
  },
  {
    name: "risky",
    dir: "sdk53-pager-view",
    exitCode: 1,
    status: "risky"
  },
  {
    name: "unsupported",
    dir: "bare-react-native",
    exitCode: 1,
    status: "unsupported"
  }
] as const;

for (const fixture of analysisFixtureClasses) {
  test(`exit code + JSON shape: ${fixture.name} (${fixture.dir}) is ${fixture.exitCode} / ${fixture.status}`, async () => {
    const fixturePath = path.join(fixturesRoot, fixture.dir);
    const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
    const parsed = parseCapturedJson(output.stdout);

    assert.equal(output.exitCode, fixture.exitCode);
    assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
    assert.equal(parsed.summary.status, fixture.status);
  });
}

test("exit code + JSON shape: accepted-exception (leave) is 0 / accepted-exception", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-contract-accepted-"));
  await cp(path.join(fixturesRoot, "sdk54-leave-expo-av"), root, { recursive: true });

  const first = await captureStdout(() => main(["doctor", "--json", "--write-snapshot", root]));
  assert.equal(first.exitCode, 1);
  const firstReport = parseCapturedJson(first.stdout);
  assertAnalysisJsonContract(firstReport, path.resolve(root));
  assert.equal(firstReport.summary.status, "risky");

  const snapshotPath = path.join(root, "nativeguard-lock.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as {
    acceptedExceptions: unknown[];
  };
  snapshot.acceptedExceptions = [
    {
      packageName: "expo-av",
      version: "16.0.7",
      reason: "Leaving expo-av on SDK 54 until the expo-audio / expo-video migration.",
      ruleId: "sdk54-leave-expo-av-pending-audio-video-migration"
    }
  ];
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  const second = await captureStdout(() => main(["doctor", "--json", root]));
  const parsed = parseCapturedJson(second.stdout);
  assert.equal(second.exitCode, 0);
  assertAnalysisJsonContract(parsed, path.resolve(root));
  assert.equal(parsed.summary.status, "accepted-exception");
});

test("exit code + JSON shape: INVALID_SDK is 1 with error payload", async () => {
  const fixturePath = path.join(fixturesRoot, "expo-prebuild");
  const output = await captureStdout(() => main(["doctor", "--json", "--sdk", "54xyz", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as {
    schemaVersion?: string;
    error?: { code?: string; message?: string };
    recommendations?: unknown;
    summary?: unknown;
    project?: unknown;
  };

  assert.equal(output.exitCode, 1);
  assert.equal(parsed.schemaVersion, DOCTOR_REPORT_SCHEMA_VERSION);
  assert.equal(parsed.error?.code, "INVALID_SDK");
  assert.match(parsed.error?.message ?? "", /54xyz/);
  assert.equal(parsed.recommendations, undefined);
  assert.equal(parsed.summary, undefined);
  assert.equal(parsed.project, undefined);
});

test("smoke: --json analysis shape is stable across fixture classes", async () => {
  const reports: AnalysisJson[] = [];

  for (const fixture of analysisFixtureClasses) {
    const fixturePath = path.join(fixturesRoot, fixture.dir);
    const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
    const parsed = parseCapturedJson(output.stdout);
    assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
    reports.push(parsed);
  }

  const roots = new Set(reports.map(report => report.project.root));
  assert.equal(roots.size, analysisFixtureClasses.length);
  assert.deepEqual(
    [...new Set(reports.map(report => report.schemaVersion))],
    [DOCTOR_REPORT_SCHEMA_VERSION]
  );
  assert.ok(reports.every(report => Array.isArray(report.recommendations)));
  assert.ok(reports.every(report => STABILITY_STATUSES.includes(report.summary.status)));
  assert.ok(reports.every(report => PROJECT_KINDS.includes(report.project.kind)));
});

interface AnalysisJson {
  schemaVersion: string;
  recommendations: unknown[];
  summary: { status: (typeof STABILITY_STATUSES)[number] };
  project: { kind: (typeof PROJECT_KINDS)[number]; root: string };
}

function assertAnalysisJsonContract(value: unknown, expectedRoot: string): asserts value is AnalysisJson {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  const parsed = value as Record<string, unknown>;
  const validation = validateDoctorReport(parsed);
  assert.equal(validation.valid, true, validation.errors.join(", "));

  assert.equal(parsed.schemaVersion, DOCTOR_REPORT_SCHEMA_VERSION);
  assert.ok(Array.isArray(parsed.recommendations));
  assert.equal("error" in parsed, false);

  const summary = parsed.summary;
  assert.equal(typeof summary, "object");
  assert.notEqual(summary, null);
  const status = (summary as { status?: unknown }).status;
  assert.equal(typeof status, "string");
  assert.ok(STABILITY_STATUSES.includes(status as (typeof STABILITY_STATUSES)[number]));

  const project = parsed.project;
  assert.equal(typeof project, "object");
  assert.notEqual(project, null);
  const kind = (project as { kind?: unknown }).kind;
  const root = (project as { root?: unknown }).root;
  assert.equal(typeof kind, "string");
  assert.ok(PROJECT_KINDS.includes(kind as (typeof PROJECT_KINDS)[number]));
  assert.equal(root, expectedRoot);
}

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
