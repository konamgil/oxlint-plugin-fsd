import type {
  AliasConfig,
  BackendBoundariesConfig,
  BackendBoundariesOptions,
  BackendBoundaryLayerConfig,
  ForbiddenImportsConfig,
  ForbiddenImportsOptions,
  LayerRuleConfig,
  NoCrossSliceDependencyConfig,
  NoCrossSliceDependencyOptions,
  NoGlobalStoreImportsConfig,
  NoGlobalStoreImportsOptions,
  NoPublicApiSidestepConfig,
  NoPublicApiSidestepOptions,
  NoUiInBusinessLogicConfig,
  NoUiInBusinessLogicOptions,
  OrderedImportsConfig,
  OrderedImportsOptions,
} from "../types.js";

const DEFAULT_ALIAS: AliasConfig = {
  value: "@",
  withSlash: false,
};

const DEFAULT_LAYERS: Record<string, LayerRuleConfig> = {
  app: {
    pattern: "app",
    priority: 1,
    allowedToImport: ["app", "processes", "pages", "widgets", "features", "entities", "shared"],
  },
  processes: {
    pattern: "processes",
    priority: 2,
    allowedToImport: ["pages", "widgets", "features", "entities", "shared"],
  },
  pages: {
    pattern: "pages",
    priority: 3,
    allowedToImport: ["widgets", "features", "entities", "shared"],
  },
  widgets: {
    pattern: "widgets",
    priority: 4,
    allowedToImport: ["features", "entities", "shared"],
  },
  features: {
    pattern: "features",
    priority: 5,
    allowedToImport: ["entities", "shared"],
  },
  entities: {
    pattern: "entities",
    priority: 6,
    allowedToImport: ["shared"],
  },
  shared: {
    pattern: "shared",
    priority: 7,
    allowedToImport: ["shared"],
  },
};

const DEFAULT_FOLDER_PATTERN = {
  enabled: false,
  regex: "^(\\d+_)?(.*)",
  extractionGroup: 2,
};

const DEFAULT_TEST_FILE_PATTERNS = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/StoreDecorator.tsx",
];

const DEFAULT_PUBLIC_API_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"];
const DEFAULT_PUBLIC_API_LAYERS = ["features", "entities", "widgets", "shared"];
const DEFAULT_UI_LAYERS = ["ui", "widgets", "features"];
const DEFAULT_BUSINESS_LOGIC_LAYERS = ["model", "api", "lib"];
const DEFAULT_FORBIDDEN_STORE_PATHS = [
  "/app/store",
  "/shared/store",
  "/store/",
  "/redux/",
  "/zustand/",
  "/mobx/",
  "/recoil/",
];
const DEFAULT_IMPORT_ORDER = [
  "app",
  "processes",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
];

const DEFAULT_BACKEND_MODULE_LAYERS = ["api", "application", "domain", "infra"];
const DEFAULT_BACKEND_TOP_LEVEL_LAYERS = ["core", "shared"];
const DEFAULT_BACKEND_LAYERS: Record<string, Required<BackendBoundaryLayerConfig>> = {
  "module-api": {
    allowedToImport: ["module-application", "core", "shared"],
  },
  "module-application": {
    allowedToImport: ["module-application", "module-domain", "core", "shared"],
  },
  "module-domain": {
    allowedToImport: ["module-domain", "shared"],
  },
  "module-infra": {
    allowedToImport: ["module-application", "module-domain", "module-infra", "core", "shared"],
  },
  core: {
    allowedToImport: ["core", "shared"],
  },
  shared: {
    allowedToImport: ["shared"],
  },
};
const DEFAULT_BACKEND_PUBLIC_API_PATTERNS = [
  "^application(?:/index(?:\\.[cm]?[jt]sx?)?)?$",
  "^infra(?:/index(?:\\.[cm]?[jt]sx?)?)?$",
  "^[^/]+\\.module(?:\\.[cm]?ts)?$",
  "^[^/]+\\.service(?:\\.[cm]?ts)?$",
];

function memoizeByOptions<T extends object, R extends object>(
  compute: (input: T | undefined) => R,
): (input?: T) => R {
  const cache = new WeakMap<object, R>();
  const defaultKey: object = Object.freeze({});
  return (input?: T): R => {
    const key: object = input ?? defaultKey;
    const cached = cache.get(key);
    if (cached) return cached;
    const result = compute(input);
    cache.set(key, result);
    return result;
  };
}

function normalizeAliasInput(input: ForbiddenImportsOptions["alias"]): AliasConfig {
  if (input == null) return DEFAULT_ALIAS;
  if (typeof input === "string") {
    const endsWithSlash = input.endsWith("/");
    return {
      value: endsWithSlash ? input.slice(0, -1) : input,
      withSlash: endsWithSlash,
    };
  }
  const rawValue = input.value ?? DEFAULT_ALIAS.value;
  const endsWithSlash = rawValue.endsWith("/");
  const value = endsWithSlash ? rawValue.slice(0, -1) : rawValue;
  return {
    value,
    withSlash: input.withSlash ?? endsWithSlash,
  };
}

function mergeForbiddenImportsConfigImpl(
  userConfig: ForbiddenImportsOptions = {},
): ForbiddenImportsConfig {
  const alias = normalizeAliasInput(userConfig.alias);

  const layers: Record<string, LayerRuleConfig> = { ...DEFAULT_LAYERS };
  if (userConfig.layers) {
    for (const [key, value] of Object.entries(userConfig.layers)) {
      if (layers[key]) {
        layers[key] = { ...layers[key], ...value };
      } else {
        layers[key] = {
          pattern: key,
          ...value,
        };
      }
    }
  }

  const folderPattern = {
    ...DEFAULT_FOLDER_PATTERN,
    ...userConfig.folderPattern,
  };

  return {
    alias,
    layers,
    folderPattern,
    testFilesPatterns: userConfig.testFilesPatterns
      ? [...userConfig.testFilesPatterns]
      : [...DEFAULT_TEST_FILE_PATTERNS],
    ignoreImportPatterns: [...(userConfig.ignoreImportPatterns ?? [])],
  };
}

export const mergeForbiddenImportsConfig = memoizeByOptions<
  ForbiddenImportsOptions,
  ForbiddenImportsConfig
>(mergeForbiddenImportsConfigImpl);

function mergeNoPublicApiSidestepConfigImpl(
  userConfig: NoPublicApiSidestepOptions = {},
): NoPublicApiSidestepConfig {
  const baseConfig = mergeForbiddenImportsConfig({
    alias: userConfig.alias,
    testFilesPatterns: userConfig.testFilesPatterns,
    ignoreImportPatterns: userConfig.ignoreImportPatterns,
  });

  const sharedPublicApiSegments: readonly string[] | "*" =
    userConfig.sharedPublicApiSegments == null
      ? "*"
      : userConfig.sharedPublicApiSegments === "*"
        ? "*"
        : [...userConfig.sharedPublicApiSegments];

  return {
    ...baseConfig,
    restrictedLayers: userConfig.layers ? [...userConfig.layers] : [...DEFAULT_PUBLIC_API_LAYERS],
    publicApiFiles: userConfig.publicApiFiles
      ? [...userConfig.publicApiFiles]
      : [...DEFAULT_PUBLIC_API_FILES],
    allowTypeImports: userConfig.allowTypeImports ?? false,
    sharedPublicApiSegments,
  };
}

export const mergeNoPublicApiSidestepConfig = memoizeByOptions<
  NoPublicApiSidestepOptions,
  NoPublicApiSidestepConfig
>(mergeNoPublicApiSidestepConfigImpl);

function mergeNoCrossSliceDependencyConfigImpl(
  userConfig: NoCrossSliceDependencyOptions = {},
): NoCrossSliceDependencyConfig {
  const baseConfig = mergeForbiddenImportsConfig(userConfig);

  return {
    ...baseConfig,
    featuresOnly: userConfig.featuresOnly ?? false,
    excludeLayers: [...(userConfig.excludeLayers ?? [])],
    allowTypeImports: userConfig.allowTypeImports ?? false,
  };
}

export const mergeNoCrossSliceDependencyConfig = memoizeByOptions<
  NoCrossSliceDependencyOptions,
  NoCrossSliceDependencyConfig
>(mergeNoCrossSliceDependencyConfigImpl);

function mergeNoUiInBusinessLogicConfigImpl(
  userConfig: NoUiInBusinessLogicOptions = {},
): NoUiInBusinessLogicConfig {
  const baseConfig = mergeForbiddenImportsConfig(userConfig);

  return {
    ...baseConfig,
    allowTypeImports: userConfig.allowTypeImports ?? false,
    uiLayers: userConfig.uiLayers ? [...userConfig.uiLayers] : [...DEFAULT_UI_LAYERS],
    businessLogicLayers: userConfig.businessLogicLayers
      ? [...userConfig.businessLogicLayers]
      : [...DEFAULT_BUSINESS_LOGIC_LAYERS],
  };
}

export const mergeNoUiInBusinessLogicConfig = memoizeByOptions<
  NoUiInBusinessLogicOptions,
  NoUiInBusinessLogicConfig
>(mergeNoUiInBusinessLogicConfigImpl);

function mergeNoGlobalStoreImportsConfigImpl(
  userConfig: NoGlobalStoreImportsOptions = {},
): NoGlobalStoreImportsConfig {
  return {
    forbiddenPaths: userConfig.forbiddenPaths
      ? [...userConfig.forbiddenPaths]
      : [...DEFAULT_FORBIDDEN_STORE_PATHS],
    allowedPaths: [...(userConfig.allowedPaths ?? [])],
    testFilesPatterns: userConfig.testFilesPatterns
      ? [...userConfig.testFilesPatterns]
      : [...DEFAULT_TEST_FILE_PATTERNS],
  };
}

export const mergeNoGlobalStoreImportsConfig = memoizeByOptions<
  NoGlobalStoreImportsOptions,
  NoGlobalStoreImportsConfig
>(mergeNoGlobalStoreImportsConfigImpl);

function mergeBackendBoundariesConfigImpl(
  userConfig: BackendBoundariesOptions = {},
): BackendBoundariesConfig {
  const layers: Record<string, Required<BackendBoundaryLayerConfig>> = {
    ...DEFAULT_BACKEND_LAYERS,
  };

  if (userConfig.layers) {
    for (const [key, value] of Object.entries(userConfig.layers)) {
      layers[key] = {
        allowedToImport: [...(value.allowedToImport ?? layers[key]?.allowedToImport ?? [])],
      };
    }
  }

  return {
    alias: normalizeAliasInput(userConfig.alias),
    sourceRootPattern: userConfig.sourceRootPattern ?? "/src/",
    modulesDir: userConfig.modulesDir ?? "modules",
    moduleLayers: userConfig.moduleLayers
      ? [...userConfig.moduleLayers]
      : [...DEFAULT_BACKEND_MODULE_LAYERS],
    topLevelLayers: userConfig.topLevelLayers
      ? [...userConfig.topLevelLayers]
      : [...DEFAULT_BACKEND_TOP_LEVEL_LAYERS],
    layers,
    publicApiPatterns: userConfig.publicApiPatterns
      ? [...userConfig.publicApiPatterns]
      : [...DEFAULT_BACKEND_PUBLIC_API_PATTERNS],
    enforceCrossModulePublicApi: userConfig.enforceCrossModulePublicApi ?? true,
    allowSameModuleSameLayer: userConfig.allowSameModuleSameLayer ?? true,
    testFilesPatterns: userConfig.testFilesPatterns
      ? [...userConfig.testFilesPatterns]
      : [...DEFAULT_TEST_FILE_PATTERNS],
    ignoreImportPatterns: [...(userConfig.ignoreImportPatterns ?? [])],
    allowTypeImports: userConfig.allowTypeImports ?? false,
  };
}

export const mergeBackendBoundariesConfig = memoizeByOptions<
  BackendBoundariesOptions,
  BackendBoundariesConfig
>(mergeBackendBoundariesConfigImpl);

function mergeOrderedImportsConfigImpl(
  userConfig: OrderedImportsOptions = {},
): OrderedImportsConfig {
  const baseConfig = mergeForbiddenImportsConfig({
    alias: userConfig.alias,
    testFilesPatterns: userConfig.testFilesPatterns,
    ignoreImportPatterns: userConfig.ignoreImportPatterns,
  });
  const customOrder = userConfig.customOrder
    ? [...userConfig.customOrder]
    : [...DEFAULT_IMPORT_ORDER];
  const rawGroups = userConfig.groups
    ? [...userConfig.groups]
    : ["external", ...customOrder, "relative"];
  const groups = [...rawGroups];

  for (const fallbackGroup of ["external", ...customOrder, "relative"]) {
    if (!groups.includes(fallbackGroup)) {
      groups.push(fallbackGroup);
    }
  }

  return {
    ...baseConfig,
    customOrder,
    groups,
    separators: userConfig.separators ?? false,
  };
}

export const mergeOrderedImportsConfig = memoizeByOptions<
  OrderedImportsOptions,
  OrderedImportsConfig
>(mergeOrderedImportsConfigImpl);
