// seasonalEvents.ts — date-driven seasonal event registry.
//
// A "seasonal event" is a themed, time-boxed overlay on the site: a colour
// theme (`data-theme` on <html>) plus visual effects (falling leaves, a warm
// vignette, a banner). Windows are recurring year-month/day ranges so they
// come back every year without code changes. `?event=<id>` / `?event=off`
// override detection, which makes any event previewable/testable.

export type ThemeId = "default" | "autumn";

export interface SeasonalEvent {
  id: ThemeId;
  name: string;
  tagline: string;
  badge?: string;
  /** Inclusive recurring start (month 1-12, day 1-31), viewer-local. */
  start: { month: number; day: number };
  /** Inclusive recurring end (month 1-12, day 1-31), viewer-local. */
  end: { month: number; day: number };
  palette: { leaf: string[]; glow: string };
}

/** Autumn equinox → end of November. */
export const AUTUMN_EVENT: SeasonalEvent = {
  id: "autumn",
  name: "Autumn Event",
  tagline: "Maple skies and pumpkin deals — limited-time autumn games and themes.",
  badge: "Autumn",
  start: { month: 9, day: 22 },
  end: { month: 11, day: 30 },
  palette: {
    leaf: ["#d97706", "#b45309", "#f59e0b", "#92400e", "#c2410c", "#a16207"],
    glow: "#f59e0b",
  },
};

export const SEASONAL_EVENTS: SeasonalEvent[] = [AUTUMN_EVENT];

/** MMDD-style comparable ordinal so `1031` sorts after `1022`. */
export const eventOrdinal = (month: number, day: number) => month * 100 + day;

/** True when `now` falls inside the event's recurring yearly window. */
export function isEventActive(event: SeasonalEvent, now: Date): boolean {
  const d = eventOrdinal(now.getMonth() + 1, now.getDate());
  const from = eventOrdinal(event.start.month, event.start.day);
  const to = eventOrdinal(event.end.month, event.end.day);
  // Handles windows that wrap the new year (e.g. Dec → Feb) too.
  return from <= to ? d >= from && d <= to : d >= from || d <= to;
}

/** The first event whose window contains `now`, or null. */
export function getActiveEvent(now: Date): SeasonalEvent | null {
  return SEASONAL_EVENTS.find((e) => isEventActive(e, now)) ?? null;
}

/** Look up an event by id, or null when it is not registered. */
export function findEvent(id: string): SeasonalEvent | null {
  return SEASONAL_EVENTS.find((e) => e.id === id) ?? null;
}

export const EVENT_STORAGE_KEY = "nexconsole:event";

export type EventOverride = ThemeId | "auto";

/**
 * Resolve the effective theme, honouring an explicit override.
 * Override sources, in order: `?event=<id>|off|default`, then localStorage,
 * then the date window. A query param wins and is persisted so the preview
 * survives navigation.
 */
export function resolveTheme(
  now: Date,
  search = typeof window !== "undefined" ? window.location.search : "",
): { theme: ThemeId; event: SeasonalEvent | null } {
  const param = new URLSearchParams(search).get("event");
  const forced = (param ?? readStorage() ?? "").toLowerCase().trim();
  if (forced === "off" || forced === "default" || forced === "") {
    if (forced === "off" || forced === "default") return { theme: "default", event: null };
  }
  const forcedEvent = findEvent(forced);
  if (forcedEvent) return { theme: forcedEvent.id, event: forcedEvent };
  if (forced === "off" || forced === "default") return { theme: "default", event: null };
  const event = getActiveEvent(now);
  return { theme: event ? event.id : "default", event };
}

function readStorage(): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(EVENT_STORAGE_KEY);
    }
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

function writeStorage(value: string | null): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (value === null) window.localStorage.removeItem(EVENT_STORAGE_KEY);
      else window.localStorage.setItem(EVENT_STORAGE_KEY, value);
    }
  } catch {
    /* ignore */
  }
}

/** Persist an override (used when a query param forces a preview). */
export function setEventOverride(value: EventOverride): void {
  writeStorage(value === "auto" ? null : value);
}

/* ------------------------------------------------------------------ leaves */

export interface LeafSpec {
  /** Horizontal start position in %. */
  left: number;
  /** Animation delay in seconds. */
  delay: number;
  /** Fall duration in seconds. */
  duration: number;
  /** Horizontal drift in px over the fall. */
  drift: number;
  /** Total rotation in degrees. */
  spin: number;
  /** Size multiplier (1 = base size). */
  scale: number;
  color: string;
  /** 0–1, used for shape variation and sway speed. */
  tone: number;
}

/** mulberry32 — small deterministic PRNG so leaf layout is stable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build `count` leaf specs deterministically for a given seed. */
export function buildLeaves(count: number, palette: string[], seed = 7): LeafSpec[] {
  const rnd = seededRandom(seed);
  const safePalette = palette.length ? palette : ["#d97706"];
  const leaves: LeafSpec[] = [];
  for (let i = 0; i < count; i++) {
    leaves.push({
      left: Math.round(rnd() * 10000) / 100,
      delay: Math.round(rnd() * 12000) / 1000,
      duration: 9 + Math.round(rnd() * 900) / 100,
      drift: -90 + Math.round(rnd() * 1800) / 10,
      spin: 180 + Math.round(rnd() * 540),
      scale: 0.6 + Math.round(rnd() * 80) / 100,
      color: safePalette[i % safePalette.length],
      tone: rnd(),
    });
  }
  return leaves;
}

/** True when the visitor asked for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
