import path from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import { fixtureManifest, projectRoot } from "../test/fixtures-manifest.mjs";

const oxlintEntrypoint = path.join(projectRoot, "node_modules", "oxlint", "bin", "oxlint");
const iterations = Number(process.env.FSD_BENCH_ITERATIONS ?? "5");

function runFixture(configPath, targetPath) {
  const started = performance.now();
  const run = spawnSync(
    process.execPath,
    [oxlintEntrypoint, "-c", configPath, targetPath, "--format", "json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );
  const elapsedMs = performance.now() - started;

  if (run.error) {
    throw run.error;
  }

  return {
    elapsedMs,
    status: run.status ?? 1,
  };
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length > 0 ? sum / sorted.length : 0,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
  };
}

const fixtureResults = [];
for (const fixture of fixtureManifest) {
  const samples = [];

  for (let index = 0; index < iterations; index += 1) {
    const result = runFixture(fixture.configPath, fixture.targetPath);
    samples.push(result.elapsedMs);
  }

  fixtureResults.push({
    name: fixture.name,
    ...summarize(samples),
  });
}

const totalSamples = fixtureResults.map((fixture) => fixture.mean);
const total = summarize(totalSamples);

console.log(`Oxlint FSD benchmark (${iterations} iterations per fixture)`);
console.log("");
for (const fixture of fixtureResults) {
  console.log(
    `${fixture.name.padEnd(44)} mean=${fixture.mean.toFixed(2)}ms min=${fixture.min.toFixed(2)}ms p95=${fixture.p95.toFixed(2)}ms max=${fixture.max.toFixed(2)}ms`,
  );
}
console.log("");
console.log(
  `Aggregate fixture mean: ${total.mean.toFixed(2)}ms | min=${total.min.toFixed(2)}ms | p95=${total.p95.toFixed(2)}ms | max=${total.max.toFixed(2)}ms`,
);
