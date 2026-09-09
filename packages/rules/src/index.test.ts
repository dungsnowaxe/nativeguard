import test from "node:test";
import assert from "node:assert/strict";
import { loadBundledRules, optionalRules, validateBundledRules } from "./index.js";

test("loads the curated default pack", () => {
  const rules = loadBundledRules();
  assert.deepEqual(
    rules.map(rule => rule.id),
    [
      "sdk54-reanimated-requires-worklets-0.5.1",
      "sdk53-ban-reanimated-4",
      "sdk54-legacy-arch-reanimated-v3",
      "pager-view-min-6.7.1-on-rn-079",
      "ban-sentry-expo-on-sdk-ge-50",
      "flash-list-v2-requires-new-arch",
      "sdk54-pin-screens-tilde-4.16",
      "nativewind-min-4.2.1-with-rngh-sdk54"
    ]
  );
  assert.ok(rules[0]?.remediation.some(action => action.type === "bump"));
  assert.equal(
    rules.some(rule => rule.id === "legendapp-list-v2-react-native-api-migration"),
    false
  );
  assert.equal(
    rules.some(rule => rule.id === "expo-prebuild-new-architecture-manual-check"),
    false
  );
  assert.equal(
    rules.some(rule => rule.id === "expo-sdk-54-react-native-svg-off-matrix"),
    false
  );
});

test("keeps the New Architecture rule optional and out of the default pack", () => {
  assert.equal(
    optionalRules.some(rule => rule.id === "expo-prebuild-new-architecture-manual-check"),
    true
  );
  assert.equal(optionalRules[0]?.confidence, "low");
});

test("validates bundled rules", () => {
  assert.deepEqual(validateBundledRules(), []);
});
