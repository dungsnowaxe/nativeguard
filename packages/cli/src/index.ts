#!/usr/bin/env node
import {
  analyzeProject,
  compareNativeGuardSnapshots,
  createPrReviewReportFromSnapshots,
  createEnvironmentReport,
  createNativeGuardSnapshot,
  explainPackage,
  NativeGuardError,
  readNativeGuardSnapshot,
  writeNativeGuardLockfile,
  writeNativeGuardSnapshot
} from "@nativeguard/core";
import { renderPrReviewComment } from "@nativeguard/github-action";
import {
  DOCTOR_REPORT_SCHEMA_VERSION,
  validateDoctorReport,
  validateNativeGuardEnvironmentReport,
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

  if (command === "explain") {
    return runExplain(args);
  }

  if (command === "env-report") {
    return runEnvReport(args);
  }

  if (command === "snapshot") {
    return runSnapshot(args);
  }

  if (command === "compare") {
    return runCompare(args);
  }

  if (command === "review-pr") {
    return runReviewPr(args);
  }

  if (command === "--help" || command === "-h" || command === undefined) {
    printHelp();
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

async function runExplain(args: string[]): Promise<number> {
  const json = args.includes("--json");
  const configPath = readFlagValue(args, "--config");
  const packageName = args.find(arg => !arg.startsWith("--") && arg !== configPath);

  if (!packageName) {
    printCommandError(new NativeGuardError("explain requires <package[@version]>.", "INVALID_ARGUMENTS"), json);
    return 1;
  }

  try {
    const explanation = await explainPackage({
      rootDir: process.cwd(),
      cliVersion: CLI_VERSION,
      packageName,
      ...(configPath ? { configPath } : {})
    });

    if (json) {
      process.stdout.write(`${JSON.stringify(explanation, null, 2)}\n`);
    } else {
      printPackageExplanation(explanation);
    }

    return explanation.status === "risky" || explanation.status === "unknown" ? 1 : 0;
  } catch (error) {
    printCommandError(error, json);
    return 1;
  }
}

async function runSnapshot(args: string[]): Promise<number> {
  const json = args.includes("--json");
  const outputPath = readFlagValue(args, "--output");
  const configPath = readFlagValue(args, "--config");

  try {
    const snapshot = await createNativeGuardSnapshot({
      rootDir: process.cwd(),
      cliVersion: CLI_VERSION,
      ...(configPath ? { configPath } : {})
    });

    if (outputPath) {
      await writeNativeGuardSnapshot(snapshot, outputPath);
    }

    if (json || !outputPath) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      console.log(`Wrote NativeGuard snapshot to ${outputPath}`);
    }

    return 0;
  } catch (error) {
    printCommandError(error, json);
    return 1;
  }
}

async function runCompare(args: string[]): Promise<number> {
  const json = args.includes("--json");
  const basePath = readFlagValue(args, "--base");
  const headPath = readFlagValue(args, "--head");

  if (!basePath || !headPath) {
    printCommandError(new NativeGuardError("compare requires --base <path> and --head <path>.", "INVALID_ARGUMENTS"), json);
    return 1;
  }

  try {
    const comparison = compareNativeGuardSnapshots(
      await readNativeGuardSnapshot(basePath),
      await readNativeGuardSnapshot(headPath)
    );

    if (json) {
      process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    } else {
      printSnapshotComparison(comparison);
    }

    return comparison.changedPackages.length > 0 ? 1 : 0;
  } catch (error) {
    printCommandError(error, json);
    return 1;
  }
}

async function runReviewPr(args: string[]): Promise<number> {
  const json = args.includes("--json");
  const format = readFlagValue(args, "--format");
  const markdown = format ? format === "markdown" : !json;
  const basePath = readFlagValue(args, "--base");
  const headPath = readFlagValue(args, "--head");
  const repository = readFlagValue(args, "--repository");
  const baseRef = readFlagValue(args, "--base-ref");
  const headRef = readFlagValue(args, "--head-ref");

  if (!basePath || !headPath) {
    printCommandError(new NativeGuardError("review-pr requires --base <snapshot> and --head <snapshot>.", "INVALID_ARGUMENTS"), json);
    return 1;
  }

  try {
    const report = createPrReviewReportFromSnapshots(
      await readNativeGuardSnapshot(basePath),
      await readNativeGuardSnapshot(headPath)
    );

    if (json || !markdown) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(renderPrReviewComment(report, {
        ...(repository ? { repository } : {}),
        ...(baseRef ? { baseRef } : {}),
        ...(headRef ? { headRef } : {})
      }));
    }

    return report.status === "red" ? 1 : 0;
  } catch (error) {
    printCommandError(error, json);
    return 1;
  }
}

async function runEnvReport(args: string[]): Promise<number> {
  const json = args.includes("--json");

  try {
    const report = await createEnvironmentReport({
      rootDir: process.cwd(),
      cliVersion: CLI_VERSION
    });

    const validation = validateNativeGuardEnvironmentReport(report);
    if (!validation.valid) {
      throw new NativeGuardError(
        `Environment report failed schema validation: ${validation.errors.join(", ")}`,
        "INVALID_ENVIRONMENT_REPORT"
      );
    }

    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printEnvironmentReport(report);
    }

    return 0;
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

async function runDoctor(args: string[]): Promise<number> {
  const parsedArgs = parseDoctorArgs(args);
  const { json, writeLockfile, ci, configPath, sdk, rootDir } = parsedArgs;

  try {
    const report = await analyzeProject({
      rootDir,
      cliVersion: CLI_VERSION,
      ...(configPath ? { configPath } : {}),
      ...(sdk ? { sdk } : {}),
      ci
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

    const statusCode = exitCodeForStatus(report.summary.status);
    return ci ? report.policy?.exitDecision.exitCode ?? statusCode : statusCode;
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

function parseDoctorArgs(args: string[]): {
  json: boolean;
  writeLockfile: boolean;
  ci: boolean;
  configPath?: string;
  sdk?: string;
  rootDir: string;
} {
  let json = false;
  let writeLockfile = false;
  let ci = false;
  let configPath: string | undefined;
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
    if (arg === "--ci") {
      ci = true;
      continue;
    }
    if (arg === "--config") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new NativeGuardError("The --config flag requires a path.", "INVALID_ARGS");
      }
      configPath = value;
      index += 1;
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

  return {
    json,
    writeLockfile,
    ci,
    rootDir: rootDir ?? process.cwd(),
    ...(configPath ? { configPath } : {}),
    ...(sdk ? { sdk } : {})
  };
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

function printHelp(): void {
  console.log(`NativeGuard

Usage:
  nativeguard --version
  nativeguard doctor [path] [--json] [--write-snapshot] [--sdk <major|soft>] [--ci] [--config <path>]
  nativeguard explain <package[@version]> [--json] [--config <path>]
  nativeguard env-report [--json]
  nativeguard snapshot [--json] [--output <path>] [--config <path>]
  nativeguard compare --base <path> --head <path> [--json]
  nativeguard review-pr --base <snapshot> --head <snapshot> [--json|--format markdown]

  --write-snapshot, --write-lockfile
      Write nativeguard-lock.json (NativeGuard snapshot only).
  --sdk <major|soft>
      Filter rules to this Expo SDK major. Garbage values exit 1 with INVALID_SDK.
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
  if (report.dependencyGraph) {
    console.log(
      `Graph: ${report.dependencyGraph.nodes.length} packages · ${report.dependencyGraph.duplicates.length} duplicates · ${report.dependencyGraph.patchedPackages.length} patched`
    );
  }
  if (report.policy) {
    console.log(`Policy: ${report.policy.exitDecision.reason}`);
  }
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
  return recommendation.evidence.map(record => record.url ?? record.type).join(",");
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function printSnapshotComparison(comparison: ReturnType<typeof compareNativeGuardSnapshots>): void {
  console.log("NativeGuard Snapshot Comparison");
  console.log("");
  console.log(`Changed packages: ${comparison.changedPackages.length}`);
  console.log(`Added: ${comparison.addedPackages.length}`);
  console.log(`Removed: ${comparison.removedPackages.length}`);
  console.log(`Version changes: ${comparison.changedPackageVersions.length}`);
  for (const change of comparison.changedPackages) {
    console.log(`- ${change.changeType} ${change.packageName}: ${change.beforeVersion ?? "-"} -> ${change.afterVersion ?? "-"}`);
  }
}

function printPackageExplanation(explanation: Awaited<ReturnType<typeof explainPackage>>): void {
  console.log(`NativeGuard Package Explanation: ${explanation.packageName}`);
  console.log("");
  console.log(`Status: ${explanation.status.toUpperCase()}`);
  console.log(`Installed versions: ${explanation.installedVersions.length > 0 ? explanation.installedVersions.join(", ") : "not installed"}`);
  console.log(`Declared range: ${explanation.declaredRange ?? "not declared"}`);
  console.log(`Direct dependency: ${explanation.direct ? "yes" : "no"}`);
  console.log(`Classification: ${explanation.classification}`);
  if (explanation.unknownReason) {
    console.log(`Unknown: ${explanation.unknownReason}`);
  }

  console.log("");
  console.log("Findings:");
  if (explanation.findings.length === 0) {
    console.log("- none");
  } else {
    for (const finding of explanation.findings) {
      console.log(`- [${finding.severity}] ${finding.title}`);
    }
  }

  console.log("");
  console.log("Actions:");
  if (explanation.recommendedActions.length === 0) {
    console.log("- none");
  } else {
    for (const action of explanation.recommendedActions) {
      console.log(`- ${action.type}: ${action.note}`);
    }
  }
}

function printCommandError(error: unknown, json: boolean): void {
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
}

function printEnvironmentReport(report: Awaited<ReturnType<typeof createEnvironmentReport>>): void {
  console.log("NativeGuard Environment Report");
  console.log("");
  console.log(`Project: ${report.project.kind}`);
  console.log(`Package manager: ${report.toolchain.packageManager}`);
  console.log(`Expo: ${report.project.expoVersion ?? "not detected"}`);
  console.log(`React Native: ${report.project.reactNativeVersion ?? "not detected"}`);
  console.log(`New Architecture: ${report.project.newArchitecture?.enabled ?? "unknown"}`);
  console.log("");
  console.log("Missing context:");
  if (report.toolchain.missingContext.length === 0) {
    console.log("- none");
  } else {
    for (const item of report.toolchain.missingContext) {
      console.log(`- ${item}`);
    }
  }
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
