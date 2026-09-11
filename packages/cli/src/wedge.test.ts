import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { RECOMMENDATION_ACTIONS, RECOMMENDATION_SURFACES } from "@nativeguard/schema";
import { main } from "./index.js";

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

test("wedge: doctor --json on sentry-expo fixture emits exclude with evidence and surfaces", async () => {
  const parsed = await doctorJson(path.join(fixturesRoot, "sentry-expo-sdk54"));
  assert.equal(parsed.summary.status, "risky");
  const exclude = parsed.recommendations.find(recommendation => recommendation.action === "exclude");
  assert.ok(exclude);
  assert.equal(exclude.packageName, "sentry-expo");
  assert.equal(RECOMMENDATION_ACTIONS.includes(exclude.action), true);
  assert.ok(exclude.evidence.length > 0);
  assert.ok(exclude.surfaces.every(surface => RECOMMENDATION_SURFACES.includes(surface)));
});

test("wedge: doctor --json on pager-view fixture emits bump", async () => {
  const parsed = await doctorJson(path.join(fixturesRoot, "sdk53-pager-view"));
  assert.ok(
    parsed.recommendations.some(
      recommendation =>
        recommendation.action === "bump" && recommendation.packageName === "react-native-pager-view"
    )
  );
});

test("wedge: --sdk 54 hides the SDK 53 pager-view rule", async () => {
  const previous = process.cwd();
  process.chdir(path.join(fixturesRoot, "sdk53-pager-view"));
  try {
    const sdk54 = parseCapturedJson((await captureStdout(() => main(["doctor", "--json", "--sdk", "54"]))).stdout);
    const sdk53 = parseCapturedJson((await captureStdout(() => main(["doctor", "--json", "--sdk=53"]))).stdout);
    assert.equal(sdk54.project.expoSdkMajor, "54");
    assert.equal(
      sdk54.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
      false
    );
    assert.ok(sdk53.findings.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  } finally {
    process.chdir(previous);
  }
});

test("wedge: bare React Native doctor JSON is unsupported, not stable", async () => {
  const parsed = await doctorJson(path.join(fixturesRoot, "bare-react-native"));
  assert.equal(parsed.project.kind, "bare-react-native");
  assert.equal(parsed.summary.status, "unsupported");
  assert.notEqual(parsed.summary.status, "stable");
});

test("wedge: acceptedExceptions round-trip leave/exclude without re-erroring", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-cli-accepted-"));
  await cp(path.join(fixturesRoot, "sentry-expo-sdk54"), root, { recursive: true });
  const previous = process.cwd();
  process.chdir(root);
  try {
    const first = await captureStdout(() => main(["doctor", "--json", "--write-snapshot"]));
    assert.equal(first.exitCode, 1);
    const firstReport = parseCapturedJson(first.stdout);
    assert.equal(firstReport.summary.status, "risky");

    const snapshotPath = path.join(root, "nativeguard-lock.json");
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as {
      acceptedExceptions: unknown[];
    };
    snapshot.acceptedExceptions = [
      {
        packageName: "sentry-expo",
        version: "7.2.0",
        reason: "Accepted until @sentry/react-native migration.",
        ruleId: "ban-sentry-expo-on-sdk-ge-50"
      }
    ];
    await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

    const second = await captureStdout(() => main(["doctor", "--json", "--write-snapshot"]));
    assert.equal(second.exitCode, 0);
    const secondReport = parseCapturedJson(second.stdout);
    assert.equal(secondReport.summary.status, "accepted-exception");
    assert.equal(secondReport.findings[0]?.status, "accepted-exception");

    const preserved = JSON.parse(await readFile(snapshotPath, "utf8")) as {
      acceptedExceptions: Array<{ packageName: string }>;
    };
    assert.equal(preserved.acceptedExceptions[0]?.packageName, "sentry-expo");
  } finally {
    process.chdir(previous);
  }
});

interface DoctorJson {
  project: { kind?: string; expoSdkMajor?: string };
  summary: { status: string };
  findings: Array<{ ruleId?: string; status?: string }>;
  recommendations: Array<{
    action: (typeof RECOMMENDATION_ACTIONS)[number];
    packageName: string;
    evidence: unknown[];
    surfaces: Array<(typeof RECOMMENDATION_SURFACES)[number]>;
  }>;
}

async function doctorJson(root: string): Promise<DoctorJson> {
  const previous = process.cwd();
  process.chdir(root);
  try {
    const output = await captureStdout(() => main(["doctor", "--json"]));
    return parseCapturedJson(output.stdout);
  } finally {
    process.chdir(previous);
  }
}

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

function parseCapturedJson(stdout: string): DoctorJson {
  const marker = stdout.lastIndexOf('"schemaVersion"');
  const start = marker === -1 ? stdout.indexOf("{") : stdout.lastIndexOf("{", marker);
  const end = stdout.lastIndexOf("}");
  assert.notEqual(start, -1);
  assert.ok(end > start);
  return JSON.parse(stdout.slice(start, end + 1)) as DoctorJson;
}

