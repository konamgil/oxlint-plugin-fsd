import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { toJson } from "tsconfck";

import { normalizePath } from "./path.js";

interface TsReference {
  path: string;
}

interface TsCompilerOptions {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

interface TsConfigLike {
  extends?: string | string[];
  references?: TsReference[];
  compilerOptions?: TsCompilerOptions;
}

interface ResolvedCompilerOptions {
  baseUrl?: string;
  paths?: Record<string, string[]>;
  absoluteBaseUrl: string;
  absolutePaths: Record<string, string[]>;
}

interface ResolvedTsConfig {
  tsconfigFile: string;
  compilerOptions: ResolvedCompilerOptions;
  references: ResolvedTsConfig[];
}

const require = createRequire(import.meta.url);
const tsConfigCache = new Map<string, ResolvedTsConfig | null>();
const relatedConfigCache = new Map<string, ResolvedTsConfig[]>();

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

function readJsoncFile(filePath: string): TsConfigLike {
  const content = readFileSync(filePath, "utf8");
  return JSON.parse(toJson(content)) as TsConfigLike;
}

function resolveExtendedConfigPath(configDir: string, request: string): string | null {
  const withJson = request.endsWith(".json") ? request : `${request}.json`;

  if (request.startsWith(".") || request.startsWith("/") || request.match(/^[A-Za-z]:/)) {
    const resolved = path.resolve(configDir, request);
    if (existsSync(resolved)) {
      return normalizePath(resolved);
    }

    const resolvedJson = path.resolve(configDir, withJson);
    return existsSync(resolvedJson) ? normalizePath(resolvedJson) : null;
  }

  try {
    return normalizePath(require.resolve(request, { paths: [configDir] }));
  } catch {
    try {
      return normalizePath(require.resolve(withJson, { paths: [configDir] }));
    } catch {
      return null;
    }
  }
}

function resolveReferenceConfigPath(configDir: string, request: string): string | null {
  const resolved = path.resolve(configDir, request);
  const normalizedResolved = normalizePath(resolved);

  if (existsSync(normalizedResolved)) {
    try {
      if (readFileSync(normalizedResolved, "utf8")) {
        return normalizedResolved;
      }
    } catch {
      const candidate = path.join(normalizedResolved, "tsconfig.json");
      return existsSync(candidate) ? normalizePath(candidate) : null;
    }
  }

  const tsconfigJson = path.resolve(configDir, request, "tsconfig.json");
  if (existsSync(tsconfigJson)) {
    return normalizePath(tsconfigJson);
  }

  const withJson = request.endsWith(".json")
    ? path.resolve(configDir, request)
    : path.resolve(configDir, `${request}.json`);
  return existsSync(withJson) ? normalizePath(withJson) : null;
}

function toAbsolutePaths(
  absoluteBaseUrl: string,
  pathsConfig: Record<string, string[]> = {},
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(pathsConfig).map(([pattern, replacements]) => [
      pattern,
      replacements.map((replacement) => normalizePath(path.resolve(absoluteBaseUrl, replacement))),
    ]),
  );
}

function createCompilerOptions(
  rawOptions: TsCompilerOptions | undefined,
  configDir: string,
  inherited?: ResolvedCompilerOptions,
): ResolvedCompilerOptions {
  const absoluteBaseUrl = rawOptions?.baseUrl
    ? normalizePath(path.resolve(configDir, rawOptions.baseUrl))
    : inherited?.absoluteBaseUrl ?? normalizePath(configDir);

  const ownAbsolutePaths = rawOptions?.paths
    ? toAbsolutePaths(absoluteBaseUrl, rawOptions.paths)
    : {};

  return {
    baseUrl: rawOptions?.baseUrl ?? inherited?.baseUrl,
    paths: {
      ...inherited?.paths,
      ...rawOptions?.paths,
    },
    absoluteBaseUrl,
    absolutePaths: {
      ...inherited?.absolutePaths,
      ...ownAbsolutePaths,
    },
  };
}

function loadTsConfig(configFile: string, ancestry = new Set<string>()): ResolvedTsConfig | null {
  const normalizedConfigFile = normalizePath(configFile);
  if (tsConfigCache.has(normalizedConfigFile)) {
    return tsConfigCache.get(normalizedConfigFile) ?? null;
  }

  if (ancestry.has(normalizedConfigFile) || !existsSync(normalizedConfigFile)) {
    tsConfigCache.set(normalizedConfigFile, null);
    return null;
  }

  const rawConfig = readJsoncFile(normalizedConfigFile);
  const configDir = path.dirname(normalizedConfigFile);
  const nextAncestry = new Set(ancestry);
  nextAncestry.add(normalizedConfigFile);

  const extendsList = Array.isArray(rawConfig.extends)
    ? rawConfig.extends
    : rawConfig.extends
      ? [rawConfig.extends]
      : [];

  let compilerOptions = createCompilerOptions(undefined, configDir);
  for (const extendedConfig of extendsList) {
    const extendedPath = resolveExtendedConfigPath(configDir, extendedConfig);
    if (!extendedPath) {
      continue;
    }

    const resolvedParent = loadTsConfig(extendedPath, nextAncestry);
    if (!resolvedParent) {
      continue;
    }

    compilerOptions = createCompilerOptions(
      {
        baseUrl: resolvedParent.compilerOptions.baseUrl,
        paths: resolvedParent.compilerOptions.paths,
      },
      path.dirname(resolvedParent.tsconfigFile),
      compilerOptions,
    );
    compilerOptions.absoluteBaseUrl = resolvedParent.compilerOptions.absoluteBaseUrl;
    compilerOptions.absolutePaths = {
      ...compilerOptions.absolutePaths,
      ...resolvedParent.compilerOptions.absolutePaths,
    };
  }

  compilerOptions = createCompilerOptions(rawConfig.compilerOptions, configDir, compilerOptions);

  const references = (rawConfig.references ?? [])
    .map((reference) => resolveReferenceConfigPath(configDir, reference.path))
    .filter((referencePath): referencePath is string => referencePath !== null)
    .map((referencePath) => loadTsConfig(referencePath, nextAncestry))
    .filter((referenceConfig): referenceConfig is ResolvedTsConfig => referenceConfig !== null);

  const resolvedConfig = {
    tsconfigFile: normalizedConfigFile,
    compilerOptions,
    references,
  } satisfies ResolvedTsConfig;

  tsConfigCache.set(normalizedConfigFile, resolvedConfig);
  return resolvedConfig;
}

function flattenRelatedTsConfigs(config: ResolvedTsConfig): ResolvedTsConfig[] {
  const collected: ResolvedTsConfig[] = [];
  const visited = new Set<string>();

  function visit(current: ResolvedTsConfig): void {
    if (visited.has(current.tsconfigFile)) {
      return;
    }

    visited.add(current.tsconfigFile);
    collected.push(current);
    for (const reference of current.references) {
      visit(reference);
    }
  }

  visit(config);
  return collected;
}

function findNearestTsConfig(filePath: string): ResolvedTsConfig[] {
  const normalizedPath = normalizePath(filePath);
  const startDir = path.dirname(normalizedPath);

  if (relatedConfigCache.has(startDir)) {
    return relatedConfigCache.get(startDir) ?? [];
  }

  let currentDir = startDir;
  while (true) {
    const candidate = path.join(currentDir, "tsconfig.json");
    if (existsSync(candidate)) {
      const loaded = loadTsConfig(candidate);
      const flattened = loaded ? flattenRelatedTsConfigs(loaded) : [];
      relatedConfigCache.set(startDir, flattened);
      return flattened;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      relatedConfigCache.set(startDir, []);
      return [];
    }

    currentDir = parentDir;
  }
}

function tryResolveFile(candidate: string): string | null {
  const normalizedCandidate = normalizePath(candidate);

  if (existsSync(normalizedCandidate)) {
    try {
      const stats = statSync(normalizedCandidate);
      if (stats.isFile()) {
        return normalizedCandidate;
      }
    } catch {
      return null;
    }
  }

  for (const extension of RESOLVE_EXTENSIONS) {
    const withExtension = `${normalizedCandidate}${extension}`;
    if (existsSync(withExtension)) {
      return normalizePath(withExtension);
    }
  }

  for (const extension of RESOLVE_EXTENSIONS) {
    const indexFile = path.join(normalizedCandidate, `index${extension}`);
    if (existsSync(indexFile)) {
      return normalizePath(indexFile);
    }
  }

  return null;
}

function matchPathAlias(pattern: string, importPath: string): string[] | null {
  if (!pattern.includes("*")) {
    return pattern === importPath ? [] : null;
  }

  const [prefix, suffix] = pattern.split("*");
  if (!importPath.startsWith(prefix) || !importPath.endsWith(suffix ?? "")) {
    return null;
  }

  const matched = importPath.slice(prefix.length, importPath.length - (suffix?.length ?? 0));
  return [matched];
}

function resolveWithTsConfig(importPath: string, tsconfig: ResolvedTsConfig): string | null {
  for (const [pattern, replacements] of Object.entries(tsconfig.compilerOptions.absolutePaths)) {
    const matched = matchPathAlias(pattern, importPath);
    if (!matched) {
      continue;
    }

    for (const replacement of replacements) {
      const substituted = replacement.includes("*")
        ? replacement.replace("*", matched[0] ?? "")
        : replacement;
      const resolved = tryResolveFile(substituted);
      if (resolved) {
        return resolved;
      }
    }
  }

  return tryResolveFile(path.resolve(tsconfig.compilerOptions.absoluteBaseUrl, importPath));
}

export function resolveImportPath(importPath: string, importerFile: string): string | null {
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return tryResolveFile(path.resolve(path.dirname(importerFile), importPath));
  }

  const relatedConfigs = findNearestTsConfig(importerFile);
  for (const tsconfig of relatedConfigs) {
    const resolved = resolveWithTsConfig(importPath, tsconfig);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}
