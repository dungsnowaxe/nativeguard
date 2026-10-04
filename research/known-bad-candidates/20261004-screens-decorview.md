# Known-bad candidate: react-native-screens DecorView null crash

> Unconfirmed. Not merged into `@nativeguard/rules`. Human gate only.
> Do not treat this as a pack rule until someone confirms the ranges.
> Promoted to rule `screens-decorview-android-sdk55`. Ranges in this note are unchanged. 4.23.1 not released (tag 404).

| Field | Value |
| --- | --- |
| package | `react-native-screens` |
| vulnerable | `>=4.23.0 <4.25.0` |
| fixed | `>=4.25.0` |
| patched | patch-package null-guard on `Screen.onLayout` while Expo SDK 55 pins `~4.23.0` and 4.23.1 is not confirmed |
| SDK / RN notes | SDK 55 bundledNativeModules pins `~4.23.0`; issue claims SDK 56 bundles 4.25.2 |
| evidence URL | https://github.com/software-mansion/react-native-screens/issues/4311 |
| status | unconfirmed |
| 4.23.1 | 4.23.1 not released |

## What issue #4311 states

[software-mansion/react-native-screens#4311](https://github.com/software-mansion/react-native-screens/issues/4311) (open) says `react-native-screens` 4.23.0 and 4.24.0 crash on Android in `Screen.onLayout`:

`FATAL EXCEPTION: java.lang.IllegalArgumentException: [RNScreens] DecorView is required for applying inset correction, but was null.`

The issue says the crash was fixed in 4.25.0, where the DecorView-based inset correction was removed from `onLayout`. It points at fix #3793 (`e74d69f0`), first released in 4.25.0.

The vulnerable range above is the span covering the versions the issue names as crashing (4.23.0 and 4.24.0) up to, but not including, that 4.25.0 fix. It is unconfirmed: the issue does not itself write the comparator string `>=4.23.0 <4.25.0`.

## Workaround the issue proposes

Expo SDK 55 pins `react-native-screens@~4.23.0` in `bundledNativeModules.json`, so the issue says SDK 55 apps cannot take 4.25.x without overriding Expo's version validation. It claims SDK 56 already bundles 4.25.2.

Until a 4.23.x backport exists, the issue's minimal patch-package null-guard is:

```
val topLevelDecorView = reactContext.currentActivity?.window?.decorView
val topInset = topLevelDecorView?.let { getDecorViewTopInset(it) } ?: 0
```

The issue author asked for a 4.23.1 with that guard, not a backport of the full #3793 inset rework. They noted 4.23.1 was not confirmed.

## Release check

Checked 2026-10-04:

- `gh api repos/software-mansion/react-native-screens/git/ref/tags/4.23.1` → `404` `Not Found`
- `gh release view 4.23.1 --repo software-mansion/react-native-screens` → `release not found`
- `gh api repos/software-mansion/react-native-screens/git/matching-refs/tags/4.23` → `refs/tags/4.23.0` only

4.23.1 not released.

Fixed stays `>=4.25.0`. It does not add `>=4.23.1 <4.24.0`.
