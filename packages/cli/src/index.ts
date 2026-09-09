#!/usr/bin/env node
import { analyzeProject, NativeGuardError, writeNativeGuardLockfile } from "@nativeguard/core";
import {
  validateDoctorReport,
  type Recommendation,
  type RecommendationAction,
  type RecommendationSurface
} from "@nativeguard/schema";

const CLI_VERSION = "0.0.0";

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv;

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
    const { writeLockfile, sdk } = parseDoctorArgs(args);
    const report = await analyzeProject({
      rootDir: process.cwd(),
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
      await writeNativeGuardLockfile(report, process.cwd());
    }

    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printReport(report, writeLockfile);
    }

    return report.summary.status === "risky" ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            schemaVersion: "1.0.0",
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

function parseDoctorArgs(args: string[]): { json: boolean; writeLockfile: boolean; sdk?: string } {
  let json = false;
  let writeLockfile = false;
  let sdk: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--write-lockfile") {
      writeLockfile = true;
      continue;
    }
    if (arg === "--sdk") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new NativeGuardError(
          "The --sdk flag requires an Expo SDK major, for example --sdk 54.",
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
          "The --sdk flag requires an Expo SDK major, for example --sdk=54.",
          "INVALID_SDK"
        );
      }
      sdk = value;
    }
  }

  return { json, writeLockfile, ...(sdk ? { sdk } : {}) };
}

function printHelp(): void {
  console.log(`NativeGuard

Usage:
  nativeguard --version
  nativeguard doctor [--json] [--write-lockfile] [--sdk <major>]
`);
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
    console.log("Wrote nativeguard-lock.json");
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
