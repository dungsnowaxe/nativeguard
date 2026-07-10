## ADDED Requirements

### Requirement: CLI package and executable
The system SHALL provide a TypeScript CLI package named `@nativeguard/cli` that exposes a `nativeguard` executable.

#### Scenario: CLI package exposes binary
- **WHEN** the CLI package is installed
- **THEN** the `nativeguard` command is available from the package binary entrypoint

#### Scenario: CLI reports version
- **WHEN** a user runs `nativeguard --version`
- **THEN** the CLI prints the installed NativeGuard CLI version

### Requirement: Doctor command
The system SHALL provide a `nativeguard doctor` command that analyzes the current project for React Native and Expo dependency stability.

#### Scenario: Doctor analyzes supported project
- **WHEN** a user runs `nativeguard doctor` in a supported Expo prebuild or React Native project
- **THEN** the CLI scans local project metadata and prints a compatibility report

#### Scenario: Doctor handles unsupported project
- **WHEN** a user runs `nativeguard doctor` outside a supported React Native or Expo project
- **THEN** the CLI exits with a non-zero status and explains which required project signals were missing

### Requirement: Project profile detection
The system SHALL detect the project profile needed for compatibility analysis, including Expo package version, React Native package version, package manager, and available native project signals.

#### Scenario: Expo prebuild project is detected
- **WHEN** a project contains Expo configuration and generated native project directories
- **THEN** the CLI classifies the project as Expo prebuild

#### Scenario: Bare React Native project is detected
- **WHEN** a project contains React Native dependencies and native project directories without Expo project ownership
- **THEN** the CLI classifies the project as bare React Native

#### Scenario: Expo Go project is detected
- **WHEN** a project contains Expo configuration without generated native project directories
- **THEN** the CLI classifies the project as Expo Go

### Requirement: Package manager priority
The system SHALL support npm first and expose package-manager analysis through an adapter boundary for later Yarn, pnpm, and Bun support.

#### Scenario: npm project is analyzed
- **WHEN** a project uses npm package metadata and an npm lockfile
- **THEN** the CLI analyzes dependencies using the npm adapter

#### Scenario: later package manager is detected
- **WHEN** a project uses Yarn, pnpm, or Bun before full support is implemented
- **THEN** the CLI identifies the package manager and reports the current support limitation without misclassifying it as npm

### Requirement: JSON output contract
The system SHALL provide structured JSON output for `nativeguard doctor` as a stable machine-readable contract.

#### Scenario: Doctor emits JSON
- **WHEN** a user runs `nativeguard doctor --json`
- **THEN** the CLI writes a JSON report containing schema version, project profile, rule-pack provenance, findings, summary status, and recommended next actions

#### Scenario: JSON output is parseable
- **WHEN** the CLI exits after `nativeguard doctor --json`
- **THEN** the emitted output is valid JSON with no human-readable decoration mixed into stdout

### Requirement: Human-readable report
The system SHALL provide a human-readable doctor report for terminal users.

#### Scenario: Doctor prints terminal report
- **WHEN** a user runs `nativeguard doctor` without `--json`
- **THEN** the CLI prints a concise report with project profile, stability summary, findings, and recommended next actions
