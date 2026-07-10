#!/usr/bin/env node
import { analyzeProject, createEnvironmentReport, NativeGuardError, writeNativeGuardLockfile } from "@nativeguard/core";
import { validateDoctorReport, validateNativeGuardEnvironmentReport } from "@nativeguard/schema";

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

  if (command === "env-report") {
    return runEnvReport(args);
  }

  if (command === "--help" || command === "-h" || command === undefined) {
    printHelp();
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
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
  const json = args.includes("--json");
  const writeLockfile = args.includes("--write-lockfile");

  try {
    const report = await analyzeProject({
      rootDir: process.cwd(),
      cliVersion: CLI_VERSION
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

function printHelp(): void {
  console.log(`NativeGuard

Usage:
  nativeguard --version
  nativeguard doctor [--json] [--write-lockfile]
  nativeguard env-report [--json]
`);
}

function printReport(report: Awaited<ReturnType<typeof analyzeProject>>, wroteLockfile: boolean): void {
  console.log("NativeGuard Stability Report");
  console.log("");
  console.log(`Project: ${report.project.kind}`);
  console.log(`Package manager: ${report.project.packageManager}`);
  console.log(`Expo: ${report.project.expoVersion ?? "not detected"}`);
  console.log(`React Native: ${report.project.reactNativeVersion ?? "not detected"}`);
  console.log(`Status: ${report.summary.status.toUpperCase()}`);
  if (report.dependencyGraph) {
    console.log(
      `Graph: ${report.dependencyGraph.nodes.length} packages · ${report.dependencyGraph.duplicates.length} duplicates · ${report.dependencyGraph.patchedPackages.length} patched`
    );
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
  console.log("Next actions:");
  for (const action of report.nextActions) {
    console.log(`- ${action}`);
  }

  if (wroteLockfile) {
    console.log("");
    console.log("Wrote nativeguard-lock.json");
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
