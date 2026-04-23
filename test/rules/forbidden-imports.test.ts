import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("forbidden-imports reports one invalid higher-layer import", () => {
  const result = runFixture("forbidden-imports");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(forbidden-imports)");
  expect(result.diagnostics[0]?.filename).toContain("features/tasks/ui/Panel.ts");
});

test("forbidden-imports allows cross-imports through @x public API", () => {
  const result = runFixture("forbidden-imports-cross-public-api");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("forbidden-imports allows cross-imports through @x index public API", () => {
  const result = runFixture("forbidden-imports-cross-public-api-index");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("forbidden-imports reports invalid @x imports for the wrong consumer slice", () => {
  const result = runFixture("forbidden-imports-invalid-cross-public-api");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.filename).toContain("entities/cart/ui/BadSmallCart.ts");
});

test("forbidden-imports reports direct imports to higher-layer root files", () => {
  const result = runFixture("forbidden-imports-direct-higher-layer");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.filename).toContain("entities/cart/lib/count-cart-items.ts");
});

test("forbidden-imports resolves paths from referenced tsconfig projects", () => {
  const result = runFixture("forbidden-imports-referenced-tsconfig-paths");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.filename).toContain("features/comments/ui/CommentCard.ts");
});
