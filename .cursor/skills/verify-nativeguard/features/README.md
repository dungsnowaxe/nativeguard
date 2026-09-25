# NativeGuard verification map

This directory is the maintained source for verifying the user-facing behavior of NativeGuard. Read the index before driving the CLI, then use the matching feature file as the recipe.

## Baseline preconditions

- Node.js 24.x (`node -v` starts with `v24.`). `.nvmrc` is `24`.
- From the repo root: `pnpm install && pnpm build` has completed.
- `packages/cli/dist/index.js` exists.
- `node packages/cli/dist/index.js --version` prints `0.0.0`.
- `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh check` passes.
- Tracked trees under `fixtures/` are read-only. Copy before `--write-snapshot` or before editing `nativeguard-lock.json`.
- Evidence goes to `.cursor/skills/verify-nativeguard/artifacts/<run-id>/`.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer `doctor [path]` over changing the agent's cwd. Use `--cwd` on the helper only when proving the cwd entry point.
- Treat every command as literal. Keep fixture names, flags, and `--sdk` values unchanged.
- Always capture `--json` output (the helper adds `--json` if omitted).
- Restore scratch copies after a mutating drive. Do not remove proof artifacts during cleanup.
- NativeGuard must not mutate package manager lockfiles. Assert that when a recipe uses `--write-snapshot`.

## Proof and skip reporting

- Capture the command, stdout JSON, stderr, and exit code.
- Analysis proof includes `schemaVersion`, `recommendations`, `summary.status`, `project.kind`, and `project.root`.
- Error-payload proof includes `schemaVersion` and `error.code`, and the absence of `recommendations` / `summary` / `project`.
- Record the feature ID and entry point used with every artifact (`meta.json`).
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-doctor` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Risky pager-view recommendation](./doctor-risky-recommendation.md) covers `fixtures/sdk53-pager-view` emitting a `bump` for `react-native-pager-view` and exit `1`.
- [Unsupported bare React Native](./doctor-unsupported-bare-rn.md) covers `fixtures/bare-react-native` reporting `unsupported` with empty `recommendations` and exit `1`.
- [Accepted pin / leave exception](./doctor-accepted-exception.md) covers recording `acceptedExceptions` in `nativeguard-lock.json` so matching `leave` / `pin` findings exit `0`.
- [Invalid `--sdk` value](./doctor-invalid-sdk.md) covers `--sdk 54xyz` emitting `INVALID_SDK` and exit `1`.
- [Doctor path argument](./doctor-path-arg.md) covers `doctor [path]` setting `project.root` to the resolved project path.
