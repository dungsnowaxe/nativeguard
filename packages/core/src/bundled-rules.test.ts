import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { analyzeProject, detectProjectProfile } from "./index.js";

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

const curatedFixtures = [
  {
    dir: "sdk54-reanimated-worklets",
    ruleId: "sdk54-reanimated-requires-worklets-0.5.1",
    excludedRuleIds: ["sdk54-legacy-arch-reanimated-v3"],
    evidenceUrls: [
      "https://github.com/expo/fyi/blob/main/expo-54-reanimated.md",
      "https://github.com/software-mansion/react-native-reanimated/issues/8432",
      "https://github.com/expo/expo/issues/39980"
    ],
    recommendations: [
      {
        action: "bump",
        packageName: "react-native-worklets",
        to: "0.5.1",
        surfaces: ["eas", "local-native"]
      }
    ]
  },
  {
    dir: "sdk53-ban-reanimated-4",
    ruleId: "sdk53-ban-reanimated-4",
    evidenceUrls: [
      "https://github.com/software-mansion/react-native-reanimated/issues/7457",
      "https://github.com/expo/expo/issues/38832"
    ],
    recommendations: [
      {
        action: "pin",
        packageName: "react-native-reanimated",
        to: "~3.17.4",
        surfaces: ["eas", "local-native"]
      }
    ]
  },
  {
    dir: "sdk54-legacy-arch-reanimated",
    ruleId: "sdk54-legacy-arch-reanimated-v3",
    excludedRuleIds: ["sdk54-reanimated-requires-worklets-0.5.1"],
    evidenceUrls: ["https://github.com/expo/fyi/blob/main/expo-54-reanimated.md"],
    recommendations: [
      {
        action: "pin",
        packageName: "react-native-reanimated",
        to: "~3.17.4",
        surfaces: ["eas", "local-native"]
      },
      {
        action: "exclude",
        packageName: "react-native-reanimated",
        surfaces: ["eas", "local-native"]
      }
    ]
  },
  {
    dir: "sdk53-pager-view",
    ruleId: "pager-view-min-6.7.1-on-rn-079",
    evidenceUrls: [
      "https://github.com/callstack/react-native-pager-view/issues/988",
      "https://github.com/expo/expo/pull/36324"
    ],
    recommendations: [
      {
        action: "bump",
        packageName: "react-native-pager-view",
        to: "6.7.1",
        surfaces: ["eas", "local-native"]
      }
    ]
  },
  {
    dir: "sentry-expo-sdk54",
    ruleId: "ban-sentry-expo-on-sdk-ge-50",
    evidenceUrls: [
      "https://expo.dev/changelog/2024-05-07-sdk-51",
      "https://github.com/expo/fyi/blob/main/sentry-expo-migration.md"
    ],
    recommendations: [
      {
        action: "exclude",
        packageName: "sentry-expo",
        surfaces: ["eas", "runtime"]
      }
    ]
  },
  {
    dir: "flash-list-v2-legacy-arch",
    ruleId: "flash-list-v2-requires-new-arch",
    evidenceUrls: [
      "https://github.com/Shopify/flash-list/issues/1752",
      "https://github.com/Shopify/flash-list"
    ],
    recommendations: [
      {
        action: "pin",
        packageName: "@shopify/flash-list",
        to: "1.x",
        surfaces: ["eas", "local-native"]
      }
    ]
  },
  {
    dir: "sdk54-screens-expo-go",
    ruleId: "sdk54-pin-screens-tilde-4.16",
    evidenceUrls: [
      "https://github.com/software-mansion/react-native-screens/issues/3470",
      "https://github.com/software-mansion/react-native-screens/issues/3496"
    ],
    recommendations: [
      {
        action: "pin",
        packageName: "react-native-screens",
        to: "~4.16.0",
        surfaces: ["eas", "runtime"]
      }
    ]
  },
  {
    dir: "sdk54-nativewind-rngh",
    ruleId: "nativewind-min-4.2.1-with-rngh-sdk54",
    evidenceUrls: [
      "https://github.com/nativewind/nativewind/issues/1570",
      "https://github.com/expo/expo/issues/39833"
    ],
    recommendations: [
      {
        action: "bump",
        packageName: "nativewind",
        to: "4.2.1",
        surfaces: ["runtime"]
      }
    ]
  }
] as const;

for (const fixture of curatedFixtures) {
  test(`fires ${fixture.ruleId} on the ${fixture.dir} fixture`, async () => {
    const report = await analyzeProject({
      rootDir: path.join(fixturesRoot, fixture.dir),
      cliVersion: "0.0.0",
      now: new Date("2026-09-09T00:00:00.000Z")
    });

    assert.equal(
      report.findings.some(finding => finding.ruleId === fixture.ruleId),
      true
    );
    const excludedRuleIds = "excludedRuleIds" in fixture ? fixture.excludedRuleIds : [];
    for (const excludedRuleId of excludedRuleIds) {
      assert.equal(
        report.findings.some(finding => finding.ruleId === excludedRuleId),
        false
      );
    }
    assert.equal(
      report.findings.some(finding => finding.ruleId === "legendapp-list-v2-react-native-api-migration"),
      false
    );

    const matched = report.recommendations.filter(recommendation => recommendation.ruleId === fixture.ruleId);
    assert.deepEqual(
      matched.map(recommendation => ({
        action: recommendation.action,
        packageName: recommendation.packageName,
        ...(recommendation.to ? { to: recommendation.to } : {}),
        surfaces: recommendation.surfaces
      })),
      fixture.recommendations
    );

    for (const recommendation of matched) {
      const urls = recommendation.evidence.flatMap(record => (record.url ? [record.url] : []));
      for (const url of fixture.evidenceUrls) {
        assert.equal(urls.includes(url), true, `missing evidence ${url}`);
      }
      assert.ok(recommendation.surfaces.length > 0);
    }
  });
}

test("detects newArchitectureEnabled from app.json expo.newArchEnabled", async () => {
  const enabledRoot = path.join(fixturesRoot, "sdk54-reanimated-worklets");
  const disabledRoot = path.join(fixturesRoot, "sdk54-legacy-arch-reanimated");

  const enabled = await detectProjectProfile(enabledRoot, {
    dependencies: { expo: "54.0.33", "react-native": "0.81.5" }
  });
  const disabled = await detectProjectProfile(disabledRoot, {
    dependencies: { expo: "54.0.33", "react-native": "0.81.5" }
  });

  assert.equal(enabled.newArchitectureEnabled, true);
  assert.equal(disabled.newArchitectureEnabled, false);
});

test("skips the worklets bump when react-native-worklets is already 0.5.1", async () => {
  const root = await tempProject({
    dependencies: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      "react-native-reanimated": "4.1.0",
      "react-native-worklets": "0.5.1"
    },
    directories: ["ios", "android"],
    appJson: { expo: { newArchEnabled: true } }
  });

  const report = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(
    report.findings.some(finding => finding.ruleId === "sdk54-reanimated-requires-worklets-0.5.1"),
    false
  );
});

test("does not fire nativewind without react-native-gesture-handler", async () => {
  const root = await tempProject({
    dependencies: {
      expo: "54.0.33",
      "react-native": "0.81.5",
      nativewind: "4.1.23"
    },
    directories: ["ios", "android"]
  });

  const report = await analyzeProject({ rootDir: root, cliVersion: "0.0.0" });
  assert.equal(
    report.findings.some(finding => finding.ruleId === "nativewind-min-4.2.1-with-rngh-sdk54"),
    false
  );
});

async function tempProject(options: {
  dependencies: Record<string, string>;
  directories?: string[];
  appJson?: Record<string, unknown>;
}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nativeguard-rule-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, dependencies: options.dependencies }, null, 2)
  );
  await writeFile(
    path.join(root, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: options.dependencies },
        ...Object.fromEntries(
          Object.entries(options.dependencies).map(([packageName, version]) => [
            `node_modules/${packageName}`,
            { version }
          ])
        )
      }
    })
  );
  for (const directory of options.directories ?? []) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  if (options.appJson) {
    await writeFile(path.join(root, "app.json"), JSON.stringify(options.appJson, null, 2));
  }
  return root;
}
