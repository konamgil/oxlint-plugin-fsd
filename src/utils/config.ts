import type {
  AliasConfig,
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
export function mergeForbiddenImportsConfig(
  userConfig: ForbiddenImportsOptions = {},
): ForbiddenImportsConfig {
  let alias: AliasConfig;
  if (!userConfig.alias) {
    alias = DEFAULT_ALIAS;
  } else if (typeof userConfig.alias === "string") {
    alias = {
      value: userConfig.alias,
      withSlash: userConfig.alias.endsWith("/"),
    };
  } else {
    alias = {
      ...DEFAULT_ALIAS,
      ...userConfig.alias,
    };
  }

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

export function mergeNoPublicApiSidestepConfig(
  userConfig: NoPublicApiSidestepOptions = {},
): NoPublicApiSidestepConfig {
  const baseConfig = mergeForbiddenImportsConfig({
    alias: userConfig.alias,
    testFilesPatterns: userConfig.testFilesPatterns,
    ignoreImportPatterns: userConfig.ignoreImportPatterns,
  });

  return {
    ...baseConfig,
    restrictedLayers: userConfig.layers
      ? [...userConfig.layers]
      : [...DEFAULT_PUBLIC_API_LAYERS],
    publicApiFiles: userConfig.publicApiFiles
      ? [...userConfig.publicApiFiles]
      : [...DEFAULT_PUBLIC_API_FILES],
    allowTypeImports: userConfig.allowTypeImports ?? false,
  };
}

export function mergeNoCrossSliceDependencyConfig(
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

export function mergeNoUiInBusinessLogicConfig(
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

export function mergeNoGlobalStoreImportsConfig(
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

export function mergeOrderedImportsConfig(
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
  const rawGroups = userConfig.groups ? [...userConfig.groups] : ["external", ...customOrder, "relative"];
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
