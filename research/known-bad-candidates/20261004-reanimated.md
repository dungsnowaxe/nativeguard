# Known-bad candidate: react-native-reanimated

> Draft only. Miner v1 does **not** auto-merge into `@nativeguard/rules`.
> Vulnerable and fixed stay TODO unless one issue literally states both ranges. Copied ranges are unconfirmed.

| Field | Value |
| --- | --- |
| package | `react-native-reanimated` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \| pin \| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| search scope | `software-mansion/react-native-reanimated`, `expo/expo` |
| mined | 2026-10-04T07:45:07.218Z |

## Evidence URLs

- https://github.com/expo/expo/issues/47518
- https://github.com/software-mansion/react-native-reanimated/issues/10280
- https://github.com/software-mansion/react-native-reanimated/issues/10672
- https://github.com/software-mansion/react-native-reanimated/issues/7666
- https://github.com/software-mansion/react-native-reanimated/issues/7674
- https://github.com/software-mansion/react-native-reanimated/pull/10455
- https://github.com/expo/expo/issues/41620
- https://github.com/expo/expo/issues/42631

## Search hits

- [[SDK 57] Bump `react-native-reanimated` from 4.5.0 to 4.5.1](https://github.com/expo/expo/issues/47518) (closed)
- [[Android] ANR: synchronouslyUpdateUIProps prints full stack traces on the UI thread when the view tag is unmounted (RN 0.86 reflection path)](https://github.com/software-mansion/react-native-reanimated/issues/10280) (open)
- [[iOS] "Unable to recognize flag: USE_ANIMATION_BACKEND" from JS → EXC_BAD_ACCESS (SIGSEGV) (RN 0.83.10 + Reanimated 4.5.5 + Worklets 0.10.1)](https://github.com/software-mansion/react-native-reanimated/issues/10672) (open)
- [[iOS Crash] EXC_BAD_ACCESS in folly::dynamic::hash() via ShadowNode clone — intermittent crash on Reanimated 3.17.1](https://github.com/software-mansion/react-native-reanimated/issues/7666) (open)
- [[Gradle Build Error] Failed to compile with Kotlin 1.9.25 using react-native-reanimated on EAS Build (Expo Managed)](https://github.com/software-mansion/react-native-reanimated/issues/7674) (open)
- [chore(worklets): add Bundle Mode patches for metro 0.87.0 and 0.87.1](https://github.com/software-mansion/react-native-reanimated/pull/10455) (open)
- [Expo's tree shaking crashes production with latest react-native-reanimated](https://github.com/expo/expo/issues/41620) (open)
- [Crash when dragging with react-native-reanimated-dnd on Expo SDK 54 (react-native-worklets error)](https://github.com/expo/expo/issues/42631) (closed)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
