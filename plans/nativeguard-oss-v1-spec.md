# NativeGuard OSS v1 Specification

## Purpose

NativeGuard is an Expo / React Native dependency compatibility tool. Its first public open-source release must help maintainers decide whether a dependency graph is known stable, intentionally off-matrix, temporarily patched, unknown, or unsafe to ship.

The public v1 is not a thin MVP. Internal milestones can be incremental, but public v1 must be complete enough for real repositories, CI, dependency PRs, and community rule contributions.

## Product Promise

NativeGuard answers these questions:

- Is this Expo / React Native dependency graph stable for this project context?
- If a package is off the recommended matrix, is that intentional, risky, or supported by evidence?
- Did this Renovate / Dependabot PR introduce new dependency risk?
- Which patch, override, resolution, package extension, config change, or verification step is required?
- Which warnings are new risk, known exceptions, stale exceptions, or unknowns?
- What environment snapshot can be safely shared with maintainers without leaking secrets?

## Public v1 Release Bar

Public v1 requires all of the following:

- CLI commands for local analysis, explanations, planning, snapshots, comparisons, and rule validation.
- Stable JSON schemas for config, report, snapshot, and rules.
- Deterministic rule evaluation with confidence and evidence.
- CI-friendly exit codes and GitHub Action integration.
- Fixture-backed tests for Expo managed, Expo prebuild, bare RN, monorepo, package-manager, and New Architecture cases.
- Contribution templates and rule authoring docs.
- Security and privacy policy for reports, rules, and optional remote updates.
- Release process for CLI/core and rules.
- At least 10 real-project validations and at least 5 clear wins over generic dependency update tooling.

## Non-Goals For Public v1

- Do not replace Renovate, Dependabot, Expo Doctor, React Native Directory, rnx-kit, Snyk, Socket, or npm audit.
- Do not automatically scrape GitHub Issues during normal installs or CI.
- Do not apply source patches blindly.
- Do not attempt full npm coverage.
- Do not launch a dashboard-first product.
- Do not require AI for normal operation.
- Do not claim certainty when rules or metadata are missing.

## Repository Layout

Recommended monorepo structure:

```text
nativeguard/
  packages/
    core/
    cli/
    rules/
    github-action/
    schemas/
  fixtures/
    expo-managed/
    expo-prebuild/
    bare-react-native/
    monorepo/
    package-managers/
    new-architecture/
  docs/
    concepts/
    commands/
    rules/
    contributing/
    ci/
    security/
  examples/
    github-action/
    renovate/
    local-config/
  plans/
```

### Package Responsibilities

`@nativeguard/core`

- Repo scanning.
- Project context detection.
- Dependency graph modeling.
- Rule loading and evaluation.
- Policy and exception evaluation.
- Report generation.
- Snapshot and graph diff logic.

`@nativeguard/cli`

- Command routing.
- Terminal rendering.
- JSON output.
- Exit code handling.
- Config loading.
- Local redaction behavior.

`@nativeguard/rules`

- Public curated rule pack.
- Rule metadata.
- Rule tests and fixtures.
- Rule changelog.

`@nativeguard/github-action`

- GitHub Action wrapper.
- PR comment rendering.
- Check annotations.
- Stable-state snapshot upload/download.

`@nativeguard/schemas`

- JSON schemas for config, rule, report, snapshot, and PR review output.
- TypeScript types generated from schemas, or schemas generated from source types with checked output.

## CLI Commands

### `nativeguard doctor`

Analyze the current repository and print a compatibility report.

Required flags:

- `--json`: emit machine-readable report.
- `--config <path>`: use explicit config.
- `--rules <path-or-version>`: use a local or pinned rule pack.
- `--ci`: use CI policy and exit codes.
- `--no-network`: disable remote rule lookups.
- `--include-unknown`: include unknown package details.
- `--redact`: redact sensitive paths/scopes in output.

Acceptance criteria:

- Detects project context.
- Loads rules and local exceptions.
- Classifies findings as green, blue, yellow, red, or unknown.
- Distinguishes new risk from known exception when a snapshot is available.
- Emits stable JSON conforming to report schema.

### `nativeguard explain <package[@version]>`

Explain one dependency in the current project context.

Acceptance criteria:

- Shows installed version, declared range, direct/transitive status, and lockfile source.
- Shows package classification: JS-only, Expo module, native module, config plugin, unknown, private, abandoned, or deprecated.
- Shows matching rules, evidence, confidence, and recommended actions.
- Explains why no rule matched when the result is unknown.

### `nativeguard plan`

Produce a safe remediation or upgrade plan.

Required flags:

- `--target-expo <sdk>`
- `--target-rn <version>`
- `--package <package[@version]>`
- `--json`

Acceptance criteria:

- Produces ordered actions.
- Separates deterministic edits from manual verification.
- Marks risky actions as requiring approval.
- Includes rollback guidance.
- Does not mutate files.

### `nativeguard snapshot`

Capture the current stable-state model for later comparison.

Required flags:

- `--output <path>`
- `--json`
- `--redact`

Acceptance criteria:

- Includes dependency graph fingerprint.
- Includes project context fingerprint.
- Includes rule pack version.
- Includes local exceptions and their expiry metadata.
- Excludes secrets and machine-local absolute paths by default.

### `nativeguard compare`

Compare two snapshots or base/head working trees.

Required flags:

- `--base <path-or-ref>`
- `--head <path-or-ref>`
- `--json`

Acceptance criteria:

- Reports direct and transitive dependency changes.
- Reports newly introduced risks.
- Reports resolved risks.
- Reports stale exceptions.
- Reports rule pack changes that affect classification.

### `nativeguard review-pr`

Generate a PR review report for Renovate, Dependabot, or manually opened dependency PRs.

Required flags:

- `--base <ref>`
- `--head <ref>`
- `--format markdown|json`
- `--github`

Acceptance criteria:

- Produces a concise PR comment with status, risk table, evidence, required actions, and verification checklist.
- Supports GitHub Action mode.
- Fails CI only according to configured policy.

### `nativeguard rules validate`

Validate rule files and rule packs.

Required flags:

- `--rules <path>`
- `--fixtures <path>`
- `--strict`

Acceptance criteria:

- Validates schema.
- Detects conflicting scopes.
- Detects missing evidence.
- Detects expired rules.
- Runs rule fixture tests.

### `nativeguard env-report`

Generate a redacted environment report for bug reports.

Acceptance criteria:

- Includes Expo SDK, RN version, package manager, lockfile type, New Architecture signals, platform config summaries, and relevant package versions.
- Redacts tokens, registry URLs, internal paths, private package names when configured, and CI variables.
- Can be attached to GitHub issues safely.

## Exit Code Contract

- `0`: no blocking findings.
- `1`: policy-blocked findings in CI mode.
- `2`: invalid user input, invalid config, or invalid command.
- `3`: invalid rule pack or schema violation.
- `4`: stale rule pack or expired required exception when policy blocks stale data.
- `5`: internal error.

Warnings alone should not fail unless policy says so.

## Status Model

- `green`: matches expected compatibility policy and no known issue.
- `blue`: intentional off-matrix version with evidence and local exception.
- `yellow`: usable only with required workaround, override, patch, or verification.
- `red`: likely unsafe due to native API, peer dependency, New Architecture, platform-specific regression, or known breakage.
- `unknown`: insufficient evidence or unsupported project context.

Every non-green status must include:

- `why`
- `affectedContext`
- `confidence`
- `evidence`
- `recommendedActions`
- `requiredVerification`

## Project Context Detection

NativeGuard must detect:

- Expo SDK version.
- React Native version.
- Expo managed vs Expo prebuild vs bare RN.
- Generated native folders presence.
- Expo Router presence.
- Expo Modules usage.
- Package manager: npm, pnpm, Yarn classic, Yarn Berry, Bun read-only.
- Workspace root and app packages.
- Lockfile freshness signals.
- New Architecture signals.
- Hermes usage where available.
- iOS and Android native config summaries.
- EAS build profile hints where available.

Context detection should produce a confidence score. If detection is uncertain, reports must say so.

## Toolchain And Cache Context

Native dependency compatibility can change even when `package.json` does not. Public v1 should collect enough toolchain context to explain local/CI differences without becoming a full build system inspector.

NativeGuard should detect or accept configured values for:

- Node version.
- Package manager version.
- Expo CLI version where available.
- CocoaPods version where available.
- Xcode version where available.
- Gradle version where available.
- Android Gradle Plugin version where available.
- Kotlin version where available.
- Android SDK compile/target/min versions where available.
- EAS build profile name and relevant non-secret profile settings where available.

Reports should flag:

- Lockfile drift.
- Missing install after package.json changes.
- Patch files that do not match installed versions.
- Generated native folders that appear older than app config.
- Local-only success risk when CI is likely to run from a clean install.
- Toolchain context missing from an environment report.

NativeGuard should not read or print secrets from `.env`, CI variables, private registry auth, or EAS credentials.

## Dependency Graph Model

Each package node should include:

- Package name.
- Installed version.
- Declared range.
- Direct or transitive status.
- Dependency path where available.
- Lockfile source.
- Package manager source.
- Workspace/local/private status.
- Native classification.
- Known patch/override/resolution/packageExtension status.
- Peer dependency expectations and mismatches.
- Matching compatibility rules.

The graph engine must support:

- Direct vs transitive diffs.
- Duplicate package detection.
- Duplicate React / React Native detection.
- Native module duplicate detection.
- Patch file matching.
- Override/resolution/packageExtension analysis.

## Rule Schema Requirements

Every rule must include:

- `id`
- `package`
- `affectedVersions`
- `contexts`
- `severity`
- `status`
- `confidence`
- `symptoms`
- `recommendedActions`
- `requiredVerification`
- `evidence`
- `owner`
- `createdAt`
- `reviewAfter`

Optional fields:

- `safeVersions`
- `unsafeVersions`
- `replacementPackages`
- `patches`
- `platforms`
- `architecture`
- `packageManagers`
- `expoSdk`
- `reactNative`
- `notes`

Example:

```json
{
  "id": "react-native-svg-expo-54-android-fabric-regression",
  "package": "react-native-svg",
  "affectedVersions": ">=15.8.0 <15.11.2",
  "contexts": {
    "expoSdk": ["54"],
    "reactNative": ["0.81.x"],
    "platforms": ["android"],
    "newArchitecture": true
  },
  "severity": "warning",
  "status": "yellow",
  "confidence": "medium",
  "symptoms": ["Android rendering regression under Fabric"],
  "recommendedActions": [
    {
      "type": "bump",
      "package": "react-native-svg",
      "to": "15.11.2"
    },
    {
      "type": "expoInstallExclude",
      "package": "react-native-svg"
    }
  ],
  "requiredVerification": ["android-release-build", "visual-smoke-test"],
  "evidence": [
    {
      "type": "github_issue",
      "url": "https://github.com/example/example/issues/123",
      "confidence": "medium"
    }
  ],
  "owner": "nativeguard-maintainers",
  "createdAt": "2026-07-11",
  "reviewAfter": "2026-10-11"
}
```

## Local Config Requirements

Default config file: `nativeguard.config.json`.

Required support:

- Rule pack pinning.
- CI policy.
- Ignored packages with reason.
- Private package classification.
- Known exceptions with owner, reason, expiry, allowed range, and required verification.
- Redaction settings.
- Package manager behavior overrides.

Example:

```json
{
  "rules": {
    "source": "@nativeguard/rules",
    "version": "2026.07.11"
  },
  "ci": {
    "failOn": ["red"],
    "warnOn": ["yellow", "unknown", "stale-exception"]
  },
  "exceptions": [
    {
      "package": "react-native-svg",
      "allowedVersions": "15.11.2",
      "reason": "Required Android Fabric fix before Expo SDK matrix catches up",
      "owner": "@mobile-platform",
      "expiresAt": "2026-09-01",
      "requiredVerification": ["android-release-build"]
    }
  ],
  "redaction": {
    "hidePrivateScopes": true,
    "hideAbsolutePaths": true
  }
}
```

## Report Schema Requirements

The JSON report must include:

- Tool version.
- Rule pack version.
- Project context.
- Dependency graph summary.
- Findings.
- Unknowns.
- Exceptions.
- Stale exceptions.
- Recommended actions.
- Required verification.
- Exit decision.
- Redaction metadata.

Report output must be snapshot-tested.

## GitHub Action Requirements

Action inputs:

- `config`
- `rules`
- `base`
- `head`
- `fail-on`
- `comment`
- `upload-snapshot`

Action outputs:

- `status`
- `risk-count`
- `new-risk-count`
- `snapshot-path`
- `report-path`

PR comment must include:

- Overall status.
- Project context.
- Changed packages.
- New risks.
- Known exceptions.
- Stale exceptions.
- Required actions.
- Verification checklist.
- Evidence links.

## Fixture Matrix

Public v1 fixture coverage:

- Expo managed app with clean dependencies.
- Expo managed app with off-matrix native dependency.
- Expo managed app with unknown package.
- Expo prebuild app with generated native folders.
- Expo prebuild app with config plugin drift.
- Bare RN app with New Architecture disabled.
- Bare RN app with New Architecture enabled.
- Monorepo app with hoisted dependencies.
- Monorepo app with duplicate React / RN.
- App with patch-package.
- App with pnpm overrides.
- App with Yarn resolutions.
- App with Yarn packageExtensions.
- App with private workspace package.
- App with transitive native dependency risk.

## Testing Strategy

Required tests:

- Unit tests for scanners.
- Unit tests for rule matching.
- Unit tests for semver range handling.
- Unit tests for policy evaluation.
- Unit tests for redaction.
- Snapshot tests for terminal output.
- Snapshot tests for JSON reports.
- Fixture integration tests for CLI commands.
- Rule validation tests.
- GitHub Action rendering tests.

Optional expensive tests:

- TypeScript check on selected fixtures.
- Expo Doctor comparison on selected fixtures.
- `pod install` on selected iOS fixtures.
- Gradle sync/build on selected Android fixtures.
- EAS Build validation later.

## Rule Governance

Rule lifecycle:

- `proposed`
- `reproduced`
- `trusted`
- `stale`
- `retired`

Rule labels:

- `confirmed`
- `community-reported`
- `workaround`
- `deprecated`
- `needs-repro`
- `platform-specific`
- `new-architecture`
- `package-manager-specific`

Maintainer rules:

- Prefer narrow context over broad claims.
- Prefer high-quality evidence over popularity.
- Never imply cross-platform support from one-platform evidence.
- Low-confidence rules must report uncertainty.
- AI-assisted rules must be reviewed by humans before becoming trusted.

## Security And Privacy

Public v1 must include:

- `SECURITY.md`.
- Private data redaction docs.
- Remote rule update threat model.
- Rule contribution trust policy.
- Patch/apply safety policy.
- Dependency confusion guidance for private packages.

Default behavior:

- No network access unless remote rule updates are requested.
- No blind source patching.
- No mutation without explicit command.
- No report should include tokens, registry credentials, internal absolute paths, or CI secrets.

## Documentation Required For Public v1

- README with clear positioning and examples.
- Quickstart.
- CLI command reference.
- Config reference.
- Rule schema reference.
- Report schema reference.
- GitHub Action guide.
- Renovate / Dependabot integration guide.
- Contribution guide.
- Rule authoring guide.
- Fixture authoring guide.
- Maintainer guide.
- Security policy.
- Comparison page: Expo Doctor, React Native Directory, rnx-kit, Renovate, Dependabot, Snyk, Socket.

## Public v1 Acceptance Checklist

- [ ] All public commands documented.
- [ ] Config schema documented and validated.
- [ ] Rule schema documented and validated.
- [ ] Report schema documented and snapshot-tested.
- [ ] Exit codes documented and tested.
- [ ] Fixture matrix implemented.
- [ ] GitHub Action works on a dependency PR.
- [ ] Redacted environment report works.
- [ ] Rule contribution workflow works end to end.
- [ ] At least 30 curated rules for high-pain Expo/RN packages.
- [ ] At least 10 real repositories tested.
- [ ] At least 5 real cases where NativeGuard catches or explains risk that generic tools miss.
- [ ] Security policy published.
- [ ] Release checklist published.
- [ ] Changelog initialized.

## Internal Build Sequence

1. Schema foundation: config, rule, report, snapshot, exit codes.
2. Project scanner: Expo/RN/package manager/workspace/native context.
3. Dependency graph engine: direct/transitive nodes, lockfile versions, patches, overrides.
4. Rule evaluator: matching, confidence, evidence, recommended actions.
5. Terminal and JSON reports.
6. `doctor`, `explain`, `snapshot`, `compare`.
7. Fixture matrix and snapshot tests.
8. `review-pr` and GitHub Action.
9. `plan` and conservative safe-action modeling.
10. Rule registry v1 with governance.
11. Docs, contribution workflow, security policy, release process.
12. Private alpha on real repos.
13. Public OSS v1 release.

## Open Questions

- Should rules be authored in JSON, YAML, or TypeScript with schema-generated JSON?
- Should package classification use React Native Directory as an optional data source, a vendored snapshot, or both?
- Should remote rule packs be distributed through npm, static CDN, GitHub releases, or all three?
- How much native build verification should be expected in public CI versus optional maintainer workflows?
- Should `apply` ship in public v1, or should public v1 only produce deterministic plans and let users edit manually?
