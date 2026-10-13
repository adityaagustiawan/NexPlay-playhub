// seasonalEvents.test.ts — tests for the seasonal event window logic.
import { describe, expect, it } from "vitest";
import {
  AUTUMN_EVENT,
  EVENT_STORAGE_KEY,
  SEASONAL_EVENTS,
  buildLeaves,
  eventOrdinal,
  findEvent,
  getActiveEvent,
  isEventActive,
  resolveTheme,
  seededRandom,
  setEventOverride,
  prefersReducedMotion,
  type SeasonalEvent,
} from "@/lib/seasonalEvents";

const at = (iso: string) => new Date(iso);

describe("eventOrdinal", () => {
  it("produces a comparable MMDD number", () => {
    expect(eventOrdinal(1, 1)).toBe(101);
    expect(eventOrdinal(10, 31)).toBe(1031);
  });

  it("orders dates correctly within a year", () => {
    expect(eventOrdinal(10, 22)).toBeGreaterThan(eventOrdinal(10, 1));
    expect(eventOrdinal(11, 1)).toBeGreaterThan(eventOrdinal(10, 31));
  });
});

describe("isEventActive", () => {
  const event: SeasonalEvent = {
    id: "autumn",
    name: "Autumn",
    tagline: "",
    start: { month: 9, day: 22 },
    end: { month: 11, day: 30 },
    palette: { leaf: [], glow: "" },
  };

  it("is active on the first day of the window", () => {
    expect(isEventActive(event, at("2026-09-22T12:00:00Z"))).toBe(true);
  });

  it("is active on the last day of the window", () => {
    expect(isEventActive(event, at("2026-11-30T23:59:00Z"))).toBe(true);
  });

  it("is inactive the day before the window", () => {
    expect(isEventActive(event, at("2026-09-21T23:59:00Z"))).toBe(false);
  });

  it("is inactive the day after the window", () => {
    expect(isEventActive(event, at("2026-12-01T00:00:00Z"))).toBe(false);
  });

  it("is inactive in the middle of summer", () => {
    expect(isEventActive(event, at("2026-07-04T12:00:00Z"))).toBe(false);
  });

  it("handles a window that wraps the new year", () => {
    const winter: SeasonalEvent = { ...event, start: { month: 12, day: 15 }, end: { month: 2, day: 15 } };
    expect(isEventActive(winter, at("2026-12-24T12:00:00Z"))).toBe(true);
    expect(isEventActive(winter, at("2027-01-05T12:00:00Z"))).toBe(true);
    expect(isEventActive(winter, at("2027-02-16T12:00:00Z"))).toBe(false);
    expect(isEventActive(winter, at("2026-12-14T12:00:00Z"))).toBe(false);
  });
});

describe("getActiveEvent", () => {
  it("returns the autumn event during October", () => {
    expect(getActiveEvent(at("2026-10-13T12:00:00Z"))?.id).toBe("autumn");
  });

  it("returns null outside any window", () => {
    expect(getActiveEvent(at("2026-06-01T12:00:00Z"))).toBeNull();
  });

  it("returns null in deep winter", () => {
    expect(getActiveEvent(at("2027-01-15T12:00:00Z"))).toBeNull();
  });
});

describe("findEvent", () => {
  it("finds a registered event by id", () => {
    expect(findEvent("autumn")?.id).toBe("autumn");
  });

  it("returns null for an unknown id", () => {
    expect(findEvent("halloween")).toBeNull();
  });
});

describe("resolveTheme", () => {
  // localStorage is unavailable in node; resolveTheme falls back to null.
  it("returns autumn during the window with no override", () => {
    const { theme, event } = resolveTheme(at("2026-10-13T12:00:00Z"), "");
    expect(theme).toBe("autumn");
    expect(event?.id).toBe("autumn");
  });

  it("returns default outside the window", () => {
    const { theme, event } = resolveTheme(at("2026-06-01T12:00:00Z"), "");
    expect(theme).toBe("default");
    expect(event).toBeNull();
  });

  it("?event=autumn forces autumn even out of season", () => {
    const { theme, event } = resolveTheme(at("2026-06-01T12:00:00Z"), "?event=autumn");
    expect(theme).toBe("autumn");
    expect(event?.id).toBe("autumn");
  });

  it("?event=off forces the default theme during the event", () => {
    const { theme, event } = resolveTheme(at("2026-10-13T12:00:00Z"), "?event=off");
    expect(theme).toBe("default");
    expect(event).toBeNull();
  });

  it("?event=default also disables the event", () => {
    const { theme } = resolveTheme(at("2026-10-13T12:00:00Z"), "?event=default");
    expect(theme).toBe("default");
  });

  it("ignores an unknown event id and uses the date window", () => {
    const { theme } = resolveTheme(at("2026-10-13T12:00:00Z"), "?event=winter");
    expect(theme).toBe("autumn");
  });

  it("is case-insensitive on the override", () => {
    const { theme } = resolveTheme(at("2026-06-01T12:00:00Z"), "?event=AUTUMN");
    expect(theme).toBe("autumn");
  });
});

describe("seededRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect(a()).not.toBe(b());
  });

  it("stays inside [0, 1)", () => {
    const rnd = seededRandom(7);
    for (let i = 0; i < 200; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("buildLeaves", () => {
  it("builds the requested number of leaves", () => {
    expect(buildLeaves(14, ["#fff"])).toHaveLength(14);
  });

  it("is deterministic for the same seed and palette", () => {
    expect(buildLeaves(10, ["#a", "#b"], 3)).toEqual(buildLeaves(10, ["#a", "#b"], 3));
  });

  it("differs between seeds", () => {
    expect(buildLeaves(10, ["#fff"], 1)).not.toEqual(buildLeaves(10, ["#fff"], 2));
  });

  it("cycles the palette so every leaf has a colour", () => {
    const palette = ["#111", "#222", "#333"];
    const leaves = buildLeaves(5, palette, 7);
    for (const leaf of leaves) expect(palette).toContain(leaf.color);
  });

  it("falls back to a default colour for an empty palette", () => {
    const leaves = buildLeaves(3, [], 7);
    for (const leaf of leaves) expect(leaf.color).toBe("#d97706");
  });

  it("keeps leaf positions on screen and timings positive", () => {
    const leaves = buildLeaves(20, ["#d97706"], 7);
    for (const leaf of leaves) {
      expect(leaf.left).toBeGreaterThanOrEqual(0);
      expect(leaf.left).toBeLessThanOrEqual(100);
      expect(leaf.duration).toBeGreaterThan(0);
      expect(leaf.delay).toBeLessThanOrEqual(12);
      expect(leaf.scale).toBeGreaterThan(0);
      expect(leaf.tone).toBeGreaterThanOrEqual(0);
      expect(leaf.tone).toBeLessThan(1);
    }
  });
});

describe("registry integrity", () => {
  it("exports exactly one event", () => {
    expect(SEASONAL_EVENTS).toHaveLength(1);
    expect(SEASONAL_EVENTS[0]).toBe(AUTUMN_EVENT);
  });

  it("gives every event a palette and copy", () => {
    for (const ev of SEASONAL_EVENTS) {
      expect(ev.name.length).toBeGreaterThan(0);
      expect(ev.tagline.length).toBeGreaterThan(0);
      expect(ev.palette.leaf.length).toBeGreaterThan(0);
      expect(ev.palette.glow).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("covers the current date (today is inside the autumn window)", () => {
    expect(getActiveEvent(new Date())?.id).toBe("autumn");
  });
});

describe("prefersReducedMotion", () => {
  it("returns false when matchMedia is unavailable", () => {
    const original = window.matchMedia;
    const holder = window as unknown as { matchMedia?: typeof window.matchMedia };
    delete holder.matchMedia;
    try {
      expect(prefersReducedMotion()).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it("reads the media query when available", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q })) as typeof window.matchMedia;
    try {
      expect(prefersReducedMotion()).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });
});
