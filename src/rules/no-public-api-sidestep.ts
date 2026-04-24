import path from "node:path";

import type { NoPublicApiSidestepOptions } from "../types.js";
import { mergeNoPublicApiSidestepConfig } from "../utils/config.js";
import { createImportRule } from "../utils/create-import-rule.js";
import {
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSegmentFromPath,
  extractSliceFromPath,
  getRelativePathFromRoot,
  isCrossImportPublicApiImportPath,
  isCrossImportPublicApiPath,
  isRelativeImportPath,
  normalizePath,
} from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "noDirectImport";

const publicApiNameSetCache = new WeakMap<readonly string[], Set<string>>();

function getPublicApiNameSet(publicApiFiles: readonly string[]): Set<string> {
  let cached = publicApiNameSetCache.get(publicApiFiles);
  if (!cached) {
    cached = new Set(
      publicApiFiles.flatMap((apiFile) => [apiFile, apiFile.replace(/\.[^.]+$/, "")]),
    );
    publicApiNameSetCache.set(publicApiFiles, cached);
  }
  return cached;
}

function isPublicApiImport(
  importPath: string,
  importLayer: string,
  publicApiFiles: readonly string[],
  resolvedImportPath: string | null,
  sharedPublicApiSegments: readonly string[] | "*",
): boolean {
  const publicApiFileNames = getPublicApiNameSet(publicApiFiles);
  const isIndexLikeFileName = (value: string): boolean =>
    publicApiFileNames.has(value) || /^index(?:\.[^.]+)?\.[^.]+$/.test(value);

  const isAllowedSharedSegment = (segment: string | undefined): boolean => {
    if (!segment) return false;
    if (sharedPublicApiSegments === "*") return true;
    return sharedPublicApiSegments.includes(segment);
  };

  if (resolvedImportPath) {
    const relativePath = getRelativePathFromRoot(resolvedImportPath);
    if (relativePath) {
      const resolvedSegments = relativePath.split("/").filter(Boolean);

      if (importLayer === "shared" && isAllowedSharedSegment(resolvedSegments[1])) {
        const withinSegment = resolvedSegments.slice(2);
        if (withinSegment.length === 1) {
          return isIndexLikeFileName(withinSegment[0] ?? "");
        }

        if (withinSegment.length === 2) {
          return isIndexLikeFileName(withinSegment[1] ?? "");
        }

        return false;
      }

      const targetSlice = resolvedSegments[1] ?? null;
      const afterSlice = resolvedSegments.slice(2);
      if (targetSlice !== null) {
        return afterSlice.length === 1 && isIndexLikeFileName(afterSlice[0] ?? "");
      }
    }
  }

  const normalizedImportPath = normalizePath(importPath);
  const specifierTail = path.posix.basename(normalizedImportPath);
  const hasExplicitPublicApiFile = isIndexLikeFileName(specifierTail);

  if (hasExplicitPublicApiFile) {
    return true;
  }

  const pathParts = normalizedImportPath.split("/").filter(Boolean);
  const layerIndex = pathParts.findIndex((part) => {
    const normalizedPart = normalizePath(part);
    return normalizedPart === importLayer || normalizedPart.includes(importLayer);
  });

  if (layerIndex < 0) {
    return false;
  }

  if (importLayer === "shared") {
    return pathParts.length === layerIndex + 2;
  }

  return pathParts.length === layerIndex + 2;
}

export const noPublicApiSidestepRule = createImportRule<
  NoPublicApiSidestepOptions,
  ReturnType<typeof mergeNoPublicApiSidestepConfig>
>({
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent direct imports from internal files and force imports through slice public APIs.",
      recommended: true,
    },
    messages: {
      noDirectImport:
        "Direct import from '{{ importPath }}' is not allowed. Use the public API instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          alias: {
            oneOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  value: { type: "string" },
                  withSlash: { type: "boolean" },
                },
                required: ["value"],
                additionalProperties: false,
              },
            ],
          },
          layers: {
            type: "array",
            items: { type: "string" },
          },
          publicApiFiles: {
            type: "array",
            items: { type: "string" },
          },
          testFilesPatterns: {
            type: "array",
            items: { type: "string" },
          },
          ignoreImportPatterns: {
            type: "array",
            items: { type: "string" },
          },
          allowTypeImports: {
            type: "boolean",
          },
          sharedPublicApiSegments: {
            oneOf: [
              { type: "string", enum: ["*"] },
              { type: "array", items: { type: "string" } },
            ],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  mergeConfig: mergeNoPublicApiSidestepConfig,
  checkImport({ context, config, filePath, node, importPath }) {
    if (isRelativeImportPath(importPath)) return;

    const resolvedImportPath = resolveImportPath(importPath, filePath);
    const importLayer =
      (resolvedImportPath ? extractLayerFromPath(resolvedImportPath, config) : null) ??
      extractLayerFromImportPath(importPath, config);
    if (!importLayer || !config.restrictedLayers.includes(importLayer)) return;

    const sourceLayer = extractLayerFromPath(filePath, config);
    const sourceSlice = extractSliceFromPath(filePath, config);
    if (
      sourceLayer === importLayer &&
      sourceSlice &&
      isCrossImportPublicApiImportPath(importPath, sourceSlice, config)
    ) {
      return;
    }

    if (resolvedImportPath) {
      const targetSlice = extractSliceFromPath(resolvedImportPath, config);
      const targetSegment = extractSegmentFromPath(resolvedImportPath, config);

      if (
        sourceLayer === importLayer &&
        sourceSlice &&
        targetSlice &&
        sourceSlice !== targetSlice &&
        isCrossImportPublicApiPath(resolvedImportPath, sourceSlice, config)
      ) {
        return;
      }

      if (
        targetSegment &&
        (targetSegment === "@x" ||
          (sourceLayer === importLayer && sourceSlice !== null && sourceSlice === targetSlice))
      ) {
        return;
      }
    }

    if (
      isPublicApiImport(
        importPath,
        importLayer,
        config.publicApiFiles,
        resolvedImportPath,
        config.sharedPublicApiSegments,
      )
    ) {
      return;
    }

    context.report({
      node,
      messageId: "noDirectImport" satisfies MessageIds,
      data: { importPath },
    });
  },
});
