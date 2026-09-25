---
name: verify-nativeguard
description: Drive NativeGuard's CLI (`nativeguard doctor`) against repo fixtures and capture JSON, stderr, and exit-code evidence. Use when proving doctor recommendations, exit codes, or the analysis JSON contract after CLI, core, or schema changes.
---

# Verify NativeGuard

NativeGuard is a CLI **evidence layer** for Expo / React Native dependency decisions. It is not `expo-doctor`. It does not apply upgrades, rewrite manifests, expand rule packs, or mutate npm / Yarn / pnpm / Bun lockfiles.

Primary user surface: `nativeguard doctor`. There is no web UI, daemon, or hosted API. `--version` and `--help` are supporting surfaces.

This skill is for the next agent: launch the built CLI, doctor the instance, drive one mapped feature the way a user would, capture evidence, then clean up scratch state **without deleting proof**.

## Launch

NativeGuard is a short-lived CLI. Launch means install and build once; each drive starts a new process that exits.

1. Use **Node.js 24.x** (`engines`: `>=24 <25`; `.nvmrc` is `24`). Node 20 fails (`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`). From the repo root:

```sh
nvm install
nvm use
node -v   # must print v24.x
corepack enable
pnpm install
pnpm build
```

2. Ready when all of these hold:

- `packages/cli/dist/index.js` exists
- `node packages/cli/dist/index.js --version` prints `0.0.0` and exits `0`
- `pnpm nativeguard --version` prints the same

Equivalent entry points (prefer these; do not invent others):

```sh
node packages/cli/dist/index.js doctor --json
pnpm nativeguard doctor --json
```

The workspace script is `node packages/cli/dist/index.js`. The CLI strips a leading `--` from argv, so `pnpm nativeguard -- doctor --json` still runs doctor.

There is no server to keep alive and no teardown after a successful build. Do not start a long-lived process.

## Doctor

Run this read-only check whenever anything looks off, and before the first drive of a session. From the repo root:

```sh
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh check
```

Pass when:

| Check | Expected |
| --- | --- |
| Node major | `24` |
| CLI binary | `packages/cli/dist/index.js` exists |
| `--version` | stdout `0.0.0`, exit `0` |
| `--help` | stdout contains `nativeguard doctor`, exit `0` |

Refuse to drive if Node is not 24.x or the dist file is missing. Rebuild with `pnpm build` rather than running `packages/cli/src`.

## Drive

Doctor analyzes **the current working directory** or an optional project path:

```sh
nativeguard doctor
nativeguard doctor [path]
nativeguard doctor --json
nativeguard doctor --sdk 54
nativeguard doctor --sdk 54.0.0-beta.1
nativeguard doctor --write-snapshot
```

Drive through the helper so stdout, stderr, and exit code land in a named evidence directory. From the repo root:

```sh
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive \
  --run-id <run-id> \
  --feature <feature-id> \
  -- <doctor-args>
```

`<doctor-args>` are passed to `nativeguard doctor`. The helper always adds `--json` if you omit it.

Examples:

```sh
# path argument (preferred; does not change the agent's cwd)
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive \
  --run-id pager-view-risky \
  --feature doctor-risky-recommendation \
  -- fixtures/sdk53-pager-view

# cwd form (same fixture)
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive \
  --run-id pager-view-cwd \
  --feature doctor-risky-recommendation \
  --cwd fixtures/sdk53-pager-view \
  --
```

Stable handles (assert these; they are the user-visible contract):

- Exit `0` when `summary.status` is `stable` or `accepted-exception`
- Exit `1` when `summary.status` is `risky` or `unsupported` (including bare React Native)
- Exit `1` when analysis does not run (`INVALID_SDK`, `MISSING_PACKAGE_JSON`, `UNSUPPORTED_PROJECT`, …)
- Analysis JSON always includes `schemaVersion`, `recommendations[]`, `summary.status`, `project.kind`, `project.root`
- Error JSON is `{ schemaVersion, error: { code, message } }` with no `recommendations`, `summary`, or `project`
- `schemaVersion` is `"1.0.0"`
- Frozen recommendation `action` is `bump | pin | leave | exclude`

Isolation:

- Tracked `fixtures/` trees are **read-only**. Copy before `--write-snapshot` or before editing `nativeguard-lock.json`.
- Scratch copies go under `/tmp/nativeguard-verify-<run-id>/`.
- Concurrent read-only `doctor` processes against different fixtures are safe. Do not `--write-snapshot` two runs into the same directory.
- Never mutate npm / Yarn / pnpm / Bun lockfiles. Never expand rule packs.

Read the matching file under `features/` and follow its recipe. A proof that drives one convenient entry point is incomplete when that feature lists others.

## Evidence

Proof lives at:

```
.cursor/skills/verify-nativeguard/artifacts/<run-id>/
```

The helper writes:

| File | Contents |
| --- | --- |
| `meta.json` | feature id, run id, Node version, cwd, command, timestamps |
| `command.txt` | exact argv invoked |
| `stdout.json` | doctor stdout (`--json` is JSON-only) |
| `stderr.txt` | doctor stderr (usually empty on `--json`) |
| `exit-code.txt` | process exit code, trailing newline |

Standards:

- Exercise the real CLI (`node packages/cli/dist/index.js` or `pnpm nativeguard`), not `analyzeProject` imported from tests.
- Capture the invocation **and** the resulting JSON + exit code, not only a pass/fail boolean.
- Parse `stdout.json` as JSON. Assert `schemaVersion`, then either the analysis fields or `error.code`.
- For analysis reports, assert `summary.status`, `project.kind`, `project.root`, and at least one `recommendations[]` field named by the feature (or that the array is empty when the feature says so).
- `project.root` must be the **absolute** path of the analyzed project.
- `--write-snapshot` proof includes a second read of `nativeguard-lock.json` **and** a check that `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` / `bun.lock` bytes did not change.
- Do not call a dry-run sufficient; doctor is already read-only except `--write-snapshot`, which writes only `nativeguard-lock.json`.

This directory is gitignored. Cleanup must not delete it.

## Cleanup

Doctor processes exit on their own. After a drive (including a failed one):

1. Remove only scratch copies this run created, e.g. `rm -rf /tmp/nativeguard-verify-<run-id>`.
2. If a drive is still running, kill **that PID** (or the tmux session you started). Never `pkill -f nativeguard` or kill by binary name.
3. Leave `.cursor/skills/verify-nativeguard/artifacts/<run-id>/` in place.
4. Leave tracked `fixtures/` untouched. If a drive wrote `nativeguard-lock.json` into a tracked fixture, delete **only that file** (it is already gitignored) and treat the run as invalid.

Helper for named scratch dirs:

```sh
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh cleanup --scratch-dir /tmp/nativeguard-verify-<run-id>
```

## Helpers

`.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh` is executable. Invoke it from the repo root.

```sh
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh check
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id <id> --feature <id> [--cwd <dir>] -- [doctor args]
.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh cleanup --scratch-dir /tmp/nativeguard-verify-<id>
```

`drive` records evidence and **does not fail** when doctor exits `1`; risky and unsupported reports are expected exits. The agent asserts `exit-code.txt` and `stdout.json` against the feature file.

Do not reverse-engineer the script. If a flag is missing, add it to the script and this section together.
