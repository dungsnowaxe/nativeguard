# Known-bad candidate: nativewind

> Draft only. Miner v0 does **not** auto-merge into `@nativeguard/rules`.
> Fill vulnerable / fixed ranges from evidence before proposing a pack change.

| Field | Value |
| --- | --- |
| package | `nativewind` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \| pin \| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| signals | `fails EAS`, `expo doctor`, `patch-package`, `workaround`, `fixed in` |
| mined | 2026-10-04T07:31:51.289Z |

## Evidence URLs

- https://github.com/kyh/init/issues/93
- https://github.com/masch/sonora/issues/128

## Search hits

- [Remove or re-justify the @expo/dom-webview 56.0.5 override (forces a cross-major peer violation)](https://github.com/kyh/init/issues/93) (closed)
- [fix(build): Android APK build fails — lightningcss >=1.30.2 breaks CSS parsing in react-native-css](https://github.com/masch/sonora/issues/128) (closed)

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
