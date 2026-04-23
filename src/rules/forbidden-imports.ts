import type { Context, ESTree, Rule } from "@oxlint/plugins";

import type { ForbiddenImportsOptions } from "../types.js";
import { mergeForbiddenImportsConfig } from "../utils/config.js";
import { getRuleOptions } from "../utils/options.js";
import {
  compileRegexList,
  isCrossImportPublicApiImportPath,
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSliceFromPath,
  matchesAnyRegex,
  normalizePath,
  isCrossImportPublicApiPath,
} from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "invalidImport";

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

export const forbiddenImportsRule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent imports from higher FSD layers or otherwise forbidden layer dependencies.",
      recommended: true,
    },
    messages: {
      invalidImport:
        "'{{ fromLayer }}' layer cannot import from '{{ toLayer }}' layer. Allowed imports: {{ allowedLayers }}",
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
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let config = mergeForbiddenImportsConfig();
    let testFileRegexes = compileRegexList(config.testFilesPatterns);
    let ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);

    let filePath = "";
    let fromLayer: string | null = null;
    let fromSlice: string | null = null;

    function reportIfForbidden(
      node: ESTree.Node,
      importPath: string,
      messageNode: ESTree.Node = node,
    ): void {
      if (!fromLayer || matchesAnyRegex(importPath, ignoredImportRegexes)) {
        return;
      }

      if (fromSlice && isCrossImportPublicApiImportPath(importPath, fromSlice, config)) {
        return;
      }

      const resolvedImportPath = resolveImportPath(importPath, filePath);
      const toLayer =
        (resolvedImportPath ? extractLayerFromPath(resolvedImportPath, config) : null) ??
        extractLayerFromImportPath(importPath, config);
      if (!toLayer) {
        return;
      }

      if (resolvedImportPath && fromSlice) {
        const toSlice = extractSliceFromPath(resolvedImportPath, config);
        if (
          toLayer === fromLayer &&
          toSlice &&
          toSlice !== fromSlice &&
          isCrossImportPublicApiPath(resolvedImportPath, fromSlice, config)
        ) {
          return;
        }
      }

      const fromLayerConfig = config.layers[fromLayer];
      const allowedToImport = fromLayerConfig?.allowedToImport ?? [];
      if (allowedToImport.includes(toLayer)) {
        return;
      }

      context.report({
        node: messageNode,
        messageId: "invalidImport" satisfies MessageIds,
        data: {
          fromLayer,
          toLayer,
          allowedLayers: allowedToImport.length > 0 ? allowedToImport.join(", ") : "(none)",
        },
      });
    }

    return {
      before() {
        const options = getRuleOptions<ForbiddenImportsOptions>(context);
        config = mergeForbiddenImportsConfig(options);
        testFileRegexes = compileRegexList(config.testFilesPatterns);
        ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
        filePath = getFilename(context);
        if (matchesAnyRegex(filePath, testFileRegexes)) {
          fromLayer = null;
          fromSlice = null;
          return false;
        }

        fromLayer = extractLayerFromPath(filePath, config);
        fromSlice = fromLayer ? extractSliceFromPath(filePath, config) : null;
        return fromLayer !== null;
      },
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (typeof node.source.value === "string") {
          reportIfForbidden(node, node.source.value, node);
        }
      },
      ImportExpression(node: ESTree.ImportExpression) {
        const source = node.source;
        if (source.type === "Literal" && typeof source.value === "string") {
          reportIfForbidden(node, source.value, source);
        }
      },
    };
  },
};
