import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/fixtures/**"],
    environment: "node",
    passWithNoTests: false,
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
  },
});
