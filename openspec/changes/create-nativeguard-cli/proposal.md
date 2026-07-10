## Why

React Native and Expo dependency upgrades fail in ways that generic dependency tools cannot explain: Expo version matrices, native modules, package manager behavior, New Architecture compatibility, and intentional off-matrix exceptions all interact. NativeGuard should start as a focused, offline-first CLI that gives React Native teams a trustworthy compatibility report before adding remediation, PR review, or hosted services.

## What Changes

- Create the initial NativeGuard CLI product direction as a TypeScript monorepo.
- Publish the CLI as `@nativeguard/cli`, exposing a `nativeguard` executable.
- Prioritize project analysis for Expo prebuild apps first, then bare React Native, then Expo Go.
- Start with npm package manager support, followed by Yarn, pnpm, and Bun on the roadmap.
- Provide structured JSON output as a first-class contract for future GitHub Actions, agents, and MCP integrations.
- Define `nativeguard-lock.json` as the stable-state snapshot file.
- Define a separate rules/dataset package designed for deterministic CLI evaluation and AI-friendly agent consumption.
- Explicitly defer monorepo project support, PR review comments, GitHub Actions, remote registry updates, and safe apply mode to later roadmap stages.

## Capabilities

### New Capabilities

- `nativeguard-cli`: CLI commands, package shape, project detection, terminal reports, and JSON output.
- `nativeguard-rules`: AI-friendly local rules dataset for compatibility facts, evidence, package metadata, and remediation guidance.
- `stable-state-lockfile`: `nativeguard-lock.json` snapshot behavior for stable-state tracking, rule-pack provenance, and accepted exceptions.
- `roadmap-boundaries`: first-version scope boundaries and later roadmap capabilities for monorepos, PR review, GitHub Actions, remote registry, and apply mode.

### Modified Capabilities

- None.

## Impact

- Establishes the initial monorepo package layout for the NativeGuard project.
- Introduces a TypeScript CLI runtime and build/test tooling.
- Introduces a local rules package that can be consumed by the CLI and future agent skills.
- Defines user-facing command/API contracts for `nativeguard doctor`, JSON output, and lockfile creation.
- Leaves future implementation room for additional package managers, monorepo analysis, GitHub PR review, hosted rules, and safe remediation.
