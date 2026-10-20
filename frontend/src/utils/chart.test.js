import { describe, expect, it } from "vitest";
import { compactNumber, labelIndexes, niceScale } from "./chart.js";

describe("niceScale", () => {
  it("gives whole-number ticks that cover the data", () => {
    expect(niceScale(0)).toEqual({ top: 1, ticks: [0, 1] });
    expect(niceScale(3)).toEqual({ top: 3, ticks: [0, 1, 2, 3] });
    expect(niceScale(7)).toEqual({ top: 8, ticks: [0, 2, 4, 6, 8] });
    expect(niceScale(43)).toEqual({ top: 60, ticks: [0, 20, 40, 60] });
  });

  it("never has a top below the largest value", () => {
    for (const max of [1, 2, 5, 9, 11, 99, 100, 101, 1234]) {
      expect(niceScale(max).top).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("labelIndexes", () => {
  it("always includes the first and last point and never too many", () => {
    const indexes = labelIndexes(30, 600);
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(29);
    expect(indexes.length).toBeLessThanOrEqual(Math.floor(600 / 64));
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("handles tiny series", () => {
    expect(labelIndexes(1, 300)).toEqual([0]);
    expect(labelIndexes(2, 300)).toEqual([0, 1]);
  });
});

describe("compactNumber", () => {
  it("compacts from a thousand up", () => {
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(1000)).toBe("1K");
    expect(compactNumber(12900)).toBe("12.9K");
  });
});
