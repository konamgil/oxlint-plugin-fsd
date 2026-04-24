import type { NoRelativeImportsOptions } from "../types.js";
import { createImportRule } from "../utils/create-import-rule.js";
import {
  getSliceBoundary,
  isRelativeImportPath,
  isSameSliceImport,
} from "../utils/path.js";

type MessageIds = "noRelativeImport";

interface NoRelativeImportsConfig {
  readonly allowSameSlice: boolean;
  readonly allowTypeImports: boolean;
  readonly testFilesPatterns: readonly string[];
  readonly ignoreImportPatterns: readonly string[];
  readonly layers: readonly string[] | undefined;
  readonly singleLayerModules: readonly string[] | undefined;
}

function mergeNoRelativeImportsConfig(
  options: NoRelativeImportsOptions = {},
): NoRelativeImportsConfig {
  return {
    allowSameSlice: options.allowSameSlice ?? true,
    allowTypeImports: options.allowTypeImports ?? false,
    testFilesPatterns: options.testFilesPatterns ?? [],
    ignoreImportPatterns: options.ignoreImportPatterns ?? [],
    layers: options.layers,
    singleLayerModules: options.singleLayerModules,
  };
}

export const noRelativeImportsRule = createImportRule<
  NoRelativeImportsOptions,
  NoRelativeImportsConfig
>({
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent relative imports that cross slice boundaries in Feature-Sliced Design.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowSameSlice: { type: "boolean" },
          allowTypeImports: { type: "boolean" },
          testFilesPatterns: {
            type: "array",
            items: { type: "string" },
          },
          ignoreImportPatterns: {
            type: "array",
            items: { type: "string" },
          },
          layers: {
            type: "array",
            items: { type: "string" },
          },
          singleLayerModules: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRelativeImport:
        "Relative imports cannot cross slice boundaries. Use an absolute import through the slice public API instead.",
    },
  },
  mergeConfig: mergeNoRelativeImportsConfig,
  shouldSkipFile({ config, filePath }) {
    return (
      getSliceBoundary(filePath, {
        layers: config.layers ? [...config.layers] : undefined,
        singleLayerModules: config.singleLayerModules
          ? [...config.singleLayerModules]
          : undefined,
      }) === null
    );
  },
  checkImport({ context, config, filePath, node, importPath, isTypeImport }) {
    if (!isRelativeImportPath(importPath)) return;
    if (config.allowTypeImports && isTypeImport) return;
    if (
      config.allowSameSlice &&
      isSameSliceImport(filePath, importPath, {
        layers: config.layers ? [...config.layers] : undefined,
        singleLayerModules: config.singleLayerModules
          ? [...config.singleLayerModules]
          : undefined,
      })
    ) {
      return;
    }

    context.report({
      node,
      messageId: "noRelativeImport" satisfies MessageIds,
    });
  },
});
