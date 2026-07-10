## Context

NativeGuard is starting from an empty repo with a product roadmap for an Expo/React Native dependency intelligence tool. The first implementation should create a useful local CLI before expanding into PR review, GitHub Actions, hosted rule updates, agent integrations, or safe remediation.

The CLI is aimed at React Native teams who need to understand whether their dependency graph is stable for their Expo SDK, React Native version, native module set, package manager, and accepted off-matrix exceptions. The first project priority is Expo prebuild apps, followed by bare React Native apps and Expo Go apps.

## Goals / Non-Goals

**Goals:**

- Establish a TypeScript monorepo for NativeGuard.
- Publish the CLI package as `@nativeguard/cli` with a `nativeguard` binary.
- Implement an offline-first `nativeguard doctor` workflow with human-readable and JSON output.
- Model local compatibility rules in a separate package that is deterministic for the CLI and friendly for agents to consume.
- Create `nativeguard-lock.json` as the stable-state snapshot file.
- Keep first-version behavior narrow enough to ship and validate on real Expo prebuild projects.

**Non-Goals:**

- No safe apply mode in the first version.
- No PR review comments or GitHub Action implementation in the first version.
- No hosted rules registry or required network access in the first version.
- No deep user-monorepo analysis in the first version.
- No autonomous GitHub Issue scraping or AI-generated rule acceptance in the first version.
- No full parity across npm, Yarn, pnpm, and Bun in the first version.

## Decisions

### TypeScript Monorepo

Use TypeScript for the first implementation because NativeGuard must integrate naturally with JavaScript package metadata, React Native projects, npm distribution, GitHub Actions, and future agent tooling. The likely first-version bottlenecks are correctness, package-manager behavior, and rules quality rather than CPU performance.

Alternatives considered:

- Rust: stronger single-binary distribution and performance, but slower iteration and less direct npm ecosystem integration.
- Go: simple static binaries and good performance, but less natural for React Native package-manager semantics than TypeScript.

The monorepo should keep package boundaries clean so performance-sensitive pieces can move to Rust or Go later if measurement proves the need.

### Repository Package Manager

Use pnpm for the NativeGuard repository monorepo. pnpm provides explicit workspace configuration through `pnpm-workspace.yaml`, strict local workspace dependency resolution with `workspace:*`, and efficient dependency installation for multi-package TypeScript projects.

### Package Layout

Use separate workspace packages for the CLI, core analysis logic, rules dataset, and shared schemas.

Expected package shape:

```text
packages/
  cli/       @nativeguard/cli, nativeguard executable
  core/      project scanning, package graph model, rules evaluation
  rules/     @nativeguard/rules, bundled rules and evidence dataset
  schema/    shared JSON schemas and TypeScript types
```

This keeps the CLI thin and allows future GitHub Actions, MCP servers, and agent skills to consume the same core contracts.

### Offline-First Rules

Bundle a local rules package and make network access opt-in later. First-version analysis must be reproducible without remote registry access.

Rules may be authored as JSON, JSONC, or JSONL, but they must compile or validate into a strict schema. JSONL is a good fit for large rule/evidence records because agents and scripts can process one record at a time. JSON or JSONC is a good fit for curated package metadata and compact fixtures.

### Project Priority

Prioritize detection and analysis in this order:

1. Expo prebuild apps
2. Bare React Native apps
3. Expo Go apps

Expo prebuild receives the strongest first-version checks because it exposes both Expo configuration and native project context.

### Package Manager Priority

Support npm first. Add Yarn next, then pnpm, then Bun. First-version code should expose a package-manager adapter interface so later support does not require rewriting the analyzer.

### Stable JSON Output

Treat JSON output as a public contract from the start. Human-readable terminal output can evolve more freely, but JSON must remain structured enough for tests, future GitHub Actions, and agent integrations.

### Lockfile

Use `nativeguard-lock.json` for stable-state snapshots. It should capture the analyzed project profile, rule-pack provenance, package-manager metadata, findings summary, and accepted exceptions. It should not replace package-manager lockfiles.

## Risks / Trade-offs

- TypeScript startup and runtime overhead may become noticeable on very large repositories -> Add benchmark fixtures and preserve a clean core boundary for native optimization later.
- npm-first support may frustrate Yarn or pnpm users -> Detect unsupported package managers clearly and add read-only diagnostics where practical.
- Rules can become inconsistent or hard for agents to consume -> Enforce JSON Schema validation and include stable IDs, evidence links, affected ranges, confidence, and remediation records.
- `nativeguard-lock.json` could be confused with package lockfiles -> Document that it is a stability snapshot, not an install resolver.
- Deferring monorepo support limits first-version usefulness for large teams -> Put monorepo support in the roadmap and keep internal project discovery extensible.
- Offline-first rules can go stale -> Include rule-pack version/provenance in reports and lockfiles, and plan an optional remote registry later.

## Migration Plan

This is a new project, so there is no user-facing migration. Implementation should start by scaffolding the monorepo and creating the CLI, core, rules, and schema packages. The first usable milestone is `nativeguard doctor` running offline against an Expo prebuild project and producing both terminal and JSON reports.

Rollback is straightforward before first release: remove or revise the generated packages and OpenSpec change artifacts. After release, changes to JSON output and `nativeguard-lock.json` must be versioned.

## Open Questions

- Should first-version rules be stored primarily as JSONL records, JSON/JSONC grouped files, or both with a build step?
- Should `nativeguard doctor` write `nativeguard-lock.json` by default, or only with an explicit flag such as `--write-lockfile`?
- What exact schema versioning convention should be used for JSON output and `nativeguard-lock.json`?
