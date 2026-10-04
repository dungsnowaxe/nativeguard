# Known-bad candidate: react-native-reanimated

> Draft only. Miner v0 does **not** auto-merge into `@nativeguard/rules`.
> Fill vulnerable / fixed ranges from evidence before proposing a pack change.

| Field | Value |
| --- | --- |
| package | `react-native-reanimated` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \| pin \| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| signals | `fails EAS`, `expo doctor`, `patch-package`, `workaround`, `fixed in` |
| mined | 2026-10-04T07:31:23.338Z |

## Evidence URLs

- https://github.com/expo/expo/issues/39583
- https://github.com/expo/expo/issues/32843
- https://github.com/expo/expo-cli/issues/4707
- https://github.com/realm/realm-js/issues/4621

## Search hits

- [[SDK 54]: expo TypeError: Cannot read property 'level' of undefined](https://github.com/expo/expo/issues/39583) (closed)
- [[SDK 52][router] Cannot find module 'react' error on Web when app config set to Server instead of Static](https://github.com/expo/expo/issues/32843) (closed)
- [FetchError: request to https://api.expo.dev/v2/versions/latest failed, reason: Socket connection timeout](https://github.com/expo/expo-cli/issues/4707) (closed)
- [10.20.0-beta.5 Missing Constructor Error](https://github.com/realm/realm-js/issues/4621) (closed)

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
