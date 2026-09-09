import test from "node:test";
import assert from "node:assert/strict";
import { loadBundledRules, optionalRules, validateBundledRules } from "./index.js";

test("loads seed rules", () => {
  const rules = loadBundledRules();
  assert.ok(rules.length >= 1);
  assert.equal(rules[0]?.id, "expo-sdk-54-react-native-svg-off-matrix");
  assert.ok(rules[0]?.remediation.some(action => action.type === "leave"));
  assert.equal(
    rules.some(rule => rule.id === "legendapp-list-v2-react-native-api-migration"),
    false
  );
  assert.equal(
    rules.some(rule => rule.id === "expo-prebuild-new-architecture-manual-check"),
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
