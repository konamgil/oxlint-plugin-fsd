import type { Context, ESTree, Rule } from "@oxlint/plugins";

import type { NoUiInBusinessLogicOptions } from "../types.js";
import { mergeNoUiInBusinessLogicConfig } from "../utils/config.js";
import { getRuleOptions } from "../utils/options.js";
import {
  compileRegexList,
  extractSegmentFromImportPath,
  extractSegmentFromPath,
  isRelativeImportPath,
  matchesAnyRegex,
  normalizePath,
  resolveRelativeImport,
} from "../utils/path.js";

type MessageIds = "noUiInBusinessLogic";

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

export const noUiInBusinessLogicRule: Rule = {
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
  createOnce(context) {
    let config = mergeNoUiInBusinessLogicConfig();
    let testFileRegexes = compileRegexList(config.testFilesPatterns);
    let ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
    let uiLayers = new Set(config.uiLayers);
    let businessLogicLayers = new Set(config.businessLogicLayers);

    let filePath = "";
    let shouldRunOnFile = false;

    function isUiImport(importPath: string): boolean {
      const importText = `${importPath}`;

      if (isRelativeImportPath(importPath)) {
        const resolvedImportPath = resolveRelativeImport(filePath, importText);
        const targetSegment = extractSegmentFromPath(resolvedImportPath, config);
        return targetSegment !== null && uiLayers.has(targetSegment);
      }

      const targetSegment = extractSegmentFromImportPath(importText, config);
      if (targetSegment && uiLayers.has(targetSegment)) {
        return true;
      }

      for (const segment of config.uiLayers) {
        if (importText.includes(`/${segment}/`)) {
          return true;
        }
      }

      return false;
    }

    function handleImport(node: ESTree.Node, importPath: string): void {
      if (
        !shouldRunOnFile ||
        matchesAnyRegex(importPath, ignoredImportRegexes) ||
        !isUiImport(importPath)
      ) {
        return;
      }

      context.report({
        node,
        messageId: "noUiInBusinessLogic" satisfies MessageIds,
      });
    }

    return {
      before() {
        const options = getRuleOptions<NoUiInBusinessLogicOptions>(context);
        config = mergeNoUiInBusinessLogicConfig(options);
        testFileRegexes = compileRegexList(config.testFilesPatterns);
        ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
        uiLayers = new Set(config.uiLayers);
        businessLogicLayers = new Set(config.businessLogicLayers);
        filePath = getFilename(context);
        if (matchesAnyRegex(filePath, testFileRegexes)) {
          shouldRunOnFile = false;
          return false;
        }

        const currentSegment = extractSegmentFromPath(filePath, config);
        shouldRunOnFile = currentSegment !== null && businessLogicLayers.has(currentSegment);
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
