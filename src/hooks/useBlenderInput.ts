// useBlenderInput.ts — React binding for the ported blender-web input detector.
// Reports the detected device (mouse vs trackpad) and turns wheel / pinch /
// gesture input into navigation intents (zoom, pan, orbit, rotate).
import { useEffect, useRef, useState, type RefObject } from "react";
import { BlenderInputTracker, detectPlatform, type DeviceType, type InputStats } from "@/lib/blenderInput";

export interface BlenderInputHandlers {
  /** factor > 1 zooms in, < 1 zooms out */
  onZoom?: (factor: number) => void;
  onPan?: (dx: number, dy: number) => void;
  onOrbit?: (dx: number, dy: number) => void;
  onRotate?: (radians: number) => void;
}

export interface BlenderInputState {
  device: DeviceType;
  confidence: number;
  platform: string;
  stats: InputStats;
}

export function useBlenderInput(
  target: RefObject<HTMLElement | null>,
  handlers: BlenderInputHandlers = {},
  enabled = true,
): BlenderInputState {
  const [state, setState] = useState<BlenderInputState>(() => ({
    device: "unknown",
    confidence: 0,
    platform:
      typeof navigator !== "undefined" ? detectPlatform(navigator.userAgent, navigator.platform ?? "") : "Unknown",
    stats: { total: 0, wheel: 0, trackpad: 0, gesture: 0 },
  }));

  const tracker = useRef(new BlenderInputTracker());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = target.current;
    if (!el || !enabled) return;

    const sync = () =>
      setState((s) => ({
        ...s,
        device: tracker.current.device,
        confidence: tracker.current.confidence,
        stats: { ...tracker.current.stats },
      }));

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const res = tracker.current.observeWheel({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        time: performance.now(),
      });
      // Trackpad two-finger scroll pans; mouse wheel / ctrl+wheel zooms.
      if (res.device === "trackpad" && !e.ctrlKey) {
        handlersRef.current.onPan?.(e.deltaX, e.deltaY);
      } else {
        handlersRef.current.onZoom?.(Math.exp(-e.deltaY * 0.0015));
      }
      sync();
    };

    const gestureCapable = typeof window !== "undefined" && "ongesturestart" in window;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      tracker.current.observeGesture();
      sync();
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as unknown as { scale?: number; rotation?: number };
      if (typeof g.scale === "number" && g.scale > 0) handlersRef.current.onZoom?.(g.scale);
      if (typeof g.rotation === "number") handlersRef.current.onRotate?.((g.rotation * Math.PI) / 180);
      sync();
    };
    const onGestureEnd = () => {};

    let touchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      if (touchDist > 0 && d > 0) handlersRef.current.onZoom?.(d / touchDist);
      touchDist = d;
      tracker.current.observeGesture();
      sync();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    if (gestureCapable) {
      el.addEventListener("gesturestart", onGestureStart);
      el.addEventListener("gesturechange", onGestureChange);
      el.addEventListener("gestureend", onGestureEnd);
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      if (gestureCapable) {
        el.removeEventListener("gesturestart", onGestureStart);
        el.removeEventListener("gesturechange", onGestureChange);
        el.removeEventListener("gestureend", onGestureEnd);
      }
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [target, enabled]);

  return state;
}
