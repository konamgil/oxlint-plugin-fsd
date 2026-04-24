import type { NoGlobalStoreImportsOptions } from "../types.js";
import { mergeNoGlobalStoreImportsConfig } from "../utils/config.js";
import { createImportRule } from "../utils/create-import-rule.js";

type MessageIds = "noGlobalStore";

export const noGlobalStoreImportsRule = createImportRule<
  NoGlobalStoreImportsOptions,
  ReturnType<typeof mergeNoGlobalStoreImportsConfig>
>({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct imports of global stores. Use hooks or selectors instead.",
      recommended: true,
    },
    messages: {
      noGlobalStore:
        "'{{ storeName }}' cannot be directly imported. Use hooks such as useStore or useSelector instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          forbiddenPaths: {
            type: "array",
            items: { type: "string" },
          },
          allowedPaths: {
            type: "array",
            items: { type: "string" },
          },
          testFilesPatterns: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  mergeConfig: mergeNoGlobalStoreImportsConfig,
  checkImport({ context, config, node, importPath }) {
    const isAllowed = config.allowedPaths.some((allowedPath) =>
      importPath.includes(allowedPath),
    );
    if (isAllowed) return;

    const isForbidden = config.forbiddenPaths.some((forbiddenPath) =>
      importPath.includes(forbiddenPath),
    );
    if (!isForbidden) return;

    context.report({
      node,
      messageId: "noGlobalStore" satisfies MessageIds,
      data: { storeName: importPath },
    });
  },
});
