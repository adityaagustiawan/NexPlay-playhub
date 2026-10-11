import { describe, expect, it } from "vitest";
import { BlenderInputTracker, classifyWheel, detectPlatform } from "@/lib/blenderInput";

describe("classifyWheel", () => {
  it("treats line/page scroll modes as a mouse wheel", () => {
    expect(classifyWheel({ deltaX: 0, deltaY: 3, deltaMode: 1, time: 1000 }).device).toBe("mouse");
    expect(classifyWheel({ deltaX: 0, deltaY: 1, deltaMode: 2, time: 1000 }).device).toBe("mouse");
  });

  it("treats a standard 120 wheel notch as a mouse", () => {
    expect(classifyWheel({ deltaX: 0, deltaY: 120, deltaMode: 0, time: 1000 }).device).toBe("mouse");
    expect(classifyWheel({ deltaX: 0, deltaY: 100, deltaMode: 0, time: 1000 }).device).toBe("mouse");
  });

  it("treats fractional deltas as a trackpad", () => {
    const r = classifyWheel({ deltaX: 0, deltaY: 3.5, deltaMode: 0, time: 1000 });
    expect(r.device).toBe("trackpad");
    expect(r.confidence).toBeGreaterThanOrEqual(85);
  });

  it("treats small high-frequency deltas as a trackpad", () => {
    const r = classifyWheel({ deltaX: 0, deltaY: 5, deltaMode: 0, time: 1010 }, 1000);
    expect(r.device).toBe("trackpad");
  });

  it("flags multi-axis fractional scrolling as a trackpad", () => {
    const r = classifyWheel({ deltaX: 2.5, deltaY: 2.5, deltaMode: 0, time: 1000 });
    expect(r.device).toBe("trackpad");
    expect(r.reasons).toContain("Multi-axis scrolling");
  });

  it("never exceeds 95% confidence", () => {
    expect(classifyWheel({ deltaX: 1.5, deltaY: 1.5, deltaMode: 0, time: 1000 }).confidence).toBeLessThanOrEqual(95);
  });
});

describe("BlenderInputTracker", () => {
  it("accumulates stats and remembers the device", () => {
    const t = new BlenderInputTracker();
    t.observeWheel({ deltaX: 0, deltaY: 120, deltaMode: 0, time: 1000 });
    expect(t.device).toBe("mouse");
    t.observeWheel({ deltaX: 0.4, deltaY: 0.4, deltaMode: 0, time: 1100 });
    expect(t.device).toBe("trackpad");
    t.observeGesture();
    expect(t.stats.total).toBe(3);
    expect(t.stats.gesture).toBe(1);
    expect(t.label()).toBe("Trackpad");
  });
});

describe("detectPlatform", () => {
  it("maps common user agents", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("macOS");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux");
    expect(detectPlatform("", "CustomOS")).toBe("CustomOS");
  });
});
