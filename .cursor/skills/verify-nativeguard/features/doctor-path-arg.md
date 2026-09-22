# Doctor path argument

`nativeguard doctor [path]` analyzes the given project instead of the current working directory and sets `project.root` to that project's absolute path.

## Sub-features

- `path-sets-root` sets `project.root` to the resolved absolute fixture path when doctor is given a path.
- `path-ignores-cwd` keeps `project.root` on the path argument even when cwd is the repo root.
- `path-nested` analyzes `fixtures/pnpm-workspace-catalog/apps/mobile` and sets `project.root` to that nested package.
- `cwd-fallback` without a path uses `process.cwd()` as `project.root`.

## How to get to it (user POV)

- Run `nativeguard doctor --json fixtures/sdk53-pager-view` from the repo root.
- Run `nativeguard doctor --json fixtures/pnpm-workspace-catalog/apps/mobile` from the repo root.
- `cd` into a fixture and run `nativeguard doctor --json` with no path.

## Driving it with verify-doctor

Preconditions:

- Baseline launch and doctor check have passed.
- Cwd for the helper default (no `--cwd`) is the repo root.

- **Repo-root path.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id path-pager-view --feature doctor-path-arg -- fixtures/sdk53-pager-view`. `project.root` equals the absolute path of `fixtures/sdk53-pager-view` and is not the repo root. `schemaVersion` is `"1.0.0"` and `recommendations` is an array.
- **Nested workspace path.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id path-nested-mobile --feature doctor-path-arg -- fixtures/pnpm-workspace-catalog/apps/mobile`. `project.root` equals the absolute path of `fixtures/pnpm-workspace-catalog/apps/mobile`.
- **Cwd fallback.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id path-cwd-fallback --feature doctor-path-arg --cwd fixtures/bare-react-native --`. `project.root` equals the absolute path of `fixtures/bare-react-native`.
- **Proof.** Compare the three `stdout.json` files: the three `project.root` values are distinct absolute directories, each matching the project that was named.

## Gotchas

- `project.root` is absolute. Do not assert a relative `fixtures/...` string.
- Doctor accepts at most one path. A second non-flag argument is `INVALID_ARGS`, which is a different feature.
- Nested workspace packages still analyze that package root; do not expect `project.root` to walk up to the workspace root.
- Human (non-`--json`) output prints `Project: <kind>` and does not print `project.root`. Use `--json` for this proof.
