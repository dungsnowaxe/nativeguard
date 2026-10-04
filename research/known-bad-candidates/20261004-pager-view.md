# Known-bad candidate: react-native-pager-view

> Draft only. Miner v1 does **not** auto-merge into `@nativeguard/rules`.
> Vulnerable and fixed stay TODO unless one issue literally states both ranges. Copied ranges are unconfirmed.

| Field | Value |
| --- | --- |
| package | `react-native-pager-view` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \| pin \| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| search scope | `callstack/react-native-pager-view`, `expo/expo` |
| mined | 2026-10-04T07:39:35.766Z |

## Evidence URLs

- https://github.com/callstack/react-native-pager-view/issues/1026
- https://github.com/callstack/react-native-pager-view/issues/1036
- https://github.com/callstack/react-native-pager-view/issues/1080
- https://github.com/callstack/react-native-pager-view/issues/1098
- https://github.com/callstack/react-native-pager-view/issues/1156
- https://github.com/callstack/react-native-pager-view/issues/532
- https://github.com/callstack/react-native-pager-view/issues/590
- https://github.com/callstack/react-native-pager-view/pull/1149
- https://github.com/callstack/react-native-pager-view/pull/970
- https://github.com/expo/expo/issues/39474
- https://github.com/callstack/react-native-pager-view/issues/1005
- https://github.com/callstack/react-native-pager-view/issues/1009
- https://github.com/callstack/react-native-pager-view/issues/1028
- https://github.com/callstack/react-native-pager-view/issues/1033
- https://github.com/callstack/react-native-pager-view/issues/1049
- https://github.com/callstack/react-native-pager-view/issues/1050
- https://github.com/callstack/react-native-pager-view/issues/1066
- https://github.com/callstack/react-native-pager-view/issues/1099
- https://github.com/callstack/react-native-pager-view/issues/1154
- https://github.com/callstack/react-native-pager-view/issues/431
- https://github.com/callstack/react-native-pager-view/issues/514
- https://github.com/callstack/react-native-pager-view/issues/575
- https://github.com/callstack/react-native-pager-view/issues/856
- https://github.com/callstack/react-native-pager-view/issues/882
- https://github.com/callstack/react-native-pager-view/issues/895
- https://github.com/callstack/react-native-pager-view/issues/951
- https://github.com/callstack/react-native-pager-view/issues/999
- https://github.com/callstack/react-native-pager-view/pull/1145
- https://github.com/callstack/react-native-pager-view/pull/1150
- https://github.com/expo/expo/issues/26879
- https://github.com/expo/expo/issues/33102
- https://github.com/expo/expo/issues/43774
- https://github.com/expo/expo/issues/45231
- https://github.com/expo/expo/issues/45511
- https://github.com/expo/expo/issues/49058
- https://github.com/expo/expo/issues/50878

## Search hits

- [PagerView shrinks when its siblings are overflowing container](https://github.com/callstack/react-native-pager-view/issues/1026) (open)
- [Button in the view pager become unresponsive after removing a page](https://github.com/callstack/react-native-pager-view/issues/1036) (open)
- [[iOS 15] Tab indicator does not update when switching pages after SwiftUI migration (v8)](https://github.com/callstack/react-native-pager-view/issues/1080) (open)
- [[iOS] Nested PagerView crashes with UIViewControllerHierarchyInconsistency (8.0.4)](https://github.com/callstack/react-native-pager-view/issues/1098) (closed)
- [[Android] v9: nested horizontal ScrollView inside a page no longer scrolls (regression from 8.x)](https://github.com/callstack/react-native-pager-view/issues/1156) (open)
- [I would like the Height to be scaled according to the children](https://github.com/callstack/react-native-pager-view/issues/532) (open)
- [Incorrect page change detected when scrolling outside of view](https://github.com/callstack/react-native-pager-view/issues/590) (open)
- [fix(ios): hide vertical pager scroll edge effects](https://github.com/callstack/react-native-pager-view/pull/1149) (closed)
- [fix: pager view recycling crash](https://github.com/callstack/react-native-pager-view/pull/970) (closed)
- [[Bug] ReferenceError: Property 'require' doesn't exist with Hermes engine in SDK 53](https://github.com/expo/expo/issues/39474) (closed)
- [java.lang.IllegalArgumentException: Scrapped or attached views may not be recycled](https://github.com/callstack/react-native-pager-view/issues/1005) (open)
- [6.8.1 property scrollEnabled allows for swiping on iOS](https://github.com/callstack/react-native-pager-view/issues/1009) (closed)
- [[iOS 15] swipeEnabled: false is not working](https://github.com/callstack/react-native-pager-view/issues/1028) (open)
- [Elements inside a pagerview is not accessible by appium](https://github.com/callstack/react-native-pager-view/issues/1033) (open)
- [Android: Horizontal FlatList inside Vertical FlatList causes PagerView to swipe pages on fast horizontal scroll](https://github.com/callstack/react-native-pager-view/issues/1049) (open)
- [[iOS] `react-native-screens` v4.19.0 breaks the global back swipe gesture on pager views](https://github.com/callstack/react-native-pager-view/issues/1050) (open)
- [[iOS] onPageSelected is not fired after upgrading to Expo 55](https://github.com/callstack/react-native-pager-view/issues/1066) (open)
- [[iOS] pager content getting cropped on version 8.0.4](https://github.com/callstack/react-native-pager-view/issues/1099) (open)
- [[Android] Focused TextInput keeps focus and keyboard after switching pages (v9)](https://github.com/callstack/react-native-pager-view/issues/1154) (open)
- [Cusing warning on build the app debug ](https://github.com/callstack/react-native-pager-view/issues/431) (open)
- [setPage prevents Keyboard on Android](https://github.com/callstack/react-native-pager-view/issues/514) (open)
- [The first SceneView's height is not full](https://github.com/callstack/react-native-pager-view/issues/575) (open)
- [>Task :react-native-pager-view:compileDebugKotlin FAILED](https://github.com/callstack/react-native-pager-view/issues/856) (closed)
- [app crashing in react native version 0.75.4  with new architecture](https://github.com/callstack/react-native-pager-view/issues/882) (closed)
- [onPageSelected is triggering with e.nativeEvent.position==0 after leaving tabview](https://github.com/callstack/react-native-pager-view/issues/895) (open)
- [tabBarIndicator does not update when navigating to another screen](https://github.com/callstack/react-native-pager-view/issues/951) (open)
- [Pager view causing crash in the app for some users in production](https://github.com/callstack/react-native-pager-view/issues/999) (open)
- [fix(android): preserve pager content during screen exit transitions](https://github.com/callstack/react-native-pager-view/pull/1145) (open)
- [fix(ios): stop the GeometryReader root from shrinking pages for the keyboard](https://github.com/callstack/react-native-pager-view/pull/1150) (closed)
- [[SDK 50] Expo tracking transparency crashing on web](https://github.com/expo/expo/issues/26879) (closed)
- [[expo52] IOS nested routing navigation page jitters ](https://github.com/expo/expo/issues/33102) (closed)
- [expo-sharing causes unresponsive screen after returning from share dialog on iOS 16.3 and iOS 26.2](https://github.com/expo/expo/issues/43774) (closed)
- [[expo-location] [android] IllegalArgumentException Cannot create an event emitter for module class expo.modules.location.LocationModule that isn't present in the module registry. Available modules: [].](https://github.com/expo/expo/issues/45231) (closed)
- [`expo-image` renders at 0×0 with `require()` source or source-level width/height](https://github.com/expo/expo/issues/45511) (open)
- [Expo Router resolves identical dynamic routes from different protected route groups inconsistently](https://github.com/expo/expo/issues/49058) (closed)
- [[expo-camera][Web] Reports onCameraReady too early](https://github.com/expo/expo/issues/50878) (closed)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
