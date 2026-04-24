import path from "node:path";

import {
  DEFAULT_FSD_LAYERS,
  DEFAULT_SINGLE_LAYER_MODULES,
  type ForbiddenImportsConfig,
  type NoRelativeImportsOptions,
  type SliceBoundary,
} from "../types.js";

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.*]/g, "\\$&");
}

const EMPTY_REGEX_LIST: readonly RegExp[] = Object.freeze([]);

const globRegexCache = new Map<string, RegExp>();
const plainRegexCache = new Map<string, RegExp>();
const regexListCache = new Map<string, RegExp[]>();

const PATH_CACHE_SIZE = 2000;

interface LRUCache<K, V> {
  has(key: K): boolean;
  get(key: K): V | undefined;
  set(key: K, value: V): void;
}

export function __internal_createLRU<K, V>(max: number): LRUCache<K, V> {
  return createLRU<K, V>(max);
}

function createLRU<K, V>(max: number): LRUCache<K, V> {
  const map = new Map<K, V>();
  return {
    has(key) {
      return map.has(key);
    },
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key) as V;
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      if (map.has(key)) {
        map.delete(key);
      } else if (map.size >= max) {
        const firstKey = map.keys().next().value;
        if (firstKey !== undefined) map.delete(firstKey);
      }
      map.set(key, value);
    },
  };
}

interface ConfigCache {
  aliasPatterns: readonly string[];
  segmentToLayer: Map<string, string>;
  folderPatternRegex: RegExp | null;
  filePartsCache: LRUCache<string, PathParts | null>;
  importPartsCache: LRUCache<string, PathParts | null>;
}

const configCacheStore = new WeakMap<ForbiddenImportsConfig, ConfigCache>();

function getConfigCache(config: ForbiddenImportsConfig): ConfigCache {
  const cached = configCacheStore.get(config);
  if (cached) return cached;

  const aliasPatterns: readonly string[] = [
    config.alias.withSlash ? `${config.alias.value}/` : config.alias.value,
    `${config.alias.value}/`,
  ];

  const segmentToLayer = new Map<string, string>();
  for (const [layerKey, layerConfig] of Object.entries(config.layers)) {
    segmentToLayer.set(layerKey, layerKey);
    const pattern = layerConfig?.pattern;
    if (pattern && !segmentToLayer.has(pattern)) {
      segmentToLayer.set(pattern, layerKey);
    }
  }

  let folderPatternRegex: RegExp | null = null;
  if (config.folderPattern.enabled) {
    try {
      folderPatternRegex = new RegExp(config.folderPattern.regex);
    } catch {
      folderPatternRegex = null;
    }
  }

  const entry: ConfigCache = {
    aliasPatterns,
    segmentToLayer,
    folderPatternRegex,
    filePartsCache: createLRU<string, PathParts | null>(PATH_CACHE_SIZE),
    importPartsCache: createLRU<string, PathParts | null>(PATH_CACHE_SIZE),
  };
  configCacheStore.set(config, entry);
  return entry;
}

function globToRegex(pattern: string): RegExp {
  const cached = globRegexCache.get(pattern);
  if (cached) return cached;

  const normalizedPattern = normalizePath(pattern);
  const placeholder = "__DOUBLE_STAR__";
  const escaped = escapeRegex(normalizedPattern.replace(/\*\*/g, placeholder))
    .replace(new RegExp(placeholder, "g"), ".*")
    .replace(/\\\*/g, "[^/]*");
  const regex = new RegExp(`^${escaped}$`);
  globRegexCache.set(pattern, regex);
  return regex;
}

function compileSingleRegex(pattern: string): RegExp {
  const cached = plainRegexCache.get(pattern);
  if (cached) return cached;

  let compiled: RegExp;
  try {
    compiled = new RegExp(pattern);
  } catch {
    compiled = globToRegex(pattern);
  }
  plainRegexCache.set(pattern, compiled);
  return compiled;
}

export function isRelativeImportPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "." ||
      value === ".." ||
      value.startsWith("./") ||
      value.startsWith("../"))
  );
}

export function compileRegexList(patterns: readonly string[] = []): RegExp[] {
  if (patterns.length === 0) return EMPTY_REGEX_LIST as RegExp[];

  const key = patterns.join("\u0000");
  const cached = regexListCache.get(key);
  if (cached) return cached;

  const compiled = patterns.map(compileSingleRegex);
  regexListCache.set(key, compiled);
  return compiled;
}

export function matchesAnyRegex(value: string, regexes: readonly RegExp[]): boolean {
  for (const regex of regexes) {
    if (regex.test(value)) return true;
  }
  return false;
}

export function getRelativePathFromRoot(
  filePath: string,
  rootPattern = "/src/",
): string | null {
  const normalizedPath = normalizePath(filePath);
  const rootIndex = normalizedPath.indexOf(rootPattern);

  if (rootIndex === -1) {
    return null;
  }

  return normalizedPath.slice(rootIndex + rootPattern.length);
}

interface PathParts {
  segments: string[];
  layer: string;
  layerIndex: number;
}

function stripAliasSegments(
  normalizedImport: string,
  aliasPatterns: readonly string[],
): string[] | null {
  const matchingPrefix = aliasPatterns.find((prefix) =>
    normalizedImport.startsWith(prefix),
  );
  if (!matchingPrefix) return null;

  let rest = normalizedImport.slice(matchingPrefix.length);
  if (rest.startsWith("/")) rest = rest.slice(1);
  return rest.split("/").filter(Boolean);
}

function parseImportPathParts(
  importPath: string,
  config: ForbiddenImportsConfig,
): PathParts | null {
  if (isRelativeImportPath(importPath)) return null;

  const cache = getConfigCache(config);
  if (cache.importPartsCache.has(importPath)) {
    return cache.importPartsCache.get(importPath) ?? null;
  }

  const normalized = normalizePath(importPath);
  const segments = stripAliasSegments(normalized, cache.aliasPatterns);
  let result: PathParts | null = null;

  if (segments && segments.length > 0) {
    const firstSegment = segments[0];
    if (firstSegment) {
      const layer = cache.segmentToLayer.get(firstSegment);
      if (layer) {
        result = { segments, layer, layerIndex: 0 };
      }
    }
  }

  cache.importPartsCache.set(importPath, result);
  return result;
}

function parseFilePathParts(
  filePath: string,
  config: ForbiddenImportsConfig,
): PathParts | null {
  const cache = getConfigCache(config);
  if (cache.filePartsCache.has(filePath)) {
    return cache.filePartsCache.get(filePath) ?? null;
  }

  const relativePath = getRelativePathFromRoot(filePath);
  let result: PathParts | null = null;

  if (relativePath) {
    const segments = relativePath.split("/").filter(Boolean);
    const firstDir = segments[0];
    if (firstDir) {
      let layer: string | null = null;

      if (cache.folderPatternRegex) {
        const match = firstDir.match(cache.folderPatternRegex);
        const extracted = match?.[config.folderPattern.extractionGroup];
        if (extracted) {
          layer = cache.segmentToLayer.get(extracted) ?? null;
        }
      }

      if (!layer) {
        layer = cache.segmentToLayer.get(firstDir) ?? null;
      }

      if (layer) {
        result = { segments, layer, layerIndex: 0 };
      }
    }
  }

  cache.filePartsCache.set(filePath, result);
  return result;
}

export function extractLayerFromImportPath(
  importPath: string,
  config: ForbiddenImportsConfig,
): string | null {
  return parseImportPathParts(importPath, config)?.layer ?? null;
}

export function extractLayerFromPath(
  filePath: string,
  config: ForbiddenImportsConfig,
): string | null {
  return parseFilePathParts(filePath, config)?.layer ?? null;
}

export function extractSliceFromPath(
  filePath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const parts = parseFilePathParts(filePath, config);
  if (!parts || parts.layerIndex < 0) return null;
  return parts.segments[parts.layerIndex + 1] ?? null;
}

export function extractSegmentFromPath(
  filePath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const parts = parseFilePathParts(filePath, config);
  if (!parts || parts.layerIndex < 0) return null;
  return parts.segments[parts.layerIndex + 2] ?? null;
}

export function extractSliceFromImportPath(
  importPath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const parts = parseImportPathParts(importPath, config);
  if (!parts || parts.segments.length < 2) return null;
  return parts.segments[parts.layerIndex + 1] ?? null;
}

export function extractSegmentFromImportPath(
  importPath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const parts = parseImportPathParts(importPath, config);
  if (!parts) return null;
  return parts.segments[parts.layerIndex + 2] ?? null;
}

export function isCrossImportPublicApiPath(
  resolvedPath: string,
  sourceSlice: string,
  config: ForbiddenImportsConfig,
): boolean {
  const relativePath = getRelativePathFromRoot(resolvedPath);
  if (!relativePath) return false;

  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length < 4) return false;

  const firstSegment = segments[0];
  if (!firstSegment || !config.layers[firstSegment]) return false;

  return segments[2] === "@x" && segments[3] === sourceSlice;
}

export function isCrossImportPublicApiImportPath(
  importPath: string,
  sourceSlice: string,
  config: ForbiddenImportsConfig,
): boolean {
  const parts = parseImportPathParts(importPath, config);
  if (!parts) return false;
  return (
    parts.segments[parts.layerIndex + 2] === "@x" &&
    parts.segments[parts.layerIndex + 3] === sourceSlice
  );
}

export function isSharedPublicApiPath(
  resolvedPath: string,
  allowedSegments: readonly string[] | "*" = "*",
): boolean {
  const relativePath = getRelativePathFromRoot(resolvedPath);
  if (!relativePath) {
    return false;
  }

  const segments = relativePath.split("/").filter(Boolean);
  if (segments[0] !== "shared") {
    return false;
  }

  const segment = segments[1];
  if (!segment) return false;
  if (allowedSegments !== "*" && !allowedSegments.includes(segment)) {
    return false;
  }

  const rest = segments.slice(2);
  if (rest.length === 1) {
    return /^index\.[^.]+$/.test(rest[0] ?? "");
  }

  if (rest.length === 2) {
    return /^index\.[^.]+$/.test(rest[1] ?? "");
  }

  return false;
}

export function getSliceBoundary(
  filePath: string,
  options: NoRelativeImportsOptions,
): SliceBoundary | null {
  const normalizedPath = normalizePath(filePath);
  const sourceRootIndex = normalizedPath.lastIndexOf("/src/");

  if (sourceRootIndex === -1) {
    return null;
  }

  const sourceRelativePath = normalizedPath.slice(sourceRootIndex + 5);
  const segments = sourceRelativePath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const layers = new Set(options.layers ?? DEFAULT_FSD_LAYERS);
  const singleLayerModules = new Set(
    options.singleLayerModules ?? DEFAULT_SINGLE_LAYER_MODULES,
  );

  const layer = segments[0];
  if (!layer || !layers.has(layer)) {
    return null;
  }

  if (singleLayerModules.has(layer)) {
    return { layer, slice: null };
  }

  const slice = segments[1];
  if (!slice) {
    return null;
  }

  return { layer, slice };
}

export function resolveRelativeImport(
  currentFilePath: string,
  importPath: string,
): string {
  const normalizedFilePath = normalizePath(currentFilePath);
  const currentDir = path.posix.dirname(normalizedFilePath);
  return normalizePath(path.posix.resolve(currentDir, importPath));
}

export function isSameSliceImport(
  currentFilePath: string,
  importPath: string,
  options: NoRelativeImportsOptions,
): boolean {
  const currentBoundary = getSliceBoundary(currentFilePath, options);
  if (!currentBoundary) {
    return false;
  }

  const resolvedImportPath = resolveRelativeImport(currentFilePath, importPath);
  const targetBoundary = getSliceBoundary(resolvedImportPath, options);

  if (!targetBoundary) {
    return false;
  }

  return (
    currentBoundary.layer === targetBoundary.layer &&
    currentBoundary.slice === targetBoundary.slice
  );
}
