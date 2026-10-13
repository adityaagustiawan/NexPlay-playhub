// SeasonalEventLayer.tsx — applies the seasonal theme + renders its effects.
//
// Rendered once at the app root. It:
//   1. resolves the active event (date window, `?event=`, localStorage)
//   2. stamps `data-theme="<id>"` on <html> so the CSS palette swaps
//   3. paints the effects: falling leaves + a warm vignette
//   4. shows a dismissible event banner
// Everything is framework-light and pointer-transparent, so no page is
// affected except visually. `prefers-reduced-motion` drops the movement
// (the CSS already handles the animations; we skip generating leaves here
// so nothing is even mounted).
import { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, Sparkles, X } from "lucide-react";
import { AUTUMN_EVENT, buildLeaves, prefersReducedMotion, resolveActiveEvent, type SeasonalEvent } from "@/lib/seasonalEvent";

const LEAF_COUNT = 14;
const BANNER_DISMISS_KEY = "nexconsole:event-banner-dismissed";

/** One leaf: an SVG maple-ish shape tinted by the event palette. */
function LeafShape({ color, flip }: { color: string; flip: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path
        d="M12 2c3.5 1.6 6 4.4 6 8 0 2.2-.9 4-2.3 5.2.8.6 1.6 1.5 2 2.6-2.2-.6-3.9-1.4-5.2-2.4-1.3 1-3 1.8-5.2 2.4.4-1.1 1.2-2 2-2.6C6.9 14 6 12.2 6 10c0-3.6 2.5-6.4 6-8Z"
        fill={color}
        opacity="0.92"
      />
      <path d="M12 3.5v17" stroke="rgba(0,0,0,0.28)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M12 9.5 8.5 7M12 12.5 9 10.4M12 9.5 15.5 7M12 12.5 15 10.4" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function SeasonalEventLayer() {
  const [event] = useState<SeasonalEvent | null>(() => resolveActiveEvent());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(BANNER_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [reduced] = useState(() => prefersReducedMotion());
  const rafRef = useRef<number | null>(null);

  // Paint / clear the theme attribute on the document element.
  useEffect(() => {
    const root = document.documentElement;
    if (event && event.id !== "none") root.setAttribute("data-theme", event.id);
    else root.removeAttribute("data-theme");
    return () => root.removeAttribute("data-theme");
  }, [event]);

  // Re-evaluate the window at midnight so a seasonal rollover is automatic.
  useEffect(() => {
    if (!event) return;
    const check = () => {
      const still = resolveActiveEvent();
      if (!still) {
        document.documentElement.removeAttribute("data-theme");
      }
    };
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2).getTime() - now.getTime();
    const t = window.setTimeout(check, Math.max(1000, midnight));
    return () => window.clearTimeout(t);
  }, [event]);

  const leaves = useMemo(
    () => (event && !reduced ? buildLeaves(LEAF_COUNT, event.palette.leaf) : []),
    [event, reduced],
  );

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  if (!event) return null;

  const dismissBanner = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {/* Warm light wash behind the page */}
      <div className="autumn-vignette" aria-hidden="true" />

      {/* Falling leaves */}
      {leaves.length > 0 && (
        <div className="leaf-layer" aria-hidden="true" data-testid="leaf-layer">
          {leaves.map((leaf, i) => (
            <span
              key={i}
              className="leaf"
              style={{
                left: `${leaf.left}%`,
                "--leaf-size": `${Math.round(leaf.scale * 18)}px`,
                "--leaf-duration": `${leaf.duration}s`,
                "--leaf-delay": `${leaf.delay}s`,
                "--leaf-drift": `${leaf.drift}px`,
                "--leaf-spin": `${leaf.spin}deg`,
                "--leaf-sway-duration": `${(2.2 + leaf.tone * 1.8).toFixed(2)}s`,
                "--leaf-opacity": "0.85",
              } as React.CSSProperties}
            >
              <LeafShape color={leaf.color} flip={leaf.tone > 0.5} />
            </span>
          ))}
        </div>
      )}

      {/* Event banner */}
      {!dismissed && (
        <div
          className="autumn-banner pointer-events-auto absolute inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b border-amber-500/25 bg-gradient-to-r from-amber-950/85 via-orange-900/80 to-amber-950/85 px-4 py-1.5 backdrop-blur-md"
          role="status"
          data-testid="event-banner"
        >
          <Leaf className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            {event.name}
          </span>
          <span className="hidden font-body text-[11px] text-amber-100/80 sm:inline">
            {event.tagline}
          </span>
          <span className="autumn-banner-glow ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Live
          </span>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss event banner"
            className="absolute right-2 rounded p-1 text-amber-200/70 transition-colors hover:bg-amber-500/15 hover:text-amber-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}
