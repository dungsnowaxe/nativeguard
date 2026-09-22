#!/usr/bin/env node
import { analyzeProject, NativeGuardError, writeNativeGuardLockfile } from "@nativeguard/core";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  validateDoctorReport,
  type Recommendation,
  type RecommendationAction,
  type RecommendationSurface,
  type StabilityStatus
} from "@nativeguard/schema";

const CLI_VERSION = "0.0.0";

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv[0] === "--" ? argv.slice(1) : argv;

  if (command === "--version" || command === "-v") {
    console.log(CLI_VERSION);
    return 0;
  }

  if (command === "doctor") {
    return runDoctor(args);
  }

  if (command === "--help" || command === "-h" || command === undefined) {
    printHelp();
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

async function runDoctor(args: string[]): Promise<number> {
  const json = args.includes("--json");

  try {
    const { writeLockfile, sdk, rootDir } = parseDoctorArgs(args);
    const report = await analyzeProject({
      rootDir,
      cliVersion: CLI_VERSION,
      ...(sdk ? { sdk } : {})
    });

    const validation = validateDoctorReport(report);
    if (!validation.valid) {
      throw new NativeGuardError(
        `Doctor report failed schema validation: ${validation.errors.join(", ")}`,
        "INVALID_REPORT"
      );
    }

    if (writeLockfile) {
      await writeNativeGuardLockfile(report, rootDir);
    }

    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printReport(report, writeLockfile);
    }

    return exitCodeForStatus(report.summary.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            schemaVersion: DOCTOR_REPORT_SCHEMA_VERSION,
            error: {
              code: error instanceof NativeGuardError ? error.code : "UNKNOWN_ERROR",
              message
            }
          },
          null,
          2
        )}\n`
      );
    } else {
      console.error(`NativeGuard: ${message}`);
    }
    return 1;
  }
}

function parseDoctorArgs(args: string[]): {
  json: boolean;
  writeLockfile: boolean;
  sdk?: string;
  rootDir: string;
} {
  let json = false;
  let writeLockfile = false;
  let sdk: string | undefined;
  let rootDir: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--write-snapshot" || arg === "--write-lockfile") {
      writeLockfile = true;
      continue;
    }
    if (arg === "--sdk") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new NativeGuardError(
          "The --sdk flag requires an Expo SDK major or prerelease/soft string, for example --sdk 54 or --sdk 54.0.0-beta.1.",
          "INVALID_SDK"
        );
      }
      sdk = value;
      index += 1;
      continue;
    }
    if (arg?.startsWith("--sdk=")) {
      const value = arg.slice("--sdk=".length);
      if (!value) {
        throw new NativeGuardError(
          "The --sdk flag requires an Expo SDK major or prerelease/soft string, for example --sdk=54 or --sdk=54.0.0-beta.1.",
          "INVALID_SDK"
        );
      }
      sdk = value;
      continue;
    }
    if (arg?.startsWith("--")) {
      throw new NativeGuardError(`Unknown doctor option: ${arg}`, "INVALID_ARGS");
    }
    if (rootDir) {
      throw new NativeGuardError(
        "doctor accepts at most one project path. Usage: nativeguard doctor [path] [--json] [--write-snapshot] [--sdk <major|soft>]",
        "INVALID_ARGS"
      );
    }
    rootDir = arg;
  }

  return { json, writeLockfile, rootDir: rootDir ?? process.cwd(), ...(sdk ? { sdk } : {}) };
}

function printHelp(): void {
  console.log(`NativeGuard

Usage:
  nativeguard --version
  nativeguard doctor [path] [--json] [--write-snapshot] [--sdk <major|soft>]

  --write-snapshot, --write-lockfile
      Write nativeguard-lock.json (NativeGuard snapshot only).
      Does not mutate npm, Yarn, pnpm, or Bun lockfiles.
      Preserves acceptedExceptions already recorded in the snapshot.
  --sdk <major|soft>
      Filter rules to this Expo SDK major. Accepts a major integer or an
      unambiguous prerelease/soft string (54, 54beta, 54.0.0-beta.1).
      Parsed from the project when omitted. Garbage values exit 1 with INVALID_SDK.

  Exit codes:
      0  summary.status is stable or accepted-exception
      1  summary.status is risky or unsupported (including bare React Native)
      1  analysis did not run (INVALID_SDK, UNSUPPORTED_PROJECT, MISSING_PACKAGE_JSON, ...)

  JSON (--json):
      Analysis reports always include schemaVersion, recommendations[],
      summary.status, project.kind, and project.root. The contract is
      additive; ignore unknown fields. Failures emit
      { schemaVersion, error: { code, message } } and exit 1.

  Accepted pin/leave/exclude findings:
      Add an acceptedExceptions[] entry to nativeguard-lock.json (package, version,
      reason required, optional ruleId). The next doctor run surfaces matching
      pin, leave, or exclude findings as accepted-exception (warning, exit 0)
      instead of re-erroring. bump findings stay risky (exit 1) until the
      installed version changes. NativeGuard does not apply pins or bumps.
`);
}

function exitCodeForStatus(status: StabilityStatus): number {
  switch (status) {
    case "stable":
    case "accepted-exception":
      return 0;
    case "risky":
    case "unsupported":
      return 1;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function printReport(report: Awaited<ReturnType<typeof analyzeProject>>, wroteLockfile: boolean): void {
  console.log("NativeGuard Stability Report");
  console.log("");
  console.log(`Project: ${report.project.kind}`);
  console.log(`Package manager: ${report.project.packageManager}`);
  console.log(`Expo: ${report.project.expoVersion ?? "not detected"}`);
  console.log(`SDK: ${report.project.expoSdkMajor ?? "not detected"}`);
  console.log(`React Native: ${report.project.reactNativeVersion ?? "not detected"}`);
  console.log(`Status: ${report.summary.status.toUpperCase()}`);
  console.log("");

  if (report.findings.length === 0) {
    console.log("No findings.");
  } else {
    console.log("Findings:");
    for (const finding of report.findings) {
      console.log(`- [${finding.severity}] ${finding.title}`);
      console.log(`  ${finding.detail}`);
    }
  }

  console.log("");
  printRecommendationsTable(report.recommendations);

  console.log("");
  console.log("Next actions:");
  for (const action of report.nextActions) {
    console.log(`- ${action}`);
  }

  if (wroteLockfile) {
    console.log("");
    console.log("Wrote nativeguard-lock.json (NativeGuard snapshot; package manager lockfiles were not changed).");
  }
}

function printRecommendationsTable(recommendations: Recommendation[]): void {
  console.log("Recommendations:");
  if (recommendations.length === 0) {
    console.log("No recommendations.");
    return;
  }

  const headers = ["Package", "Action", "From", "To", "Surfaces", "Evidence"];
  const rows = recommendations.map(recommendation => [
    recommendation.packageName,
    formatRecommendationAction(recommendation.action),
    recommendation.from ?? "",
    recommendation.to ?? "",
    recommendation.surfaces.map(formatRecommendationSurface).join(","),
    formatEvidence(recommendation)
  ]);
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map(row => row[column]?.length ?? 0))
  );

  console.log(formatTableRow(headers, widths));
  console.log(widths.map(width => "-".repeat(width)).join(" | "));
  for (const row of rows) {
    console.log(formatTableRow(row, widths));
  }
}

function formatTableRow(cells: string[], widths: number[]): string {
  return cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join(" | ");
}

function formatRecommendationAction(action: RecommendationAction): string {
  switch (action) {
    case "bump":
    case "pin":
    case "leave":
    case "exclude":
      return action;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function formatRecommendationSurface(surface: RecommendationSurface): string {
  switch (surface) {
    case "eas":
    case "local-native":
    case "runtime":
      return surface;
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }
}

function formatEvidence(recommendation: Recommendation): string {
  if (recommendation.evidence.length === 0) return "";
  return recommendation.evidence
    .map(record => record.url ?? record.type)
    .join(",");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    exitCode => {
      process.exitCode = exitCode;
    },
    error => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
