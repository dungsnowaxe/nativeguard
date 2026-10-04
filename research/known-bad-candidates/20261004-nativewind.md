# Known-bad candidate: nativewind

> Draft only. Miner v1 does **not** auto-merge into `@nativeguard/rules`.
> Vulnerable and fixed stay TODO unless one issue literally states both ranges. Copied ranges are unconfirmed.

| Field | Value |
| --- | --- |
| package | `nativewind` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \| pin \| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| search scope | `nativewind/nativewind`, `expo/expo` |
| mined | 2026-10-04T07:47:00.628Z |

## Evidence URLs

- https://github.com/expo/expo/issues/39615
- https://github.com/nativewind/nativewind/issues/1039
- https://github.com/nativewind/nativewind/issues/1802
- https://github.com/nativewind/nativewind/issues/1821
- https://github.com/expo/expo/issues/36761
- https://github.com/expo/expo/issues/39657
- https://github.com/expo/expo/issues/40788
- https://github.com/expo/expo/issues/43029

## Search hits

- [Suddenly npx expo start doesn't work anymore [fixed, nativewind 4.2.0 problem]](https://github.com/expo/expo/issues/39615) (closed)
- [Nativewind 4.1 and Material Top Tabs - Tab alignment issues](https://github.com/nativewind/nativewind/issues/1039) (open)
- [Metro >= 0.83: haste.emit uses legacy eventsQueue format → CSS HMR silently broken on RN 0.81+ / Expo SDK 55+](https://github.com/nativewind/nativewind/issues/1802) (closed)
- [NativeWind v4 Fast Refresh broken on RN 0.83 / Metro 0.83 — `changes.modifiedFiles is not iterable`](https://github.com/nativewind/nativewind/issues/1821) (closed)
- [Metro/Babel: .plugins is not a valid Plugin property when using nativewind/babel in Expo SDK 53](https://github.com/expo/expo/issues/36761) (closed)
- [[SDK 54 / React 19] Nativewind loses `ref` prop](https://github.com/expo/expo/issues/39657) (closed)
- [Expo project fails to load metro.config.js after upgrading NativeWind](https://github.com/expo/expo/issues/40788) (closed)
- [[EXPO-54 ISSUE] Font Clipping, Safearea view and Nativewind Theme issue in expo sdk 54 on Android 13](https://github.com/expo/expo/issues/43029) (closed)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
