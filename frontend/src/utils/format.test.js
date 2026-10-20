import { describe, expect, it } from "vitest";
import { formatDayLabel, formatHours, formatRelative, plural, truncate } from "./format.js";

describe("formatRelative", () => {
  const now = new Date("2026-10-19T12:00:00Z").getTime();

  it("describes past times in friendly units", () => {
    expect(formatRelative("2026-10-19T11:59:40Z", now)).toBe("just now");
    expect(formatRelative("2026-10-19T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelative("2026-10-18T12:00:00Z", now)).toBe("yesterday");
    expect(formatRelative("2026-10-16T12:00:00Z", now)).toBe("3 days ago");
  });
});

describe("other formatters", () => {
  it("formats durations", () => {
    expect(formatHours(null)).toBe("-");
    expect(formatHours(0.4)).toBe("under 1 hour");
    expect(formatHours(5)).toBe("5 hours");
    expect(formatHours(60)).toBe("2.5 days");
  });

  it("labels calendar days without time-zone drift", () => {
    expect(formatDayLabel("2026-10-19")).toBe("19 Oct");
    expect(formatDayLabel("2026-01-01")).toBe("1 Jan");
  });

  it("pluralises and truncates", () => {
    expect(plural(1, "request")).toBe("1 request");
    expect(plural(3, "request")).toBe("3 requests");
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("a very long sentence indeed", 10)).toBe("a very lo…");
  });
});
