import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  compileRegexList,
  extractLayerFromImportPath,
  extractLayerFromPath,
  extractSegmentFromImportPath,
  extractSegmentFromPath,
  extractSliceFromImportPath,
  extractSliceFromPath,
  getRelativePathFromRoot,
  getAliasRelativePath,
  getSliceBoundary,
  isCrossImportPublicApiImportPath,
  isCrossImportPublicApiPath,
  isRelativeImportPath,
  isSameSliceImport,
  isSharedPublicApiPath,
  matchesAnyRegex,
  normalizePath,
  resolveRelativeImport,
} from "../../src/utils/path.js";
import { mergeForbiddenImportsConfig } from "../../src/utils/config.js";

const baseConfig = mergeForbiddenImportsConfig();
const configWithFolderPattern = mergeForbiddenImportsConfig({
  folderPattern: { enabled: true, regex: "^(\\d+_)?(.*)", extractionGroup: 2 },
});
const configWithCustomAlias = mergeForbiddenImportsConfig({ alias: "~" });
const configWithSlashAlias = mergeForbiddenImportsConfig({ alias: "@/" });

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\foo\\bar")).toBe("C:/foo/bar");
  });

  it("collapses duplicate slashes", () => {
    expect(normalizePath("a///b//c")).toBe("a/b/c");
  });

  it("handles mixed separators from Windows", () => {
    expect(normalizePath("src\\features/auth\\ui")).toBe("src/features/auth/ui");
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(normalizePath(normalizePath(value))).toBe(normalizePath(value));
      }),
    );
  });

  it("never produces double forward slashes", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(normalizePath(value)).not.toMatch(/\/\//);
      }),
    );
  });
});

describe("isRelativeImportPath", () => {
  it.each(["./foo", "../bar", ".", ".."])("detects %s as relative", (value) => {
    expect(isRelativeImportPath(value)).toBe(true);
  });

  it.each(["@/foo", "foo", "/abs/path", ""])("rejects %s", (value) => {
    expect(isRelativeImportPath(value)).toBe(false);
  });

  it("narrows non-strings to false", () => {
    expect(isRelativeImportPath(null)).toBe(false);
    expect(isRelativeImportPath(42)).toBe(false);
    expect(isRelativeImportPath(undefined)).toBe(false);
  });
});

describe("getAliasRelativePath", () => {
  it("strips plain aliases and slash aliases", () => {
    expect(
      getAliasRelativePath("@/modules/user/application", {
        value: "@",
        withSlash: true,
      }),
    ).toBe("modules/user/application");
    expect(
      getAliasRelativePath("~/features/auth", {
        value: "~",
        withSlash: false,
      }),
    ).toBe("features/auth");
  });

  it("normalizes Windows-style imports before stripping aliases", () => {
    expect(
      getAliasRelativePath("@\\modules\\user\\application", {
        value: "@",
        withSlash: true,
      }),
    ).toBe("modules/user/application");
  });

  it("rejects non-matching aliases", () => {
    expect(
      getAliasRelativePath("#/modules/user", {
        value: "@",
        withSlash: true,
      }),
    ).toBeNull();
  });
});

describe("compileRegexList + matchesAnyRegex", () => {
  it("returns same array reference on repeat calls (cached)", () => {
    const first = compileRegexList(["**/*.test.*", "^foo$"]);
    const second = compileRegexList(["**/*.test.*", "^foo$"]);
    expect(first).toBe(second);
  });

  it("treats plain regex strings as RegExp", () => {
    const [regex] = compileRegexList(["^foo$"]);
    expect(regex!.test("foo")).toBe(true);
    expect(regex!.test("foobar")).toBe(false);
  });

  it("falls back to glob-to-regex when invalid RegExp", () => {
    const [regex] = compileRegexList(["**/*.stories.tsx"]);
    expect(regex!.test("src/features/auth/ui/Button.stories.tsx")).toBe(true);
    expect(regex!.test("src/features/auth/ui/Button.tsx")).toBe(false);
  });

  it("handles Windows-style paths after normalization", () => {
    const regexes = compileRegexList(["**/*.test.*"]);
    expect(matchesAnyRegex(normalizePath("C:\\repo\\foo.test.ts"), regexes)).toBe(true);
  });

  it("returns false on empty lists", () => {
    expect(matchesAnyRegex("anything", compileRegexList([]))).toBe(false);
    expect(matchesAnyRegex("anything", compileRegexList())).toBe(false);
  });
});

describe("getRelativePathFromRoot", () => {
  it("slices after /src/", () => {
    expect(getRelativePathFromRoot("/repo/src/features/auth/index.ts")).toBe(
      "features/auth/index.ts",
    );
  });

  it("normalizes Windows separators before slicing", () => {
    expect(getRelativePathFromRoot("C:\\repo\\src\\shared\\ui\\Button.tsx")).toBe(
      "shared/ui/Button.tsx",
    );
  });

  it("returns null when pattern absent", () => {
    expect(getRelativePathFromRoot("/repo/dist/bundle.js")).toBeNull();
  });

  it("allows custom root pattern", () => {
    expect(getRelativePathFromRoot("/repo/lib/widgets/x.ts", "/lib/")).toBe("widgets/x.ts");
  });
});

describe("extractLayerFromPath / extractLayerFromImportPath", () => {
  it("extracts layer from file path", () => {
    expect(extractLayerFromPath("/repo/src/features/auth/ui/Form.tsx", baseConfig)).toBe(
      "features",
    );
  });

  it("extracts layer from import path with alias", () => {
    expect(extractLayerFromImportPath("@/entities/user/api", baseConfig)).toBe("entities");
  });

  it("returns null for non-FSD first segment", () => {
    expect(extractLayerFromPath("/repo/src/random/foo.ts", baseConfig)).toBeNull();
  });

  it("returns null for relative import", () => {
    expect(extractLayerFromImportPath("./foo", baseConfig)).toBeNull();
  });

  it("returns null when not under /src/", () => {
    expect(extractLayerFromPath("/repo/dist/features/auth/x.ts", baseConfig)).toBeNull();
  });

  describe("folderPattern", () => {
    it("extracts layer from numeric-prefixed folder (regression: previously broken layerIndex)", () => {
      expect(
        extractLayerFromPath("/repo/src/05_features/auth/ui.ts", configWithFolderPattern),
      ).toBe("features");
    });

    it("also returns slice correctly for numeric-prefixed folder", () => {
      expect(
        extractSliceFromPath("/repo/src/05_features/auth/ui.ts", configWithFolderPattern),
      ).toBe("auth");
    });

    it("still works for non-prefixed folder when pattern enabled", () => {
      expect(extractLayerFromPath("/repo/src/features/auth/ui.ts", configWithFolderPattern)).toBe(
        "features",
      );
    });
  });

  describe("custom alias", () => {
    it("resolves layer with ~ alias", () => {
      expect(extractLayerFromImportPath("~/shared/ui", configWithCustomAlias)).toBe("shared");
    });

    it("normalizes alias with trailing slash (regression: was @// before)", () => {
      expect(extractLayerFromImportPath("@/features/auth", configWithSlashAlias)).toBe("features");
    });
  });
});

describe("extractSliceFromPath / extractSliceFromImportPath", () => {
  it("extracts slice from file path", () => {
    expect(extractSliceFromPath("/repo/src/features/auth/ui/Form.tsx", baseConfig)).toBe("auth");
  });

  it("extracts slice from import path", () => {
    expect(extractSliceFromImportPath("@/features/auth/ui", baseConfig)).toBe("auth");
  });

  it("returns null when import has only layer segment", () => {
    expect(extractSliceFromImportPath("@/features", baseConfig)).toBeNull();
  });
});

describe("extractSegmentFromPath / extractSegmentFromImportPath", () => {
  it("extracts segment (slot after slice)", () => {
    expect(extractSegmentFromPath("/repo/src/features/auth/ui/Form.tsx", baseConfig)).toBe("ui");
  });

  it("extracts segment from import path", () => {
    expect(extractSegmentFromImportPath("@/entities/user/api", baseConfig)).toBe("api");
  });
});

describe("isCrossImportPublicApiPath / *ImportPath", () => {
  it("detects @x cross-import on file path", () => {
    expect(
      isCrossImportPublicApiPath(
        "/repo/src/features/checkout/@x/cart/index.ts",
        "cart",
        baseConfig,
      ),
    ).toBe(true);
  });

  it("rejects @x import with wrong consumer slice", () => {
    expect(
      isCrossImportPublicApiPath(
        "/repo/src/features/checkout/@x/cart/index.ts",
        "wrongSlice",
        baseConfig,
      ),
    ).toBe(false);
  });

  it("detects @x cross-import on import path", () => {
    expect(
      isCrossImportPublicApiImportPath("@/features/checkout/@x/cart", "cart", baseConfig),
    ).toBe(true);
  });

  it("rejects non-@x import path", () => {
    expect(
      isCrossImportPublicApiImportPath("@/features/checkout/internal", "cart", baseConfig),
    ).toBe(false);
  });
});

describe("isSharedPublicApiPath", () => {
  it("allows ui index under shared by default (wildcard segments)", () => {
    expect(isSharedPublicApiPath("/repo/src/shared/ui/Button/index.ts")).toBe(true);
  });

  it("allows lib shallow index", () => {
    expect(isSharedPublicApiPath("/repo/src/shared/lib/formatDate/index.ts")).toBe(true);
  });

  it("allows config segment by default (regression: was rejected due to hardcoded ui/lib)", () => {
    expect(isSharedPublicApiPath("/repo/src/shared/config/index.ts")).toBe(true);
  });

  it("respects explicit allowed segments (deny config)", () => {
    expect(isSharedPublicApiPath("/repo/src/shared/config/index.ts", ["ui", "lib"])).toBe(false);
  });

  it("rejects deep non-index paths", () => {
    expect(isSharedPublicApiPath("/repo/src/shared/ui/Button/internal/helpers.ts")).toBe(false);
  });

  it("rejects when not under shared", () => {
    expect(isSharedPublicApiPath("/repo/src/features/auth/index.ts")).toBe(false);
  });
});

describe("getSliceBoundary", () => {
  it("returns layer+slice for standard layer", () => {
    expect(getSliceBoundary("/repo/src/features/auth/ui/Form.tsx", {})).toEqual({
      layer: "features",
      slice: "auth",
    });
  });

  it("returns null slice for single-layer modules (app, shared)", () => {
    expect(getSliceBoundary("/repo/src/app/store/index.ts", {})).toEqual({
      layer: "app",
      slice: null,
    });
  });

  it("returns null when outside known layers", () => {
    expect(getSliceBoundary("/repo/src/random/foo.ts", {})).toBeNull();
  });

  it("returns null when not under /src/", () => {
    expect(getSliceBoundary("/repo/dist/features/auth.ts", {})).toBeNull();
  });
});

describe("resolveRelativeImport + isSameSliceImport", () => {
  it("resolves ../sibling relative path", () => {
    const resolved = resolveRelativeImport(
      "/repo/src/features/auth/ui/Form.tsx",
      "../model/store.ts",
    );
    expect(resolved).toBe("/repo/src/features/auth/model/store.ts");
  });

  it("detects same-slice relative import", () => {
    expect(isSameSliceImport("/repo/src/features/auth/ui/Form.tsx", "../model/store", {})).toBe(
      true,
    );
  });

  it("rejects cross-slice relative import", () => {
    expect(isSameSliceImport("/repo/src/features/auth/ui/Form.tsx", "../../billing/api", {})).toBe(
      false,
    );
  });
});

describe("property: parseFilePathParts round-trip", () => {
  const knownLayers = ["app", "processes", "pages", "widgets", "features", "entities", "shared"];

  it("any known layer + arbitrary slice produces correct layer extraction", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...knownLayers),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        (layer, slice) => {
          const filePath = `/repo/src/${layer}/${slice}/ui/X.tsx`;
          expect(extractLayerFromPath(filePath, baseConfig)).toBe(layer);
        },
      ),
    );
  });

  it("cross-import @x always validates when slice matches", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
        (consumerSlice, producerSlice) => {
          const resolvedPath = `/repo/src/features/${producerSlice}/@x/${consumerSlice}/index.ts`;
          expect(isCrossImportPublicApiPath(resolvedPath, consumerSlice, baseConfig)).toBe(true);
        },
      ),
    );
  });
});
