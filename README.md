# NativeGuard

NativeGuard is an offline-first dependency stability CLI for Expo and React Native projects.

## Install

```sh
pnpm add -D @nativeguard/cli
```

## Usage

```sh
nativeguard doctor
nativeguard doctor --json
nativeguard doctor --write-lockfile
nativeguard doctor --sdk 54
```

`--sdk` filters rules to that Expo SDK major. If omitted, NativeGuard parses the current Expo major from the project (`package-lock.json` resolved `expo` version when present, otherwise the declared `expo` range).

The first version focuses on local analysis and reports. It does not apply fixes, submit PR review comments, require a hosted registry, or deeply analyze user monorepos.

## Contracts

- `nativeguard doctor --json` emits machine-readable JSON with an explicit schema version.
- Doctor JSON includes `findings`, `packageIssues`, and a frozen `recommendations[]` contract: `action` is `bump | pin | leave | exclude`, plus `evidence` and `surfaces` (`eas | local-native | runtime`). The human report prints that table.
- When `package-lock.json` is present, rules match `packages["node_modules/<name>"].version`. Declared ranges stay in the dependency snapshot for display.
- `nativeguard-lock.json` stores a NativeGuard stable-state snapshot. It does not replace npm, Yarn, pnpm, or Bun lockfiles.

## Roadmap

- Yarn support
- pnpm support
- Bun support
- user monorepo analysis
- GitHub Action PR review
- hosted rules registry
- MCP and agent integrations
- safe apply mode
# nativeguard
