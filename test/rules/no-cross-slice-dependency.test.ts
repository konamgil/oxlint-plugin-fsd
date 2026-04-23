import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("no-cross-slice-dependency reports one same-layer cross-slice import", () => {
  const result = runFixture("no-cross-slice-dependency");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(no-cross-slice-dependency)");
  expect(result.diagnostics[0]?.filename).toContain("features/tasks/ui/Panel.ts");
});

test("no-cross-slice-dependency allows cross-imports through @x public API", () => {
  const result = runFixture("no-cross-slice-dependency-cross-public-api");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("no-cross-slice-dependency allows cross-imports through @x index public API", () => {
  const result = runFixture("no-cross-slice-dependency-cross-public-api-index");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("no-cross-slice-dependency reports invalid @x imports for the wrong consumer slice", () => {
  const result = runFixture("no-cross-slice-dependency-invalid-cross-public-api");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.filename).toContain("entities/cart/ui/BadSmallCart.ts");
});
