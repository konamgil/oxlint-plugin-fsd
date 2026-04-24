import { describe, expect, it } from "vitest";

import { createImportRule } from "../../src/utils/create-import-rule.js";

describe("createImportRule", () => {
  it("passes meta through verbatim", () => {
    const meta = {
      type: "problem" as const,
      messages: { test: "hit" },
      schema: [],
    };
    const rule = createImportRule({
      meta,
      mergeConfig: () => ({ testFilesPatterns: [] }),
      checkImport: () => {},
    });
    expect(rule.meta).toBe(meta);
  });

  it("exposes createOnce entry point", () => {
    const rule = createImportRule({
      meta: { type: "problem", messages: {} },
      mergeConfig: () => ({ testFilesPatterns: [] }),
      checkImport: () => {},
    });
    expect("createOnce" in rule).toBe(true);
    expect(typeof (rule as { createOnce?: unknown }).createOnce).toBe("function");
  });
});
