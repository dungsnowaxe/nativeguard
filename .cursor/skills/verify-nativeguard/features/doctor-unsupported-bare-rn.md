# Unsupported bare React Native

Doctor detects a bare React Native project, skips compatibility rules, reports `summary.status` `"unsupported"` with an empty `recommendations` array, and exits `1`. This is an analysis report, not an error payload.

## Sub-features

- `bare-path` analyzes `fixtures/bare-react-native` via `doctor [path]` and exits `1`.
- `bare-cwd` analyzes the same fixture from that directory as cwd and exits `1`.
- `bare-status` sets `summary.status` to `"unsupported"` and `project.kind` to `"bare-react-native"`.
- `bare-empty-recs` leaves `recommendations` as `[]` and does not emit `error.code`.

## How to get to it (user POV)

- Run `nativeguard doctor --json fixtures/bare-react-native` from the repo root.
- `cd fixtures/bare-react-native` and run `nativeguard doctor --json`.

## Driving it with verify-doctor

Preconditions:

- Baseline launch and doctor check have passed.
- `fixtures/bare-react-native/package.json` depends on `react-native` and does not depend on `expo`.
- The fixture has `ios/` and `android/` directories.

- **Path entry.** Analyze the fixture by path. Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id bare-rn-unsupported --feature doctor-unsupported-bare-rn -- fixtures/bare-react-native`. Exit code `1`. `stdout.json` has `schemaVersion` `"1.0.0"`, `summary.status` `"unsupported"`, `project.kind` `"bare-react-native"`, `project.root` equal to the absolute path of `fixtures/bare-react-native`, and `recommendations` equal to `[]`.
- **Not an error payload.** The same JSON has no `error` key. `summary` and `project` are present.
- **Cwd entry.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id bare-rn-unsupported-cwd --feature doctor-unsupported-bare-rn --cwd fixtures/bare-react-native --`. Exit code `1` and the same `summary.status` / `project.kind`.
- **Proof.** Keep the artifact directories. `exit-code.txt` is `1`. The tracked fixture is unchanged.

## Gotchas

- Unsupported is not `stable` and not `INVALID_SDK`. Empty `recommendations` plus `summary.status` `"unsupported"` is the proof; an `error` object means analysis did not run.
- Bare React Native is detected from `react-native` plus `ios/` or `android/` and no Expo prebuild layout. Do not swap in `fixtures/expo-prebuild`.
- Exit `1` is expected. Do not retry until doctor exits `0`.
