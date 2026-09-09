import test from "node:test";
import assert from "node:assert/strict";
import { loadBundledRules, validateBundledRules } from "./index.js";

test("loads seed rules", () => {
  const rules = loadBundledRules();
  assert.ok(rules.length >= 1);
  assert.equal(rules[0]?.id, "expo-sdk-54-react-native-svg-off-matrix");
  assert.ok(rules[0]?.remediation.some(action => action.type === "leave"));
});

test("validates bundled rules", () => {
  assert.deepEqual(validateBundledRules(), []);
});
