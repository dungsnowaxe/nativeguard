# Risky pager-view recommendation

Doctor reports a risky `bump` for `react-native-pager-view` on the SDK 53 pager-view fixture and exits `1`. NativeGuard does not apply the bump.

## Sub-features

- `risky-path` analyzes `fixtures/sdk53-pager-view` via `doctor [path]` and exits `1`.
- `risky-cwd` analyzes the same fixture from that directory as cwd and exits `1`.
- `risky-bump` includes a `recommendations[]` entry with `action` `bump` and `packageName` `react-native-pager-view`.
- `risky-contract` includes `schemaVersion`, `recommendations`, `summary.status`, `project.kind`, and `project.root`.

## How to get to it (user POV)

- Run `nativeguard doctor --json fixtures/sdk53-pager-view` from the repo root.
- `cd fixtures/sdk53-pager-view` and run `nativeguard doctor --json`.

## Driving it with verify-doctor

Preconditions:

- Baseline launch and doctor check have passed.
- `fixtures/sdk53-pager-view/package.json` still depends on `react-native-pager-view` `6.6.0` and `expo` `53.0.20`.
- The tracked fixture is unmodified.

- **Path entry.** Analyze the fixture by path. Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id pager-view-risky --feature doctor-risky-recommendation -- fixtures/sdk53-pager-view`. Exit code `1`. `stdout.json` parses as JSON with `schemaVersion` `"1.0.0"`, `summary.status` `"risky"`, `project.kind` `"expo-prebuild"`, and `project.root` equal to the absolute path of `fixtures/sdk53-pager-view`.
- **Bump recommendation.** In the same `stdout.json`, `recommendations` contains an object whose `action` is `"bump"`, `packageName` is `"react-native-pager-view"`, `from` is `"6.6.0"`, and `to` is `"6.7.1"`.
- **Cwd entry.** Analyze the fixture as cwd. Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id pager-view-risky-cwd --feature doctor-risky-recommendation --cwd fixtures/sdk53-pager-view --`. Exit code `1`, `summary.status` `"risky"`, and `project.root` is the same absolute fixture path.
- **Proof.** Keep both artifact directories. `exit-code.txt` is `1` and `stderr.txt` does not replace the JSON report. The tracked `fixtures/sdk53-pager-view` tree is unchanged, including `package-lock.json`.

## Gotchas

- Exit `1` is the success signal for this feature. Do not treat a non-zero doctor exit as a harness failure.
- `--json` writes the report to stdout only. Assert `stdout.json`, not a human table on stdout.
- `acceptedExceptions` cannot silence a `bump`. Do not use the leave/pin exception recipe on this fixture and call it stable.
- `--sdk 54` hides the SDK 53 pager-view rule. Omit `--sdk` unless a different feature asks for it.
- The fixture has `ios/` and `android/` (`.gitkeep`), so `project.kind` is `"expo-prebuild"`, not `"expo-go"`.
