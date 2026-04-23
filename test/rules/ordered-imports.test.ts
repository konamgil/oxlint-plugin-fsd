import path from "node:path";

import { expect, test } from "vitest";

import {
  readFixtureFile,
  runOxlint,
  runOxlintFix,
  runFixture,
  withTempFixture,
} from "../utils/oxlint.js";

test("ordered-imports reports one ordering violation", () => {
  const result = runFixture("ordered-imports");

  expect(result.status).not.toBe(0);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.code).toBe("fsd(ordered-imports)");
  expect(result.diagnostics[0]?.filename).toContain("features/tasks/ui/Panel.ts");
});

test("ordered-imports applies autofix to reorder imports", () => {
  withTempFixture("ordered-imports", (root) => {
    const configPath = path.join(root, ".oxlintrc.json");
    const targetPath = path.join(root, "src");

    const result = runOxlintFix(configPath, targetPath);
    expect([0, 1]).toContain(result.status);

    const fileAfterFix = readFixtureFile(root, "src", "features", "tasks", "ui", "Panel.ts");
    expect(fileAfterFix).toContain('import { taskModel } from "@/features/tasks/model";');
    expect(fileAfterFix).toContain('import { formatDate } from "@/shared/lib/date";');
    expect(fileAfterFix.indexOf('import { taskModel } from "@/features/tasks/model";')).toBeLessThan(
      fileAfterFix.indexOf('import { formatDate } from "@/shared/lib/date";'),
    );

    const rerun = runOxlint(configPath, targetPath);
    expect(rerun.status).toBe(0);
    expect(rerun.diagnostics).toHaveLength(0);
  });
});

test("ordered-imports preserves leading comments while fixing", () => {
  withTempFixture("ordered-imports-comments", (root) => {
    const configPath = path.join(root, ".oxlintrc.json");
    const targetPath = path.join(root, "src");

    const beforeFix = readFixtureFile(root, "src", "features", "tasks", "ui", "Panel.ts");
    expect(beforeFix.startsWith("// important comment for imports")).toBe(true);

    const result = runOxlintFix(configPath, targetPath);
    expect([0, 1]).toContain(result.status);

    const afterFix = readFixtureFile(root, "src", "features", "tasks", "ui", "Panel.ts");
    expect(afterFix.startsWith("// important comment for imports")).toBe(true);
    expect(afterFix.indexOf('import { taskModel } from "@/features/tasks/model";')).toBeLessThan(
      afterFix.indexOf('import { formatDate } from "@/shared/lib/date";'),
    );
  });
});

test("ordered-imports applies configured groups and separators", () => {
  withTempFixture("ordered-imports-groups", (root) => {
    const configPath = path.join(root, ".oxlintrc.json");
    const targetPath = path.join(root, "src");

    const result = runOxlintFix(configPath, targetPath);
    expect([0, 1]).toContain(result.status);

    const afterFix = readFixtureFile(root, "src", "features", "tasks", "ui", "Panel.ts");
    expect(afterFix).toContain(
      'import React from "react";\n\nimport { formatDate } from "@/shared/lib/date";',
    );
    expect(afterFix).toContain(
      'import { formatDate } from "@/shared/lib/date";\n\nimport { taskModel } from "@/features/tasks/model";',
    );
    expect(afterFix).toContain(
      'import { taskModel } from "@/features/tasks/model";\n\nimport { editorPage } from "@/pages/editor";',
    );
    expect(afterFix).toContain(
      'import { editorPage } from "@/pages/editor";\n\nimport { localUtil } from "./local";',
    );
  });
});

test("ordered-imports skips test files", () => {
  const result = runFixture("ordered-imports-test-file");

  expect(result.status).toBe(0);
  expect(result.diagnostics).toHaveLength(0);
});

test("ordered-imports does not autofix when side-effect imports are present", () => {
  withTempFixture("ordered-imports-side-effect", (root) => {
    const configPath = path.join(root, ".oxlintrc.json");
    const targetPath = path.join(root, "src");
    const beforeFix = readFixtureFile(root, "src", "features", "tasks", "ui", "Panel.ts");

    const result = runOxlintFix(configPath, targetPath);
    expect(result.status).toBe(1);

    const afterFix = readFixtureFile(root, "src", "features", "tasks", "ui", "Panel.ts");
    expect(afterFix).toBe(beforeFix);

    const rerun = runOxlint(configPath, targetPath);
    expect(rerun.status).toBe(1);
    expect(rerun.diagnostics).toHaveLength(1);
  });
});
