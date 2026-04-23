import type { Context, ESTree, Rule, SourceCode } from "@oxlint/plugins";

import type { OrderedImportsOptions } from "../types.js";
import { mergeOrderedImportsConfig } from "../utils/config.js";
import { getRuleOptions } from "../utils/options.js";
import {
  compileRegexList,
  extractLayerFromImportPath,
  isRelativeImportPath,
  matchesAnyRegex,
  normalizePath,
} from "../utils/path.js";

type MessageIds = "incorrectGrouping";

interface ImportChunk {
  node: ESTree.ImportDeclaration;
  text: string;
  importPath: string;
  group: string;
  isSideEffectOnly: boolean;
}

function getFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

function collectImportChunkTexts(
  sourceCode: SourceCode,
  importNodes: ESTree.ImportDeclaration[],
  classifyImport: (node: ESTree.ImportDeclaration, importPath: string) => string,
): ImportChunk[] {
  return importNodes.map((node) => {
    return {
      node,
      text: sourceCode.getText(node),
      importPath: typeof node.source.value === "string" ? node.source.value : "",
      group:
        typeof node.source.value === "string"
          ? classifyImport(node, node.source.value)
          : "external",
      isSideEffectOnly: node.specifiers.length === 0 && node.importKind !== "type",
    };
  });
}

function buildImportBlock(chunks: ImportChunk[], endOfLine: string): string {
  return chunks.map((chunk) => chunk.text.trim()).join(endOfLine);
}

export const orderedImportsRule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce import ordering by Feature-Sliced Design layer order.",
      recommended: true,
    },
    fixable: "code",
    messages: {
      incorrectGrouping:
        "'{{ currentImport }}' import is not correctly grouped. Keep imports ordered by layer.",
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
          customOrder: {
            type: "array",
            items: { type: "string" },
          },
          groups: {
            type: "array",
            items: { type: "string" },
          },
          separators: {
            type: "boolean",
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
    let config = mergeOrderedImportsConfig();
    let testFileRegexes = compileRegexList(config.testFilesPatterns);
    let ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);

    return {
      before() {
        const options = getRuleOptions<OrderedImportsOptions>(context);
        config = mergeOrderedImportsConfig(options);
        testFileRegexes = compileRegexList(config.testFilesPatterns);
        ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns);
      },
      Program(node: ESTree.Program) {
        const filePath = getFilename(context);
        if (matchesAnyRegex(filePath, testFileRegexes)) {
          return;
        }

        const importNodes = node.body.filter(
          (statement): statement is ESTree.ImportDeclaration =>
            statement.type === "ImportDeclaration",
        );

        if (importNodes.length < 2) {
          return;
        }

        const sourceCode = context.sourceCode || context.getSourceCode();
        const sourceText = sourceCode.text;
        const endOfLine = sourceText.includes("\r\n") ? "\r\n" : "\n";
        const classifyImport = (_node: ESTree.ImportDeclaration, importPath: string): string => {
          if (isRelativeImportPath(importPath)) {
            return "relative";
          }

          const layer = extractLayerFromImportPath(importPath, config);
          return layer && config.groups.includes(layer) ? layer : "external";
        };

        const importChunks = collectImportChunkTexts(
          sourceCode,
          importNodes,
          classifyImport,
        );

        if (importChunks.some((chunk) => matchesAnyRegex(chunk.importPath, ignoredImportRegexes))) {
          return;
        }

        const groupedImports = new Map<string, ImportChunk[]>();
        for (const group of config.groups) {
          groupedImports.set(group, []);
        }

        for (const chunk of importChunks) {
          if (!groupedImports.has(chunk.group)) {
            groupedImports.set(chunk.group, []);
          }
          groupedImports.get(chunk.group)!.push(chunk);
        }

        const populatedGroups = config.groups
          .map((group) => ({
            group,
            chunks: groupedImports.get(group) ?? [],
          }))
          .filter((entry) => entry.chunks.length > 0);

        const finalOrder = populatedGroups.flatMap((entry) => entry.chunks);
        const sortedImportText = config.separators
          ? populatedGroups
              .map((entry) => buildImportBlock(entry.chunks, endOfLine))
              .join(`${endOfLine}${endOfLine}`)
          : buildImportBlock(finalOrder, endOfLine);

        const firstImport = importNodes[0]!;
        const lastImport = importNodes[importNodes.length - 1]!;
        const originalImportText = sourceText.slice(firstImport.range[0], lastImport.range[1]);

        if (originalImportText.trim() === sortedImportText.trim()) {
          return;
        }

        const firstImportPath = firstImport.source.value;
        context.report({
          node: firstImport,
          messageId: "incorrectGrouping" satisfies MessageIds,
          data: {
            currentImport:
              typeof firstImportPath === "string" ? firstImportPath : "<unknown>",
          },
          fix: importChunks.some((chunk) => chunk.isSideEffectOnly)
            ? undefined
            : (fixer) => {
            return fixer.replaceTextRange(
              [firstImport.range[0], lastImport.range[1]],
              sortedImportText,
            );
            },
        });
      },
    };
  },
};
