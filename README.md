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
```

The first version focuses on local analysis and reports. It does not apply fixes, submit PR review comments, require a hosted registry, or deeply analyze user monorepos.

## Contracts

- `nativeguard doctor --json` emits machine-readable JSON with an explicit schema version.
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
