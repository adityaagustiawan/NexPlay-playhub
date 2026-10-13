// SeasonalEventLayer.tsx — site-wide seasonal event overlay.
//
// Responsibilities:
//   1. resolve the active event (date window, `?event=` override, localStorage)
//   2. apply the matching palette to <html data-theme="…">
//   3. render the event's visual effects (falling leaves + warm vignette)
//   4. show a dismissible event banner with a live countdown
//
// The layer is decorative and pointer-transparent, so no page changes
// behaviour — only colour and atmosphere. `prefers-reduced-motion` keeps the
// theme but stops the movement.
import { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, Sparkles, X } from "lucide-react";
import { resolveTheme, type SeasonalEvent } from "@/lib/seasonalEvents";

interface Props {
  /** Hard override, mainly for tests and previews. `undefined` = auto-detect. */
  force?: SeasonalEvent | null;
  /** Render the banner as well as the effects. */
  showBanner?: boolean;
}

/** Distinct autumn leaf silhouettes so the field never looks cloned. */
const LEAF_PATHS = [
  // maple-ish
  "M12 2c2.4 2.2 3.2 5 2.2 7.4 2.6.4 4.4 2 5.4 4.4-2.8.6-4.4 2-5.4 4 .8 2.6-.2 5.2-2.6 7.2l-1.6-1.4c1.8-1.6 2.4-3.2 1.8-5-1.6-1.4-3.8-1.6-5.8-.6-.2-2.2-1.4-4-3.4-5.4 1.6-2.2 1.4-4.8-.6-7 2.6-.2 4.6-1.4 6-3.6 1.4 2.2 3.4 3.4 6 3.6z",
  // oval
  "M12 3c5 2 8 5 8 9s-3 7-8 9c-5-2-8-5-8-9s3-7 8-9zm0 2.4c-3.4 1.6-5.6 4-5.6 6.6S8.6 17 12 18.6c3.4-1.6 5.6-4 5.6-6.6S15.4 7 12 5.4z",
  // pointed
  "M12 1.5c4.5 4 7 7.6 7 11.2 0 4.4-3.1 8.3-7 9.8-3.9-1.5-7-5.4-7-9.8C5 9.1 7.5 5.5 12 1.5zm0 3.6c-2.6 2.4-4.2 5-4.2 7.6 0 2.8 1.8 5.3 4.2 6.6 2.4-1.3 4.2-3.8 4.2-6.6 0-2.6-1.6-5.2-4.2-7.6z",
];

const LEAF_COLORS = [
  "hsl(24 92% 54%)", // pumpkin
  "hsl(38 96% 56%)", // amber
  "hsl(12 82% 46%)", // maple red
  "hsl(32 62% 40%)", // ochre
  "hsl(20 80% 48%)", // burnt orange
];

interface LeafSpec {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  scale: number;
  color: string;
  path: number;
}

/** mulberry32 — deterministic so the field is identical on every render. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1);
    t = (t + Math.imul(t ^ (t >>> 7), 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLeafField(count: number, seed = 7): LeafSpec[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    left: rnd() * 100,
    delay: rnd() * -18,
    duration: 9 + rnd() * 9,
    drift: -90 + rnd() * 180,
    spin: 180 + rnd() * 540,
    scale: 0.6 + rnd() * 0.8,
    color: LEAF_COLORS[Math.floor(rnd() * LEAF_COLORS.length)],
    path: Math.floor(rnd() * LEAF_PATHS.length),
  }));
}

/** "2d 4h 10m" / "4h 10m 5s" countdown formatting. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Event window as ISO strings (end of the final day, start of the first). */
function eventWindow(event: SeasonalEvent, now: Date): { endsIso: string; startsIso: string } {
  const y = now.getFullYear();
  return {
    startsIso: new Date(y, event.start.month - 1, event.start.day, 0, 0, 0).toISOString(),
    endsIso: new Date(y, event.end.month - 1, event.end.day, 23, 59, 59, 999).toISOString(),
  };
}

/** Tracks prefers-reduced-motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function SeasonalEventLayer({ force, showBanner = true }: Props) {
  // Resolved once per mount so navigation never re-shuffles the theme.
  const [event] = useState<SeasonalEvent | null>(() => {
    if (force !== undefined) return force;
    const { event } = resolveTheme(new Date(), typeof window !== "undefined" ? window.location.search : "");
    return event;
  });

  const reduced = usePrefersReducedMotion();
  const field = useMemo(() => buildLeafField(18, 7), []);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<number | null>(null);

  // Apply / clear the palette on <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (!event) {
      root.removeAttribute("data-theme");
      return;
    }
    root.setAttribute("data-theme", event.id);
    // Keep mobile browser chrome in step with the warm palette.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#1c1210");
    return () => {
      root.removeAttribute("data-theme");
    };
  }, [event]);

  // Remember the dismissal per event so it stays hidden across sessions.
  useEffect(() => {
    if (!event) return;
    try {
      setDismissed(window.localStorage.getItem(`nexconsole:event-dismissed:${event.id}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [event]);

  // Countdown ticker while the banner is visible.
  useEffect(() => {
    if (!event || !showBanner || dismissed) return;
    timer.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [event, showBanner, dismissed]);

  if (!event) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(`nexconsole:event-dismissed:${event.id}`, "1");
    } catch {
      /* storage unavailable — hide for this session only */
    }
    setDismissed(true);
  };

  const bounds = eventWindow(event, new Date());
  const remaining = Math.max(0, Date.parse(bounds.endsIso) - now);

  return (
    <>
      {/* warm autumn light wash — pure decoration */}
      <div className="autumn-vignette" aria-hidden="true" />

      {!reduced && (
        <div className="leaf-layer" aria-hidden="true">
          {field.map((leaf, i) => (
            <span
              key={i}
              className="leaf"
              style={{
                left: `${leaf.left}%`,
                animationDelay: `${leaf.delay}s`,
                animationDuration: `${leaf.duration}s`,
                transform: `scale(${leaf.scale})`,
                ["--leaf-drift" as string]: `${leaf.drift}px`,
                ["--leaf-spin" as string]: `${leaf.spin}deg`,
                ["--leaf-size" as string]: `${12 + (leaf.scale - 0.6) * 8}px`,
              }}
            >
              <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ color: leaf.color }}>
                <path d={LEAF_PATHS[leaf.path]} fill="currentColor" opacity="0.9" />
              </svg>
            </span>
          ))}
        </div>
      )}

      {showBanner && !dismissed && (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-[60] flex justify-center px-4">
          <div
            className="autumn-banner pointer-events-auto mt-2 flex max-w-xl items-center gap-3 rounded-full border border-[hsl(38_96%_56%/0.35)] bg-[hsl(22_20%_12%/0.95)] px-4 py-2 backdrop-blur-md"
            role="status"
            aria-live="polite"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/autumn";
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <span className="autumn-banner-glow flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(24_92%_54%/0.18)]">
              <Leaf className="h-4 w-4 text-[hsl(38_96%_56%)]" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-heading text-xs font-semibold text-[hsl(32_30%_94%)]">
                {event.name}
                <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(24_92%_54%/0.18)] px-2 py-0.5 text-[10px] font-medium text-[hsl(38_96%_66%)]">
                  <Sparkles className="h-2.5 w-2.5" />
                  Live
                </span>
              </p>
              <p className="truncate font-body text-[11px] text-[hsl(30_12%_62%)]">
                {event.tagline}
                <span className="ml-1 font-semibold text-[hsl(38_80%_64%)]">Ends in {formatCountdown(remaining)}</span>
              </p>
            </div>
            <button
              type="button"
<<<<<<< HEAD
              onClick={dismiss}
=======
              onClick={(e) => {
                e.stopPropagation();
                dismiss();
              }}
>>>>>>> 64e9947 (feat: add autumn theme, event pages, and promo banner on library)
              aria-label="Dismiss event banner"
              className="ml-1 rounded-full p-1 text-[hsl(30_12%_62%)] transition-colors hover:bg-[hsl(24_16%_20%)] hover:text-[hsl(32_30%_94%)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
