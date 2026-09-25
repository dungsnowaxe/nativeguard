import { parseYamlSubset } from "./yaml.js";

export interface InstallLockfile {
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
  lockfileName: string;
  lockfileVersion?: number;
  packageCount: number;
  resolvedVersions: Record<string, string>;
  entries: LockfileEntry[];
  binaryLockfile?: boolean;
  unsupportedReason?: string;
}

export interface LockfileEntry {
  packageName: string;
  descriptor?: string;
  version: string;
  importerKey?: string;
}

export function parseNpmLockfile(raw: string, importerKey = "."): InstallLockfile {
  const parsed = JSON.parse(raw) as {
    lockfileVersion?: number;
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string; dependencies?: Record<string, { version?: string }> }>;
  };
  const entries: LockfileEntry[] = [];
  const packages = parsed.packages ?? {};

  for (const [key, value] of Object.entries(packages)) {
    if (!value.version) continue;
    const localPrefix = importerKey === "." ? "" : `${importerKey}/`;
    const localMatch = key.match(new RegExp(`^${escapeRegExp(localPrefix)}node_modules/(@[^/]+/[^/]+|[^/]+)$`));
    const rootMatch = key.match(/^node_modules\/(@[^/]+\/[^/]+|[^/]+)$/);
    const packageName = localMatch?.[1] ?? (importerKey === "." ? rootMatch?.[1] : undefined);
    if (!packageName) continue;
    entries.push({
      packageName,
      version: value.version,
      importerKey: localMatch ? importerKey : "."
    });
  }

  if (entries.length === 0 && parsed.dependencies) {
    collectNpmV1Dependencies(parsed.dependencies, entries);
  }

  return {
    packageManager: "npm",
    lockfileName: "package-lock.json",
    ...(parsed.lockfileVersion ? { lockfileVersion: parsed.lockfileVersion } : {}),
    packageCount: parsed.packages ? Object.keys(parsed.packages).length : entries.length,
    resolvedVersions: pickResolvedVersions(entries, importerKey),
    entries
  };
}

export function parseYarnLock(raw: string): InstallLockfile {
  const classic = /(^|\n)# yarn lockfile v1\b/.test(raw);
  const entries: LockfileEntry[] = [];
  const lines = raw.split(/\r?\n/);
  let metadataVersion: number | undefined;
  let currentDescriptors: string[] | undefined;

  for (const line of lines) {
    if (!classic && currentDescriptors === undefined && line.startsWith("  version:") && metadataVersion === undefined) {
      const version = unquote(line.slice("  version:".length).trim());
      if (/^\d+$/.test(version)) metadataVersion = Number(version);
    }

    if (!line.startsWith(" ") && !line.startsWith("\t") && line.trim().endsWith(":")) {
      const key = line.trim().slice(0, -1).trim();
      currentDescriptors = key === "__metadata" ? undefined : splitYarnDescriptors(unquote(key));
      continue;
    }

    if (!currentDescriptors) continue;
    const classicVersion = line.match(/^\s+version\s+"([^"]+)"\s*$/);
    const berryVersion = line.match(/^\s+version:\s*(.+)$/);
    const version = classicVersion?.[1] ?? (berryVersion ? unquote(berryVersion[1]?.trim() ?? "") : undefined);
    if (!version) continue;
    for (const descriptor of currentDescriptors) {
      const packageName = packageNameFromDescriptor(descriptor);
      if (!packageName) continue;
      entries.push({ packageName, descriptor, version });
    }
    currentDescriptors = undefined;
  }

  return {
    packageManager: "yarn",
    lockfileName: "yarn.lock",
    ...(classic ? { lockfileVersion: 1 } : metadataVersion !== undefined ? { lockfileVersion: metadataVersion } : {}),
    packageCount: entries.length,
    resolvedVersions: pickResolvedVersions(entries),
    entries
  };
}

export function parsePnpmLock(raw: string, importerKey = "."): InstallLockfile {
  const parsed = asRecord(parseYamlSubset(raw)) ?? {};
  const entries: LockfileEntry[] = [];
  const importers = asRecord(parsed.importers) ?? {};

  for (const [key, importerValue] of Object.entries(importers)) {
    const importer = asRecord(importerValue);
    if (!importer) continue;
    collectPnpmImporterDeps(importer, key, entries);
  }

  const packages = asRecord(parsed.packages) ?? {};
  for (const [key, value] of Object.entries(packages)) {
    const parsedKey = parsePnpmPackageKey(key);
    if (!parsedKey) continue;
    const record = asRecord(value);
    const version = record && typeof record.version === "string" ? record.version : parsedKey.version;
    entries.push({
      packageName: parsedKey.packageName,
      version: stripPeerSuffix(version),
      descriptor: parsedKey.packageName
    });
  }

  const lockfileVersion = parseLockfileVersionNumber(parsed.lockfileVersion);
  return {
    packageManager: "pnpm",
    lockfileName: "pnpm-lock.yaml",
    ...(lockfileVersion ? { lockfileVersion } : {}),
    packageCount: Object.keys(packages).length || entries.length,
    resolvedVersions: pickResolvedVersions(entries, importerKey),
    entries
  };
}

export function parseBunLock(raw: string): InstallLockfile {
  const parsed = asRecord(parseJsonc(raw)) ?? {};
  const entries: LockfileEntry[] = [];
  const packages = asRecord(parsed.packages) ?? {};

  for (const [key, value] of Object.entries(packages)) {
    if (Array.isArray(value) && typeof value[0] === "string") {
      const locator = value[0];
      if (locator.includes("@workspace:") || locator.endsWith("@workspace")) continue;
      const packageName = packageNameFromDescriptor(locator) || packageNameFromDescriptor(key);
      const version = versionFromLocator(locator);
      if (!packageName || !version) continue;
      entries.push({ packageName, descriptor: key, version });
      continue;
    }
    const record = asRecord(value);
    if (record && typeof record.version === "string") {
      const packageName = packageNameFromDescriptor(key);
      if (!packageName) continue;
      entries.push({ packageName, descriptor: key, version: record.version });
    }
  }

  const lockfileVersion = parseLockfileVersionNumber(parsed.lockfileVersion);
  return {
    packageManager: "bun",
    lockfileName: "bun.lock",
    ...(lockfileVersion ? { lockfileVersion } : {}),
    packageCount: Object.keys(packages).length,
    resolvedVersions: pickResolvedVersions(entries),
    entries
  };
}

export function pickResolvedVersions(
  entries: LockfileEntry[],
  importerKey?: string,
  declared?: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const prioritized = importerKey
    ? [
        ...entries.filter(entry => entry.importerKey === importerKey),
        ...entries.filter(entry => entry.importerKey !== importerKey)
      ]
    : entries;

  for (const entry of prioritized) {
    const declaredRange = declared?.[entry.packageName];
    if (declaredRange && entry.descriptor && !descriptorMatches(entry.descriptor, entry.packageName, declaredRange)) {
      if (resolved[entry.packageName]) continue;
    }
    if (resolved[entry.packageName] && declaredRange && entry.descriptor) {
      if (descriptorMatches(entry.descriptor, entry.packageName, declaredRange)) {
        resolved[entry.packageName] = entry.version;
      }
      continue;
    }
    if (!resolved[entry.packageName]) {
      resolved[entry.packageName] = entry.version;
    }
  }
  return resolved;
}

export function packageNameFromDescriptor(descriptor: string): string {
  const value = unquote(descriptor.trim());
  if (!value) return "";
  if (value.startsWith("@")) {
    const slash = value.indexOf("/");
    if (slash === -1) return value;
    const rest = value.slice(slash + 1);
    const at = rest.indexOf("@");
    return at === -1 ? value : value.slice(0, slash + 1 + at);
  }
  const at = value.indexOf("@");
  return at === -1 ? value : value.slice(0, at);
}

export function stripPeerSuffix(version: string): string {
  return version.trim().split("(")[0]?.trim() ?? version;
}

export function parseJsonc(raw: string): unknown {
  return JSON.parse(stripJsonc(raw));
}

function collectNpmV1Dependencies(
  dependencies: Record<string, { version?: string; dependencies?: Record<string, { version?: string }> }>,
  entries: LockfileEntry[]
): void {
  for (const [packageName, value] of Object.entries(dependencies)) {
    if (value.version) {
      entries.push({ packageName, version: value.version, importerKey: "." });
    }
    if (value.dependencies) {
      collectNpmV1Dependencies(value.dependencies, entries);
    }
  }
}

function collectPnpmImporterDeps(
  importer: Record<string, unknown>,
  importerKey: string,
  entries: LockfileEntry[]
): void {
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
    const deps = asRecord(importer[field]);
    if (!deps) continue;
    for (const [packageName, value] of Object.entries(deps)) {
      const version =
        typeof value === "string"
          ? stripPeerSuffix(value)
          : typeof asRecord(value)?.version === "string"
            ? stripPeerSuffix(String(asRecord(value)?.version))
            : undefined;
      if (!version) continue;
      const specifier = typeof asRecord(value)?.specifier === "string" ? String(asRecord(value)?.specifier) : undefined;
      entries.push({
        packageName,
        version,
        ...(specifier ? { descriptor: specifier } : {}),
        importerKey: importerKey === "" ? "." : importerKey
      });
    }
  }
}

function parsePnpmPackageKey(key: string): { packageName: string; version: string } | undefined {
  const trimmed = key.replace(/^\//, "");
  const match = trimmed.match(/^(?:@[^/]+\/[^@/]+|[^@/]+)[@/](.+)$/);
  if (!match) return undefined;
  const packageName = packageNameFromDescriptor(trimmed.includes("@") ? trimmed : `${trimmed}`);
  const version = stripPeerSuffix(match[1] ?? "");
  if (!packageName || !version) return undefined;
  if (trimmed.startsWith("@")) {
    const at = trimmed.indexOf("@", 1);
    if (at === -1) return undefined;
    return { packageName: trimmed.slice(0, at), version: stripPeerSuffix(trimmed.slice(at + 1)) };
  }
  const at = trimmed.indexOf("@");
  if (at !== -1) {
    return { packageName: trimmed.slice(0, at), version: stripPeerSuffix(trimmed.slice(at + 1)) };
  }
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) return undefined;
  return {
    packageName: trimmed.slice(0, slash),
    version: stripPeerSuffix(trimmed.slice(slash + 1))
  };
}

function splitYarnDescriptors(key: string): string[] {
  const descriptors: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < key.length; index += 1) {
    const character = key[index];
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (character === "," && !inQuotes && key[index + 1] === " ") {
      const trimmed = current.trim();
      if (trimmed) descriptors.push(unquote(trimmed));
      current = "";
      index += 1;
      continue;
    }
    current += character;
  }
  const trimmed = current.trim();
  if (trimmed) descriptors.push(unquote(trimmed));
  return descriptors;
}

function descriptorMatches(descriptor: string, packageName: string, declared: string): boolean {
  const value = unquote(descriptor);
  if (value === declared) return true;
  const rest = value.slice(packageName.length);
  return (
    rest === `@${declared}` ||
    rest === `@npm:${declared}` ||
    rest === declared ||
    rest.endsWith(`@${declared}`) ||
    rest.endsWith(`@npm:${declared}`)
  );
}

function versionFromLocator(locator: string): string | undefined {
  const name = packageNameFromDescriptor(locator);
  if (!name) return undefined;
  const suffix = locator.slice(name.length);
  if (!suffix.startsWith("@")) return undefined;
  const version = suffix.slice(1).split("#")[0]?.trim();
  return version || undefined;
}

function parseLockfileVersionNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stripJsonc(raw: string): string {
  let result = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    const next = raw[index + 1];
    if (inLineComment) {
      if (character === "\n") {
        inLineComment = false;
        result += character;
      }
      continue;
    }
    if (inBlockComment) {
      if (character === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      result += character;
      if (character === "\\" && next) {
        result += next;
        index += 1;
        continue;
      }
      if (character === '"') inString = false;
      continue;
    }
    if (character === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (character === '"') inString = true;
    result += character;
  }
  return result.replace(/,\s*([}\]])/g, "$1");
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
