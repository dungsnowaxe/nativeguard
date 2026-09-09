import {
  type CompatibilityRule,
  RULE_SCHEMA_VERSION,
  validateCompatibilityRule
} from "@nativeguard/schema";

export const RULES_PACKAGE = {
  name: "@nativeguard/rules",
  version: "0.0.0"
} as const;

export const bundledRules: CompatibilityRule[] = [
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "expo-sdk-54-react-native-svg-off-matrix",
    packageName: "react-native-svg",
    affectedRange: "15.8.0 - 15.10.x",
    context: {
      projectKinds: ["expo-prebuild"],
      expoSdk: ["54"],
      reactNative: ["0.81.x"],
      packageManagers: ["npm"],
      newArchitecture: true
    },
    outcome: "accepted-exception",
    confidence: "medium",
    summary:
      "Expo SDK 54 projects may intentionally use an off-matrix react-native-svg version when it fixes Android rendering regressions.",
    issue: {
      reason: "Expo's default version matrix may rewrite an intentionally selected off-matrix version.",
      fixedVersion: "15.11.2"
    },
    evidence: [
      {
        type: "manual",
        summary:
          "Seed NativeGuard rule based on the product roadmap example for Expo SDK 54 and react-native-svg.",
        confidence: "medium"
      }
    ],
    remediation: [
      {
        type: "leave",
        packageName: "react-native-svg",
        note: "Leave the intentional off-matrix version in place when it is required for Android rendering fixes."
      },
      {
        type: "exclude",
        packageName: "react-native-svg",
        note: "Record the exception and add expo.install.exclude when Expo install would otherwise rewrite the version."
      },
      {
        type: "manual-check",
        packageName: "react-native-svg",
        note: "Verify Android release builds when using the off-matrix version."
      }
    ]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "expo-sdk-54-react-native-pager-view-scroll-lock",
    packageName: "react-native-pager-view",
    affectedRange: "<7.0.2",
    context: {
      projectKinds: ["expo-prebuild"],
      expoSdk: ["54"],
      reactNative: ["0.81.x"],
      packageManagers: ["npm"],
      newArchitecture: true
    },
    outcome: "risky",
    confidence: "high",
    summary: "react-native-pager-view before 7.0.2 can ignore disabled swiping once on mount.",
    issue: {
      reason:
        "swipeEnabled={false} can still allow the first tab swipe because older native pager initialization applies scrollEnabled={false} too late.",
      fixedVersion: "7.0.2"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/callstack/react-native-pager-view/issues/1028",
        summary:
          "Older pager-view releases can apply scrollEnabled={false} too late during native pager initialization.",
        confidence: "high"
      },
      {
        type: "release_note",
        url: "https://github.com/callstack/react-native-pager-view/releases/tag/v7.0.2",
        summary: "The pinning plan records 7.0.2 as the first fixed version for this scroll-lock issue.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "bump",
        packageName: "react-native-pager-view",
        to: "7.0.2",
        note: "Use at least 7.0.2 when tab views rely on swipeEnabled={false}."
      }
    ]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "expo-sdk-54-sentry-react-native-bundled-7-2",
    packageName: "@sentry/react-native",
    affectedRange: "~7.2.0",
    context: {
      projectKinds: ["expo-prebuild"],
      expoSdk: ["54"],
      reactNative: ["0.81.x"],
      packageManagers: ["npm"],
      newArchitecture: true
    },
    outcome: "risky",
    confidence: "medium",
    summary: "Expo SDK 54 bundled @sentry/react-native 7.2.x misses later SDK-54-compatible fixes.",
    issue: {
      reason:
        "The Expo-bundled 7.2.x line misses Firebase Android fixes, duplicate iOS new-architecture crash-report fixes, and EAS symbolication fixes recorded in the pinning plan.",
      fixedVersion: "7.13.x"
    },
    evidence: [
      {
        type: "manual",
        summary:
          "The dependency pinning plan records Firebase Android fixes, duplicate iOS new-architecture crash reports, and EAS symbolication regressions when downgraded to bundled 7.2.x.",
        confidence: "medium"
      }
    ],
    remediation: [
      {
        type: "pin",
        packageName: "@sentry/react-native",
        to: "7.13.x",
        note: "Pin above Expo's bundled 7.2.x version and exclude it from Expo install rewrites."
      },
      {
        type: "exclude",
        packageName: "@sentry/react-native",
        note: "Add @sentry/react-native to expo.install.exclude when intentionally staying above the Expo bundle."
      }
    ]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "expo-sdk-54-react-native-screens-rn-082-floor",
    packageName: "react-native-screens",
    affectedRange: ">=4.20.0",
    context: {
      projectKinds: ["expo-prebuild"],
      expoSdk: ["54"],
      reactNative: ["0.81.x"],
      packageManagers: ["npm"],
      newArchitecture: true
    },
    outcome: "risky",
    confidence: "medium",
    summary: "react-native-screens 4.20+ is above the Expo SDK 54 / React Native 0.81 ceiling.",
    issue: {
      reason:
        "react-native-screens 4.20+ requires a newer React Native line than Expo SDK 54's React Native 0.81.5 ceiling.",
      fixedVersion: "4.19.x"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/expo/expo/issues/41049",
        summary:
          "The dependency pinning plan records SDK 54 native tab icon issues and an RN >=0.82 floor for newer screens releases.",
        confidence: "medium"
      }
    ],
    remediation: [
      {
        type: "pin",
        packageName: "react-native-screens",
        to: "4.19.x",
        note: "Stay on 4.19.x while the app is on Expo SDK 54 / React Native 0.81."
      }
    ]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "legendapp-list-v2-react-native-api-migration",
    packageName: "@legendapp/list",
    affectedRange: "2.x",
    context: {
      projectKinds: ["expo-prebuild"],
      packageManagers: ["npm"]
    },
    outcome: "risky",
    confidence: "medium",
    summary: "@legendapp/list v2 uses APIs/imports that the pinning plan migrated away from.",
    issue: {
      reason:
        "@legendapp/list v2 uses the old import path and removed list APIs that the app migrated away from.",
      fixedVersion: "3.0.6"
    },
    evidence: [
      {
        type: "manual",
        summary:
          "The dependency pinning plan records a major migration to 3.0.6 with React Native imports moved to @legendapp/list/react-native and removed v2 sizing/sticky APIs.",
        confidence: "medium"
      }
    ],
    remediation: [
      {
        type: "bump",
        packageName: "@legendapp/list",
        to: "3.0.6",
        note: "Use the v3 React Native import path and replace removed v2 list APIs."
      }
    ]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "expo-prebuild-new-architecture-manual-check",
    packageName: "react-native",
    affectedRange: "*",
    context: {
      projectKinds: ["expo-prebuild"],
      packageManagers: ["npm"],
      newArchitecture: true
    },
    outcome: "stable",
    confidence: "low",
    summary:
      "Expo prebuild projects with native folders should include New Architecture compatibility in dependency review.",
    evidence: [
      {
        type: "manual",
        summary: "Seed rule used to ensure Expo prebuild projects surface native compatibility context.",
        confidence: "low"
      }
    ],
    remediation: [
      {
        type: "manual-check",
        note: "Review native modules for New Architecture compatibility before accepting dependency upgrades."
      }
    ]
  }
];

export function loadBundledRules(): CompatibilityRule[] {
  return bundledRules;
}

export function validateBundledRules(): string[] {
  const errors: string[] = [];
  for (const rule of bundledRules) {
    const result = validateCompatibilityRule(rule);
    if (!result.valid) {
      errors.push(`${rule.id}: ${result.errors.join(", ")}`);
    }
  }
  return errors;
}
