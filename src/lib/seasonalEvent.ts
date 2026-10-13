// seasonalEvent.ts — seasonal theme + event window logic.
//
// A "seasonal event" is a themed, time-boxed overlay on the site: a colour
// theme plus visual effects (falling leaves, warmth vignette, a banner).
// Windows live here so the same build can serve every season.

export type EventThemeId = "autumn" | "winter" | "spring" | "none";

export interface SeasonalEvent {
  id: EventThemeId;
  /** Human name shown in the banner. */
  name: string;
  /** Short pitch for the banner body. */
  tagline: string;
  /** Inclusive UTC start date (YYYY-MM-DD). */
  start: string;
  /** Inclusive UTC end date (YYYY-MM-DD). */
  end: string;
  /** Emoji/font-free marks used by the effect layer. */
  palette: { leaf: string[]; glow: string };
}

/**
 * Northern-hemisphere autumn: Oct 1 – Nov 15.
 * Dates are inclusive and evaluated in UTC so every visitor sees the same
 * window regardless of timezone.
 */
export const AUTUMN_EVENT: SeasonalEvent = {
  id: "autumn",
  name: "Autumn Harvest",
  tagline: "Falling leaves, warm lights and limited seasonal drops.",
  start: "2026-10-01",
  end: "2026-11-15",
  palette: {
    leaf: ["#d97706", "#b45309", "#f59e0b", "#92400e", "#c2410c", "#a16207"],
    glow: "#f59e0b",
  },
};

export const EVENTS: SeasonalEvent[] = [AUTUMN_EVENT];

/** Parse an inclusive YYYY-MM-DD day into a UTC timestamp range. */
export function dayRange(day: string): { start: number; end: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const end = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1) - 1;
  return { start, end };
}

/** The event covering `now`, or null when no seasonal event is live. */
export function getActiveEvent(now: Date = new Date()): SeasonalEvent | null {
  const ts = now.getTime();
  for (const ev of EVENTS) {
    const range = dayRange(ev.start);
    const stop = dayRange(ev.end);
    if (!range || !stop) continue;
    if (ts >= range.start && ts <= stop.end) return ev;
  }
  return null;
}

/** An event by id (used by the preview override). */
export function findEvent(id: string): SeasonalEvent | null {
  return EVENTS.find((e) => e.id === id) ?? null;
}

export type EventOverride = "auto" | EventThemeId;

export const EVENT_STORAGE_KEY = "nexconsole:event";

/**
 * Resolve which event should be active, honouring explicit overrides:
 *   ?event=autumn   force on  ·  ?event=off force off  ·  ?theme=autumn alias
 * then localStorage, then the date window. A query param wins and is kept in
 * localStorage so the preview survives navigation.
 */
export function resolveActiveEvent(
  now: Date = new Date(),
  search = typeof window !== "undefined" ? window.location.search : "",
  storage: Pick<Storage, "getItem"> | null =
    typeof window !== "undefined" && window.localStorage ? window.localStorage : null,
): SeasonalEvent | null {
  const params = new URLSearchParams(search || "");
  const raw = (params.get("event") ?? params.get("theme") ?? "").toLowerCase().trim();

  if (raw) {
    if (raw === "off" || raw === "none" || raw === "0") {
      storage?.removeItem?.(EVENT_STORAGE_KEY);
      return null;
    }
    const forced = findEvent(raw);
    if (forced) {
      try {
        storage?.setItem?.(EVENT_STORAGE_KEY, forced.id);
      } catch {
        /* private mode / quota — the URL still forces it for this view */
      }
      return forced;
    }
  }

  if (storage) {
    let saved: string | null = null;
    try {
      saved = storage.getItem(EVENT_STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved) {
      if (saved === "off") return null;
      const fromStore = findEvent(saved);
      if (fromStore) return fromStore;
    }
  }

  return getActiveEvent(now);
}

/** Deterministic pseudo-random sequence (mulberry32) — stable leaf layout. */
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

export interface LeafSpec {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  scale: number;
  color: string;
  /** 0–1 — which of the leaf colour steps this leaf uses. */
  tone: number;
}

/**
 * Build the leaf specs for the effect layer. Deterministic for a given
 * `seed` so the layout never re-shuffles on re-render.
 */
export function buildLeaves(count: number, palette: string[], seed = 7): LeafSpec[] {
  const rnd = seededRandom(seed);
  const leaves: LeafSpec[] = [];
  for (let i = 0; i < count; i++) {
    leaves.push({
      left: Math.round(rnd() * 10000) / 100,
      delay: Math.round(rnd() * 12000) / 1000,
      duration: 9 + Math.round(rnd() * 900) / 100,
      drift: -90 + Math.round(rnd() * 1800) / 10,
      spin: 180 + Math.round(rnd() * 540),
      scale: 0.6 + Math.round(rnd() * 80) / 100,
      color: palette[i % palette.length],
      tone: rnd(),
    });
  }
  return leaves;
}

/** True when the visitor asked for less motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
