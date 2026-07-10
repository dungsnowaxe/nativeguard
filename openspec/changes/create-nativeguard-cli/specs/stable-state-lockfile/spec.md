## ADDED Requirements

### Requirement: Stable-state lockfile
The system SHALL define `nativeguard-lock.json` as the NativeGuard stable-state snapshot file.

#### Scenario: Lockfile is written
- **WHEN** a user requests lockfile creation after a successful doctor analysis
- **THEN** the CLI writes `nativeguard-lock.json` at the project root

#### Scenario: Lockfile is not a package lockfile
- **WHEN** `nativeguard-lock.json` is created
- **THEN** it records NativeGuard stability state and does not replace or modify npm, Yarn, pnpm, or Bun lockfiles

### Requirement: Lockfile captures provenance
The lockfile SHALL capture enough provenance to reproduce the NativeGuard interpretation of the project state.

#### Scenario: Provenance is recorded
- **WHEN** the CLI writes `nativeguard-lock.json`
- **THEN** the file includes schema version, NativeGuard CLI version, rules package version, project profile, package manager, dependency snapshot summary, findings summary, and generated timestamp

### Requirement: Lockfile captures accepted exceptions
The lockfile SHALL support recording accepted compatibility exceptions separately from package-manager dependency resolution.

#### Scenario: Exception is recorded
- **WHEN** a user accepts an intentional off-matrix dependency state
- **THEN** the lockfile records the package, version, reason, related rule or finding ID, and review metadata

#### Scenario: Exception remains auditable
- **WHEN** a future doctor run reads a lockfile with accepted exceptions
- **THEN** the CLI can distinguish accepted exceptions from newly introduced risks

### Requirement: Lockfile schema version
The lockfile SHALL include an explicit schema version.

#### Scenario: Supported lockfile is read
- **WHEN** the CLI reads a `nativeguard-lock.json` with a supported schema version
- **THEN** the CLI can use it for stable-state comparison

#### Scenario: Unsupported lockfile is read
- **WHEN** the CLI reads a `nativeguard-lock.json` with an unsupported schema version
- **THEN** the CLI reports the incompatibility and avoids silently misinterpreting the file
