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

function globToRegex(pattern: string): RegExp {
  const normalizedPattern = normalizePath(pattern);
  const placeholder = "__DOUBLE_STAR__";
  const escaped = escapeRegex(normalizedPattern.replace(/\*\*/g, placeholder))
    .replace(new RegExp(placeholder, "g"), ".*")
    .replace(/\\\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
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
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern);
    } catch {
      return globToRegex(pattern);
    }
  });
}

export function matchesAnyRegex(value: string, regexes: readonly RegExp[]): boolean {
  return regexes.some((regex) => regex.test(value));
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

export function extractLayerFromImportPath(
  importPath: string,
  config: ForbiddenImportsConfig,
): string | null {
  if (isRelativeImportPath(importPath)) {
    return null;
  }

  const normalizedPath = normalizePath(importPath);
  const aliasPatterns = [
    config.alias.withSlash ? `${config.alias.value}/` : config.alias.value,
    `${config.alias.value}/`,
  ];
  const matchingPattern = aliasPatterns.find((pattern) => normalizedPath.startsWith(pattern));

  if (!matchingPattern) {
    return null;
  }

  let pathWithoutAlias = normalizedPath.slice(matchingPattern.length);
  if (pathWithoutAlias.startsWith("/")) {
    pathWithoutAlias = pathWithoutAlias.slice(1);
  }

  const firstSegment = pathWithoutAlias.split("/")[0];
  if (!firstSegment) {
    return null;
  }

  return (
    Object.keys(config.layers).find(
      (layer) =>
        layer === firstSegment || config.layers[layer]?.pattern === firstSegment,
    ) ?? null
  );
}

export function extractLayerFromPath(
  filePath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const relativePath = getRelativePathFromRoot(filePath);
  if (!relativePath) {
    return null;
  }

  const firstDir = relativePath.split("/")[0];
  if (!firstDir) {
    return null;
  }

  if (config.folderPattern.enabled) {
    const regex = new RegExp(config.folderPattern.regex);
    const match = firstDir.match(regex);
    const extracted = match?.[config.folderPattern.extractionGroup];
    if (extracted) {
      return (
        Object.keys(config.layers).find(
          (layer) =>
            layer === extracted || config.layers[layer]?.pattern === extracted,
        ) ?? null
      );
    }
  }

  return (
    Object.keys(config.layers).find(
      (layer) => layer === firstDir || config.layers[layer]?.pattern === firstDir,
    ) ?? null
  );
}

export function extractSliceFromPath(
  filePath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const relativePath = getRelativePathFromRoot(filePath);
  if (!relativePath) {
    return null;
  }

  const segments = relativePath.split("/").filter(Boolean);
  const layer = extractLayerFromPath(filePath, config);

  if (!layer) {
    return null;
  }

  const layerIndex = segments.findIndex(
    (segment) => segment === layer || config.layers[layer]?.pattern === segment,
  );
  if (layerIndex < 0) {
    return null;
  }

  return segments[layerIndex + 1] ?? null;
}

export function extractSegmentFromPath(
  filePath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const relativePath = getRelativePathFromRoot(filePath);
  if (!relativePath) {
    return null;
  }

  const segments = relativePath.split("/").filter(Boolean);
  const layer = extractLayerFromPath(filePath, config);
  if (!layer) {
    return null;
  }

  const layerIndex = segments.findIndex(
    (segment) => segment === layer || config.layers[layer]?.pattern === segment,
  );
  if (layerIndex < 0) {
    return null;
  }

  return segments[layerIndex + 2] ?? null;
}

export function extractSliceFromImportPath(
  importPath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const normalizedPath = normalizePath(importPath);
  const layer = extractLayerFromImportPath(normalizedPath, config);

  if (!layer) {
    return null;
  }

  const aliasPatterns = [
    config.alias.withSlash ? `${config.alias.value}/` : config.alias.value,
    `${config.alias.value}/`,
  ];
  const matchingPattern = aliasPatterns.find((pattern) => normalizedPath.startsWith(pattern));
  if (!matchingPattern) {
    return null;
  }

  let pathWithoutAlias = normalizedPath.slice(matchingPattern.length);
  if (pathWithoutAlias.startsWith("/")) {
    pathWithoutAlias = pathWithoutAlias.slice(1);
  }

  const segments = pathWithoutAlias.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const layerIndex = segments.findIndex(
    (segment) => segment === layer || config.layers[layer]?.pattern === segment,
  );
  if (layerIndex < 0) {
    return null;
  }

  return segments[layerIndex + 1] ?? null;
}

export function extractSegmentFromImportPath(
  importPath: string,
  config: ForbiddenImportsConfig,
): string | null {
  const normalizedPath = normalizePath(importPath);
  const layer = extractLayerFromImportPath(normalizedPath, config);
  if (!layer) {
    return null;
  }

  const aliasPatterns = [
    config.alias.withSlash ? `${config.alias.value}/` : config.alias.value,
    `${config.alias.value}/`,
  ];
  const matchingPattern = aliasPatterns.find((pattern) => normalizedPath.startsWith(pattern));
  if (!matchingPattern) {
    return null;
  }

  let pathWithoutAlias = normalizedPath.slice(matchingPattern.length);
  if (pathWithoutAlias.startsWith("/")) {
    pathWithoutAlias = pathWithoutAlias.slice(1);
  }

  const segments = pathWithoutAlias.split("/").filter(Boolean);
  const layerIndex = segments.findIndex(
    (segment) => segment === layer || config.layers[layer]?.pattern === segment,
  );
  if (layerIndex < 0) {
    return null;
  }

  return segments[layerIndex + 2] ?? null;
}

export function isCrossImportPublicApiPath(
  resolvedPath: string,
  sourceSlice: string,
  config: ForbiddenImportsConfig,
): boolean {
  const relativePath = getRelativePathFromRoot(resolvedPath);
  if (!relativePath) {
    return false;
  }

  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length < 4) {
    return false;
  }

  const layer = segments[0];
  if (!layer || !config.layers[layer]) {
    return false;
  }

  return segments[2] === "@x" && segments[3] === sourceSlice;
}

export function isCrossImportPublicApiImportPath(
  importPath: string,
  sourceSlice: string,
  config: ForbiddenImportsConfig,
): boolean {
  const normalizedPath = normalizePath(importPath);
  const layer = extractLayerFromImportPath(normalizedPath, config);
  if (!layer) {
    return false;
  }

  const aliasPatterns = [
    config.alias.withSlash ? `${config.alias.value}/` : config.alias.value,
    `${config.alias.value}/`,
  ];
  const matchingPattern = aliasPatterns.find((pattern) => normalizedPath.startsWith(pattern));
  if (!matchingPattern) {
    return false;
  }

  let pathWithoutAlias = normalizedPath.slice(matchingPattern.length);
  if (pathWithoutAlias.startsWith("/")) {
    pathWithoutAlias = pathWithoutAlias.slice(1);
  }

  const segments = pathWithoutAlias.split("/").filter(Boolean);
  const layerIndex = segments.findIndex(
    (segment) => segment === layer || config.layers[layer]?.pattern === segment,
  );
  if (layerIndex < 0) {
    return false;
  }

  return segments[layerIndex + 2] === "@x" && segments[layerIndex + 3] === sourceSlice;
}

export function isSharedPublicApiPath(
  resolvedPath: string,
  _config: ForbiddenImportsConfig,
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
  if (!segment || !["ui", "lib"].includes(segment)) {
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
