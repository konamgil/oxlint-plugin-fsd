import type { Context, ESTree, Rule } from "@oxlint/plugins";
import path from "node:path";

import type { NoPublicApiSidestepOptions } from "../types.js";
import { mergeNoPublicApiSidestepConfig } from "../utils/config.js";
import { getRuleOptions } from "../utils/options.js";
import {
  compileRegexList,
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSegmentFromPath,
  extractSliceFromPath,
  getRelativePathFromRoot,
  isCrossImportPublicApiImportPath,
  isRelativeImportPath,
  isCrossImportPublicApiPath,
  matchesAnyRegex,
  normalizePath,
} from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "noDirectImport";

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

function isPublicApiImport(
  importPath: string,
  importLayer: string,
  publicApiFiles: readonly string[],
  resolvedImportPath: string | null,
): boolean {
  const publicApiFileNames = new Set(
    publicApiFiles.flatMap((apiFile) => [apiFile, apiFile.replace(/\.[^.]+$/, "")]),
  );
  const isIndexLikeFileName = (value: string): boolean =>
    publicApiFileNames.has(value) || /^index(?:\.[^.]+)?\.[^.]+$/.test(value);

  if (resolvedImportPath) {
    const relativePath = getRelativePathFromRoot(resolvedImportPath);
    if (relativePath) {
      const resolvedSegments = relativePath.split("/").filter(Boolean);

      if (importLayer === "shared" && (resolvedSegments[1] === "ui" || resolvedSegments[1] === "lib")) {
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

  const isSliceRootImport = pathParts.length === layerIndex + 2;
  return isSliceRootImport;
}

export const noPublicApiSidestepRule: Rule = {
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
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let config = mergeNoPublicApiSidestepConfig();
    let testFileRegexes = compileRegexList(config.testFilesPatterns);
    let ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);

    let filePath = "";
    let shouldRunOnFile = false;

    function reportIfSidestep(importPath: string, node: ESTree.Node): void {
      if (!shouldRunOnFile) {
        return;
      }

      if (isRelativeImportPath(importPath) || matchesAnyRegex(importPath, ignoredImportRegexes)) {
        return;
      }

      const resolvedImportPath = resolveImportPath(importPath, filePath);
      const importLayer =
        (resolvedImportPath ? extractLayerFromPath(resolvedImportPath, config) : null) ??
        extractLayerFromImportPath(importPath, config);
      if (!importLayer || !config.restrictedLayers.includes(importLayer)) {
        return;
      }

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

      if (isPublicApiImport(importPath, importLayer, config.publicApiFiles, resolvedImportPath)) {
        return;
      }

      context.report({
        node,
        messageId: "noDirectImport" satisfies MessageIds,
        data: {
          importPath,
        },
      });
    }

    return {
      before() {
        const options = getRuleOptions<NoPublicApiSidestepOptions>(context);
        config = mergeNoPublicApiSidestepConfig(options);
        testFileRegexes = compileRegexList(config.testFilesPatterns);
        ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
        filePath = getFilename(context);
        shouldRunOnFile = !matchesAnyRegex(filePath, testFileRegexes);
        return shouldRunOnFile;
      },
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (config.allowTypeImports && node.importKind === "type") {
          return;
        }

        if (typeof node.source.value === "string") {
          reportIfSidestep(node.source.value, node);
        }
      },
      ImportExpression(node: ESTree.ImportExpression) {
        const source = node.source;
        if (source.type === "Literal" && typeof source.value === "string") {
          reportIfSidestep(source.value, source);
        }
      },
    };
  },
};
