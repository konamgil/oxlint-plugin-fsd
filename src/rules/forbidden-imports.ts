import type { ForbiddenImportsOptions } from "../types.js";
import { mergeForbiddenImportsConfig } from "../utils/config.js";
import { createImportRule } from "../utils/create-import-rule.js";
import {
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSliceFromImportPath,
  extractSliceFromPath,
  isCrossImportPublicApiImportPath,
  isCrossImportPublicApiPath,
} from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "invalidImport";

export const forbiddenImportsRule = createImportRule<
  ForbiddenImportsOptions,
  ReturnType<typeof mergeForbiddenImportsConfig>
>({
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
  mergeConfig: mergeForbiddenImportsConfig,
  shouldSkipFile({ config, filePath }) {
    return extractLayerFromPath(filePath, config) === null;
  },
  checkImport({ context, config, filePath, node, importPath }) {
    const fromLayer = extractLayerFromPath(filePath, config);
    if (!fromLayer) return;
    const fromSlice = extractSliceFromPath(filePath, config);

    if (fromSlice && isCrossImportPublicApiImportPath(importPath, fromSlice, config)) {
      return;
    }

    const importLayer = extractLayerFromImportPath(importPath, config);
    const importSlice = extractSliceFromImportPath(importPath, config);
    if (importLayer === fromLayer && importSlice === fromSlice) return;

    const resolvedImportPath = resolveImportPath(importPath, filePath);
    const toLayer =
      (resolvedImportPath ? extractLayerFromPath(resolvedImportPath, config) : null) ??
      extractLayerFromImportPath(importPath, config);
    if (!toLayer) return;

    if (resolvedImportPath && fromSlice) {
      const toSlice = extractSliceFromPath(resolvedImportPath, config);
      if (toLayer === fromLayer && toSlice === fromSlice) return;
      if (
        toLayer === fromLayer &&
        toSlice &&
        toSlice !== fromSlice &&
        isCrossImportPublicApiPath(resolvedImportPath, fromSlice, config)
      ) {
        return;
      }
    }

    const allowedToImport = config.layers[fromLayer]?.allowedToImport ?? [];
    if (allowedToImport.includes(toLayer)) return;

    context.report({
      node,
      messageId: "invalidImport" satisfies MessageIds,
      data: {
        fromLayer,
        toLayer,
        allowedLayers: allowedToImport.length > 0 ? allowedToImport.join(", ") : "(none)",
      },
    });
  },
});
