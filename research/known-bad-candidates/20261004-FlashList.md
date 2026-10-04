# Known-bad candidate: @shopify/flash-list

> Draft only. Miner v1 does **not** auto-merge into `@nativeguard/rules`.
> Vulnerable and fixed stay TODO unless one issue literally states both ranges. Copied ranges are unconfirmed.

| Field | Value |
| --- | --- |
| package | `@shopify/flash-list` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \| pin \| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| search scope | `Shopify/flash-list`, `expo/expo` |
| mined | 2026-10-04T07:46:32.580Z |

## Evidence URLs

- https://github.com/expo/expo/pull/50824
- https://github.com/Shopify/flash-list/issues/1961
- https://github.com/Shopify/flash-list/issues/2419
- https://github.com/expo/expo/issues/45301
- https://github.com/expo/expo/issues/47523
- https://github.com/Shopify/flash-list/issues/1872

## Search hits

- [[expo] Bump `@shopify/flash-list` to `2.3.2` and `@shopify/react-native-skia` to `2.13.1`](https://github.com/expo/expo/pull/50824) (closed)
- [[RN 0.81][Testing] Only first 10 items are rendered in snapshots](https://github.com/Shopify/flash-list/issues/1961) (closed)
- [stickyHeaderConfig.offset also pushes list content down, not just the sticky pin position](https://github.com/Shopify/flash-list/issues/2419) (open)
- [expo-image causes visible frame drops / low fps when used inside @shopify/flash-list during vertical scroll](https://github.com/expo/expo/issues/45301) (closed)
- [[bunx expo install --fix] will downgrade @shopify/flash-list to 2.0.2 - expected version is deprected! SDK 56-57](https://github.com/expo/expo/issues/47523) (closed)
- [Flashlist:v2.0.3: Type chat render from bottom not working.](https://github.com/Shopify/flash-list/issues/1872) (closed)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
