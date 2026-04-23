import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("no-relative-imports reports one cross-slice relative import", () => {
  const result = runFixture("no-relative-imports");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(no-relative-imports)");
  expect(result.diagnostics[0]?.filename).toContain("features/tasks/ui/Card.ts");
});

test("no-relative-imports can disallow same-slice relative imports via config", () => {
  const result = runFixture("no-relative-imports-disallow-same-slice");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(no-relative-imports)");
});
