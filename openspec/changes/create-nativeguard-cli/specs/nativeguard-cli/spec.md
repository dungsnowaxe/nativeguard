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

### Requirement: Package manager lockfile resolve
The system SHALL resolve installed versions from npm, Yarn (classic v1 and Berry), pnpm, and Bun text lockfiles when present, and SHALL prefer those resolved versions for rule matching.

#### Scenario: npm project is analyzed
- **WHEN** a project uses npm package metadata and an npm lockfile
- **THEN** the CLI analyzes dependencies using lockfile-resolved versions while keeping declared ranges in the dependency snapshot

#### Scenario: Yarn, pnpm, or Bun lockfile is present
- **WHEN** a project has `yarn.lock`, `pnpm-lock.yaml`, or text `bun.lock`
- **THEN** the CLI resolves installed versions from that lockfile and matches rules against those versions

#### Scenario: declared range would miss a lock-resolved known-bad
- **WHEN** `package.json` declares a range that does not match a bundled rule and the lockfile resolves that package to a known-bad version
- **THEN** doctor reports the finding using the lock-resolved version

#### Scenario: binary Bun lockfile cannot be parsed
- **WHEN** a project has only `bun.lockb` and no text `bun.lock`
- **THEN** the CLI reports an explicit unsupported finding and does not classify the project as stable

### Requirement: Workspace catalog and overrides
The system SHALL analyze a target package directory and read the workspace-root lockfile, catalogs, resolutions, and overrides when the package is a workspace member.

#### Scenario: nested workspace package
- **WHEN** `nativeguard doctor` runs in a nested workspace package or with an optional project path
- **THEN** the CLI reads the workspace-root lockfile for that package

#### Scenario: catalog or override resolves
- **WHEN** a dependency uses `catalog:` or is pinned by Yarn `resolutions` or npm/pnpm `overrides` to a concrete version
- **THEN** the CLI uses that effective version for rule matching

#### Scenario: resolution is unknown
- **WHEN** a specifier such as `catalog:` cannot be resolved from the lockfile, catalog, or overrides
- **THEN** the CLI emits an explicit unsupported finding and does not return silent stable

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
