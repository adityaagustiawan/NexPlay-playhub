// blenderInput.ts — pure input logic ported from blender-web's
// tools/web-input-detector.js ("inspired by Blender's GHOST input system").
//
// The original is a browser-only demo class; this is the reusable core:
// classify a wheel event as mouse vs trackpad, detect the platform, and track
// running stats. Kept free of DOM/React so it can be unit-tested. The React
// binding lives in src/hooks/useBlenderInput.ts.

export type DeviceType = "mouse" | "trackpad" | "unknown";

export interface WheelSample {
  deltaX: number;
  deltaY: number;
  /** 0 = pixel, 1 = line, 2 = page (DOM_DELTA_*) */
  deltaMode: number;
  /** timestamp (ms), used to spot high-frequency trackpad scrolling */
  time: number;
}

export interface WheelClassification {
  device: DeviceType;
  /** 0–95, matching the original heuristic's ceiling */
  confidence: number;
  reasons: string[];
}

export function detectPlatform(userAgent: string, platform = ""): string {
  const ua = userAgent || "";
  if (ua.includes("Win")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Linux")) return "Linux";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  return platform || "Unknown";
}

/**
 * Classify a single wheel event. `prevTime` is the previous wheel event's
 * timestamp (0 for the first) — the gap feeds the high-frequency check.
 */
export function classifyWheel(sample: WheelSample, prevTime = 0): WheelClassification {
  const { deltaX, deltaY, deltaMode, time } = sample;
  const timeDelta = prevTime > 0 ? time - prevTime : Infinity;

  const isFloatDelta = deltaY % 1 !== 0 || deltaX % 1 !== 0;
  const hasLargeDelta = Math.abs(deltaY) >= 100 || Math.abs(deltaX) >= 100;
  const hasSmallDelta = Math.abs(deltaY) < 10 && Math.abs(deltaX) < 10;
  const hasBothAxes = deltaX !== 0 && deltaY !== 0;
  const isHighFrequency = timeDelta < 20;

  let device: DeviceType = "unknown";
  let confidence = 0;
  const reasons: string[] = [];

  if (deltaMode === 1 || deltaMode === 2) {
    device = "mouse";
    confidence = 70;
    reasons.push("Line/Page scroll mode");
  } else if (deltaMode === 0) {
    if (Math.abs(deltaY) === 120 || Math.abs(deltaY) === 100) {
      device = "mouse";
      confidence = 80;
      reasons.push("Standard wheel increment");
    } else if (isFloatDelta) {
      device = "trackpad";
      confidence = 85;
      reasons.push("Fractional delta values");
    } else if (hasSmallDelta && isHighFrequency) {
      device = "trackpad";
      confidence = 75;
      reasons.push("Smooth scrolling pattern");
    } else if (hasLargeDelta && !isFloatDelta) {
      device = "mouse";
      confidence = 65;
      reasons.push("Large integer deltas");
    } else {
      device = "trackpad";
      confidence = 50;
      reasons.push("Pixel mode (uncertain)");
    }
  }

  if (hasBothAxes && isFloatDelta) {
    device = "trackpad";
    confidence = Math.min(95, confidence + 15);
    reasons.push("Multi-axis scrolling");
  }

  // Mouse wheels scroll in multiples of 3 or 120.
  if (
    deltaY !== 0 &&
    !isFloatDelta &&
    !hasBothAxes &&
    (Math.abs(deltaY) % 3 === 0 || Math.abs(deltaY) % 120 === 0)
  ) {
    if (device !== "trackpad" || confidence < 70) {
      device = "mouse";
      confidence = Math.max(confidence, 75);
      reasons.push("Mouse wheel pattern");
    }
  }

  return { device, confidence: Math.min(confidence, 95), reasons };
}

export interface InputStats {
  total: number;
  wheel: number;
  trackpad: number;
  gesture: number;
}

/** Stateful tracker mirroring the detector class from the source repo. */
export class BlenderInputTracker {
  device: DeviceType = "unknown";
  confidence = 0;
  stats: InputStats = { total: 0, wheel: 0, trackpad: 0, gesture: 0 };
  private lastWheelTime = 0;

  observeWheel(sample: WheelSample): WheelClassification {
    const result = classifyWheel(sample, this.lastWheelTime);
    this.lastWheelTime = sample.time;
    if (result.confidence > this.confidence || result.device !== this.device) {
      this.device = result.device;
      this.confidence = result.confidence;
    }
    this.stats.total += 1;
    if (result.device === "trackpad") this.stats.trackpad += 1;
    else if (result.device === "mouse") this.stats.wheel += 1;
    return result;
  }

  observeGesture(): void {
    this.device = "trackpad";
    this.confidence = 100;
    this.stats.total += 1;
    this.stats.gesture += 1;
  }

  label(): string {
    if (this.device === "mouse") return "Mouse";
    if (this.device === "trackpad") return "Trackpad";
    return "Unknown";
  }
}
