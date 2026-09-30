#!/usr/bin/env node
/**
 * NativeGuard known-bad miner v0 (script-only, not a GitHub Action).
 *
 * Uses `gh search` to draft markdown candidates under research/known-bad-candidates/.
 * Does NOT auto-merge into the curated rules pack. Evidence layer only.
 *
 * Usage:
 *   node scripts/mine-known-bad.mjs
 *   node scripts/mine-known-bad.mjs --dry-run
 *
 * Requires: GitHub CLI (`gh`) authenticated for public search.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "research", "known-bad-candidates");

const WATCHLIST = [
  {
    key: "reanimated",
    package: "react-native-reanimated",
    queries: [
      "react-native-reanimated fails EAS",
      "react-native-reanimated expo doctor",
      "react-native-reanimated patch-package",
      "react-native-reanimated workaround",
      "react-native-reanimated fixed in"
    ]
  },
  {
    key: "screens",
    package: "react-native-screens",
    queries: [
      "react-native-screens fails EAS",
      "react-native-screens expo doctor",
      "react-native-screens patch-package",
      "react-native-screens workaround",
      "react-native-screens fixed in"
    ]
  },
  {
    key: "pager-view",
    package: "react-native-pager-view",
    queries: [
      "react-native-pager-view fails EAS",
      "react-native-pager-view expo doctor",
      "react-native-pager-view patch-package",
      "react-native-pager-view workaround",
      "react-native-pager-view fixed in"
    ]
  },
  {
    key: "FlashList",
    package: "@shopify/flash-list",
    queries: [
      "flash-list fails EAS",
      "@shopify/flash-list expo doctor",
      "flash-list patch-package",
      "flash-list workaround",
      "flash-list fixed in"
    ]
  },
  {
    key: "nativewind",
    package: "nativewind",
    queries: [
      "nativewind fails EAS",
      "nativewind expo doctor",
      "nativewind patch-package",
      "nativewind workaround",
      "nativewind fixed in"
    ]
  },
  {
    key: "sentry",
    package: "@sentry/react-native",
    queries: [
      "sentry-expo fails EAS",
      "@sentry/react-native expo doctor",
      "sentry-expo patch-package",
      "sentry react-native workaround",
      "sentry-expo fixed in"
    ]
  }
];

const SIGNAL_TERMS = ["fails EAS", "expo doctor", "patch-package", "workaround", "fixed in"];

const dryRun = process.argv.includes("--dry-run");

function runGhSearch(query) {
  const result = spawnSync(
    "gh",
    [
      "search",
      "issues",
      query,
      "--limit",
      "8",
      "--json",
      "url,title,repository,createdAt,state,labels"
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "gh search failed").trim();
    throw new Error(err);
  }
  try {
    return JSON.parse(result.stdout || "[]");
  } catch {
    return [];
  }
}

function stamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function renderCandidate(entry, hits) {
  const evidenceUrls = [...new Set(hits.map(hit => hit.url).filter(Boolean))];
  const titles = hits.map(hit => `- [${hit.title}](${hit.url}) (${hit.state})`).join("\n") || "- _(no hits)_";
  return `# Known-bad candidate: ${entry.package}

> Draft only. Miner v0 does **not** auto-merge into \`@nativeguard/rules\`.
> Fill vulnerable / fixed ranges from evidence before proposing a pack change.

| Field | Value |
| --- | --- |
| package | \`${entry.package}\` |
| vulnerable range | _TODO semver range that fails_ |
| fixed range | _TODO semver range that clears (or leave blank)_ |
| patched workaround | _optional: patch-package \\| pin \\| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| signals | ${SIGNAL_TERMS.map(term => `\`${term}\``).join(", ")} |
| mined | ${new Date().toISOString()} |

## Evidence URLs

${evidenceUrls.map(url => `- ${url}`).join("\n") || "- _(none)_"}

## Search hits

${titles}

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const day = stamp();
  const written = [];

  for (const entry of WATCHLIST) {
    const hits = [];
    for (const query of entry.queries) {
      if (dryRun) {
        console.log(`[dry-run] gh search issues ${JSON.stringify(query)}`);
        continue;
      }
      try {
        const batch = runGhSearch(query);
        for (const hit of batch) hits.push(hit);
      } catch (error) {
        console.error(`search failed for ${entry.package}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const hit of hits) {
      if (!hit?.url || seen.has(hit.url)) continue;
      seen.add(hit.url);
      deduped.push(hit);
    }

    const fileName = `${day}-${entry.key}.md`;
    const outPath = path.join(OUT_DIR, fileName);
    const body = renderCandidate(entry, deduped);
    if (!dryRun) {
      await writeFile(outPath, body);
      written.push(outPath);
      console.log(`wrote ${path.relative(ROOT, outPath)} (${deduped.length} evidence urls)`);
    } else {
      console.log(`[dry-run] would write ${path.relative(ROOT, outPath)}`);
    }
  }

  if (!dryRun) {
    const readme = path.join(OUT_DIR, "README.md");
    await writeFile(
      readme,
      `# Known-bad candidates (miner v0)

Draft markdown only. Produced by \`scripts/mine-known-bad.mjs\` via \`gh search\`.

- Watchlist: reanimated, screens, pager-view, FlashList, nativewind, sentry
- Signals: fails EAS, expo doctor, patch-package, workaround, fixed in
- Fields: package, vulnerable range, fixed range, evidence URLs, SDK/RN notes
- **No auto-merge** into the curated pack
- **Not** a GitHub Action — script-only runner

Re-run:

\`\`\`sh
mise exec node@24 -- node scripts/mine-known-bad.mjs
\`\`\`
`
    );
    written.push(readme);
  }

  console.log(dryRun ? "dry-run complete" : `miner v0 complete (${written.length} files)`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
