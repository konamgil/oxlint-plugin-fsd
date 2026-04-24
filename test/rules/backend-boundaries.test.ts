import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("backend-boundaries enforces module layers and cross-module public APIs", () => {
  const result = runFixture("backend-boundaries");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(7);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    "fsd(backend-boundaries)",
    "fsd(backend-boundaries)",
    "fsd(backend-boundaries)",
    "fsd(backend-boundaries)",
    "fsd(backend-boundaries)",
    "fsd(backend-boundaries)",
    "fsd(backend-boundaries)",
  ]);
});
