import { describe, expect, it } from "vitest";

import {
  mergeForbiddenImportsConfig,
  mergeNoCrossSliceDependencyConfig,
  mergeNoGlobalStoreImportsConfig,
  mergeNoPublicApiSidestepConfig,
  mergeNoUiInBusinessLogicConfig,
  mergeOrderedImportsConfig,
} from "../../src/utils/config.js";

describe("mergeForbiddenImportsConfig alias normalization", () => {
  it("defaults to @ without slash", () => {
    const config = mergeForbiddenImportsConfig();
    expect(config.alias).toEqual({ value: "@", withSlash: false });
  });

  it("accepts plain string @", () => {
    const config = mergeForbiddenImportsConfig({ alias: "@" });
    expect(config.alias).toEqual({ value: "@", withSlash: false });
  });

  it("strips trailing slash and sets withSlash=true (regression)", () => {
    const config = mergeForbiddenImportsConfig({ alias: "@/" });
    expect(config.alias).toEqual({ value: "@", withSlash: true });
  });

  it("accepts custom tilde alias", () => {
    const config = mergeForbiddenImportsConfig({ alias: "~" });
    expect(config.alias).toEqual({ value: "~", withSlash: false });
  });

  it("accepts object form with explicit withSlash", () => {
    const config = mergeForbiddenImportsConfig({
      alias: { value: "#", withSlash: true },
    });
    expect(config.alias).toEqual({ value: "#", withSlash: true });
  });

  it("object form strips trailing slash and preserves explicit withSlash", () => {
    const config = mergeForbiddenImportsConfig({
      alias: { value: "@/", withSlash: false },
    });
    expect(config.alias).toEqual({ value: "@", withSlash: false });
  });

  it("object form without withSlash infers from trailing slash", () => {
    const config = mergeForbiddenImportsConfig({
      alias: { value: "~/" },
    });
    expect(config.alias).toEqual({ value: "~", withSlash: true });
  });
});

describe("mergeForbiddenImportsConfig layers", () => {
  it("keeps default FSD layers", () => {
    const config = mergeForbiddenImportsConfig();
    expect(Object.keys(config.layers)).toContain("features");
    expect(Object.keys(config.layers)).toContain("shared");
  });

  it("merges user overrides onto defaults", () => {
    const config = mergeForbiddenImportsConfig({
      layers: { features: { allowedToImport: ["shared"] } },
    });
    expect(config.layers.features?.allowedToImport).toEqual(["shared"]);
  });

  it("accepts entirely custom layer", () => {
    const config = mergeForbiddenImportsConfig({
      layers: { custom: { priority: 100, allowedToImport: ["shared"] } },
    });
    expect(config.layers.custom).toBeDefined();
    expect(config.layers.custom?.pattern).toBe("custom");
  });
});

describe("mergeForbiddenImportsConfig folderPattern", () => {
  it("defaults to disabled", () => {
    const config = mergeForbiddenImportsConfig();
    expect(config.folderPattern.enabled).toBe(false);
  });

  it("accepts user-enabled pattern", () => {
    const config = mergeForbiddenImportsConfig({
      folderPattern: { enabled: true, regex: "^(\\d+_)?(.*)", extractionGroup: 2 },
    });
    expect(config.folderPattern).toEqual({
      enabled: true,
      regex: "^(\\d+_)?(.*)",
      extractionGroup: 2,
    });
  });
});

describe("mergeNoPublicApiSidestepConfig", () => {
  it("defaults sharedPublicApiSegments to '*'", () => {
    const config = mergeNoPublicApiSidestepConfig();
    expect(config.sharedPublicApiSegments).toBe("*");
  });

  it("accepts explicit allowed segments list", () => {
    const config = mergeNoPublicApiSidestepConfig({
      sharedPublicApiSegments: ["ui", "lib"],
    });
    expect(config.sharedPublicApiSegments).toEqual(["ui", "lib"]);
  });

  it("explicit '*' normalizes to '*'", () => {
    const config = mergeNoPublicApiSidestepConfig({
      sharedPublicApiSegments: "*",
    });
    expect(config.sharedPublicApiSegments).toBe("*");
  });

  it("defaults allowTypeImports to false", () => {
    const config = mergeNoPublicApiSidestepConfig();
    expect(config.allowTypeImports).toBe(false);
  });

  it("uses default public api file names", () => {
    const config = mergeNoPublicApiSidestepConfig();
    expect(config.publicApiFiles).toEqual(["index.ts", "index.tsx", "index.js", "index.jsx"]);
  });

  it("uses default restricted layers", () => {
    const config = mergeNoPublicApiSidestepConfig();
    expect(config.restrictedLayers).toEqual(["features", "entities", "widgets", "shared"]);
  });
});

describe("mergeNoCrossSliceDependencyConfig", () => {
  it("featuresOnly defaults to false", () => {
    const config = mergeNoCrossSliceDependencyConfig();
    expect(config.featuresOnly).toBe(false);
  });

  it("accepts excludeLayers override", () => {
    const config = mergeNoCrossSliceDependencyConfig({
      excludeLayers: ["shared"],
    });
    expect(config.excludeLayers).toEqual(["shared"]);
  });
});

describe("mergeNoUiInBusinessLogicConfig", () => {
  it("defaults uiLayers and businessLogicLayers", () => {
    const config = mergeNoUiInBusinessLogicConfig();
    expect(config.uiLayers).toEqual(["ui", "widgets", "features"]);
    expect(config.businessLogicLayers).toEqual(["model", "api", "lib"]);
  });
});

describe("mergeNoGlobalStoreImportsConfig", () => {
  it("defaults forbidden paths", () => {
    const config = mergeNoGlobalStoreImportsConfig();
    expect(config.forbiddenPaths).toContain("/redux/");
    expect(config.forbiddenPaths).toContain("/zustand/");
  });

  it("allowedPaths empty by default", () => {
    const config = mergeNoGlobalStoreImportsConfig();
    expect(config.allowedPaths).toEqual([]);
  });
});

describe("mergeOrderedImportsConfig", () => {
  it("appends missing fallback groups", () => {
    const config = mergeOrderedImportsConfig({ groups: ["external", "features"] });
    expect(config.groups).toContain("relative");
    expect(config.groups).toContain("app");
  });

  it("uses custom order when provided", () => {
    const config = mergeOrderedImportsConfig({
      customOrder: ["app", "shared"],
    });
    expect(config.customOrder).toEqual(["app", "shared"]);
  });

  it("separators default to false", () => {
    const config = mergeOrderedImportsConfig();
    expect(config.separators).toBe(false);
  });
});
