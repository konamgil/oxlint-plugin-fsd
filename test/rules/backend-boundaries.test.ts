import path from "node:path";

import { expect, test } from "vitest";

import { fixturePath, runFixture, runOxlint } from "../utils/oxlint.js";

const BACKEND_BOUNDARIES_CODE = "fsd(backend-boundaries)";

function backendDiagnostics(result: ReturnType<typeof runFixture>) {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === BACKEND_BOUNDARIES_CODE);
}

function configPath(fixtureName: string, configName = ".oxlintrc.json"): string {
  return path.join(fixturePath(fixtureName), configName);
}

function targetPath(fixtureName: string, ...segments: string[]): string {
  return path.join(fixturePath(fixtureName), ...segments);
}

test("backend-boundaries allows valid backend layer and public API imports", () => {
  const result = runFixture("backend-boundaries-valid");

  expect(result.status).toBe(0);
  expect(backendDiagnostics(result)).toHaveLength(0);
});

test("backend-boundaries reports invalid layer direction imports", () => {
  const result = runFixture("backend-boundaries-layer");

  expect(result.status).not.toBe(0);
  const diagnostics = backendDiagnostics(result);
  expect(diagnostics).toHaveLength(3);
  expect(diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        filename: expect.stringContaining("modules/work/api/work.controller.ts"),
        message: expect.stringContaining("'module-api' cannot import 'module-domain'"),
      }),
      expect.objectContaining({
        filename: expect.stringContaining("modules/work/domain/model.ts"),
        message: expect.stringContaining("'module-domain' cannot import 'module-infra'"),
      }),
      expect.objectContaining({
        filename: expect.stringContaining("shared/token.ts"),
        message: expect.stringContaining("'shared' cannot import 'core'"),
      }),
    ]),
  );
});

test("backend-boundaries reports cross-module deep imports even when layers are allowed", () => {
  const result = runFixture("backend-boundaries-cross-public-api");

  expect(result.status).not.toBe(0);
  const diagnostics = backendDiagnostics(result);
  expect(diagnostics).toHaveLength(3);
  expect(diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        filename: expect.stringContaining("modules/work/api/work.controller.ts"),
        message: expect.stringContaining("Cross-module import from 'work' to 'user'"),
      }),
      expect.objectContaining({
        filename: expect.stringContaining("modules/work/api/type-only.ts"),
        message: expect.stringContaining("Cross-module import from 'work' to 'user'"),
      }),
      expect.objectContaining({
        filename: expect.stringContaining("modules/work/service/root.service.ts"),
        message: expect.stringContaining("Cross-module import from 'work' to 'user'"),
      }),
    ]),
  );
});

test("backend-boundaries can disable cross-module public API enforcement", () => {
  const result = runOxlint(
    configPath("backend-boundaries-cross-public-api", ".oxlintrc-no-cross-public-api.json"),
    targetPath("backend-boundaries-cross-public-api", "src"),
  );

  expect(result.status).toBe(0);
  expect(backendDiagnostics(result)).toHaveLength(0);
});

test("backend-boundaries can ignore type-only imports", () => {
  const typeOnlyFile = targetPath(
    "backend-boundaries-cross-public-api",
    "src",
    "modules",
    "work",
    "api",
    "type-only.ts",
  );

  const defaultResult = runOxlint(configPath("backend-boundaries-cross-public-api"), typeOnlyFile);
  expect(defaultResult.status).not.toBe(0);
  expect(backendDiagnostics(defaultResult)).toHaveLength(1);

  const allowTypeImportsResult = runOxlint(
    configPath("backend-boundaries-cross-public-api", ".oxlintrc-allow-type-imports.json"),
    typeOnlyFile,
  );
  expect(allowTypeImportsResult.status).toBe(0);
  expect(backendDiagnostics(allowTypeImportsResult)).toHaveLength(0);
});

test("backend-boundaries allows same-module same-layer imports by default", () => {
  const result = runFixture("backend-boundaries-same-layer");

  expect(result.status).toBe(0);
  expect(backendDiagnostics(result)).toHaveLength(0);
});

test("backend-boundaries can disallow same-module same-layer imports", () => {
  const result = runOxlint(
    configPath("backend-boundaries-same-layer", ".oxlintrc-disallow-same-layer.json"),
    targetPath("backend-boundaries-same-layer", "src"),
  );

  expect(result.status).not.toBe(0);
  const diagnostics = backendDiagnostics(result);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toEqual(
    expect.objectContaining({
      filename: expect.stringContaining("modules/work/application/use-case.ts"),
      message: expect.stringContaining("'module-application' cannot import 'module-application'"),
    }),
  );
});
