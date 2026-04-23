import type { Context } from "@oxlint/plugins";

// Oxlint's createOnce API initializes the rule before per-file options are attached.
// Read options inside `before` / visitor hooks, not at createOnce definition time.
export function getRuleOptions<T extends object>(context: Context): T {
  const rawOptions = (context as Context & { options?: unknown }).options;

  if (Array.isArray(rawOptions)) {
    return (rawOptions[0] ?? {}) as T;
  }

  if (rawOptions && typeof rawOptions === "object") {
    return rawOptions as T;
  }

  return {} as T;
}
