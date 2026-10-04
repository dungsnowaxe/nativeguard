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
| mined | 2026-10-04T07:40:31.584Z |

## Evidence URLs

- https://github.com/expo/expo/issues/29070
- https://github.com/expo/expo/issues/39615
- https://github.com/expo/expo/issues/50451
- https://github.com/nativewind/nativewind/issues/1039
- https://github.com/nativewind/nativewind/issues/1331
- https://github.com/nativewind/nativewind/issues/1711
- https://github.com/nativewind/nativewind/issues/1732
- https://github.com/nativewind/nativewind/issues/1802
- https://github.com/nativewind/nativewind/issues/1814
- https://github.com/nativewind/nativewind/issues/1821
- https://github.com/nativewind/nativewind/issues/1833
- https://github.com/nativewind/nativewind/issues/1843
- https://github.com/nativewind/nativewind/issues/1855
- https://github.com/nativewind/nativewind/pull/1784
- https://github.com/nativewind/nativewind/pull/1794
- https://github.com/expo/expo/issues/33340
- https://github.com/expo/expo/issues/35130
- https://github.com/expo/expo/issues/36122
- https://github.com/expo/expo/issues/36761
- https://github.com/expo/expo/issues/39657
- https://github.com/expo/expo/issues/40788
- https://github.com/expo/expo/issues/43029
- https://github.com/expo/expo/issues/43031
- https://github.com/expo/expo/issues/43744
- https://github.com/expo/expo/issues/44680
- https://github.com/expo/expo/issues/48390
- https://github.com/expo/expo/issues/49502
- https://github.com/nativewind/nativewind/issues/1812
- https://github.com/nativewind/nativewind/issues/1823
- https://github.com/nativewind/nativewind/issues/1834
- https://github.com/nativewind/nativewind/issues/1861

## Search hits

- [Error: Cannot find native module 'ExpoAsset'](https://github.com/expo/expo/issues/29070) (closed)
- [Suddenly npx expo start doesn't work anymore [fixed, nativewind 4.2.0 problem]](https://github.com/expo/expo/issues/39615) (closed)
- [[SDK 58][iOS][expo-modules-core] `ExpoViewShadowNode::layout` segfaults when a `matchContents` host's subtree also touches shadow nodes (nested host, or reanimated)](https://github.com/expo/expo/issues/50451) (closed)
- [Nativewind 4.1 and Material Top Tabs - Tab alignment issues](https://github.com/nativewind/nativewind/issues/1039) (open)
- [Safe area classes not applied on web due to missing safe area plugin config](https://github.com/nativewind/nativewind/issues/1331) (open)
- [Repo: Navigation context error triggered by NativeWind `shadow-*` toggle in Expo Router (Expo 53)](https://github.com/nativewind/nativewind/issues/1711) (open)
- [[V5] `styled()` with generic list components (e.g. `FlatList` and `FlashList`) causes `TS2590: union type too complex to represent`](https://github.com/nativewind/nativewind/issues/1732) (closed)
- [Metro >= 0.83: haste.emit uses legacy eventsQueue format → CSS HMR silently broken on RN 0.81+ / Expo SDK 55+](https://github.com/nativewind/nativewind/issues/1802) (closed)
- [[Bug] react-aria dependency pulls in react-dom causing Metro bundler failure on bare RN CLI](https://github.com/nativewind/nativewind/issues/1814) (open)
- [NativeWind v4 Fast Refresh broken on RN 0.83 / Metro 0.83 — `changes.modifiedFiles is not iterable`](https://github.com/nativewind/nativewind/issues/1821) (closed)
- [nativewind/babel cannot resolve JSX transform with Bun isolated installs](https://github.com/nativewind/nativewind/issues/1833) (open)
- [text-align classes on <TextInput> crash with "undefined is not a function"](https://github.com/nativewind/nativewind/issues/1843) (closed)
- [Please fix latent issues [Summary Available]](https://github.com/nativewind/nativewind/issues/1855) (closed)
- [fix: emit non-empty types for nativewind/preset](https://github.com/nativewind/nativewind/pull/1784) (open)
- [fix(native): return null for display: none to prevent Yoga crash](https://github.com/nativewind/nativewind/pull/1794) (open)
- [Error: Cannot find module '../lightningcss.linux-x64-gnu.node'](https://github.com/expo/expo/issues/33340) (closed)
- [[expo-video] memory leak for mp4](https://github.com/expo/expo/issues/35130) (closed)
- [[BUG] Splash Screen Icon and Background Color on Some Devices](https://github.com/expo/expo/issues/36122) (closed)
- [Metro/Babel: .plugins is not a valid Plugin property when using nativewind/babel in Expo SDK 53](https://github.com/expo/expo/issues/36761) (closed)
- [[SDK 54 / React 19] Nativewind loses `ref` prop](https://github.com/expo/expo/issues/39657) (closed)
- [Expo project fails to load metro.config.js after upgrading NativeWind](https://github.com/expo/expo/issues/40788) (closed)
- [[EXPO-54 ISSUE] Font Clipping, Safearea view and Nativewind Theme issue in expo sdk 54 on Android 13](https://github.com/expo/expo/issues/43029) (closed)
- [[EXPO-54 ISSUE] Font Clipping, Safearea view and Nativewind Theme issue in expo sdk 54 on Android 13](https://github.com/expo/expo/issues/43031) (closed)
- [SDK 55: SceneView crashes with 'Element type is invalid: got undefined' even with minimal layout](https://github.com/expo/expo/issues/43744) (closed)
- [[SDK 55/56] Production builds crash on A18 Pro devices (iPhone 16) with iOS 26 — dev builds work fine](https://github.com/expo/expo/issues/44680) (closed)
- [Expo go SDK 57 crashes after bundling](https://github.com/expo/expo/issues/48390) (closed)
- [[metro-config] Tree shaking emits an unwrapped module for `.css` files a transformer turned into JS](https://github.com/expo/expo/issues/49502) (open)
- [printUpgradeWarning crashes the app when serializing props that contain a context object with a throwing getter (e.g. React Navigation)](https://github.com/nativewind/nativewind/issues/1812) (open)
- [NativeWind 4.2.5 does not apply newly added classes during Fast Refresh with expo run:ios](https://github.com/nativewind/nativewind/issues/1823) (closed)
- [LogBox UI breaks on React Native 0.86 when using nativewind/babel preset](https://github.com/nativewind/nativewind/issues/1834) (open)
- [`platformSelect` does not work with `boxShadow` and css syntax](https://github.com/nativewind/nativewind/issues/1861) (open)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
