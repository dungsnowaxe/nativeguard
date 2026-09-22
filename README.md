# NativeGuard

NativeGuard is an **evidence layer** for Expo / React Native dependency decisions. It is not another `expo-doctor`. It does not apply upgrades, rewrite manifests, or mutate npm / Yarn / pnpm / Bun lockfiles. It reads the project, matches curated compatibility rules, and emits `recommendations[]` with an action, evidence URLs, and the surfaces that care (`eas`, `local-native`, `runtime`).

Use it to decide **pin, bump, leave, or exclude** — then change the app yourself.

## Dogfood (from this repo)

Requires **Node.js 24** (latest 24.x; `.nvmrc` is `24`). This repo pins `packageManager` to `pnpm@11.10.0`, which needs modern Node (`node:sqlite`); Node 20 fails with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`.

v1 is local-only. There is no npm publish step. Build, then run the workspace CLI:

```sh
pnpm install
pnpm build
pnpm nativeguard doctor --json
```

Equivalent:

```sh
node packages/cli/dist/index.js doctor --json
```

`nativeguard doctor` analyzes **the current working directory**, or an optional project path:

```sh
pnpm build
node packages/cli/dist/index.js doctor --json fixtures/sentry-expo-sdk54
node packages/cli/dist/index.js doctor --json fixtures/lock-pnpm-range-miss-pager-view
(cd fixtures/pnpm-workspace-catalog/apps/mobile && node ../../../../packages/cli/dist/index.js doctor --json)
```

The workspace script runs `node packages/cli/dist/index.js`. The CLI strips a leading `--` from argv, so `pnpm nativeguard -- doctor --json` still runs doctor.

## Commands

```sh
nativeguard doctor
nativeguard doctor [path]
nativeguard doctor --json
nativeguard doctor --sdk 54
nativeguard doctor --sdk 54.0.0-beta.1
nativeguard doctor --write-snapshot
```

| Flag | Meaning |
| --- | --- |
| `--json` | Machine-readable report. Frozen `recommendations[]`: `action` is `bump \| pin \| leave \| exclude`, plus `evidence` and `surfaces`. |
| `--sdk <major\|soft>` | Filter rules to that Expo SDK major (`--sdk 54`, `--sdk=54`, `--sdk 54beta`, `--sdk 54.0.0-beta.1`). If omitted, NativeGuard parses Expo major from the lockfile-resolved `expo` version, else the declared `expo` range, including unambiguous prerelease/canary forms. Digit-prefixed garbage (`54xyz`) exits `1` with `INVALID_SDK`. |
| `--write-snapshot` | Write `nativeguard-lock.json` (alias: `--write-lockfile`). NativeGuard snapshot only — never npm/Yarn/pnpm/Bun lockfiles. Preserves `acceptedExceptions`. |

Bare React Native is detected and reported as `summary.status: "unsupported"`, not stable. Analysis is skipped.

## Remediation ladder

NativeGuard recommends in this order. It does **not** apply any of them.

1. **pin / bump / leave** — stay on a known-good version, move to the floor/ceiling the evidence names, or leave an off-matrix install as-is when that is the documented choice.
2. **workaround** — `exclude` (for example `expo.install.exclude`) or an equivalent config change when the package should not be what Expo install would pull.
3. **patch last** — only if pin/bump/leave and exclude are insufficient. v1 does not generate or apply patches.

Examples of evidence behind the default pack:

- [Expo SDK 54 + Reanimated](https://github.com/expo/fyi/blob/main/expo-54-reanimated.md)
- [pager-view on RN 0.79](https://github.com/callstack/react-native-pager-view/issues/988)
- [sentry-expo retirement](https://github.com/expo/fyi/blob/main/sentry-expo-migration.md)
- [FlashList v2 is New Architecture-only](https://github.com/Shopify/flash-list/issues/1752)
- [SDK 54 screens pin](https://github.com/software-mansion/react-native-screens/issues/3470)
- [expo-av deprecated on SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/av)

## Exit codes

| Exit | `summary.status` | Meaning |
| --- | --- | --- |
| `0` | `stable` | No compatibility findings. |
| `0` | `accepted-exception` | Matching `pin` / `leave` / `exclude` findings were recorded in `acceptedExceptions` (reason required). Warnings, not new risk. |
| `1` | `risky` | Unaccepted findings remain, including every `bump`. |
| `1` | `unsupported` | Project or resolver gap; not a silent stable. |
| `1` | *(error)* | Run failed (`INVALID_SDK`, invalid snapshot, missing project, …). |

`--json` error payloads include `error.code` (for example `INVALID_SDK`). NativeGuard never applies pins, bumps, or lockfile edits.

## Accepted pin / leave / exclude (`nativeguard-lock.json`)

`--write-snapshot` writes a NativeGuard snapshot, not an install lockfile. To accept a **pin**, **leave**, or **exclude** recommendation (keep the current dependency on purpose):

1. Run `nativeguard doctor --write-snapshot`.
2. Edit `nativeguard-lock.json` and add an `acceptedExceptions[]` entry with `packageName`, `version`, **`reason` (required)**, and optional `ruleId` / `findingId`.
3. Re-run `nativeguard doctor`. Matching pin/leave/exclude findings become `accepted-exception` (warning, **exit 0**) instead of `risky`.
4. `--write-snapshot` keeps those exceptions. It still does not touch package manager lockfiles.

`bump` findings stay `risky` (**exit 1**) until the installed version actually changes. Do not use `acceptedExceptions` as a substitute for a bump.

```json
{
  "acceptedExceptions": [
    {
      "packageName": "expo-av",
      "version": "16.0.7",
      "reason": "Leaving expo-av on SDK 54 until the expo-audio / expo-video migration.",
      "ruleId": "sdk54-leave-expo-av-pending-audio-video-migration"
    }
  ]
}
```

## Contracts

- `nativeguard doctor --json` includes `findings`, `packageIssues`, `recommendations[]`, and `acceptedExceptions` copied from the snapshot.
- Rules match lockfile-resolved versions from `package-lock.json`, `yarn.lock` (classic v1 and Berry), `pnpm-lock.yaml`, and text `bun.lock`. Declared ranges stay in the dependency snapshot for display; resolved versions are in `resolvedVersions`.
- Nested workspace packages read the workspace-root lockfile. `catalog:`, Yarn `resolutions`, and npm/pnpm `overrides` are applied when they resolve to a concrete version. Unresolved specifiers (including `catalog:` without a catalog, and binary `bun.lockb` without `bun.lock`) emit an explicit `unsupported` finding — never silent `stable`.
- `nativeguard-lock.json` is a stability snapshot (recommendations + accepted exceptions). It is not a replacement for npm, Yarn, pnpm, or Bun lockfiles.

## Out of scope (v1)

Apply mode, GitHub Action review, hosted rule ingest, Expo compatibility-table ingest, package-lock mutation, and full turborepo/nx orchestration. Workspace lockfile + catalog/resolutions/overrides are in scope; deep monorepo task-graph analysis is not.
