// SeasonalEventLayer.tsx — site-wide seasonal event overlay.
//
// Responsibilities:
//   1. resolve the active event (date window, `?event=` override, localStorage)
//   2. apply the matching palette to <html data-theme="…">
//   3. render the event's visual effects (falling leaves, warm vignette)
//   4. show a dismissible event banner with a live countdown
//
// Everything is decorative: the layer is pointer-events:none and inert, and it
// respects prefers-reduced-motion (theme stays, motion stops).
import { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, Sparkles, X } from "lucide-react";
import { resolveTheme, type SeasonalEvent } from "@/lib/seasonalEvents";

interface Props {
  /** Optional hard override, mainly for tests and previews. */
  force?: SeasonalEvent | null;
  /** Show the event banner (the effects layer always respects the theme). */
  showBanner?: boolean;
}

/** Distinct autumn leaf shapes so the field does not look cloned. */
const LEAF_PATHS = [
  // classic maple-ish leaf
  "M12 2c2.4 2.2 3.2 5 2.2 7.4 2.6.4 4.4 2 5.4 4.4-2.8.6-4.4 2-5.4 4 .8 2.6-.2 5.2-2.6 7.2l-1.6-1.4c1.8-1.6 2.4-3.2 1.8-5-1.6-1.4-3.8-1.6-5.8-.6-.2-2.2-1.4-4-3.4-5.4 1.6-2.2 1.4-4.8-.6-7 2.6-.2 4.6-1.4 6-3.6 1.4 2.2 3.4 3.4 6 3.6z",
  // small oval leaf
  "M12 3c5 2 8 5 8 9s-3 7-8 9c-5-2-8-5-8-9s3-7 8-9zm0 2.4c-3.4 1.6-5.6 4-5.6 6.6S8.6 17 12 18.6c3.4-1.6 5.6-4 5.6-6.6S15.4 7 12 5.4z",
  // simple pointed leaf
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

/** Deterministic PRNG so the field is identical on every render. */
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

function buildLeaves(count: number, seed = 7): LeafSpec[] {
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

/** ms remaining until an ISO timestamp, clamped at 0. */
function msUntil(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t - Date.now());
}

/** "2d 4h 10m" style countdown. */
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

/** Event window as ISO strings, used for the countdown. */
function eventWindow(event: SeasonalEvent, now: Date): { endsIso: string; startsIso: string } {
  const y = now.getFullYear();
  const at = (m: number, d: number, endOfDay = false) =>
    endOfDay
      ? new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
      : new Date(y, m - 1, d, 0, 0, 0).toISOString();
  return { endsIso: at(event.end.month, event.end.day, true), startsIso: at(event.start.month, event.start.day) };
}

export function SeasonalEventLayer({ force, showBanner = true }: Props) {
  // Evaluating once on mount keeps the theme stable while navigating.
  const [resolved] = useState(() =>
    force !== undefined ? force : resolveTheme(new Date(), typeof window !== "undefined" ? window.location.search : ""),
  );
  const [dismissed, setDismissed] = useState(false);
  const dismissedKey = resolved ? `nexconsole:event-dismissed:${resolved.id}` : null;

  useEffect(() => {
    if (!resolved) {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    document.documentElement.setAttribute("data-theme", resolved.id);
    // keep <meta name="theme-color"> in sync for mobile browser chrome
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#1c1210");
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [resolved]);

  useEffect(() => {
    if (!dismissedKey) return;
    setDismissed(localStorage.getItem(dismissedKey) === "1");
  }, [dismissedKey]);

  // Reduced motion: theme only, no leaves.
  const reduced = usePrefersReducedMotion();
  const leaves = useMemo(() => buildLeaves(18, 7), []);
  const window = resolved ? eventWindow(resolved, new Date()) : null;
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!showBanner || !resolved || dismissed) return;
    timer.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [showBanner, resolved, dismissed]);

  if (!resolved) return null;

  const bannerHidden = !showBanner || dismissed;

  return (
    <>
      {/* warm autumn vignette — pure decoration */}
      <div className="autumn-vignette" aria-hidden="true" />

      {!reduced && (
        <div className="leaf-layer" aria-hidden="true">
          {leaves.map((leaf, i) => (
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

      {!bannerHidden && (
        <Banner event={resolved} endsIso={window?.endsIso ?? null} now={now} onDismiss={() => dismissBanner(dismissedKey, setDismissed)} />
      )}
    </>
  );
}

function dismissBanner(key: string | null, setDismissed: (v: boolean) => void) {
  if (key) {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable — dismiss for this session only */
    }
  }
  setDismissed(true);
}

function Banner({
  event,
  endsIso,
  now,
  onDismiss,
}: {
  event: SeasonalEvent;
  endsIso: string | null;
  now: number;
  onDismiss: () => void;
}) {
  const remaining = endsIso ? Math.max(0, Date.parse(endsIso) - now) : 0;
  const ended = remaining <= 0;

  return (
    <div className="pointer-events-auto fixed inset-x-0 top-14 z-[60] flex justify-center px-4">
      <div
        className="autumn-banner pointer-events-auto mt-2 flex max-w-xl items-center gap-3 rounded-full border border-[hsl(38_96%_56%/0.35)] bg-[hsl(22_20%_12%/0.95)] px-4 py-2 backdrop-blur-md"
        role="status"
        aria-live="polite"
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
            {!ended && <span className="ml-1 font-semibold text-[hsl(38_80%_64%)]">Ends in {formatCountdown(remaining)}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss event banner"
          className="ml-1 rounded-full p-1 text-[hsl(30_12%_62%)] transition-colors hover:bg-[hsl(24_16%_20%)] hover:text-[hsl(32_30%_94%)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Tracks prefers-reduced-motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
