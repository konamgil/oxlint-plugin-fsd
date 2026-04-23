import type { Context, ESTree, Rule } from "@oxlint/plugins";

import type { NoGlobalStoreImportsOptions } from "../types.js";
import { mergeNoGlobalStoreImportsConfig } from "../utils/config.js";
import { getRuleOptions } from "../utils/options.js";
import { compileRegexList, matchesAnyRegex, normalizePath } from "../utils/path.js";

type MessageIds = "noGlobalStore";

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

export const noGlobalStoreImportsRule: Rule = {
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
  createOnce(context) {
    let config = mergeNoGlobalStoreImportsConfig();
    let testFileRegexes = compileRegexList(config.testFilesPatterns);

    let filePath = "";
    let shouldRunOnFile = false;

    function isAllowedImport(importPath: string): boolean {
      return config.allowedPaths.some((allowedPath) => importPath.includes(allowedPath));
    }

    function isForbiddenImport(importPath: string): boolean {
      return config.forbiddenPaths.some((forbiddenPath) => importPath.includes(forbiddenPath));
    }

    function handleImport(node: ESTree.Node, importPath: string): void {
      if (!shouldRunOnFile || isAllowedImport(importPath) || !isForbiddenImport(importPath)) {
        return;
      }

      context.report({
        node,
        messageId: "noGlobalStore" satisfies MessageIds,
        data: {
          storeName: importPath,
        },
      });
    }

    return {
      before() {
        const options = getRuleOptions<NoGlobalStoreImportsOptions>(context);
        config = mergeNoGlobalStoreImportsConfig(options);
        testFileRegexes = compileRegexList(config.testFilesPatterns);
        filePath = getFilename(context);
        shouldRunOnFile = !matchesAnyRegex(filePath, testFileRegexes);
        return shouldRunOnFile;
      },
      ImportDeclaration(node: ESTree.ImportDeclaration) {
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
