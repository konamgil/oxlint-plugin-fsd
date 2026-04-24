import type { BackendBoundariesConfig, BackendBoundariesOptions } from "../types.js";
import { mergeBackendBoundariesConfig } from "../utils/config.js";
import { createImportRule } from "../utils/create-import-rule.js";
import { compileRegexList, getRelativePathFromRoot, normalizePath } from "../utils/path.js";
import { resolveImportPath } from "../utils/resolve.js";

type MessageIds = "invalidLayerImport" | "invalidCrossModuleImport";

interface BackendElement {
  kind: "module" | "top-level";
  layer: string | null;
  moduleName: string | null;
  relativeToModule: string | null;
}

const publicApiRegexCache = new WeakMap<BackendBoundariesConfig, RegExp[]>();

function aliasRelativePath(importPath: string, config: BackendBoundariesConfig): string | null {
  const normalizedImport = normalizePath(importPath);
  const aliasValue = normalizePath(config.alias.value).replace(/\/$/, "");
  const aliasPrefix = `${aliasValue}/`;

  if (!normalizedImport.startsWith(aliasPrefix)) {
    return null;
  }

  return normalizedImport.slice(aliasPrefix.length);
}

function parseElementFromRelativePath(
  relativePath: string,
  config: BackendBoundariesConfig,
): BackendElement | null {
  const segments = normalizePath(relativePath).split("/").filter(Boolean);
  const [firstSegment, secondSegment, thirdSegment] = segments;

  if (!firstSegment) return null;

  if (firstSegment === config.modulesDir && secondSegment) {
    const moduleLayer = thirdSegment ?? null;
    const layer =
      moduleLayer && config.moduleLayers.includes(moduleLayer) ? `module-${moduleLayer}` : null;

    return {
      kind: "module",
      layer,
      moduleName: secondSegment,
      relativeToModule: segments.slice(2).join("/") || null,
    };
  }

  if (config.topLevelLayers.includes(firstSegment)) {
    return {
      kind: "top-level",
      layer: firstSegment,
      moduleName: null,
      relativeToModule: null,
    };
  }

  return null;
}

function parseElementFromFilePath(
  filePath: string,
  config: BackendBoundariesConfig,
): BackendElement | null {
  const relativePath = getRelativePathFromRoot(filePath, config.sourceRootPattern);
  if (!relativePath) return null;
  return parseElementFromRelativePath(relativePath, config);
}

function parseElementFromImportPath(
  importPath: string,
  filePath: string,
  config: BackendBoundariesConfig,
): BackendElement | null {
  const resolvedImportPath = resolveImportPath(importPath, filePath);
  if (resolvedImportPath) {
    return parseElementFromFilePath(resolvedImportPath, config);
  }

  const relativePath = aliasRelativePath(importPath, config);
  if (!relativePath) return null;

  return parseElementFromRelativePath(relativePath, config);
}

function isCrossModuleImport(fromElement: BackendElement, toElement: BackendElement): boolean {
  return (
    fromElement.kind === "module" &&
    toElement.kind === "module" &&
    fromElement.moduleName !== null &&
    toElement.moduleName !== null &&
    fromElement.moduleName !== toElement.moduleName
  );
}

function isAllowedLayerImport(
  fromElement: BackendElement,
  toElement: BackendElement,
  config: BackendBoundariesConfig,
): boolean {
  if (!fromElement.layer || !toElement.layer) return true;

  const isSameModuleSameLayer =
    fromElement.kind === "module" &&
    toElement.kind === "module" &&
    fromElement.moduleName === toElement.moduleName &&
    fromElement.layer === toElement.layer;

  if (config.allowSameModuleSameLayer && isSameModuleSameLayer) {
    return true;
  }

  return config.layers[fromElement.layer]?.allowedToImport.includes(toElement.layer) ?? false;
}

function isPublicModuleApi(
  targetElement: BackendElement,
  config: BackendBoundariesConfig,
): boolean {
  if (targetElement.kind !== "module" || !targetElement.relativeToModule) {
    return false;
  }

  let regexes = publicApiRegexCache.get(config);
  if (!regexes) {
    regexes = compileRegexList(config.publicApiPatterns);
    publicApiRegexCache.set(config, regexes);
  }

  return regexes.some((regex) => regex.test(targetElement.relativeToModule ?? ""));
}

export const backendBoundariesRule = createImportRule<
  BackendBoundariesOptions,
  BackendBoundariesConfig
>({
  meta: {
    type: "problem",
    docs: {
      description: "Enforce nested backend module layer boundaries and cross-module public APIs.",
      recommended: false,
    },
    messages: {
      invalidLayerImport:
        "'{{ fromLayer }}' cannot import '{{ toLayer }}'. Allowed imports: {{ allowedLayers }}",
      invalidCrossModuleImport:
        "Cross-module import from '{{ fromModule }}' to '{{ toModule }}' must target a public API: {{ publicApiPatterns }}",
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
          sourceRootPattern: { type: "string" },
          modulesDir: { type: "string" },
          moduleLayers: {
            type: "array",
            items: { type: "string" },
          },
          topLevelLayers: {
            type: "array",
            items: { type: "string" },
          },
          layers: {
            type: "object",
            additionalProperties: {
              type: "object",
              properties: {
                allowedToImport: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              additionalProperties: false,
            },
          },
          publicApiPatterns: {
            type: "array",
            items: { type: "string" },
          },
          enforceCrossModulePublicApi: { type: "boolean" },
          allowSameModuleSameLayer: { type: "boolean" },
          testFilesPatterns: {
            type: "array",
            items: { type: "string" },
          },
          ignoreImportPatterns: {
            type: "array",
            items: { type: "string" },
          },
          allowTypeImports: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  mergeConfig: mergeBackendBoundariesConfig,
  shouldSkipFile({ config, filePath }) {
    return parseElementFromFilePath(filePath, config) === null;
  },
  checkImport({ context, config, filePath, node, importPath }) {
    const fromElement = parseElementFromFilePath(filePath, config);
    if (!fromElement) return;

    const toElement = parseElementFromImportPath(importPath, filePath, config);
    if (!toElement) return;

    if (!isAllowedLayerImport(fromElement, toElement, config)) {
      const allowedLayers = fromElement.layer
        ? (config.layers[fromElement.layer]?.allowedToImport ?? [])
        : [];

      context.report({
        node,
        messageId: "invalidLayerImport" satisfies MessageIds,
        data: {
          fromLayer: fromElement.layer ?? "(unknown)",
          toLayer: toElement.layer ?? "(unknown)",
          allowedLayers: allowedLayers.length > 0 ? allowedLayers.join(", ") : "(none)",
        },
      });
      return;
    }

    if (
      config.enforceCrossModulePublicApi &&
      isCrossModuleImport(fromElement, toElement) &&
      !isPublicModuleApi(toElement, config)
    ) {
      context.report({
        node,
        messageId: "invalidCrossModuleImport" satisfies MessageIds,
        data: {
          fromModule: fromElement.moduleName ?? "(unknown)",
          toModule: toElement.moduleName ?? "(unknown)",
          publicApiPatterns: config.publicApiPatterns.join(", "),
        },
      });
    }
  },
});
