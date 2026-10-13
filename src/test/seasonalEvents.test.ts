// seasonalEvents.test.ts — tests for the seasonal event logic.
import { describe, expect, it } from "vitest";
import {
  AUTUMN_EVENT,
  SEASONAL_EVENTS,
  buildLeaves,
  eventOrdinal,
  getActiveEvent,
  isEventActive,
  resolveTheme,
  seededRandom,
} from "@/lib/seasonalEvents";
import { formatCountdown } from "@/components/SeasonalEventLayer";

describe("eventOrdinal", () => {
  it("sorts dates by month then day", () => {
    expect(eventOrdinal(10, 1)).toBe(1001);
    expect(eventOrdinal(10, 31)).toBeGreaterThan(eventOrdinal(10, 22));
    expect(eventOrdinal(12, 1)).toBeGreaterThan(eventOrdinal(2, 28));
  });
});

describe("isEventActive", () => {
  const ev = AUTUMN_EVENT; // Sep 22 → Nov 30

  it("is active inside the window", () => {
    expect(isEventActive(ev, new Date(2026, 9, 13))).toBe(true); // Oct 13
    expect(isEventActive(ev, new Date(2026, 8, 22))).toBe(true); // Sep 22 (first day)
    expect(isEventActive(ev, new Date(2026, 10, 30))).toBe(true); // Nov 30 (last day)
  });

  it("is inactive outside the window", () => {
    expect(isEventActive(ev, new Date(2026, 8, 21))).toBe(false); // day before
    expect(isEventActive(ev, new Date(2026, 11, 1))).toBe(false); // day after
    expect(isEventActive(ev, new Date(2026, 0, 1))).toBe(false); // January
    expect(isEventActive(ev, new Date(2026, 6, 4))).toBe(false); // July
  });
});

describe("getActiveEvent", () => {
  it("finds autumn during the window", () => {
    expect(getActiveEvent(new Date(2026, 9, 13))?.id).toBe("autumn");
  });

  it("finds nothing in winter", () => {
    expect(getActiveEvent(new Date(2026, 0, 15))).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("auto-detects from the date window", () => {
    expect(resolveTheme(new Date(2026, 9, 13), "").theme).toBe("autumn");
    expect(resolveTheme(new Date(2026, 1, 13), "").theme).toBe("default");
  });

  it("honours ?event=off", () => {
    expect(resolveTheme(new Date(2026, 9, 13), "?event=off").theme).toBe("default");
    expect(resolveTheme(new Date(2026, 9, 13), "?event=off").event).toBeNull();
  });

  it("honours ?event=default", () => {
    expect(resolveTheme(new Date(2026, 9, 13), "?event=default").theme).toBe("default");
  });

  it("forces an event on with ?event=autumn even out of season", () => {
    const r = resolveTheme(new Date(2026, 1, 13), "?event=autumn");
    expect(r.theme).toBe("autumn");
    expect(r.event?.id).toBe("autumn");
  });

  it("ignores an unknown event param and falls back to the window", () => {
    expect(resolveTheme(new Date(2026, 9, 13), "?event=halloween").theme).toBe("autumn");
    expect(resolveTheme(new Date(2026, 1, 13), "?event=halloween").theme).toBe("default");
  });
});

describe("seededRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rnd = seededRandom(99);
    for (let i = 0; i < 200; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs between seeds", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe("buildLeaves", () => {
  it("creates the requested count with sane ranges", () => {
    const leaves = buildLeaves(10, AUTUMN_EVENT.palette.leaf);
    expect(leaves).toHaveLength(10);
    for (const leaf of leaves) {
      expect(leaf.left).toBeGreaterThanOrEqual(0);
      expect(leaf.left).toBeLessThanOrEqual(100);
      expect(leaf.delay).toBeGreaterThanOrEqual(0);
      expect(leaf.duration).toBeGreaterThan(0);
      expect(leaf.scale).toBeGreaterThan(0);
      expect(AUTUMN_EVENT.palette.leaf).toContain(leaf.color);
    }
  });

  it("is stable across calls (no re-shuffle on re-render)", () => {
    expect(buildLeaves(5, ["#fff"])).toEqual(buildLeaves(5, ["#fff"]));
  });

  it("varies positions and durations across leaves", () => {
    const leaves = buildLeaves(24, AUTUMN_EVENT.palette.leaf);
    expect(new Set(leaves.map((l) => l.left)).size).toBeGreaterThan(15);
    expect(new Set(leaves.map((l) => l.duration)).size).toBeGreaterThan(5);
  });

  it("falls back to a safe colour for an empty palette", () => {
    const leaves = buildLeaves(3, []);
    expect(leaves[0].color).toBeTruthy();
  });

  it("always includes every registered event", () => {
    expect(SEASONAL_EVENTS).toContain(AUTUMN_EVENT);
    expect(SEASONAL_EVENTS.length).toBeGreaterThan(0);
  });
});

describe("formatCountdown", () => {
  it("formats days, hours and minutes", () => {
    expect(formatCountdown(2 * 86400_000 + 4 * 3600_000 + 10 * 60_000)).toBe("2d 4h 10m");
  });

  it("formats hours when under a day", () => {
    expect(formatCountdown(3 * 3600_000 + 25 * 60_000)).toBe("3h 25m");
  });

  it("formats minutes and seconds when under an hour", () => {
    expect(formatCountdown(2 * 60_000 + 5_000)).toBe("2m 5s");
  });

  it("formats seconds alone", () => {
    expect(formatCountdown(12_000)).toBe("12s");
  });

  it("clamps negatives to zero", () => {
    expect(formatCountdown(-5000)).toBe("0s");
  });
});
