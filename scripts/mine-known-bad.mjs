#!/usr/bin/env node
/**
 * NativeGuard known-bad miner v1.1 (script-only, not a GitHub Action).
 *
 * Searches only each package's own GitHub repo and expo/expo.
 * expo/expo hits count only when the package name is in the title.
 * Own-repo hits count only when the title has a version, "fixed in",
 * "backport", or "pin". Feature PRs are dropped.
 * At most 8 hits are kept per package. Drafts markdown under
 * research/known-bad-candidates/. Does NOT edit the pack.
 * Skips a new file when the kept URL set is unchanged.
 *
 * Usage:
 *   node scripts/mine-known-bad.mjs
 *   node scripts/mine-known-bad.mjs --dry-run
 *   node scripts/mine-known-bad.mjs --self-check
 *
 * Requires: GitHub CLI (`gh`) authenticated for public search.
 * On auth failure the process exits before writing any draft.
 */

import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "research", "known-bad-candidates");
const EXPO_REPO = "expo/expo";

const WATCHLIST = [
  {
    key: "reanimated",
    package: "react-native-reanimated",
    repo: "software-mansion/react-native-reanimated"
  },
  {
    key: "screens",
    package: "react-native-screens",
    repo: "software-mansion/react-native-screens"
  },
  {
    key: "pager-view",
    package: "react-native-pager-view",
    repo: "callstack/react-native-pager-view"
  },
  {
    key: "FlashList",
    package: "@shopify/flash-list",
    repo: "Shopify/flash-list"
  },
  {
    key: "nativewind",
    package: "nativewind",
    repo: "nativewind/nativewind"
  },
  {
    key: "sentry",
    package: "@sentry/react-native",
    repo: "getsentry/sentry-react-native"
  }
];

const VERSION_ISH = /(?:^|[^\w.])v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?![\w.])/i;
const PHRASE = /fixed in|workaround|patch-package/i;
const COMPARATOR_RANGE =
  /(?:>=|<=|>|<|~|\^)\s*v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:\s*(?:,|and)?\s*(?:>=|<=|>|<|~|\^)\s*v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)?/gi;
const BAD_PREFIX = /vulnerable|affected|affects|broken|bad range|regression/i;
const FIXED_PREFIX = /fixed in|fixed range|fixed version|resolved in|patched in/i;

const dryRun = process.argv.includes("--dry-run");
const selfCheck = process.argv.includes("--self-check");

function stamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function mentionsPackage(text, packageName) {
  return text.toLowerCase().includes(packageName.toLowerCase());
}

const MAX_HITS = 8;
const TITLE_VERSION = /(?:^|[^\w.])v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?(?![\w.])/i;
const TITLE_PHRASE = /fixed in|backport|\bpin/i;

export function ownRepoTitleKeeps(title) {
  const value = String(title ?? "");
  return TITLE_VERSION.test(value) || TITLE_PHRASE.test(value);
}

export function isFeaturePull(hit) {
  const url = String(hit?.url ?? "");
  if (!/\/pull\/\d+/.test(url)) return false;
  const title = String(hit?.title ?? "");
  if (TITLE_PHRASE.test(title)) return false;
  return /^(feat|feature)(\b|[\s:(])/i.test(title.trim()) || /\bfeature\b/i.test(title);
}

export function keepHit(hit, packageName, repo) {
  const title = String(hit?.title ?? "");
  const body = String(hit?.body ?? "");
  if (repo === EXPO_REPO) {
    if (!mentionsPackage(title, packageName)) return false;
    const text = `${title}\n${body}`;
    return VERSION_ISH.test(text) || PHRASE.test(text);
  }
  if (isFeaturePull(hit)) return false;
  return ownRepoTitleKeeps(title);
}

function normalizeRange(value) {
  return value.replace(/\s+/g, " ").trim();
}

function lastKeyword(prefix, pattern) {
  const re = new RegExp(pattern.source, "gi");
  let last = -1;
  let match;
  while ((match = re.exec(prefix))) last = match.index;
  return last;
}

export function extractRangePair(text) {
  if (!text) return null;
  const labeled = [];
  const re = new RegExp(COMPARATOR_RANGE.source, "gi");
  let match;
  while ((match = re.exec(text))) {
    const literal = normalizeRange(match[0]);
    const start = Math.max(0, match.index - 96);
    const prefix = text.slice(start, match.index);
    const fixedAt = lastKeyword(prefix, FIXED_PREFIX);
    const badAt = lastKeyword(prefix, BAD_PREFIX);
    if (fixedAt === -1 && badAt === -1) continue;
    labeled.push({ kind: fixedAt > badAt ? "fixed" : "bad", literal, index: match.index });
  }
  for (let i = 0; i < labeled.length; i += 1) {
    const item = labeled[i];
    if (item.kind !== "bad") continue;
    const next = labeled.slice(i + 1).find(other => other.kind === "fixed" && other.index - item.index < 240);
    if (next && next.literal !== item.literal) return { bad: item.literal, fixed: next.literal };
  }
  for (let i = 0; i < labeled.length; i += 1) {
    const item = labeled[i];
    if (item.kind !== "fixed") continue;
    const next = labeled.slice(i + 1).find(other => other.kind === "bad" && other.index - item.index < 240);
    if (next && next.literal !== item.literal) return { bad: next.literal, fixed: item.literal };
  }
  return null;
}

function queriesFor(packageName) {
  const quoted = `"${packageName}"`;
  return [quoted, `${quoted} "fixed in"`, `${quoted} workaround`, `${quoted} patch-package`];
}

function runGhSearch(query, repo) {
  // gh search issues treats "@scope/name" as a mention and returns nothing.
  // The search API keeps the quoted package name in the query.
  const result = spawnSync(
    "gh",
    [
      "api",
      "-X",
      "GET",
      "search/issues",
      "-f",
      `q=repo:${repo} ${query}`,
      "-f",
      "per_page=10",
      "--jq",
      "[.items[]? | {url: .html_url, title: .title, body: (.body // \"\"), state: .state}]"
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "gh search failed").trim();
    throw new Error(err);
  }
  const stdout = (result.stdout || "").trim();
  if (!stdout) return [];
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error(`gh search returned non-JSON for ${repo}: ${error instanceof Error ? error.message : error}`);
  }
}

function dedupe(hits) {
  const seen = new Set();
  const out = [];
  for (const hit of hits) {
    if (!hit?.url || seen.has(hit.url)) continue;
    seen.add(hit.url);
    out.push(hit);
  }
  return out;
}

function rankHits(hits) {
  return [...hits].sort((a, b) => {
    const score = hit => (PHRASE.test(`${hit.title ?? ""}\n${hit.body ?? ""}`) ? 0 : 1);
    return score(a) - score(b) || String(a.url).localeCompare(String(b.url));
  });
}

function chooseRange(hits) {
  const pairs = [];
  for (const hit of hits) {
    const pair = extractRangePair(`${hit.title ?? ""}\n${hit.body ?? ""}`);
    if (!pair) continue;
    pairs.push({ ...pair, url: hit.url, title: hit.title ?? "" });
  }
  const unique = [];
  const seen = new Set();
  for (const pair of pairs) {
    const key = `${pair.bad} => ${pair.fixed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(pair);
  }
  return unique;
}

function escapeCell(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderCandidate(entry, hits, rangePairs) {
  const evidenceUrls = hits.map(hit => hit.url);
  const titles = hits.map(hit => `- [${hit.title}](${hit.url}) (${hit.state ?? "unknown"})`).join("\n");
  const confirmed = rangePairs.length === 1 ? rangePairs[0] : null;
  const vulnerable = confirmed
    ? `\`${escapeCell(confirmed.bad)}\` (unconfirmed)`
    : "_TODO semver range that fails_";
  const fixed = confirmed
    ? `\`${escapeCell(confirmed.fixed)}\` (unconfirmed)`
    : "_TODO semver range that clears (or leave blank)_";
  const rangeSection =
    rangePairs.length === 0
      ? "_No issue text literally stated both a bad range and a fixed range._"
      : rangePairs
          .map(
            pair =>
              `- \`${escapeCell(pair.bad)}\` / \`${escapeCell(pair.fixed)}\` (unconfirmed) — [${pair.title}](${pair.url})`
          )
          .join("\n");

  return `# Known-bad candidate: ${entry.package}

> Draft only. Miner v1 does **not** auto-merge into \`@nativeguard/rules\`.
> Vulnerable and fixed stay TODO unless one issue literally states both ranges. Copied ranges are unconfirmed.

| Field | Value |
| --- | --- |
| package | \`${entry.package}\` |
| vulnerable range | ${vulnerable} |
| fixed range | ${fixed} |
| patched workaround | _optional: patch-package \\| pin \\| leave_ |
| evidence URLs | see below |
| SDK / RN notes | _TODO Expo SDK / RN pairing notes_ |
| search scope | \`${entry.repo}\`, \`expo/expo\` |
| mined | ${new Date().toISOString()} |

## Evidence URLs

${evidenceUrls.map(url => `- ${url}`).join("\n")}

## Search hits

${titles}

## Range statements

${rangeSection}

## Suggested next step

1. Confirm still-in-vulnerable vs resolved-in-fixed-range against a fixture.
2. Open a rules PR only after human review — never auto-merge from this draft.
`;
}

function githubUrls(markdown) {
  return [
    ...new Set(
      [...markdown.matchAll(/https:\/\/github\.com\/[^\s)>\]]+/g)].map(match => match[0].replace(/[.,]+$/, ""))
    )
  ].sort();
}

export function keptUrls(hits) {
  return [...new Set(hits.map(hit => hit?.url).filter(Boolean))].sort();
}

export function draftEvidenceUrls(markdown) {
  const section = String(markdown).split(/^## Evidence URLs\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  return [
    ...new Set(
      [...section.matchAll(/https:\/\/github\.com\/[^\s)>\]]+/g)].map(match => match[0].replace(/[.,]+$/, ""))
    )
  ].sort();
}

export function sameUrlSet(markdown, hits) {
  const previous = draftEvidenceUrls(markdown);
  const next = keptUrls(hits);
  return previous.length === next.length && previous.every((url, index) => url === next[index]);
}

export function substantiveFingerprint(markdown) {
  const vulnerable = markdown.match(/\| vulnerable range \| ([^|\n]+) \|/);
  const fixed = markdown.match(/\| fixed range \| ([^|\n]+) \|/);
  return [
    githubUrls(markdown).join("\n"),
    (vulnerable?.[1] ?? "").trim(),
    (fixed?.[1] ?? "").trim()
  ].join("\n---\n");
}

async function draftsFor(key) {
  let names = [];
  try {
    names = await readdir(OUT_DIR);
  } catch {
    names = [];
  }
  return names
    .filter(name => new RegExp(`^\\d{8}-${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.md$`).test(name))
    .sort()
    .map(name => path.join(OUT_DIR, name));
}

async function searchPackage(entry) {
  const repos = [entry.repo, EXPO_REPO];
  const hits = [];
  for (const repo of repos) {
    for (const query of queriesFor(entry.package)) {
      if (dryRun) {
        console.log(`[dry-run] search/issues q=${JSON.stringify(`repo:${repo} ${query}`)}`);
        continue;
      }
      const batch = runGhSearch(query, repo);
      hits.push(...batch.filter(hit => keepHit(hit, entry.package, repo)));
      await sleep(2500);
    }
  }
  const kept = rankHits(dedupe(hits));
  return { filtered: kept.length, hits: kept.slice(0, MAX_HITS) };
}

async function main() {
  const day = stamp();
  const written = [];
  const removed = [];
  const skipped = [];

  for (const entry of WATCHLIST) {
    const searched = await searchPackage(entry);
    const hits = searched.hits;
    console.log(`HITS ${entry.key} filtered=${searched.filtered} kept=${hits.length}`);
    const outPath = path.join(OUT_DIR, `${day}-${entry.key}.md`);
    if (hits.length === 0) {
      if (!dryRun) {
        try {
          await unlink(outPath);
          removed.push(outPath);
          console.log(`removed ${path.relative(ROOT, outPath)} (0 surviving hits)`);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
          console.log(`no draft for ${entry.package} (0 surviving hits)`);
        }
      } else {
        console.log(`[dry-run] would not write ${path.relative(ROOT, outPath)} (0 surviving hits)`);
      }
      continue;
    }

    const rangePairs = chooseRange(hits);
    const body = renderCandidate(entry, hits, rangePairs);
    const existing = await draftsFor(entry.key);
    let unchanged = null;
    for (const file of existing) {
      const previousBody = await readFile(file, "utf8");
      if (sameUrlSet(previousBody, hits)) {
        unchanged = file;
        break;
      }
    }
    if (unchanged) {
      skipped.push({ package: entry.package, previous: path.relative(ROOT, unchanged) });
      console.log(`skip ${entry.package}: URL set unchanged vs ${path.relative(ROOT, unchanged)}`);
      continue;
    }

    if (!dryRun) {
      await writeFile(outPath, body);
      written.push(outPath);
    }
    const rangeNote =
      rangePairs.length === 0 ? "ranges TODO" : `${rangePairs.length} unconfirmed range pair(s)`;
    console.log(
      `${dryRun ? "[dry-run] would write" : "wrote"} ${path.relative(ROOT, outPath)} (${hits.length} hits, ${rangeNote})`
    );
    for (const pair of rangePairs) {
      console.log(`RANGE ${entry.package} bad=${JSON.stringify(pair.bad)} fixed=${JSON.stringify(pair.fixed)} url=${pair.url}`);
    }
  }

  console.log(
    dryRun
      ? "dry-run complete"
      : `miner v1.1 complete (wrote ${written.length}, removed ${removed.length}, skipped ${skipped.length})`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfCheck() {
  const own = "software-mansion/react-native-reanimated";
  assert(
    keepHit({ title: "Crash in 3.5.4", body: "" }, "react-native-reanimated", own),
    "own-repo title version should stay"
  );
  assert(
    keepHit(
      { title: "Request: backport DecorView fix to 4.23.x (pins ~4.23.0)", body: "" },
      "react-native-screens",
      "software-mansion/react-native-screens"
    ),
    "backport title should stay"
  );
  assert(
    keepHit(
      { title: "Pin react-native-screens to 4.23.0", url: "https://github.com/software-mansion/react-native-screens/pull/9", body: "" },
      "react-native-screens",
      "software-mansion/react-native-screens"
    ),
    "pin pull request should stay"
  );
  assert(
    !keepHit({ title: "workaround for react-native-screens", body: "no semver here" }, "react-native-screens", "software-mansion/react-native-screens"),
    "workaround-only own-repo title should drop"
  );
  assert(
    !keepHit({ title: "layout bug", body: "fails on 4.23.0" }, "react-native-screens", "software-mansion/react-native-screens"),
    "version only in the body should drop for own repo"
  );
  assert(
    !keepHit(
      { title: "feat: new blur API 1.2.3", url: "https://github.com/software-mansion/react-native-screens/pull/12", body: "" },
      "react-native-screens",
      "software-mansion/react-native-screens"
    ),
    "feature pull request should drop"
  );
  assert(
    keepHit(
      { title: "react-native-reanimated 3.5.4 crash", body: "fixed in 3.6.0" },
      "react-native-reanimated",
      EXPO_REPO
    ),
    "expo title with package and version should stay"
  );
  assert(
    !keepHit(
      { title: "fixed in 3.6.0", body: "react-native-reanimated is mentioned only here" },
      "react-native-reanimated",
      EXPO_REPO
    ),
    "expo hit with package only in the body should drop"
  );
  assert(
    !keepHit({ title: "react-native-pager-view layout", body: "no version and no phrase" }, "react-native-pager-view", EXPO_REPO),
    "expo package title without version or phrase should drop"
  );
  assert(sameUrlSet("## Evidence URLs\n\n- https://github.com/a/b/issues/1\n", [{ url: "https://github.com/a/b/issues/1" }]), "same url set");
  assert(!sameUrlSet("## Evidence URLs\n\n- https://github.com/a/b/issues/1\n", [{ url: "https://github.com/a/b/issues/2" }]), "different url set");
  const pair = extractRangePair(
    "This is vulnerable >=4.0.0 <4.1.2 on SDK 54. It is fixed in >=4.1.2."
  );
  assert(pair?.bad === ">=4.0.0 <4.1.2", `bad range parsed wrong: ${pair?.bad}`);
  assert(pair?.fixed === ">=4.1.2", `fixed range parsed wrong: ${pair?.fixed}`);
  assert(extractRangePair("fixed in 4.1.2 but no bad range") === null, "bare fixed version is not a range pair");
  assert(extractRangePair("broken >=1.0.0 <1.2.0 only") === null, "bad range alone stays TODO");
  const nearer = extractRangePair("fixed in >=1.0.0. Later this is vulnerable >=4.0.0 <4.1.2 and fixed in >=4.1.2.");
  assert(nearer?.bad === ">=4.0.0 <4.1.2", `nearer bad wrong: ${nearer?.bad}`);
  assert(nearer?.fixed === ">=4.1.2", `nearer fixed wrong: ${nearer?.fixed}`);
  const swapped = extractRangePair("fixed in >=4.1.2, vulnerable >=4.0.0 <4.1.2");
  assert(swapped?.bad === ">=4.0.0 <4.1.2" && swapped?.fixed === ">=4.1.2", "swapped order should still pair");
  console.log("self-check ok");
}

if (selfCheck) {
  runSelfCheck();
} else {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
