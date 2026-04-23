import { expect, test } from "vitest";

import { runFixture } from "../utils/oxlint.js";

test("no-public-api-sidestep reports slice sidesteps including segment-root imports", () => {
  const result = runFixture("no-public-api-sidestep");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(2);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    "fsd(no-public-api-sidestep)",
    "fsd(no-public-api-sidestep)",
  ]);
  expect(result.diagnostics.map((diagnostic) => diagnostic.filename)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("widgets/header/ui/Allowed.ts"),
      expect.stringContaining("widgets/header/ui/Header.ts"),
    ]),
  );
});

test("no-public-api-sidestep allows cross-import public APIs", () => {
  const result = runFixture("no-public-api-sidestep-cross-public-api");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("no-public-api-sidestep allows multiple explicit public API files", () => {
  const result = runFixture("no-public-api-sidestep-multi-public-api");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("no-public-api-sidestep allows shared/lib nested public APIs", () => {
  const result = runFixture("no-public-api-sidestep-shared-lib-allowed");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("no-public-api-sidestep reports shared/lib deep imports", () => {
  const result = runFixture("no-public-api-sidestep-shared-lib-deep");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.filename).toContain("pages/settings/ui/Password.ts");
});

test("no-public-api-sidestep reports shared/ui direct file imports", () => {
  const result = runFixture("no-public-api-sidestep-shared-ui-deep");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.filename).toContain("pages/editor/ui/SubmitButton.ts");
});

test("no-public-api-sidestep allows type-only deep imports when configured", () => {
  const result = runFixture("no-public-api-sidestep-allow-type-imports");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});
