import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("no-ui-in-business-logic reports one ui import from model", () => {
  const result = runFixture("no-ui-in-business-logic");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(no-ui-in-business-logic)");
  expect(result.diagnostics[0]?.filename).toContain("entities/user/model/state.ts");
});
