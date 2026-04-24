import type { Context, ESTree, Rule, RuleMeta } from "@oxlint/plugins";

import { getRuleOptions } from "./options.js";
import { compileRegexList, matchesAnyRegex, normalizePath } from "./path.js";

export interface ImportRuleFileContext<TConfig> {
  readonly context: Context;
  readonly config: TConfig;
  readonly filePath: string;
}

export interface ImportCheckContext<TConfig> extends ImportRuleFileContext<TConfig> {
  readonly node: ESTree.Node;
  readonly importPath: string;
  readonly isTypeImport: boolean;
}

export interface ImportRuleBaseConfig {
  readonly testFilesPatterns: readonly string[];
  readonly ignoreImportPatterns?: readonly string[];
  readonly allowTypeImports?: boolean;
}

export interface ImportRuleSpec<
  TOptions extends object,
  TConfig extends ImportRuleBaseConfig,
> {
  meta: RuleMeta;
  mergeConfig: (options?: TOptions) => TConfig;
  shouldSkipFile?: (ctx: ImportRuleFileContext<TConfig>) => boolean;
  checkImport: (ctx: ImportCheckContext<TConfig>) => void;
}

function toFilename(context: Context): string {
  return normalizePath(context.filename || context.getFilename());
}

export function createImportRule<
  TOptions extends object,
  TConfig extends ImportRuleBaseConfig,
>(spec: ImportRuleSpec<TOptions, TConfig>): Rule {
  return {
    meta: spec.meta,
    createOnce(context: Context) {
      let config = spec.mergeConfig();
      let testFileRegexes = compileRegexList(config.testFilesPatterns);
      let ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns ?? []);
      let filePath = "";
      let shouldRunOnFile = false;

      function visit(
        node: ESTree.Node,
        importPath: string,
        isTypeImport: boolean,
      ): void {
        if (!shouldRunOnFile) return;
        if (matchesAnyRegex(importPath, ignoredImportRegexes)) return;
        spec.checkImport({ context, config, filePath, node, importPath, isTypeImport });
      }

      return {
        before() {
          const options = getRuleOptions<TOptions>(context);
          config = spec.mergeConfig(options);
          testFileRegexes = compileRegexList(config.testFilesPatterns);
          ignoredImportRegexes = compileRegexList(config.ignoreImportPatterns ?? []);
          filePath = toFilename(context);

          if (matchesAnyRegex(filePath, testFileRegexes)) {
            shouldRunOnFile = false;
            return false;
          }

          if (spec.shouldSkipFile?.({ context, config, filePath })) {
            shouldRunOnFile = false;
            return false;
          }

          shouldRunOnFile = true;
          return true;
        },
        ImportDeclaration(node: ESTree.ImportDeclaration) {
          const isTypeImport = node.importKind === "type";
          if (config.allowTypeImports && isTypeImport) return;
          if (typeof node.source.value === "string") {
            visit(node, node.source.value, isTypeImport);
          }
        },
        ImportExpression(node: ESTree.ImportExpression) {
          const source = node.source;
          if (source.type === "Literal" && typeof source.value === "string") {
            visit(source, source.value, false);
          }
        },
      };
    },
  };
}
