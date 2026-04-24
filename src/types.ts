export const DEFAULT_FSD_LAYERS = [
  "app",
  "processes",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
] as const;

export const DEFAULT_SINGLE_LAYER_MODULES = ["app", "shared"] as const;

export interface AliasConfig {
  value: string;
  withSlash: boolean;
}

export interface LayerRuleConfig {
  pattern: string;
  priority?: number;
  allowedToImport?: string[];
}

export interface FolderPatternConfig {
  enabled: boolean;
  regex: string;
  extractionGroup: number;
}

export interface NoRelativeImportsOptions {
  allowSameSlice?: boolean;
  allowTypeImports?: boolean;
  testFilesPatterns?: string[];
  ignoreImportPatterns?: string[];
  layers?: string[];
  singleLayerModules?: string[];
}

export interface ForbiddenImportsOptions {
  alias?:
    | string
    | {
        value: string;
        withSlash?: boolean;
      };
  layers?: Record<
    string,
    {
      pattern?: string;
      priority?: number;
      allowedToImport?: string[];
    }
  >;
  folderPattern?: {
    enabled?: boolean;
    regex?: string;
    extractionGroup?: number;
  };
  testFilesPatterns?: string[];
  ignoreImportPatterns?: string[];
}

export interface ForbiddenImportsConfig {
  alias: AliasConfig;
  layers: Record<string, LayerRuleConfig>;
  folderPattern: FolderPatternConfig;
  testFilesPatterns: string[];
  ignoreImportPatterns: string[];
}

export interface NoPublicApiSidestepOptions {
  alias?:
    | string
    | {
        value: string;
        withSlash?: boolean;
      };
  layers?: string[];
  publicApiFiles?: string[];
  testFilesPatterns?: string[];
  ignoreImportPatterns?: string[];
  allowTypeImports?: boolean;
  sharedPublicApiSegments?: string[] | "*";
}

export interface NoPublicApiSidestepConfig extends ForbiddenImportsConfig {
  restrictedLayers: string[];
  publicApiFiles: string[];
  allowTypeImports: boolean;
  sharedPublicApiSegments: readonly string[] | "*";
}

export interface NoCrossSliceDependencyOptions extends ForbiddenImportsOptions {
  featuresOnly?: boolean;
  excludeLayers?: string[];
  allowTypeImports?: boolean;
}

export interface NoCrossSliceDependencyConfig extends ForbiddenImportsConfig {
  featuresOnly: boolean;
  excludeLayers: string[];
  allowTypeImports: boolean;
}

export interface NoUiInBusinessLogicOptions extends ForbiddenImportsOptions {
  allowTypeImports?: boolean;
  uiLayers?: string[];
  businessLogicLayers?: string[];
}

export interface NoUiInBusinessLogicConfig extends ForbiddenImportsConfig {
  allowTypeImports: boolean;
  uiLayers: string[];
  businessLogicLayers: string[];
}

export interface NoGlobalStoreImportsOptions {
  forbiddenPaths?: string[];
  allowedPaths?: string[];
  testFilesPatterns?: string[];
}

export interface NoGlobalStoreImportsConfig {
  forbiddenPaths: string[];
  allowedPaths: string[];
  testFilesPatterns: string[];
}

export interface BackendBoundaryLayerConfig {
  allowedToImport?: string[];
}

export interface BackendBoundariesOptions {
  alias?:
    | string
    | {
        value: string;
        withSlash?: boolean;
      };
  sourceRootPattern?: string;
  modulesDir?: string;
  moduleLayers?: string[];
  topLevelLayers?: string[];
  layers?: Record<string, BackendBoundaryLayerConfig>;
  publicApiPatterns?: string[];
  enforceCrossModulePublicApi?: boolean;
  allowSameModuleSameLayer?: boolean;
  testFilesPatterns?: string[];
  ignoreImportPatterns?: string[];
  allowTypeImports?: boolean;
}

export interface BackendBoundariesConfig {
  alias: AliasConfig;
  sourceRootPattern: string;
  modulesDir: string;
  moduleLayers: string[];
  topLevelLayers: string[];
  layers: Record<string, Required<BackendBoundaryLayerConfig>>;
  publicApiPatterns: string[];
  enforceCrossModulePublicApi: boolean;
  allowSameModuleSameLayer: boolean;
  testFilesPatterns: string[];
  ignoreImportPatterns: string[];
  allowTypeImports: boolean;
}

export interface OrderedImportsOptions {
  alias?:
    | string
    | {
        value: string;
        withSlash?: boolean;
      };
  customOrder?: string[];
  groups?: string[];
  separators?: boolean;
  testFilesPatterns?: string[];
  ignoreImportPatterns?: string[];
}

export interface OrderedImportsConfig extends ForbiddenImportsConfig {
  customOrder: string[];
  groups: string[];
  separators: boolean;
}

export interface SliceBoundary {
  layer: string;
  slice: string | null;
}
