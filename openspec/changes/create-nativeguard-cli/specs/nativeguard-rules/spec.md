## ADDED Requirements

### Requirement: Separate rules package
The system SHALL provide a separate rules package for bundled NativeGuard compatibility data.

#### Scenario: CLI loads bundled rules
- **WHEN** `nativeguard doctor` runs without network access
- **THEN** the CLI loads compatibility rules from the bundled rules package

#### Scenario: Rules package is independently versioned
- **WHEN** the CLI reports rule-pack provenance
- **THEN** the report identifies the rules package name and version used for evaluation

### Requirement: AI-friendly rule records
The rules dataset SHALL be structured so deterministic tooling and agent skills can consume the same compatibility facts.

#### Scenario: Rule includes stable identity
- **WHEN** a compatibility rule is defined
- **THEN** the rule includes a stable ID, affected package, affected version range, project context, confidence, and evaluation outcome

#### Scenario: Rule includes evidence
- **WHEN** a rule depends on external compatibility knowledge
- **THEN** the rule includes evidence metadata such as source type, URL, affected versions, fix versions, summary, and confidence

#### Scenario: Rule includes remediation guidance
- **WHEN** a rule describes a known incompatibility or acceptable exception
- **THEN** the rule includes structured remediation actions that can be rendered by the CLI without requiring AI interpretation

### Requirement: Rules schema validation
The rules dataset SHALL be validated against schemas before being consumed by the CLI.

#### Scenario: Invalid rule is rejected
- **WHEN** a rule record is missing required fields or violates the schema
- **THEN** validation fails before the rule is included in a published rule pack

#### Scenario: Valid rule is loadable
- **WHEN** a rule record satisfies the schema
- **THEN** the CLI can load and evaluate it as part of the bundled rule pack

### Requirement: Offline-first evaluation
The rules system SHALL evaluate local bundled rules without requiring network access.

#### Scenario: Network is unavailable
- **WHEN** a user runs `nativeguard doctor` without internet connectivity
- **THEN** the CLI completes analysis using the bundled rules package

#### Scenario: Remote rules are not required
- **WHEN** no remote registry configuration is present
- **THEN** the CLI does not attempt to fetch remote compatibility data during first-version analysis
