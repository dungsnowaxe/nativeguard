## ADDED Requirements

### Requirement: First-version scope boundary
The system SHALL keep first-version behavior focused on offline local analysis and reports.

#### Scenario: Safe apply is unavailable
- **WHEN** a user looks for deterministic remediation application in the first version
- **THEN** the CLI does not apply package or source changes automatically

#### Scenario: PR review is unavailable
- **WHEN** a user looks for GitHub PR review comments in the first version
- **THEN** the project treats that capability as roadmap work rather than first-version CLI behavior

#### Scenario: Hosted registry is unavailable
- **WHEN** a user runs first-version analysis
- **THEN** the CLI does not require a hosted rules registry or network access

### Requirement: Monorepo support roadmap
The system SHALL treat deep analysis of user monorepos as a roadmap capability rather than a first-version requirement.

#### Scenario: User project is a monorepo
- **WHEN** `nativeguard doctor` detects workspace metadata beyond first-version support
- **THEN** the CLI reports that deep monorepo support is not yet available instead of returning misleading single-project results

### Requirement: Future agent and GitHub Action compatibility
The system SHALL preserve contracts that allow future PR review, GitHub Action, MCP, and agent integrations to build on first-version output.

#### Scenario: Future integration consumes doctor output
- **WHEN** a future integration needs project stability data
- **THEN** it can consume the structured JSON output rather than scraping terminal text

#### Scenario: Future integration consumes rules
- **WHEN** a future agent skill needs compatibility facts
- **THEN** it can consume the rules package records and schemas without requiring access to private CLI internals
