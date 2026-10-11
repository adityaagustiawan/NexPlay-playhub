import { describe, expect, it } from "vitest";
import { resizeValue } from "@/lib/resize";

describe("resizeValue", () => {
  it("grows a right-hand panel when dragging left (invert)", () => {
    expect(resizeValue(340, -60, { min: 240, max: 720, invert: true })).toBe(400);
  });

  it("grows a bottom panel when dragging up (invert)", () => {
    expect(resizeValue(200, -40, { min: 80, max: 480, invert: true })).toBe(240);
  });

  it("grows on a positive drag without invert", () => {
    expect(resizeValue(200, 40, { min: 80, max: 480 })).toBe(240);
  });

  it("clamps to the min and max", () => {
    expect(resizeValue(340, 9999, { min: 240, max: 720 })).toBe(720);
    expect(resizeValue(340, -9999, { min: 240, max: 720 })).toBe(240);
    expect(resizeValue(340, -9999, { min: 240, max: 720, invert: true })).toBe(720);
  });

  it("rounds to whole pixels", () => {
    expect(resizeValue(340, 12.6, { min: 0, max: 999 })).toBe(353);
  });
});
