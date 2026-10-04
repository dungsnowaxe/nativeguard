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
    name: "advisory-still-vulnerable",
    dir: "advisory-pager-view-vulnerable",
    exitCode: 1,
    status: "risky"
  },
  {
    name: "advisory-fixed-range",
    dir: "advisory-pager-view-fixed",
    exitCode: 0,
    status: "stable"
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

test("NG-E5: missing sdkVersion uses the expo package major", async () => {
  const fixturePath = path.join(fixturesRoot, "e5-sdk-from-package");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson;
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.project.expoSdkMajor, "53");
  assert.equal(parsed.project.expoSdkVersions, undefined);
  assert.ok(parsed.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  assert.equal(parsed.summary.status, "risky");
});

test("NG-E5: missing expo package major uses app.config.json sdkVersion", async () => {
  const fixturePath = path.join(fixturesRoot, "e5-sdk-from-config");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson;
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.project.expoSdkMajor, "53");
  assert.deepEqual(parsed.project.expoSdkVersions, ["53.0.0"]);
  assert.ok(parsed.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  assert.equal(parsed.summary.status, "risky");
});

test("NG-E5: expo package major vs sdkVersion mismatch is not stable", async () => {
  const fixturePath = path.join(fixturesRoot, "e5-sdk-mismatch");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as {
    schemaVersion?: string;
    error?: { code?: string; message?: string };
    summary?: { status?: string };
    project?: unknown;
  };
  assert.equal(output.exitCode, 1);
  assert.equal(parsed.schemaVersion, DOCTOR_REPORT_SCHEMA_VERSION);
  assert.equal(parsed.error?.code, "SDK_MISMATCH");
  assert.match(parsed.error?.message ?? "", /54/);
  assert.match(parsed.error?.message ?? "", /53/);
  assert.equal(parsed.summary, undefined);
  assert.equal(parsed.project, undefined);
});

test("NG-E5: disagreeing app.json and app.config.json sdkVersion is not stable", async () => {
  const fixturePath = path.join(fixturesRoot, "e5-sdk-config-conflict");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as { error?: { code?: string } };
  assert.equal(output.exitCode, 1);
  assert.equal(parsed.error?.code, "SDK_MISMATCH");
});

test("NG-E5: --sdk override wins over a package vs sdkVersion mismatch", async () => {
  const fixturePath = path.join(fixturesRoot, "e5-sdk-mismatch");
  const sdk53 = await captureStdout(() => main(["doctor", "--json", "--sdk", "53", fixturePath]));
  const parsed53 = parseCapturedJson(sdk53.stdout) as DoctorJson;
  assert.equal(sdk53.exitCode, 1);
  assertAnalysisJsonContract(parsed53, path.resolve(fixturePath));
  assert.equal(parsed53.project.expoSdkMajor, "53");
  assert.ok(parsed53.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  assert.equal(parsed53.summary.status, "risky");

  const sdk54 = await captureStdout(() => main(["doctor", "--json", "--sdk=54", fixturePath]));
  const parsed54 = parseCapturedJson(sdk54.stdout) as DoctorJson;
  assert.equal(sdk54.exitCode, 0);
  assertAnalysisJsonContract(parsed54, path.resolve(fixturePath));
  assert.equal(parsed54.project.expoSdkMajor, "54");
  assert.equal(
    parsed54.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
    false
  );
  assert.equal(parsed54.summary.status, "stable");
});

test("NG-E6: screens pin is risky on managed and not on dev-client or prebuild", async () => {
  const cases = [
    { dir: "e6-screens-managed", kind: "expo-managed", exitCode: 1, status: "risky", fires: true },
    { dir: "e6-screens-dev-client", kind: "expo-dev-client", exitCode: 0, status: "stable", fires: false },
    { dir: "e6-screens-prebuild", kind: "expo-prebuild", exitCode: 0, status: "stable", fires: false }
  ] as const;

  for (const fixture of cases) {
    const fixturePath = path.join(fixturesRoot, fixture.dir);
    const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
    const parsed = parseCapturedJson(output.stdout) as DoctorJson;
    assert.equal(output.exitCode, fixture.exitCode, fixture.dir);
    assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
    assert.equal(parsed.project.kind, fixture.kind, fixture.dir);
    assert.equal(parsed.summary.status, fixture.status, fixture.dir);
    assert.equal(
      parsed.findings?.some(finding => finding.ruleId === "sdk54-pin-screens-tilde-4.16"),
      fixture.fires,
      fixture.dir
    );
  }
});

test("NG-E7: app.config.js sdkVersion is used when the expo package has no major", async () => {
  const fixturePath = path.join(fixturesRoot, "e7-config-js-sdk");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson;
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.project.expoSdkMajor, "53");
  assert.deepEqual(parsed.project.expoSdkVersions, ["53.0.0"]);
  assert.ok(parsed.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
  assert.equal(parsed.summary.status, "risky");

  const override = await captureStdout(() => main(["doctor", "--json", "--sdk", "54", fixturePath]));
  const overridden = parseCapturedJson(override.stdout) as DoctorJson;
  assert.equal(override.exitCode, 0);
  assertAnalysisJsonContract(overridden, path.resolve(fixturePath));
  assert.equal(overridden.project.expoSdkMajor, "54");
  assert.equal(
    overridden.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
    false
  );
  assert.equal(overridden.summary.status, "stable");
});

test("NG-E7: app.config.js that throws fails closed", async () => {
  const fixturePath = path.join(fixturesRoot, "e7-config-js-throws");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as {
    error?: { code?: string; message?: string };
    summary?: unknown;
  };
  assert.equal(output.exitCode, 1);
  assert.equal(parsed.error?.code, "APP_CONFIG_JS");
  assert.match(parsed.error?.message ?? "", /EXPO_TOKEN/);
  assert.equal(parsed.summary, undefined);
});

test("NG-E7: app.config.js function is not called", async () => {
  const fixturePath = path.join(fixturesRoot, "e7-config-js-function");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as {
    error?: { code?: string; message?: string };
    summary?: unknown;
  };
  assert.equal(output.exitCode, 1);
  assert.equal(parsed.error?.code, "APP_CONFIG_JS");
  assert.match(parsed.error?.message ?? "", /function/i);
  assert.equal(parsed.summary, undefined);
});

test("NG-E7: app.config.js sdkVersion disagreeing with the expo package is SDK_MISMATCH", async () => {
  const fixturePath = path.join(fixturesRoot, "e7-config-js-mismatch");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as {
    error?: { code?: string; message?: string };
    summary?: unknown;
  };
  assert.equal(output.exitCode, 1);
  assert.equal(parsed.error?.code, "SDK_MISMATCH");
  assert.match(parsed.error?.message ?? "", /54/);
  assert.match(parsed.error?.message ?? "", /53/);
  assert.equal(parsed.summary, undefined);

  const override = await captureStdout(() => main(["doctor", "--json", "--sdk", "54", fixturePath]));
  const overridden = parseCapturedJson(override.stdout) as DoctorJson;
  assert.equal(override.exitCode, 0);
  assertAnalysisJsonContract(overridden, path.resolve(fixturePath));
  assert.equal(overridden.project.expoSdkMajor, "54");
  assert.equal(overridden.summary.status, "stable");
});

test("NG-E3: git URL is unsupported even when the lockfile resolved a semver", async () => {
  const fixturePath = path.join(fixturesRoot, "e3-git-url");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson & {
    dependencySnapshot?: {
      resolvedVersions?: Record<string, string>;
      unresolvedSpecifiers?: Record<string, string>;
    };
  };
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.summary.status, "unsupported");
  assert.equal(parsed.dependencySnapshot?.resolvedVersions?.["expo-haptics"], "14.0.1");
  assert.equal(
    parsed.dependencySnapshot?.unresolvedSpecifiers?.["expo-haptics"],
    "github:expo/expo#sdk-54"
  );
  const finding = (parsed.findings as Array<{ id?: string; detail?: string; status?: string }> | undefined)?.find(
    item => item.id === "finding-unresolved-versions"
  );
  assert.ok(finding);
  assert.equal(finding?.status, "unsupported");
  assert.match(finding?.detail ?? "", /github:expo\/expo#sdk-54/);
});

test("NG-E3: a normal semver still matches advisory ranges", async () => {
  const fixturePath = path.join(fixturesRoot, "e3-semver-advisory");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson & {
    dependencySnapshot?: { unresolvedSpecifiers?: Record<string, string> };
  };
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.summary.status, "risky");
  assert.equal(parsed.dependencySnapshot?.unresolvedSpecifiers, undefined);
  assert.ok(parsed.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
});

test("NG-E7: --sdk wins when app.config.js throws", async () => {
  const fixturePath = path.join(fixturesRoot, "e7-config-js-throws");
  const output = await captureStdout(() => main(["doctor", "--json", "--sdk", "54", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson & { error?: { code?: string } };
  assert.equal(output.exitCode, 0);
  assert.equal(parsed.error, undefined);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.project.expoSdkMajor, "54");
  assert.equal(parsed.summary.status, "stable");
});

test("NG-E9: disagreeing rules keep one recommendation and exit 1", async () => {
  const fixturePath = path.join(fixturesRoot, "e9-recommendation-conflict");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson;
  const recommendations = parsed.recommendations as Array<{
    action?: string;
    packageName?: string;
    to?: string;
    ruleId?: string;
  }>;
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.summary.status, "risky");
  const gesture = recommendations.filter(item => item.packageName === "react-native-gesture-handler");
  assert.equal(gesture.length, 1);
  assert.equal(gesture[0]?.action, "bump");
  assert.equal(gesture[0]?.to, "2.16.0");
  assert.equal(gesture[0]?.ruleId, "e9-bump-gesture-handler");
  assert.equal(parsed.recommendationConflicts?.length, 1);
  const conflict = parsed.recommendationConflicts?.[0];
  assert.equal(conflict?.packageName, "react-native-gesture-handler");
  assert.equal(conflict?.winner.ruleId, "e9-bump-gesture-handler");
  assert.equal(conflict?.winner.action, "bump");
  assert.deepEqual(conflict?.lost, [
    { ruleId: "a-e9-pin-gesture-handler", action: "pin", to: "2.14.1" }
  ]);
  assert.ok(parsed.findings?.some(finding => finding.id === "finding-recommendation-conflict-react-native-gesture-handler"));
  assert.equal(
    parsed.findings?.find(finding => finding.id === "finding-recommendation-conflict-react-native-gesture-handler")?.status,
    "risky"
  );
});

test("NG-E10: a vulnerable transitive lockfile version is risky", async () => {
  const fixturePath = path.join(fixturesRoot, "e10-transitive-pager-view");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson & {
    dependencySnapshot?: { dependencies?: Record<string, string>; resolvedVersions?: Record<string, string> };
  };
  assert.equal(output.exitCode, 1);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.summary.status, "risky");
  assert.equal(parsed.dependencySnapshot?.dependencies?.["react-native-pager-view"], undefined);
  assert.equal(parsed.dependencySnapshot?.resolvedVersions?.["react-native-pager-view"], "6.6.0");
  assert.ok(parsed.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"));
});

test("NG-E10: a missing lockfile resolution is not invented", async () => {
  const fixturePath = path.join(fixturesRoot, "e10-transitive-absent");
  const output = await captureStdout(() => main(["doctor", "--json", fixturePath]));
  const parsed = parseCapturedJson(output.stdout) as DoctorJson & {
    dependencySnapshot?: { resolvedVersions?: Record<string, string> };
  };
  assert.equal(output.exitCode, 0);
  assertAnalysisJsonContract(parsed, path.resolve(fixturePath));
  assert.equal(parsed.summary.status, "stable");
  assert.equal(parsed.dependencySnapshot?.resolvedVersions?.["react-native-pager-view"], undefined);
  assert.equal(
    parsed.findings?.some(finding => finding.ruleId === "pager-view-min-6.7.1-on-rn-079"),
    false
  );
});

interface DoctorJson extends AnalysisJson {
  project: AnalysisJson["project"] & { expoSdkMajor?: string; expoSdkVersions?: string[] };
  findings?: Array<{ ruleId?: string; id?: string; status?: string }>;
  recommendationConflicts?: Array<{
    packageName: string;
    winner: { ruleId?: string; action: string; to?: string };
    lost: Array<{ ruleId?: string; action: string; to?: string }>;
  }>;
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
