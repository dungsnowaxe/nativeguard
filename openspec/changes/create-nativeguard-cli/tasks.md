## 1. Monorepo Setup

- [x] 1.1 Choose and configure the workspace package manager for the NativeGuard repo.
- [x] 1.2 Create the TypeScript workspace structure for `packages/cli`, `packages/core`, `packages/rules`, and `packages/schema`.
- [x] 1.3 Add shared TypeScript, lint, format, and test configuration for all workspace packages.
- [x] 1.4 Configure `@nativeguard/cli` package metadata with a `nativeguard` binary entrypoint.
- [x] 1.5 Add build scripts that compile all packages in dependency order.

## 2. Shared Schemas

- [x] 2.1 Define JSON schemas and TypeScript types for doctor JSON output.
- [x] 2.2 Define JSON schemas and TypeScript types for `nativeguard-lock.json`.
- [x] 2.3 Define JSON schemas and TypeScript types for rules, evidence records, findings, and remediation actions.
- [x] 2.4 Add schema validation tests with valid and invalid fixtures.

## 3. Rules Package

- [x] 3.1 Create the initial `@nativeguard/rules` package with bundled local rule data.
- [x] 3.2 Add a small seed dataset for Expo prebuild compatibility analysis.
- [x] 3.3 Include stable IDs, affected packages, affected ranges, context, evidence metadata, confidence, outcomes, and remediation guidance in rule records.
- [x] 3.4 Add a validation script that rejects malformed rule records before packaging.
- [x] 3.5 Expose a typed loader API for the core analyzer.

## 4. Core Analyzer

- [x] 4.1 Implement project root and package metadata loading.
- [x] 4.2 Implement Expo prebuild, bare React Native, and Expo Go profile detection.
- [x] 4.3 Implement npm package manager detection and npm lockfile metadata reading.
- [x] 4.4 Add adapter boundaries for future Yarn, pnpm, and Bun support.
- [x] 4.5 Implement dependency snapshot extraction from `package.json` and npm lockfile data.
- [x] 4.6 Implement rules evaluation that produces stable findings and summary status.
- [x] 4.7 Add behavior for unsupported package managers and unsupported project layouts.

## 5. CLI Doctor Command

- [x] 5.1 Implement `nativeguard --version`.
- [x] 5.2 Implement `nativeguard doctor` for local project analysis.
- [x] 5.3 Implement human-readable terminal report rendering.
- [x] 5.4 Implement `nativeguard doctor --json` with valid JSON-only stdout.
- [x] 5.5 Ensure unsupported projects exit non-zero with actionable diagnostics.

## 6. Stable-State Lockfile

- [x] 6.1 Implement `nativeguard-lock.json` write support behind an explicit doctor option.
- [x] 6.2 Include schema version, CLI version, rules version, project profile, package manager, dependency snapshot summary, findings summary, and generated timestamp.
- [x] 6.3 Add accepted-exception fields to the lockfile schema and fixtures.
- [x] 6.4 Implement supported and unsupported lockfile schema version handling.

## 7. Tests and Fixtures

- [x] 7.1 Add fixture projects for Expo prebuild, bare React Native, Expo Go, unsupported project, npm project, and non-npm package-manager detection.
- [x] 7.2 Add core analyzer tests for project profile detection.
- [x] 7.3 Add rules evaluation tests using the seed dataset.
- [x] 7.4 Add CLI integration tests for terminal output, JSON output, unsupported projects, and lockfile writing.
- [x] 7.5 Add snapshot or contract tests for doctor JSON output and `nativeguard-lock.json`.

## 8. Documentation and Roadmap Notes

- [x] 8.1 Document first-version install and usage for `@nativeguard/cli`.
- [x] 8.2 Document JSON output and `nativeguard-lock.json` as versioned contracts.
- [x] 8.3 Document first-version scope limits: no safe apply, no PR review, no hosted registry, and no deep monorepo support.
- [x] 8.4 Add roadmap notes for Yarn, pnpm, Bun, monorepo support, GitHub Action PR review, hosted rules, MCP, and safe apply mode.

## 9. Verification

- [x] 9.1 Run the full test suite.
- [x] 9.2 Run the build for all workspace packages.
- [x] 9.3 Run `nativeguard doctor` manually against at least one Expo prebuild fixture.
- [x] 9.4 Run `nativeguard doctor --json` and validate the output against the JSON schema.
- [x] 9.5 Run the rule validation script against the bundled rules package.
