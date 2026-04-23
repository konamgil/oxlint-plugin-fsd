import type { Context, ESTree, Rule } from "@oxlint/plugins";

import type { NoCrossSliceDependencyOptions } from "../types.js";
import { mergeNoCrossSliceDependencyConfig } from "../utils/config.js";
import { getRuleOptions } from "../utils/options.js";
import {
  compileRegexList,
  isCrossImportPublicApiImportPath,
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSliceFromImportPath,
  extractSliceFromPath,
  getSliceBoundary,
  isRelativeImportPath,
  isCrossImportPublicApiPath,
  matchesAnyRegex,
  normalizePath,
  resolveRelativeImport,
} from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "noFeatureDependency" | "noSliceDependency";

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

export const noCrossSliceDependencyRule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent direct imports between slices in the same FSD layer.",
      recommended: true,
    },
    messages: {
      noFeatureDependency:
        "'{{ fromFeature }}' cannot directly import from '{{ toFeature }}'. Use shared or entities instead.",
      noSliceDependency:
        "'{{ fromSlice }}' slice in {{ layer }} layer cannot directly import from '{{ toSlice }}' slice.",
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
            type: "object",
            additionalProperties: {
              type: "object",
              properties: {
                pattern: { type: "string" },
                priority: { type: "number" },
                allowedToImport: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              additionalProperties: false,
            },
          },
          folderPattern: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              regex: { type: "string" },
              extractionGroup: { type: "number" },
            },
            additionalProperties: false,
          },
          featuresOnly: { type: "boolean" },
          excludeLayers: {
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
          allowTypeImports: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let config = mergeNoCrossSliceDependencyConfig();
    let testFileRegexes = compileRegexList(config.testFilesPatterns);
    let ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
    let excludedLayers = new Set(["shared", ...config.excludeLayers]);

    let filePath = "";
    let fromLayer: string | null = null;
    let fromSlice: string | null = null;
    let shouldRunOnFile = false;

    function reportSliceDependency(node: ESTree.Node, toSlice: string): void {
      if (!fromLayer || !fromSlice || toSlice === fromSlice) {
        return;
      }

      if (fromLayer === "features" || config.featuresOnly) {
        context.report({
          node,
          messageId: "noFeatureDependency" satisfies MessageIds,
          data: {
            fromFeature: fromSlice,
            toFeature: toSlice,
          },
        });
        return;
      }

      context.report({
        node,
        messageId: "noSliceDependency" satisfies MessageIds,
        data: {
          layer: fromLayer,
          fromSlice,
          toSlice,
        },
      });
    }

    function reportAbsoluteImport(node: ESTree.Node, importPath: string): void {
      if (!fromLayer || !fromSlice) {
        return;
      }

      const resolvedImportPath = resolveImportPath(importPath, filePath);
      const toLayer =
        (resolvedImportPath ? extractLayerFromPath(resolvedImportPath, config) : null) ??
        extractLayerFromImportPath(importPath, config);
      if (toLayer !== fromLayer) {
        return;
      }

      const toSlice =
        (resolvedImportPath ? extractSliceFromPath(resolvedImportPath, config) : null) ??
        extractSliceFromImportPath(importPath, config);
      if (!toSlice || toSlice === fromSlice) {
        return;
      }

      if (isCrossImportPublicApiImportPath(importPath, fromSlice, config)) {
        return;
      }

      if (
        resolvedImportPath &&
        isCrossImportPublicApiPath(resolvedImportPath, fromSlice, config)
      ) {
        return;
      }

      reportSliceDependency(node, toSlice);
    }

    function reportRelativeImport(node: ESTree.Node, importPath: string): void {
      if (!fromLayer || !fromSlice) {
        return;
      }

      const resolvedImportPath = resolveRelativeImport(filePath, importPath);
      const targetBoundary = getSliceBoundary(resolvedImportPath, {
        layers: Object.keys(config.layers),
        singleLayerModules: ["app", "shared"],
      });

      if (!targetBoundary || targetBoundary.layer !== fromLayer || !targetBoundary.slice) {
        return;
      }

      if (targetBoundary.slice === fromSlice) {
        return;
      }

      reportSliceDependency(node, targetBoundary.slice);
    }

    function handleImport(node: ESTree.Node, importPath: string): void {
      if (!shouldRunOnFile || matchesAnyRegex(importPath, ignoredImportRegexes)) {
        return;
      }

      if (isRelativeImportPath(importPath)) {
        reportRelativeImport(node, importPath);
        return;
      }

      reportAbsoluteImport(node, importPath);
    }

    return {
      before() {
        const options = getRuleOptions<NoCrossSliceDependencyOptions>(context);
        config = mergeNoCrossSliceDependencyConfig(options);
        testFileRegexes = compileRegexList(config.testFilesPatterns);
        ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
        excludedLayers = new Set(["shared", ...config.excludeLayers]);
        filePath = getFilename(context);
        if (matchesAnyRegex(filePath, testFileRegexes)) {
          shouldRunOnFile = false;
          return false;
        }

        fromLayer = extractLayerFromPath(filePath, config);
        if (!fromLayer || excludedLayers.has(fromLayer)) {
          shouldRunOnFile = false;
          return false;
        }

        if (config.featuresOnly && fromLayer !== "features") {
          shouldRunOnFile = false;
          return false;
        }

        fromSlice = extractSliceFromPath(filePath, config);
        shouldRunOnFile = Boolean(fromSlice);
        return shouldRunOnFile;
      },
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (config.allowTypeImports && node.importKind === "type") {
          return;
        }

        if (typeof node.source.value === "string") {
          handleImport(node, node.source.value);
        }
      },
      ImportExpression(node: ESTree.ImportExpression) {
        const source = node.source;
        if (source.type === "Literal" && typeof source.value === "string") {
          handleImport(source, source.value);
        }
      },
    };
  },
};
