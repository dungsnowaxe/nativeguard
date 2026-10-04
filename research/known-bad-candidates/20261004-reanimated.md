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
| mined | 2026-10-04T07:38:40.306Z |

## Evidence URLs

- https://github.com/expo/expo/issues/47518
- https://github.com/expo/expo/issues/47625
- https://github.com/expo/expo/issues/50451
- https://github.com/expo/expo/issues/50545
- https://github.com/expo/expo/pull/50507
- https://github.com/software-mansion/react-native-reanimated/issues/10672
- https://github.com/software-mansion/react-native-reanimated/issues/7666
- https://github.com/software-mansion/react-native-reanimated/issues/7674
- https://github.com/software-mansion/react-native-reanimated/issues/9571
- https://github.com/software-mansion/react-native-reanimated/pull/10455
- https://github.com/software-mansion/react-native-reanimated/pull/10755
- https://github.com/expo/expo/issues/36301
- https://github.com/expo/expo/issues/41620
- https://github.com/expo/expo/issues/42631
- https://github.com/expo/expo/issues/45511
- https://github.com/expo/expo/issues/45926
- https://github.com/expo/expo/issues/48390
- https://github.com/expo/expo/issues/49330
- https://github.com/expo/expo/issues/49622
- https://github.com/expo/expo/issues/50733
- https://github.com/expo/expo/issues/50791
- https://github.com/expo/expo/pull/50576
- https://github.com/expo/expo/pull/50885
- https://github.com/expo/expo/pull/50998
- https://github.com/software-mansion/react-native-reanimated/issues/3058
- https://github.com/software-mansion/react-native-reanimated/issues/4597
- https://github.com/software-mansion/react-native-reanimated/issues/6752
- https://github.com/software-mansion/react-native-reanimated/issues/6873
- https://github.com/software-mansion/react-native-reanimated/issues/8217
- https://github.com/software-mansion/react-native-reanimated/pull/10505
- https://github.com/software-mansion/react-native-reanimated/pull/10801

## Search hits

- [[SDK 57] Bump `react-native-reanimated` from 4.5.0 to 4.5.1](https://github.com/expo/expo/issues/47518) (closed)
- [[Android][expo-ui] Host with matchContents crashes ReactHost: "performMeasureAndLayout called during measure layout" (synchronous onLayoutContent dispatch during measure pass + reanimated)](https://github.com/expo/expo/issues/47625) (closed)
- [[SDK 58][iOS][expo-modules-core] `ExpoViewShadowNode::layout` segfaults when a `matchContents` host's subtree also touches shadow nodes (nested host, or reanimated)](https://github.com/expo/expo/issues/50451) (closed)
- [[expo-image][Android] "You can't start or clear loads in RequestListener or Target callbacks" still crashes via onLoadFailed](https://github.com/expo/expo/issues/50545) (closed)
- [[expo][web] Stub requestAnimationFrame in server bundles (worklets regression workaround)](https://github.com/expo/expo/pull/50507) (closed)
- [[iOS] "Unable to recognize flag: USE_ANIMATION_BACKEND" from JS → EXC_BAD_ACCESS (SIGSEGV) (RN 0.83.10 + Reanimated 4.5.5 + Worklets 0.10.1)](https://github.com/software-mansion/react-native-reanimated/issues/10672) (open)
- [[iOS Crash] EXC_BAD_ACCESS in folly::dynamic::hash() via ShadowNode clone — intermittent crash on Reanimated 3.17.1](https://github.com/software-mansion/react-native-reanimated/issues/7666) (open)
- [[Gradle Build Error] Failed to compile with Kotlin 1.9.25 using react-native-reanimated on EAS Build (Expo Managed)](https://github.com/software-mansion/react-native-reanimated/issues/7674) (open)
- [Fix: Android build fails with NDK 27 (Clang 18) due to -Werror and new deprecation/VLA warnings](https://github.com/software-mansion/react-native-reanimated/issues/9571) (open)
- [chore(worklets): add Bundle Mode patches for metro 0.87.0 and 0.87.1](https://github.com/software-mansion/react-native-reanimated/pull/10455) (open)
- [test(LayoutAnimations): remove a native stack screen that holds a nested stack with header buttons](https://github.com/software-mansion/react-native-reanimated/pull/10755) (open)
- [[Video] Directly mutating player properties triggers react compiler warnings](https://github.com/expo/expo/issues/36301) (open)
- [Expo's tree shaking crashes production with latest react-native-reanimated](https://github.com/expo/expo/issues/41620) (open)
- [Crash when dragging with react-native-reanimated-dnd on Expo SDK 54 (react-native-worklets error)](https://github.com/expo/expo/issues/42631) (closed)
- [`expo-image` renders at 0×0 with `require()` source or source-level width/height](https://github.com/expo/expo/issues/45511) (open)
- [SDK 54 bridgeless mode: TurboModuleRegistry can't resolve community-CLI-autolinked modules](https://github.com/expo/expo/issues/45926) (open)
- [Expo go SDK 57 crashes after bundling](https://github.com/expo/expo/issues/48390) (closed)
- [[expo-secure-store] canUseBiometricAuthentication() returns false on Android <= 10 as soon as expo-camera is installed](https://github.com/expo/expo/issues/49330) (open)
- [[expo-router] Typed routes: getWatchHandler admits files outside the app root on Windows, poisoning router.d.ts](https://github.com/expo/expo/issues/49622) (open)
- [[SDK 57][Android] Bundled @shopify/react-native-skia 2.6.2 is incompatible with react-native 0.86: makeImageFromView skips overflow clip and throws NoSuchMethodException](https://github.com/expo/expo/issues/50733) (closed)
- [[expo-brownfield][Android] Autolinked libraries are published at their template versionName ("1.0"), so every release reuses the same Maven coordinates](https://github.com/expo/expo/issues/50791) (open)
- [[observe] Add a react-native-reanimated integration for errors and warnings](https://github.com/expo/expo/pull/50576) (open)
- [[macos] Fix macOS CI with react-native-macos 0.83](https://github.com/expo/expo/pull/50885) (closed)
- [fix(templates): Fix `npm install` for new SDK 58 projects](https://github.com/expo/expo/pull/50998) (open)
- [Android: Remove Item with exiting does not showing correctly](https://github.com/software-mansion/react-native-reanimated/issues/3058) (open)
- [No layout animation on last item of list components](https://github.com/software-mansion/react-native-reanimated/issues/4597) (open)
- [[ReText, animatedProps text] Incorrect behavior with numeric text in fitting containers. Some numbers end with an ellipsis, IOS only](https://github.com/software-mansion/react-native-reanimated/issues/6752) (open)
- [Task :react-native-reanimated:compileDebugJavaWithJavac FAILED](https://github.com/software-mansion/react-native-reanimated/issues/6873) (open)
- [react-native-reanimated:buildCMakeDebug taking too much time](https://github.com/software-mansion/react-native-reanimated/issues/8217) (open)
- [fix(LayoutAnimations): exclude animated views from removeClippedSubviews clipping on Android](https://github.com/software-mansion/react-native-reanimated/pull/10505) (open)
- [perf(Android): skip the raw props merge that React Native repeats](https://github.com/software-mansion/react-native-reanimated/pull/10801) (open)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
