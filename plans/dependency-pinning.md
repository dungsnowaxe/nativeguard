# Dependency pinning

Some dependencies are pinned, upgraded, or patched on purpose. Do not change their versions with `expo install --fix`, `npx expo install <pkg>`, or casual `pnpm update` without reading this file first.

Patches live in `patches/` and are registered in `pnpm-workspace.yaml` → `patchedDependencies`. Every patch should have a matching entry below.

Native dependency changes require a **dev client rebuild** (`pnpm ios` / `pnpm android`). JS-only workarounds need only a Metro reload.

## When to add an entry

Add or update a row when you:

- Pin a version that differs from what Expo SDK / `expo install --fix` would choose
- Upgrade a library to fix a bug (document the broken version)
- Add or change a `pnpm patch`
- Add a `pnpm-workspace.yaml` override that exists for a behavioral reason
- Add or change a Metro resolver alias / bundler workaround in `metro.config.js`

Agents: load the `dependency-pinning` skill (`.agents/skills/dependency-pinning/SKILL.md`) when changing versions or patches; append an entry in the same PR.

## Entry template

```markdown
### `package-name` @ `x.y.z`

- **Constraint:** pin | minimum | patch (`patches/...`)
- **Symptom:** what breaks if reverted
- **Why:** one or two sentences
- **Issue:** https://github.com/org/repo/issues/N (omit if none)
- **Rebuild:** yes (native) | no (JS only)
- **Affected:** screens / features (optional)
```

---

## Pinned versions

### `react-native-pager-view` @ `7.0.2`

- **Constraint:** minimum `7.0.2` (pinned in `package.json`; do not downgrade to `6.x`)
- **Symptom:** With `swipeEnabled={false}` on `react-native-tab-view`, the first tab is still swipeable once on mount; swipe locks only after that first gesture.
- **Why:** `react-native-tab-view` forwards `swipeEnabled` to pager-view as `scrollEnabled`. Versions before `7.0.2` apply `scrollEnabled={false}` too late during native pager initialization.
- **Issue:** [callstack/react-native-pager-view#1028](https://github.com/callstack/react-native-pager-view/issues/1028) (fixed in [v7.0.2](https://github.com/callstack/react-native-pager-view/releases/tag/v7.0.2))
- **Rebuild:** yes (native module)
- **Affected:** `HomeTabView`, `CustomTabView`, and any screen using `react-native-tab-view` with `swipeEnabled={false}`

---

## Patches

Document each `patchedDependencies` entry here when the reason is known. Existing patches (add rationale when discovered):

| Package                                     | Patch file                                                 |
| ------------------------------------------- | ---------------------------------------------------------- |
| `expo-modules-autolinking@3.0.24`           | `patches/expo-modules-autolinking@3.0.24.patch`            |
| `expo@54.0.33`                              | `patches/expo@54.0.33.patch`                               |
| `mixpanel-react-native@3.3.0`               | `patches/mixpanel-react-native@3.3.0.patch`                |
| `react-native-reanimated@4.2.3`             | `patches/react-native-reanimated@4.2.3.patch`              |
| `react-native@0.81.5`                       | `patches/react-native@0.81.5.patch`                        |
| `uniwind@1.9.0`                             | `patches/uniwind@1.9.0.patch`                              |
| `@reown/appkit-scaffold-react-native@1.3.0` | `patches/@reown__appkit-scaffold-react-native@1.3.0.patch` |

### `expo-modules-autolinking` @ `3.0.24`

- **Constraint:** patch (`patches/expo-modules-autolinking@3.0.24.patch`)
- **Symptom:** Android builds can fail in Google Prefab when pnpm-patched native packages resolve through `.pnpm` virtual-store paths containing `=`, for example patched `react-native` or `react-native-reanimated` paths.
- **Why:** Prefab does not escape `=` correctly in those real paths. The patch backports Expo's autolinking workaround to use the symlink `originPath` for Android when the resolved path contains both `.pnpm` and `=`.
- **Issue:** https://github.com/expo/expo/pull/44109
- **Rebuild:** yes (Android native build/autolinking)
- **Affected:** Android builds using pnpm patched native dependencies

### `react-native` @ `0.81.5`

- **Constraint:** patch (`patches/react-native@0.81.5.patch`)
- **Symptom:** iOS Hermes can crash with heap corruption / `EXC_BAD_ACCESS` in `hermes::vm::*` frames when an async void TurboModule method throws an `NSException`.
- **Why:** React Native converted that Objective-C exception to a JS error from the native method call invoker thread, touching the non-thread-safe JSI runtime. The patch backports the upstream fix to rethrow the exception instead.
- **Issue:** https://github.com/facebook/react-native/pull/56265
- **Rebuild:** yes (native code patch)
- **Affected:** iOS builds using Hermes and TurboModules

### `react-native-reanimated` @ `4.2.3`

- **Constraint:** patch (`patches/react-native-reanimated@4.2.3.patch`)
- **Symptom:** Animated style updates can crash with `TypeError: Cannot convert undefined value to object` when an array-style animation update contains a non-object/nullish entry.
- **Why:** Reanimated `4.2.3` includes the `last[propName]` initialization used by the #5672 workaround, but it still iterates and copies from every array entry. The patch keeps the defensive `obj && typeof obj === "object"` guard so `useAnimatedStyle` only merges object entries.
- **Issue:** https://github.com/software-mansion/react-native-reanimated/issues/5672
- **Rebuild:** no (JS-only patch)

### `uniwind` @ `1.9.0`

- **Constraint:** patch (`patches/uniwind@1.9.0.patch`)
- **Symptom:** Uniwind `Text` / `TextInput` respect system font scaling when accessibility text size is increased, breaking the app-wide no-scaling policy.
- **Why:** Defaults `allowFontScaling={false}` and `maxFontSizeMultiplier={1}` on Uniwind native text primitives unless explicitly overridden.
- **Rebuild:** no (JS-only patch)
- **Affected:** All Uniwind-styled text and form inputs

### `@sentry/react-native` @ `7.13.0`

- **Constraint:** pin above Expo bundle (`~7.2.0`); `package.json` → `expo.install.exclude: ["@sentry/react-native"]`
- **Symptom:** Missing Firebase+Android fixes, duplicate iOS new-arch crash reports, EAS dSYM/symbolication regressions on SDK 54 if downgraded to bundled 7.2.
- **Why:** 7.13.x backports SDK-54-compatible fixes without Sentry 8 / Cocoa 9 migration.
- **Rebuild:** yes (native module)
- **Affected:** Crash reporting, EAS source maps / dSYMs

### `react-native-screens` @ `4.19.0`

- **Constraint:** pin at `4.19.x` on Expo SDK 54 — do not upgrade to `4.20+`
- **Symptom:** expo-router native tab icons may fail to render; newer screens requires RN ≥0.82.
- **Why:** SDK 54 / RN 0.81.5 ceiling; [expo#41049](https://github.com/expo/expo/issues/41049).
- **Rebuild:** yes (native module)
- **Affected:** Tab navigation, stack push/pop, bottom sheets

### `@legendapp/list` @ `3.0.6`

- **Constraint:** pin at `3.0.6` (major upgrade from v2)
- **Symptom:** v2 import path `@legendapp/list` removed; `getEstimatedItemSize` / `stickyIndices` / `initialContainerPoolRatio` APIs removed.
- **Why:** v3 MVCP default aligns with existing `maintainVisibleContentPosition={false}` on filter/tab/socket lists; import via `@legendapp/list/react-native`, use `getFixedItemSize(item, index, type)`.
- **Rebuild:** no if JS-only; rebuild if native transitive deps change
- **Affected:** find-gems, search tables, markets, top-mc, notifications lists

---

## Metro resolver workarounds

Bundler aliases and resolver hooks live in `metro.config.js`. They are not version pins — do not try to replace them by changing `pnpm-workspace.yaml` overrides unless the entry below says otherwise.

### `tslib` — Metro alias to `tslib.es6.js`

- **Constraint:** resolver alias in `metro.config.js` (`resolveRequest` → `node_modules/tslib/tslib.es6.js`)
- **Symptom:** `TypeError: Cannot read property '__extends' of undefined` (Hermes) when loading native ECharts (`@wuba/react-native-echarts`, `echarts`, `zrender`). Insights route may also warn that the screen is missing a default export (cascade from the failed import).
- **Why:** Expo 54 Metro enables package exports (`unstable_enablePackageExports: true`). `tslib`'s `import` condition resolves to `modules/index.js`, which default-imports `tslib.js` — that default is `undefined` under Metro/Hermes, so named imports like `__extends` fail. Aliasing to `tslib.es6.js` provides proper ESM named exports.
- **Not the fix:** The `pnpm-workspace.yaml` override `tslib: ^2.6.1` hoists the root copy to 2.8.x for other packages. `echarts` / `zrender` still bundle their own nested `tslib@2.3.0`, which has the same broken export path. Removing or changing the override will not fix this crash.
- **Rebuild:** no (JS only; restart Metro with `--clear`)
- **Affected:** `EChartsSkiaChart`, Insights native token performance, any screen importing `echarts` / `zrender` through Metro
