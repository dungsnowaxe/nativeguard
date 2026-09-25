# Accepted pin / leave exception

A user can record a matching `pin`, `leave`, or `exclude` finding in `nativeguard-lock.json` `acceptedExceptions` (reason required). The next doctor run surfaces that finding as `accepted-exception` and exits `0`. `bump` findings stay `risky`.

## Sub-features

- `exception-leave` accepts the `expo-av` leave finding on a copy of `fixtures/sdk54-leave-expo-av` and exits `0`.
- `exception-pin` accepts the `react-native-screens` pin finding on a copy of `fixtures/sdk54-screens-expo-go` and exits `0`.
- `exception-snapshot` uses `--write-snapshot` to create `nativeguard-lock.json` without changing package manager lockfiles.
- `exception-bump-rejected` shows that accepting `react-native-pager-view` on `fixtures/sdk53-pager-view` still exits `1`.

## How to get to it (user POV)

- Run `nativeguard doctor --json --write-snapshot [path]`.
- Edit `nativeguard-lock.json` and add an `acceptedExceptions[]` entry with `packageName`, `version`, `reason`, and optional `ruleId`.
- Re-run `nativeguard doctor --json [path]`.

## Driving it with verify-doctor

Preconditions:

- Baseline launch and doctor check have passed.
- Scratch root `/tmp/nativeguard-verify-<run-id>/` does not exist yet (or is empty).
- Work only on copies. Never write into tracked `fixtures/`.

- **Copy leave fixture.** `mkdir -p /tmp/nativeguard-verify-<run-id> && cp -R fixtures/sdk54-leave-expo-av /tmp/nativeguard-verify-<run-id>/leave-expo-av`.
- **First leave run.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id accepted-leave-before --feature doctor-accepted-exception -- /tmp/nativeguard-verify-<run-id>/leave-expo-av --write-snapshot`. Exit code `1`. `summary.status` is `"risky"`. `recommendations` contains `action` `"leave"` and `packageName` `"expo-av"`. `nativeguard-lock.json` now exists in the copy. The copy's `package-lock.json` bytes match `fixtures/sdk54-leave-expo-av/package-lock.json`.
- **Record leave exception.** Edit the copy's `nativeguard-lock.json` so `acceptedExceptions` is `[{ "packageName": "expo-av", "version": "16.0.7", "reason": "Leaving expo-av on SDK 54 until the expo-audio / expo-video migration.", "ruleId": "sdk54-leave-expo-av-pending-audio-video-migration" }]`.
- **Second leave run.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id accepted-leave-after --feature doctor-accepted-exception -- /tmp/nativeguard-verify-<run-id>/leave-expo-av`. Exit code `0`. `summary.status` is `"accepted-exception"`. `project.root` is the absolute scratch copy path.
- **Copy pin fixture.** `cp -R fixtures/sdk54-screens-expo-go /tmp/nativeguard-verify-<run-id>/pin-screens`.
- **First pin run.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id accepted-pin-before --feature doctor-accepted-exception -- /tmp/nativeguard-verify-<run-id>/pin-screens --write-snapshot`. Exit code `1`. `recommendations` contains `action` `"pin"` and `packageName` `"react-native-screens"`.
- **Record pin exception.** Set `acceptedExceptions` to `[{ "packageName": "react-native-screens", "version": "4.20.0", "reason": "Keeping screens 4.20.0 until the Expo Go pin can be applied.", "ruleId": "sdk54-pin-screens-tilde-4.16" }]`.
- **Second pin run.** Run `.cursor/skills/verify-nativeguard/scripts/verify-doctor.sh drive --run-id accepted-pin-after --feature doctor-accepted-exception -- /tmp/nativeguard-verify-<run-id>/pin-screens`. Exit code `0`. `summary.status` is `"accepted-exception"`.
- **Bump is not acceptable.** Copy `fixtures/sdk53-pager-view` the same way, `--write-snapshot`, add an exception for `react-native-pager-view` `6.6.0` with `ruleId` `pager-view-min-6.7.1-on-rn-079`, and re-run doctor. Exit code `1` and `summary.status` `"risky"`.
- **Proof.** Keep the `*-after` artifact directories. After cleanup, those artifacts still exist and the tracked fixtures are unmodified.

## Gotchas

- `reason` is required. An exception without it does not become `accepted-exception`.
- `--write-snapshot` writes NativeGuard's snapshot only. If `package-lock.json` changes, the run is invalid.
- Do not commit scratch `nativeguard-lock.json` files. Delete `/tmp/nativeguard-verify-<run-id>` during cleanup.
- Matching is on package + version (and rule when provided). A typo in `packageName` leaves the finding `risky`.
