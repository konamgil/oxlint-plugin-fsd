import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { __internal_createLRU as createLRU } from "../../src/utils/path.js";

describe("createLRU", () => {
  it("returns undefined on miss", () => {
    const lru = createLRU<string, number>(3);
    expect(lru.has("x")).toBe(false);
    expect(lru.get("x")).toBeUndefined();
  });

  it("stores and retrieves", () => {
    const lru = createLRU<string, number>(3);
    lru.set("a", 1);
    expect(lru.has("a")).toBe(true);
    expect(lru.get("a")).toBe(1);
  });

  it("distinguishes null from miss", () => {
    const lru = createLRU<string, number | null>(3);
    lru.set("a", null);
    expect(lru.has("a")).toBe(true);
    expect(lru.get("a")).toBeNull();
  });

  it("evicts least-recently-used entry when over capacity", () => {
    const lru = createLRU<string, number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("c", 3);
    expect(lru.has("a")).toBe(false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
  });

  it("get refreshes recency", () => {
    const lru = createLRU<string, number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.get("a");
    lru.set("c", 3);
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
  });

  it("set on existing key refreshes recency", () => {
    const lru = createLRU<string, number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("a", 100);
    lru.set("c", 3);
    expect(lru.has("a")).toBe(true);
    expect(lru.get("a")).toBe(100);
    expect(lru.has("b")).toBe(false);
  });

  it("never exceeds max size", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(fc.tuple(fc.string(), fc.integer()), { maxLength: 100 }),
        (max, entries) => {
          const lru = createLRU<string, number>(max);
          for (const [key, value] of entries) {
            lru.set(key, value);
          }
          const uniqueKeys = new Set(entries.map(([k]) => k));
          let size = 0;
          for (const key of uniqueKeys) {
            if (lru.has(key)) size += 1;
          }
          expect(size).toBeLessThanOrEqual(max);
        },
      ),
    );
  });
});
