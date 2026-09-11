import {
  type CompatibilityRule,
  RULE_SCHEMA_VERSION,
  validateCompatibilityRule
} from "@nativeguard/schema";

export const RULES_PACKAGE = {
  name: "@nativeguard/rules",
  version: "0.0.0"
} as const;

const NATIVE_SURFACES = ["eas", "local-native"] as const;
const MANAGED_SURFACES = ["eas", "runtime"] as const;
const EXPO_KINDS = ["expo-prebuild", "expo-go"] as const;

export const bundledRules: CompatibilityRule[] = [
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "sdk54-reanimated-requires-worklets-0.5.1",
    packageName: "react-native-reanimated",
    affectedRange: ">=4",
    context: {
      projectKinds: [...EXPO_KINDS],
      expoSdk: ["54"],
      packageManagers: ["npm"],
      newArchitecture: true
    },
    unless: {
      packageName: "react-native-worklets",
      range: "0.5.1"
    },
    outcome: "risky",
    confidence: "high",
    summary: "Expo SDK 54 with Reanimated 4 requires react-native-worklets 0.5.1.",
    issue: {
      reason:
        "Reanimated 4 on SDK 54 needs the dedicated worklets package at 0.5.1; other worklets versions fail to compile or runtime-load.",
      fixedVersion: "0.5.1"
    },
    evidence: [
      {
        type: "docs",
        url: "https://github.com/expo/fyi/blob/main/expo-54-reanimated.md",
        summary: "Expo FYI for SDK 54 Reanimated 4 requires react-native-worklets 0.5.1.",
        confidence: "high"
      },
      {
        type: "github_issue",
        url: "https://github.com/software-mansion/react-native-reanimated/issues/8432",
        summary: "Reanimated 4 worklets pairing failures reported against mismatched worklets versions.",
        confidence: "high"
      },
      {
        type: "github_issue",
        url: "https://github.com/expo/expo/issues/39980",
        summary: "Expo SDK 54 issue tracking Reanimated 4 / worklets 0.5.1 as the supported pair.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "bump",
        packageName: "react-native-worklets",
        to: "0.5.1",
        note: "Install react-native-worklets 0.5.1 alongside Reanimated 4 on SDK 54."
      }
    ],
    surfaces: [...NATIVE_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "sdk53-ban-reanimated-4",
    packageName: "react-native-reanimated",
    affectedRange: ">=4",
    context: {
      projectKinds: [...EXPO_KINDS],
      expoSdk: ["53"],
      packageManagers: ["npm"]
    },
    outcome: "risky",
    confidence: "high",
    summary: "Expo SDK 53 does not support Reanimated 4; stay on the 3.17.x line.",
    issue: {
      reason: "Reanimated 4 requires a newer Expo/RN pairing than SDK 53 provides.",
      fixedVersion: "~3.17.4"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/software-mansion/react-native-reanimated/issues/7457",
        summary: "Reanimated 4 is not supported on the SDK 53 / RN 0.79 line.",
        confidence: "high"
      },
      {
        type: "github_issue",
        url: "https://github.com/expo/expo/issues/38832",
        summary: "Expo SDK 53 tracking Reanimated 4 as an unsupported upgrade.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "pin",
        packageName: "react-native-reanimated",
        to: "~3.17.4",
        note: "Pin react-native-reanimated to ~3.17.4 on SDK 53 and reject 4.x."
      }
    ],
    surfaces: [...NATIVE_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "sdk54-legacy-arch-reanimated-v3",
    packageName: "react-native-reanimated",
    affectedRange: ">=4",
    context: {
      projectKinds: [...EXPO_KINDS],
      expoSdk: ["54"],
      packageManagers: ["npm"],
      newArchitecture: false
    },
    outcome: "risky",
    confidence: "high",
    summary: "SDK 54 with New Architecture disabled should stay on Reanimated v3, not 4.x.",
    issue: {
      reason: "Reanimated 4 targets New Architecture; legacy-arch SDK 54 apps should remain on v3.",
      fixedVersion: "~3.17.4"
    },
    evidence: [
      {
        type: "docs",
        url: "https://github.com/expo/fyi/blob/main/expo-54-reanimated.md",
        summary: "Expo FYI: Reanimated 4 is for New Architecture; legacy arch should keep v3 and exclude 4.x from expo install.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "pin",
        packageName: "react-native-reanimated",
        to: "~3.17.4",
        note: "Pin react-native-reanimated to v3 while newArchEnabled is false on SDK 54."
      },
      {
        type: "exclude",
        packageName: "react-native-reanimated",
        note: "Add react-native-reanimated to expo.install.exclude so Expo install does not pull 4.x onto a legacy-arch app."
      }
    ],
    surfaces: [...NATIVE_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "pager-view-min-6.7.1-on-rn-079",
    packageName: "react-native-pager-view",
    affectedRange: "<6.7.1",
    context: {
      projectKinds: [...EXPO_KINDS],
      expoSdk: ["53"],
      reactNative: ["0.79.x"],
      packageManagers: ["npm"]
    },
    outcome: "risky",
    confidence: "high",
    summary: "react-native-pager-view on RN 0.79 / SDK 53 must be at least 6.7.1.",
    issue: {
      reason: "Older pager-view releases crash or fail to build against React Native 0.79.",
      fixedVersion: "6.7.1"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/callstack/react-native-pager-view/issues/988",
        summary: "pager-view versions before 6.7.1 break on RN 0.79.",
        confidence: "high"
      },
      {
        type: "github_issue",
        url: "https://github.com/expo/expo/pull/36324",
        summary: "Expo bumped the SDK 53 pager-view floor to 6.7.1.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "bump",
        packageName: "react-native-pager-view",
        to: "6.7.1",
        note: "Bump react-native-pager-view to 6.7.1 or later on RN 0.79 / SDK 53."
      }
    ],
    surfaces: [...NATIVE_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "ban-sentry-expo-on-sdk-ge-50",
    packageName: "sentry-expo",
    affectedRange: "*",
    context: {
      projectKinds: [...EXPO_KINDS],
      expoSdk: [">=50"],
      packageManagers: ["npm"]
    },
    outcome: "risky",
    confidence: "high",
    summary: "sentry-expo is retired from SDK 50+; migrate to @sentry/react-native.",
    issue: {
      reason: "sentry-expo is no longer the supported Sentry entry point starting with Expo SDK 50.",
      fixedVersion: "@sentry/react-native"
    },
    evidence: [
      {
        type: "docs",
        url: "https://expo.dev/changelog/2024-05-07-sdk-51",
        summary: "Expo changelog: sentry-expo is dropped; use @sentry/react-native.",
        confidence: "high"
      },
      {
        type: "docs",
        url: "https://github.com/expo/fyi/blob/main/sentry-expo-migration.md",
        summary: "Expo FYI migration guide from sentry-expo to @sentry/react-native.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "exclude",
        packageName: "sentry-expo",
        note: "Remove sentry-expo and migrate to @sentry/react-native on SDK 50+."
      }
    ],
    surfaces: [...MANAGED_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "flash-list-v2-requires-new-arch",
    packageName: "@shopify/flash-list",
    affectedRange: ">=2",
    context: {
      projectKinds: [...EXPO_KINDS],
      packageManagers: ["npm"],
      newArchitecture: false
    },
    outcome: "risky",
    confidence: "high",
    summary: "FlashList v2 requires New Architecture; pin 1.x when New Architecture is off.",
    issue: {
      reason: "@shopify/flash-list 2.x is New Architecture-only.",
      fixedVersion: "1.x"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/Shopify/flash-list/issues/1752",
        summary: "FlashList v2 is documented as New Architecture-only.",
        confidence: "high"
      },
      {
        type: "docs",
        url: "https://github.com/Shopify/flash-list",
        summary: "Shopify FlashList README: v2 requires New Architecture.",
        confidence: "medium"
      }
    ],
    remediation: [
      {
        type: "pin",
        packageName: "@shopify/flash-list",
        to: "1.x",
        note: "Pin @shopify/flash-list to 1.x, or enable New Architecture before using v2."
      }
    ],
    surfaces: [...NATIVE_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "sdk54-pin-screens-tilde-4.16",
    packageName: "react-native-screens",
    affectedRange: "*",
    context: {
      projectKinds: ["expo-go"],
      expoSdk: ["54"],
      packageManagers: ["npm"]
    },
    unless: {
      range: "~4.16.0"
    },
    outcome: "risky",
    confidence: "high",
    summary: "Expo SDK 54 managed / Expo Go apps should pin react-native-screens to ~4.16.0.",
    issue: {
      reason: "Newer screens releases regress Expo Go / managed SDK 54 navigation.",
      fixedVersion: "~4.16.0"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/software-mansion/react-native-screens/issues/3470",
        summary: "SDK 54 managed / Go screens regressions around versions newer than 4.16.",
        confidence: "high"
      },
      {
        type: "github_issue",
        url: "https://github.com/software-mansion/react-native-screens/issues/3496",
        summary: "Additional SDK 54 screens pin guidance toward ~4.16.0.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "pin",
        packageName: "react-native-screens",
        to: "~4.16.0",
        note: "Pin react-native-screens to ~4.16.0 on SDK 54 managed / Expo Go projects."
      }
    ],
    surfaces: [...MANAGED_SURFACES]
  },
  {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: "nativewind-min-4.2.1-with-rngh-sdk54",
    packageName: "nativewind",
    affectedRange: "<4.2.1",
    context: {
      projectKinds: [...EXPO_KINDS],
      expoSdk: ["54"],
      packageManagers: ["npm"],
      requiresPackages: ["react-native-gesture-handler"]
    },
    outcome: "risky",
    confidence: "high",
    summary: "SDK 54 apps that use Nativewind with RNGH need nativewind 4.2.1 or later.",
    issue: {
      reason: "Nativewind versions before 4.2.1 break when composed with react-native-gesture-handler on SDK 54.",
      fixedVersion: "4.2.1"
    },
    evidence: [
      {
        type: "github_issue",
        url: "https://github.com/nativewind/nativewind/issues/1570",
        summary: "Nativewind + RNGH breakage before 4.2.1.",
        confidence: "high"
      },
      {
        type: "github_issue",
        url: "https://github.com/expo/expo/issues/39833",
        summary: "Expo SDK 54 report of Nativewind requiring 4.2.1 when RNGH is present.",
        confidence: "high"
      }
    ],
    remediation: [
      {
        type: "bump",
        packageName: "nativewind",
        to: "4.2.1",
        note: "Bump nativewind to 4.2.1 or later when using react-native-gesture-handler on SDK 54."
      }
    ],
    surfaces: ["runtime"]
  }
];

export const optionalRules: CompatibilityRule[] = [
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
        summary: "Low-confidence optional rule. Not loaded in the default pack.",
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
  for (const rule of [...bundledRules, ...optionalRules]) {
    const result = validateCompatibilityRule(rule);
    if (!result.valid) {
      errors.push(`${rule.id}: ${result.errors.join(", ")}`);
    }
  }
  return errors;
}
