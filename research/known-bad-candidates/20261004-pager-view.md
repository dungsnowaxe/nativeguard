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
| mined | 2026-10-04T07:46:03.504Z |

## Evidence URLs

- https://github.com/callstack/react-native-pager-view/issues/1098
- https://github.com/callstack/react-native-pager-view/issues/1009
- https://github.com/callstack/react-native-pager-view/issues/1050
- https://github.com/callstack/react-native-pager-view/issues/1099
- https://github.com/callstack/react-native-pager-view/issues/882

## Search hits

- [[iOS] Nested PagerView crashes with UIViewControllerHierarchyInconsistency (8.0.4)](https://github.com/callstack/react-native-pager-view/issues/1098) (closed)
- [6.8.1 property scrollEnabled allows for swiping on iOS](https://github.com/callstack/react-native-pager-view/issues/1009) (closed)
- [[iOS] `react-native-screens` v4.19.0 breaks the global back swipe gesture on pager views](https://github.com/callstack/react-native-pager-view/issues/1050) (open)
- [[iOS] pager content getting cropped on version 8.0.4](https://github.com/callstack/react-native-pager-view/issues/1099) (open)
- [app crashing in react native version 0.75.4  with new architecture](https://github.com/callstack/react-native-pager-view/issues/882) (closed)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
