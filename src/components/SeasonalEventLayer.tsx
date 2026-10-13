// SeasonalEventLayer.tsx — site-wide seasonal event overlay.
//
// Responsibilities:
//   1. resolve the active event (date window, `?event=`, localStorage)
//   2. apply the matching palette to <html data-theme="…">
//   3. render the event's visual effects (falling leaves, warm vignette)
//   4. show a dismissible event banner with a live countdown
//
// The whole layer is decorative: pointer-events:none except the banner's
// dismiss button, and it respects prefers-reduced-motion (theme stays, the
// falling leaves stop).
import { useEffect, useMemo, useState } from "react";
import { Leaf, Sparkles, X } from "lucide-react";
import {
  AUTUMN_EVENT,
  buildLeaves,
  prefersReducedMotion,
  resolveTheme,
  setEventOverride,
  EVENT_STORAGE_KEY,
  type SeasonalEvent,
} from "@/lib/seasonalEvents";

/** Distinct leaf outlines so the field never looks cloned. */
const LEAF_PATHS = [
  // maple-ish
  "M12 2c2.4 2.2 3.2 5 2.2 7.4 2.6.4 4.4 2 5.4 4.4-2.8.6-4.4 2-5.4 4 .8 2.6-.2 5.2-2.6 7.2l-1.6-1.4c1.8-1.6 2.4-3.2 1.8-5-1.6-1.4-3.8-1.6-5.8-.6-.2-2.2-1.4-4-3.4-5.4 1.6-2.2 1.4-4.8-.6-7 2.6-.2 4.6-1.4 6-3.6 1.4 2.2 3.4 3.4 6 3.6z",
  // oval
  "M12 3c5 2 8 5 8 9s-3 7-8 9c-5-2-8-5-8-9s3-7 8-9zm0 2.4c-3.4 1.6-5.6 4-5.6 6.6S8.6 17 12 18.6c3.4-1.6 5.6-4 5.6-6.6S15.4 7 12 5.4z",
  // pointed
  "M12 1.5c4.5 4 7 7.6 7 11.2 0 4.4-3.1 8.3-7 9.8-3.9-1.5-7-5.4-7-9.8C6 9.1 9 5.5 12 1.5zm0 3.6c-2.6 2.4-4.2 5-4.2 7.6 0 2.8 1.8 5.3 4.2 6.6 2.4-1.3 4.2-3.8 4.2-6.6 0-2.6-1.6-5.2-4.2-7.6z",
];

const LEAF_COUNT = 16;

/** Reduce an ISO-ish timestamp to "2d 4h" style countdown. */
export function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Inclusive end-of-window timestamp for the event's current year. */
function eventEndIso(event: SeasonalEvent, now: Date): string {
  return new Date(now.getFullYear(), event.end.month - 1, event.end.day, 23, 59, 59, 999).toISOString();
}

/** Tracks prefers-reduced-motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    setReduced(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface Props {
  /** Hard override — for previews and tests. `undefined` = auto-detect. */
  force?: SeasonalEvent | null;
  showBanner?: boolean;
}

export function SeasonalEventLayer({ force, showBanner = true }: Props) {
  const [event] = useState<SeasonalEvent | null>(() => {
    if (force !== undefined) return force;
    const resolved = resolveTheme(new Date(), window.location.search);
    if (resolved.event) setEventOverride(resolved.event.id);
    return resolved.event;
  });
  const [reduced] = usePrefersReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  // (1) theme attribute on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (event) root.setAttribute("data-theme", event.id);
    else root.removeAttribute("data-theme");
    return () => root.removeAttribute("data-theme");
  }, [event]);

  // restore a previous dismissal for this event
  useEffect(() => {
    if (!event) return;
    try {
      setDismissed(localStorage.getItem(`${EVENT_STORAGE_KEY}-dismissed:${event.id}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [event]);

  const leaves = useMemo(
    () => (event && !reduced ? buildLeaves(LEAF_COUNT, event.palette.leaf) : []),
    [event, reduced],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!showBanner || !event || dismissed || reduced) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [showBanner, event, dismissed, reduced]);

  if (!event) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`${EVENT_STORAGE_KEY}-dismissed:${event.id}`, "1");
    } catch {
      /* ignore */
    }
  };

  const remaining = Math.max(0, Date.parse(eventEndIso(event, new Date())) - now);
  const bannerVisible = showBanner && !dismissed;

  return (
    <>
      {/* warm autumn light wash */}
      <div className="autumn-vignette" aria-hidden="true" />

      {/* falling leaves */}
      {leaves.length > 0 && (
        <div className="leaf-layer" aria-hidden="true" data-testid="leaf-layer">
          {leaves.map((leaf, i) => (
            <span
              key={i}
              className="leaf"
              style={{
                left: `${leaf.left}%`,
                animationDelay: `${leaf.delay}s`,
                animationDuration: `${leaf.duration}s`,
                ["--leaf-size" as string]: `${Math.round(leaf.scale * 16)}px`,
                ["--leaf-drift" as string]: `${leaf.drift}px`,
                ["--leaf-spin" as string]: `${leaf.spin}deg`,
                ["--leaf-sway-duration" as string]: `${(2.2 + leaf.tone * 1.8).toFixed(2)}s`,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                style={{ color: leaf.color, transform: `scale(${0.7 + leaf.scale * 0.5})` }}
                data-testid="leaf"
              >
                <path d={LEAF_PATHS[i % LEAF_PATHS.length]} fill="currentColor" opacity="0.9" />
              </svg>
            </span>
          ))}
        </div>
      )}

      {/* event banner */}
      {bannerVisible && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
          <div
            className="autumn-banner pointer-events-auto mt-2 flex max-w-lg items-center gap-3 rounded-full border border-amber-500/30 bg-[#251812]/95 px-4 py-2 shadow-lg shadow-black/40 backdrop-blur-md"
            role="status"
            aria-live="polite"
            data-testid="event-banner"
          >
            <span className="autumn-banner-glow flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
              <Leaf className="h-4 w-4 text-amber-400" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-heading text-[12px] font-semibold text-amber-50">
                {event.name}
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  LIVE
                </span>
              </p>
              <p className="truncate font-body text-[11px] text-amber-100/60">
                {event.tagline}
                <span className="ml-1 font-medium text-amber-300/90">Ends in {formatCountdown(remaining)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss event banner"
              className="ml-1 shrink-0 rounded-full p-1 text-amber-100/50 transition-colors hover:bg-amber-500/15 hover:text-amber-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default SeasonalEventLayer;
