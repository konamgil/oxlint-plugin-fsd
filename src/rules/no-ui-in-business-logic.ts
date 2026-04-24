import type { NoUiInBusinessLogicOptions } from "../types.js";
import { mergeNoUiInBusinessLogicConfig } from "../utils/config.js";
import { createImportRule } from "../utils/create-import-rule.js";
import {
  extractSegmentFromImportPath,
  extractSegmentFromPath,
  isRelativeImportPath,
  resolveRelativeImport,
} from "../utils/path.js";

type MessageIds = "noUiInBusinessLogic";

export const noUiInBusinessLogicRule = createImportRule<
  NoUiInBusinessLogicOptions,
  ReturnType<typeof mergeNoUiInBusinessLogicConfig>
>({
  meta: {
    type: "problem",
    docs: {
      description: "Prevent UI imports inside business-logic segments such as model, api, or lib.",
      recommended: true,
    },
    messages: {
      noUiInBusinessLogic:
        "UI components cannot be imported in business logic layers (model, api, lib).",
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
          testFilesPatterns: {
            type: "array",
            items: { type: "string" },
          },
          ignoreImportPatterns: {
            type: "array",
            items: { type: "string" },
          },
          allowTypeImports: { type: "boolean" },
          uiLayers: {
            type: "array",
            items: { type: "string" },
          },
          businessLogicLayers: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  mergeConfig: mergeNoUiInBusinessLogicConfig,
  shouldSkipFile({ config, filePath }) {
    const currentSegment = extractSegmentFromPath(filePath, config);
    if (!currentSegment) return true;
    return !config.businessLogicLayers.includes(currentSegment);
  },
  checkImport({ context, config, filePath, node, importPath }) {
    const uiLayers = new Set(config.uiLayers);

    const isUiImport = (): boolean => {
      if (isRelativeImportPath(importPath)) {
        const resolvedImportPath = resolveRelativeImport(filePath, importPath);
        const targetSegment = extractSegmentFromPath(resolvedImportPath, config);
        return targetSegment !== null && uiLayers.has(targetSegment);
      }

      const absoluteImport: string = importPath;
      const targetSegment = extractSegmentFromImportPath(absoluteImport, config);
      if (targetSegment && uiLayers.has(targetSegment)) return true;

      for (const segment of config.uiLayers) {
        if (absoluteImport.includes(`/${segment}/`)) return true;
      }
      return false;
    };

    if (!isUiImport()) return;

    context.report({
      node,
      messageId: "noUiInBusinessLogic" satisfies MessageIds,
    });
  },
});
