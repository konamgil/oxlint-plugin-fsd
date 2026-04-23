import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

export interface OxlintResult {
  status: number | null;
  stdout: string;
  stderr: string;
  diagnostics: Array<{ code?: string; filename?: string; message?: string }>;
}

export const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const oxlintEntrypoint = path.join(projectRoot, "node_modules", "oxlint", "bin", "oxlint");

export function fixturePath(fixtureName: string): string {
  return path.join(projectRoot, "test", "fixtures", fixtureName);
}

export function runOxlint(configPath: string, targetPath: string, extraArgs: string[] = []): OxlintResult {
  const shouldParseJson = !extraArgs.includes("--fix");
  const args = shouldParseJson
    ? [oxlintEntrypoint, "-c", configPath, targetPath, "--format", "json", ...extraArgs]
    : [oxlintEntrypoint, "-c", configPath, targetPath, ...extraArgs];
  const run = spawnSync(
    process.execPath,
    args,
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );

  if (run.error) {
    throw run.error;
  }

  if (!shouldParseJson) {
    return {
      status: run.status,
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      diagnostics: [],
    };
  }

  if (typeof run.stdout !== "string" || run.stdout.trim().length === 0) {
    throw new Error(`Oxlint did not return JSON output.\nSTDERR:\n${run.stderr ?? ""}`);
  }

  const report = JSON.parse(run.stdout);
  const diagnostics = Array.isArray(report)
    ? report.flatMap((entry) => entry.diagnostics ?? [])
    : Array.isArray(report.diagnostics)
      ? report.diagnostics
      : [];

  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr ?? "",
    diagnostics,
  };
}

export function runOxlintFix(configPath: string, targetPath: string): OxlintResult {
  return runOxlint(configPath, targetPath, ["--fix"]);
}

export function runFixture(fixtureName: string, extraArgs: string[] = []): OxlintResult {
  const root = fixturePath(fixtureName);
  const configPath = path.join(root, ".oxlintrc.json");
  const targetPath = path.join(root, "src");
  return runOxlint(configPath, targetPath, extraArgs);
}

export function withTempFixture<T>(fixtureName: string, run: (root: string) => T): T {
  const sourceRoot = fixturePath(fixtureName);
  const tempRoot = mkdtempSync(path.join(tmpdir(), "oxlint-plugin-fsd-"));

  cpSync(sourceRoot, tempRoot, { recursive: true });
  const sourceConfigPath = path.join(sourceRoot, ".oxlintrc.json");
  const tempConfigPath = path.join(tempRoot, ".oxlintrc.json");

  if (existsSync(sourceConfigPath) && existsSync(tempConfigPath)) {
    const sourceConfig = JSON.parse(readFileSync(sourceConfigPath, "utf8")) as {
      jsPlugins?: string[];
    };
    const tempConfig = JSON.parse(readFileSync(tempConfigPath, "utf8")) as {
      jsPlugins?: string[];
    };

    if (Array.isArray(sourceConfig.jsPlugins) && Array.isArray(tempConfig.jsPlugins)) {
      tempConfig.jsPlugins = sourceConfig.jsPlugins.map((pluginPath) =>
        path.isAbsolute(pluginPath) ? pluginPath : path.resolve(sourceRoot, pluginPath),
      );
      writeFileSync(tempConfigPath, `${JSON.stringify(tempConfig, null, 2)}\n`, "utf8");
    }
  }

  try {
    return run(tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function readFixtureFile(root: string, ...segments: string[]): string {
  return readFileSync(path.join(root, ...segments), "utf8");
}
