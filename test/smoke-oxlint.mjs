import path from "node:path";
import { spawnSync } from "node:child_process";
import { fixtureManifest, projectRoot } from "./fixtures-manifest.mjs";

const oxlintEntrypoint = path.join(projectRoot, "node_modules", "oxlint", "bin", "oxlint");

function runOxlint(configPath, targetPath) {
  const run = spawnSync(
    process.execPath,
    [oxlintEntrypoint, "-c", configPath, targetPath, "--format", "json", "--threads=1"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );

  if (run.error) {
    throw run.error;
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
    diagnostics,
  };
}

for (const testCase of fixtureManifest) {
  const result = runOxlint(testCase.configPath, testCase.targetPath);

  if (testCase.expectedStatus === "invalid" && result.status === 0) {
    throw new Error(`Expected ${testCase.name} fixture to fail, but oxlint exited successfully.`);
  }

  if (testCase.expectedStatus === "valid" && result.status !== 0) {
    throw new Error(
      `Expected ${testCase.name} fixture to pass, but oxlint exited with ${result.status}.`,
    );
  }

  if (result.diagnostics.length !== testCase.expectedDiagnostics) {
    throw new Error(
      `Expected ${testCase.expectedDiagnostics} diagnostics for ${testCase.name}, received ${result.diagnostics.length}.`,
    );
  }

  const diagnosticCodes = result.diagnostics.map((diagnostic) => diagnostic.code);
  if (JSON.stringify(diagnosticCodes) !== JSON.stringify(testCase.expectedCodes)) {
    throw new Error(
      `Expected codes ${JSON.stringify(testCase.expectedCodes)} for ${testCase.name}, received ${JSON.stringify(diagnosticCodes)}.`,
    );
  }
}

console.log("Oxlint smoke test passed.");
