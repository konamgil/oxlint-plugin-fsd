import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("no-global-store-imports reports one direct app store import", () => {
  const result = runFixture("no-global-store-imports");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(no-global-store-imports)");
  expect(result.diagnostics[0]?.filename).toContain("features/tasks/model/state.ts");
});

test("no-global-store-imports allows configured paths", () => {
  const result = runFixture("no-global-store-imports-allowed-paths");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});
