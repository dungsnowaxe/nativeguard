import test from "node:test";
import assert from "node:assert/strict";
import { parseYamlSubset } from "./yaml.js";

test("parses nested maps, quoted keys, and scalar arrays", () => {
  const parsed = parseYamlSubset(`
lockfileVersion: '9.0'
importers:
  apps/mobile:
    dependencies:
      expo:
        specifier: "catalog:"
        version: 53.0.20
packages:
  - "apps/*"
catalog:
  expo: 53.0.20
`);

  assert.deepEqual(parsed, {
    lockfileVersion: "9.0",
    importers: {
      "apps/mobile": {
        dependencies: {
          expo: {
            specifier: "catalog:",
            version: "53.0.20"
          }
        }
      }
    },
    packages: ["apps/*"],
    catalog: {
      expo: "53.0.20"
    }
  });
});
