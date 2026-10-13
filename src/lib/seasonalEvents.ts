// seasonalEvents.ts — date-driven seasonal event registry.
//
// Events are defined by a recurring (month, day) window so they come back every
// year without code changes. An event owns a theme id (applied as
// `data-theme` on <html>) plus the copy the banner shows. `?event=<id>` and
// `?event=off` override detection, which makes the event testable/previewable.

export type ThemeId = "default" | "autumn";

export interface SeasonalEvent {
  id: ThemeId;
  name: string;
  tagline: string;
  /** Inclusive start (month 1-12, day 1-31) in the viewer's local time. */
  start: { month: number; day: number };
  /** Inclusive end (month 1-12, day 1-31). */
  end: { month: number; day: number };
  /** Short label for the banner pill, e.g. "Autumn Event". */
  badge?: string;
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: "autumn",
    name: "Autumn Event",
    tagline: "Maple skies, pumpkin deals — limited-time autumn games and themes.",
    badge: "Autumn",
    // Sep 22 (autumn equinox) → Nov 30
    start: { month: 9, day: 22 },
    end: { month: 11, day: 30 },
  },
];

/** MMDD-style comparable number, so `1031` is after `1022`. */
const ordinal = (month: number, day: number) => month * 100 + day;

/** True when `now` falls inside the event's recurring yearly window. */
export function isEventActive(event: SeasonalEvent, now: Date): boolean {
  const d = ordinal(now.getMonth() + 1, now.getDate());
  const from = ordinal(event.start.month, event.start.day);
  const to = ordinal(event.end.month, event.end.day);
  // A window that wraps the new year (e.g. Dec → Feb) is handled too.
  return from <= to ? d >= from && d <= to : d >= from || d <= to;
}

/** The first event whose window contains `now`, or null. */
export function getActiveEvent(now: Date): SeasonalEvent | null {
  return SEASONAL_EVENTS.find((e) => isEventActive(e, now)) ?? null;
}

export type EventOverride = ThemeId | "auto";

/**
 * Resolve the effective theme, honouring an explicit override.
 * Override sources: `?event=autumn|off|default` query param, else localStorage.
 */
export function resolveTheme(
  now: Date,
  search = typeof window !== "undefined" ? window.location.search : "",
): { theme: ThemeId; event: SeasonalEvent | null } {
  const param = new URLSearchParams(search).get("event");
  const forced = param ?? safeStorage().getItem("nexconsole:event");
  if (forced === "off" || forced === "default") return { theme: "default", event: null };
  if (forced === "autumn") {
    const event = SEASONAL_EVENTS.find((e) => e.id === "autumn") ?? null;
    return { theme: "autumn", event };
  }
  const event = getActiveEvent(now);
  return { theme: event ? event.id : "default", event };
}

function safeStorage(): Storage | { getItem: (k: string) => string | null } {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* private mode / blocked storage — ignore */
  }
  return { getItem: () => null };
}
