import type { Context, ESTree, Rule } from "@oxlint/plugins";

import type { NoRelativeImportsOptions } from "../types.js";
import { getRuleOptions } from "../utils/options.js";
import {
  compileRegexList,
  getSliceBoundary,
  isRelativeImportPath,
  isSameSliceImport,
  matchesAnyRegex,
  normalizePath,
} from "../utils/path.js";

type MessageIds = "noRelativeImport";

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

export const noRelativeImportsRule: Rule = {
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
  createOnce(context) {
    let options: NoRelativeImportsOptions = {};
    let allowSameSlice = options.allowSameSlice ?? true;
    let allowTypeImports = options.allowTypeImports ?? false;
    let ignoreImportRegexes = compileRegexList(options.ignoreImportPatterns ?? []);
    let testFileRegexes = compileRegexList(options.testFilesPatterns ?? []);

    let filePath = "";
    let shouldRunOnFile = false;

    function shouldReportRelativeImport(importPath: unknown, importKind?: string): boolean {
      if (!shouldRunOnFile || !isRelativeImportPath(importPath)) {
        return false;
      }

      if (matchesAnyRegex(importPath, ignoreImportRegexes)) {
        return false;
      }

      if (allowTypeImports && importKind === "type") {
        return false;
      }

      if (allowSameSlice && isSameSliceImport(filePath, importPath, options)) {
        return false;
      }

      return true;
    }

    return {
      before() {
        options = getRuleOptions<NoRelativeImportsOptions>(context);
        allowSameSlice = options.allowSameSlice ?? true;
        allowTypeImports = options.allowTypeImports ?? false;
        ignoreImportRegexes = compileRegexList(options.ignoreImportPatterns ?? []);
        testFileRegexes = compileRegexList(options.testFilesPatterns ?? []);
        filePath = getFilename(context);
        shouldRunOnFile =
          !matchesAnyRegex(filePath, testFileRegexes) &&
          getSliceBoundary(filePath, options) !== null;

        return shouldRunOnFile;
      },
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (shouldReportRelativeImport(node.source.value, node.importKind)) {
          context.report({
            node,
            messageId: "noRelativeImport" satisfies MessageIds,
          });
        }
      },
      ImportExpression(node: ESTree.ImportExpression) {
        const source = node.source;
        if (
          source.type === "Literal" &&
          typeof source.value === "string" &&
          shouldReportRelativeImport(source.value)
        ) {
          context.report({
            node: source,
            messageId: "noRelativeImport" satisfies MessageIds,
          });
        }
      },
    };
  },
};
