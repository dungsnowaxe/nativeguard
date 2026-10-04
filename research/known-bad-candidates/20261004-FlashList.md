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
| mined | 2026-10-04T07:40:03.580Z |

## Evidence URLs

- https://github.com/expo/expo/issues/38333
- https://github.com/expo/expo/issues/39770
- https://github.com/expo/expo/issues/40677
- https://github.com/expo/expo/issues/46530
- https://github.com/expo/expo/pull/50781
- https://github.com/expo/expo/pull/50824
- https://github.com/Shopify/flash-list/issues/1938
- https://github.com/Shopify/flash-list/issues/1961
- https://github.com/Shopify/flash-list/issues/1975
- https://github.com/Shopify/flash-list/issues/2026
- https://github.com/Shopify/flash-list/issues/2050
- https://github.com/Shopify/flash-list/issues/2307
- https://github.com/Shopify/flash-list/issues/2334
- https://github.com/Shopify/flash-list/issues/2419
- https://github.com/Shopify/flash-list/issues/2427
- https://github.com/Shopify/flash-list/issues/2440
- https://github.com/Shopify/flash-list/issues/2462
- https://github.com/Shopify/flash-list/issues/2517
- https://github.com/Shopify/flash-list/issues/2519
- https://github.com/Shopify/flash-list/pull/2269
- https://github.com/Shopify/flash-list/pull/2520
- https://github.com/expo/expo/issues/36301
- https://github.com/expo/expo/issues/37480
- https://github.com/expo/expo/issues/39427
- https://github.com/expo/expo/issues/39597
- https://github.com/expo/expo/issues/39820
- https://github.com/expo/expo/issues/39821
- https://github.com/expo/expo/issues/41316
- https://github.com/expo/expo/issues/43343
- https://github.com/expo/expo/issues/44364
- https://github.com/expo/expo/issues/44525
- https://github.com/expo/expo/issues/45301
- https://github.com/expo/expo/issues/47523
- https://github.com/Shopify/flash-list/issues/1282
- https://github.com/Shopify/flash-list/issues/1351
- https://github.com/Shopify/flash-list/issues/1661
- https://github.com/Shopify/flash-list/issues/1868
- https://github.com/Shopify/flash-list/issues/1959
- https://github.com/Shopify/flash-list/issues/2509
- https://github.com/Shopify/flash-list/issues/869
- https://github.com/Shopify/flash-list/issues/896

## Search hits

- [Android warn :setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture](https://github.com/expo/expo/issues/38333) (closed)
- [[Expo/config-plugins]: [ios.dangerous] withIosDangerousBaseMod: Could not locate a valid AppDelegate at root](https://github.com/expo/expo/issues/39770) (closed)
- [[expo-dev-launcher] Error loading app timeout - android only](https://github.com/expo/expo/issues/40677) (closed)
- [[SDK 56][babel-preset-expo] Destructured params in arrow functions make Babel crash](https://github.com/expo/expo/issues/46530) (closed)
- [Version packages (main)](https://github.com/expo/expo/pull/50781) (closed)
- [[expo] Bump `@shopify/flash-list` to `2.3.2` and `@shopify/react-native-skia` to `2.13.1`](https://github.com/expo/expo/pull/50824) (closed)
- [scrollToIndex offset is not calculated correctly on Expo v54 (v2)](https://github.com/Shopify/flash-list/issues/1938) (open)
- [[RN 0.81][Testing] Only first 10 items are rendered in snapshots](https://github.com/Shopify/flash-list/issues/1961) (closed)
- [ItemSeparatorComponent is rendered on second to last item when numColumns={2}](https://github.com/Shopify/flash-list/issues/1975) (closed)
- [Flashlist 2.x, maintainVisibleContentPosition with translate-with-padding will scroll twice when keyboard showing](https://github.com/Shopify/flash-list/issues/2026) (open)
- [FlashList 2.x: maintainVisibleContentPosition bug when initial data does not fills the screen](https://github.com/Shopify/flash-list/issues/2050) (open)
- [Flashlist v2 initialScrollIndex renders wrong items when item size exceeds 200](https://github.com/Shopify/flash-list/issues/2307) (open)
- [[WEB] Scrollbar oscillation cause infinite layout loop](https://github.com/Shopify/flash-list/issues/2334) (open)
- [stickyHeaderConfig.offset also pushes list content down, not just the sticky pin position](https://github.com/Shopify/flash-list/issues/2419) (open)
- [Android: horizontal snapToInterval carousel over-snaps to index 0 on backward swipe (maintainVisibleContentPosition re-flings unbounded mid-snap)](https://github.com/Shopify/flash-list/issues/2427) (open)
- [ViewHolderCollection render throws "index out of bounds, not enough layouts" when the render stack outlives a layout-table shrink](https://github.com/Shopify/flash-list/issues/2440) (open)
- [maxItemsInRecyclePool=0 does not disable recycling](https://github.com/Shopify/flash-list/issues/2462) (open)
- [Visible rows go blank while scrolling when scroll events reach JS in bursts (Android, inside a bottom sheet)](https://github.com/Shopify/flash-list/issues/2517) (open)
- [Grid: next row overlaps taller items after data changes (stale minHeight picks the wrong tallest item)](https://github.com/Shopify/flash-list/issues/2519) (open)
- [fix(layout): skip layout updates when container size is 0x0](https://github.com/Shopify/flash-list/pull/2269) (open)
- [fix(layout): place the next grid row below the tallest item](https://github.com/Shopify/flash-list/pull/2520) (open)
- [[Video] Directly mutating player properties triggers react compiler warnings](https://github.com/expo/expo/issues/36301) (open)
- [[docs][expo-localization] The example configuration in the guide is not working](https://github.com/expo/expo/issues/37480) (closed)
- [[expo-video] Unable to find the native shared object associated with given JavaScript object](https://github.com/expo/expo/issues/39427) (closed)
- [[SDK 54] Crash on opening iOS app after building with `eas build --local`](https://github.com/expo/expo/issues/39597) (closed)
- [[SDK 54] building release for android on cliFile](https://github.com/expo/expo/issues/39820) (closed)
- [[SDK 54] building release for android on cliFile](https://github.com/expo/expo/issues/39821) (closed)
- [[android] Rare crash with "Exception java.lang.IllegalStateException: Already resumed"](https://github.com/expo/expo/issues/41316) (closed)
- [[expo-calendar]: Crash parsing Int instead of Long causes NumberFormatException](https://github.com/expo/expo/issues/43343) (closed)
- [[expo-updates] OutOfMemoryError in FetchUpdateProcedure during emergency launch on 32-bit Android](https://github.com/expo/expo/issues/44364) (closed)
- [java.util.concurrent.CancellationException: Task was cancelled.](https://github.com/expo/expo/issues/44525) (closed)
- [expo-image causes visible frame drops / low fps when used inside @shopify/flash-list during vertical scroll](https://github.com/expo/expo/issues/45301) (closed)
- [[bunx expo install --fix] will downgrade @shopify/flash-list to 2.0.2 - expected version is deprected! SDK 56-57](https://github.com/expo/expo/issues/47523) (closed)
- [Flashlist is much slower when scrolling after upgrade to newest RN and activate newArchitect](https://github.com/Shopify/flash-list/issues/1282) (closed)
- [Incorrect scroll direction on web with `inverted` prop](https://github.com/Shopify/flash-list/issues/1351) (closed)
- [Error installing FlashList](https://github.com/Shopify/flash-list/issues/1661) (open)
- [v2: Height of last item is not matching others in the same row when `numColumns` > 1](https://github.com/Shopify/flash-list/issues/1868) (closed)
- [Duplicate sticky header appears when scrolling or collapsing section](https://github.com/Shopify/flash-list/issues/1959) (closed)
- [StickyHeaders.compute() throws "index out of bounds, not enough layouts" — its guard checks getDataLength() but the binary search indexes the layout array](https://github.com/Shopify/flash-list/issues/2509) (open)
- [Layout issue in horizontal lists with incorrect estimatedListSize](https://github.com/Shopify/flash-list/issues/869) (closed)
- [Tslib issue after upgrading react-native](https://github.com/Shopify/flash-list/issues/896) (closed)

## Range statements

_No issue text literally stated both a bad range and a fixed range._

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
