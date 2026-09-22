import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageManagerName } from "@nativeguard/schema";
import {
  parseBunLock,
  parseNpmLockfile,
  parsePnpmLock,
  parseYarnLock,
  pickResolvedVersions,
  type InstallLockfile
} from "./lockfiles.js";
import { parseYamlSubset } from "./yaml.js";

const LOCKFILE_CANDIDATES = [
  { name: "package-lock.json", packageManager: "npm" },
  { name: "yarn.lock", packageManager: "yarn" },
  { name: "pnpm-lock.yaml", packageManager: "pnpm" },
  { name: "bun.lock", packageManager: "bun" },
  { name: "bun.lockb", packageManager: "bun" }
] as const;

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  resolutions?: Record<string, string>;
  overrides?: Record<string, string | Record<string, string>>;
  pnpm?: {
    overrides?: Record<string, string>;
  };
}

export interface WorkspaceContext {
  packageRoot: string;
  workspaceRoot: string;
  importerKey: string;
  packageManager: PackageManagerName;
  lockfileName?: (typeof LOCKFILE_CANDIDATES)[number]["name"];
  lockfilePath?: string;
  rootPackageJson?: PackageJson;
  catalogs: Record<string, Record<string, string>>;
  pinOverrides: Record<string, string>;
}

export async function resolveWorkspaceContext(packageRoot: string): Promise<WorkspaceContext> {
  const root = path.resolve(packageRoot);
  const localLockfile = await detectLockfile(root);
  const workspaceRoot = await findWorkspaceRoot(root);
  const lockfile =
    localLockfile ??
    (workspaceRoot !== root ? await detectLockfile(workspaceRoot) : undefined);
  const rootPackageJson = await readPackageJsonIfPresent(workspaceRoot);
  const workspaceManifest = await readPnpmWorkspaceManifest(workspaceRoot);
  const catalogs = {
    ...workspaceManifest.catalogs,
    ...(await readYarnCatalogs(workspaceRoot))
  };
  const pinOverrides = {
    ...workspaceManifest.overrides,
    ...flattenOverrides(rootPackageJson?.overrides),
    ...(rootPackageJson?.pnpm?.overrides ?? {}),
    ...(rootPackageJson?.resolutions ?? {})
  };

  return {
    packageRoot: root,
    workspaceRoot,
    importerKey: importerKeyFor(workspaceRoot, root),
    packageManager: lockfile?.packageManager ?? "unknown",
    ...(lockfile?.name ? { lockfileName: lockfile.name } : {}),
    ...(lockfile?.filePath ? { lockfilePath: lockfile.filePath } : {}),
    ...(rootPackageJson ? { rootPackageJson } : {}),
    catalogs,
    pinOverrides
  };
}

export async function readInstallLockfile(context: WorkspaceContext): Promise<InstallLockfile | undefined> {
  if (!context.lockfilePath || !context.lockfileName) return undefined;
  switch (context.lockfileName) {
    case "package-lock.json":
      return parseNpmLockfile(await readFile(context.lockfilePath, "utf8"), context.importerKey);
    case "yarn.lock":
      return parseYarnLock(await readFile(context.lockfilePath, "utf8"));
    case "pnpm-lock.yaml":
      return parsePnpmLock(await readFile(context.lockfilePath, "utf8"), context.importerKey);
    case "bun.lock":
      return parseBunLock(await readFile(context.lockfilePath, "utf8"));
    case "bun.lockb":
      return {
        packageManager: "bun",
        lockfileName: "bun.lockb",
        packageCount: 0,
        resolvedVersions: {},
        entries: [],
        binaryLockfile: true,
        unsupportedReason:
          "NativeGuard detected Bun but only bun.lockb is present. Binary bun.lockb is not parsed; add a text bun.lock."
      };
    default: {
      const exhaustive: never = context.lockfileName;
      return exhaustive;
    }
  }
}

export function resolveDeclaredSpecifiers(
  declared: Record<string, string>,
  lockfile: InstallLockfile | undefined,
  context: WorkspaceContext,
  packagePins: Record<string, string>
): {
  resolvedVersions: Record<string, string>;
  unresolvedSpecifiers: Record<string, string>;
} {
  const lockResolved = lockfile
    ? pickResolvedVersions(lockfile.entries, context.importerKey, declared)
    : {};
  const resolvedVersions: Record<string, string> = { ...(lockfile?.resolvedVersions ?? {}), ...lockResolved };
  const unresolvedSpecifiers: Record<string, string> = {};
  const pins = { ...context.pinOverrides, ...packagePins };

  for (const [packageName, specifier] of Object.entries(declared)) {
    if (resolvedVersions[packageName]) continue;
    const catalogVersion = resolveCatalogSpecifier(specifier, packageName, context.catalogs);
    if (catalogVersion) {
      resolvedVersions[packageName] = catalogVersion;
      continue;
    }
    const pin = pins[packageName];
    if (pin && isConcreteVersion(pin)) {
      resolvedVersions[packageName] = pin;
      continue;
    }
    if (needsExplicitResolution(specifier)) {
      unresolvedSpecifiers[packageName] = specifier;
    }
  }

  return { resolvedVersions, unresolvedSpecifiers };
}

export function needsExplicitResolution(specifier: string): boolean {
  const trimmed = specifier.trim();
  return /^(catalog|workspace|patch|link|file|portal|exec|git|github|http|https|ssh|bitbucket|gitlab):/.test(
    trimmed
  );
}

export function isConcreteVersion(specifier: string): boolean {
  const trimmed = specifier.trim();
  if (needsExplicitResolution(trimmed)) return false;
  if (
    trimmed.startsWith("^") ||
    trimmed.startsWith("~") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith("<") ||
    trimmed === "*" ||
    trimmed.includes(" - ") ||
    trimmed.includes("||") ||
    trimmed.includes(".x")
  ) {
    return false;
  }
  return /^\d+\.\d+\.\d+/.test(trimmed.replace(/^v/, ""));
}

export function matchWorkspacePattern(pattern: string, relativePath: string): boolean {
  const normalizedPattern = pattern.replaceAll("\\", "/").replace(/\/$/, "");
  const rel = relativePath.replaceAll("\\", "/");
  if (normalizedPattern === "." || normalizedPattern === "") return rel === "" || rel === ".";
  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]+")
    .replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`).test(rel);
}

async function findWorkspaceRoot(packageRoot: string): Promise<string> {
  let current = packageRoot;
  while (true) {
    if (await isWorkspaceRootContaining(current, packageRoot)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return packageRoot;
    current = parent;
  }
}

async function isWorkspaceRootContaining(candidate: string, packageRoot: string): Promise<boolean> {
  if (candidate === packageRoot) return false;
  const relative = importerKeyFor(candidate, packageRoot);
  if (relative === ".") return false;

  const pnpmWorkspace = await readPnpmWorkspaceManifest(candidate);
  if (pnpmWorkspace.packages.length > 0) {
    return pnpmWorkspace.packages.some(pattern => matchWorkspacePattern(pattern, relative));
  }

  const packageJson = await readPackageJsonIfPresent(candidate);
  const patterns = workspacePatterns(packageJson);
  if (patterns.length > 0) {
    return patterns.some(pattern => matchWorkspacePattern(pattern, relative));
  }
  return false;
}

function workspacePatterns(packageJson: PackageJson | undefined): string[] {
  if (!packageJson?.workspaces) return [];
  if (Array.isArray(packageJson.workspaces)) return packageJson.workspaces;
  return packageJson.workspaces.packages ?? [];
}

function importerKeyFor(workspaceRoot: string, packageRoot: string): string {
  const relative = path.relative(workspaceRoot, packageRoot).replaceAll("\\", "/");
  return relative === "" ? "." : relative;
}

async function detectLockfile(
  directory: string
): Promise<{ name: (typeof LOCKFILE_CANDIDATES)[number]["name"]; packageManager: "npm" | "yarn" | "pnpm" | "bun"; filePath: string } | undefined> {
  for (const candidate of LOCKFILE_CANDIDATES) {
    const filePath = path.join(directory, candidate.name);
    if (await exists(filePath)) {
      return { name: candidate.name, packageManager: candidate.packageManager, filePath };
    }
  }
  return undefined;
}

async function readPackageJsonIfPresent(directory: string): Promise<PackageJson | undefined> {
  try {
    const raw = await readFile(path.join(directory, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    throw error;
  }
}

async function readPnpmWorkspaceManifest(directory: string): Promise<{
  packages: string[];
  catalogs: Record<string, Record<string, string>>;
  overrides: Record<string, string>;
}> {
  try {
    const raw = await readFile(path.join(directory, "pnpm-workspace.yaml"), "utf8");
    const parsed = asRecord(parseYamlSubset(raw)) ?? {};
    const packages = Array.isArray(parsed.packages)
      ? parsed.packages.filter((value): value is string => typeof value === "string")
      : [];
    const catalogs: Record<string, Record<string, string>> = {};
    const defaultCatalog = stringMap(parsed.catalog);
    if (Object.keys(defaultCatalog).length > 0) {
      catalogs.default = defaultCatalog;
    }
    const named = asRecord(parsed.catalogs);
    if (named) {
      for (const [name, value] of Object.entries(named)) {
        catalogs[name] = stringMap(value);
      }
    }
    return {
      packages,
      catalogs,
      overrides: stringMap(parsed.overrides)
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return { packages: [], catalogs: {}, overrides: {} };
    }
    throw error;
  }
}

async function readYarnCatalogs(directory: string): Promise<Record<string, Record<string, string>>> {
  try {
    const raw = await readFile(path.join(directory, ".yarnrc.yml"), "utf8");
    const parsed = asRecord(parseYamlSubset(raw)) ?? {};
    const catalogs: Record<string, Record<string, string>> = {};
    const defaultCatalog = stringMap(parsed.catalog);
    if (Object.keys(defaultCatalog).length > 0) catalogs.default = defaultCatalog;
    const named = asRecord(parsed.catalogs);
    if (named) {
      for (const [name, value] of Object.entries(named)) {
        catalogs[name] = stringMap(value);
      }
    }
    return catalogs;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return {};
    throw error;
  }
}

function resolveCatalogSpecifier(
  specifier: string,
  packageName: string,
  catalogs: Record<string, Record<string, string>>
): string | undefined {
  const trimmed = specifier.trim();
  if (!trimmed.startsWith("catalog:")) return undefined;
  const catalogName = trimmed.slice("catalog:".length).trim() || "default";
  return catalogs[catalogName]?.[packageName];
}

function flattenOverrides(overrides: PackageJson["overrides"]): Record<string, string> {
  if (!overrides) return {};
  const result: Record<string, string> = {};
  for (const [packageName, value] of Object.entries(overrides)) {
    if (typeof value === "string") result[packageName] = value;
  }
  return result;
}

function stringMap(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && (error as { code?: unknown }).code === code;
}
