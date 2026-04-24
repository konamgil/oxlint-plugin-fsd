import type { NoCrossSliceDependencyOptions } from "../types.js";
import { mergeNoCrossSliceDependencyConfig } from "../utils/config.js";
import { createImportRule } from "../utils/create-import-rule.js";
import {
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSliceFromImportPath,
  extractSliceFromPath,
  getSliceBoundary,
  isCrossImportPublicApiImportPath,
  isCrossImportPublicApiPath,
  isRelativeImportPath,
  resolveRelativeImport,
} from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "noFeatureDependency" | "noSliceDependency";

export const noCrossSliceDependencyRule = createImportRule<
  NoCrossSliceDependencyOptions,
  ReturnType<typeof mergeNoCrossSliceDependencyConfig>
>({
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
  mergeConfig: mergeNoCrossSliceDependencyConfig,
  shouldSkipFile({ config, filePath }) {
    const fromLayer = extractLayerFromPath(filePath, config);
    if (!fromLayer) return true;

    const excludedLayers = new Set(["shared", ...config.excludeLayers]);
    if (excludedLayers.has(fromLayer)) return true;

    if (config.featuresOnly && fromLayer !== "features") return true;

    const fromSlice = extractSliceFromPath(filePath, config);
    return !fromSlice;
  },
  checkImport({ context, config, filePath, node, importPath }) {
    const fromLayer = extractLayerFromPath(filePath, config);
    const fromSlice = extractSliceFromPath(filePath, config);
    if (!fromLayer || !fromSlice) return;

    const reportDependency = (toSlice: string): void => {
      if (toSlice === fromSlice) return;

      if (fromLayer === "features" || config.featuresOnly) {
        context.report({
          node,
          messageId: "noFeatureDependency" satisfies MessageIds,
          data: { fromFeature: fromSlice, toFeature: toSlice },
        });
        return;
      }

      context.report({
        node,
        messageId: "noSliceDependency" satisfies MessageIds,
        data: { layer: fromLayer, fromSlice, toSlice },
      });
    };

    if (isRelativeImportPath(importPath)) {
      const resolvedImportPath = resolveRelativeImport(filePath, importPath);
      const targetBoundary = getSliceBoundary(resolvedImportPath, {
        layers: Object.keys(config.layers),
        singleLayerModules: ["app", "shared"],
      });
      if (
        !targetBoundary ||
        targetBoundary.layer !== fromLayer ||
        !targetBoundary.slice ||
        targetBoundary.slice === fromSlice
      ) {
        return;
      }
      reportDependency(targetBoundary.slice);
      return;
    }

    const resolvedImportPath = resolveImportPath(importPath, filePath);
    const toLayer =
      (resolvedImportPath ? extractLayerFromPath(resolvedImportPath, config) : null) ??
      extractLayerFromImportPath(importPath, config);
    if (toLayer !== fromLayer) return;

    const toSlice =
      (resolvedImportPath ? extractSliceFromPath(resolvedImportPath, config) : null) ??
      extractSliceFromImportPath(importPath, config);
    if (!toSlice || toSlice === fromSlice) return;

    if (isCrossImportPublicApiImportPath(importPath, fromSlice, config)) return;
    if (resolvedImportPath && isCrossImportPublicApiPath(resolvedImportPath, fromSlice, config)) {
      return;
    }

    reportDependency(toSlice);
  },
});
