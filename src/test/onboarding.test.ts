import { beforeEach, describe, expect, it } from "vitest";
import { clearOnboarded, hasOnboarded, introDuration, markOnboarded, onboardingKey } from "@/lib/onboarding";

describe("onboarding", () => {
  beforeEach(() => localStorage.clear());

  it("keys by user id, falling back to guest", () => {
    expect(onboardingKey("user-1")).toBe("nexstudio_onboarded_user-1");
    expect(onboardingKey(null)).toBe("nexstudio_onboarded_guest");
    expect(onboardingKey(undefined)).toBe("nexstudio_onboarded_guest");
    expect(onboardingKey("")).toBe("nexstudio_onboarded_guest");
  });

  it("starts un-onboarded and flips after markOnboarded", () => {
    expect(hasOnboarded("user-1")).toBe(false);
    markOnboarded("user-1");
    expect(hasOnboarded("user-1")).toBe(true);
    // Other accounts are unaffected.
    expect(hasOnboarded("user-2")).toBe(false);
  });

  it("clearOnboarded resets a single account", () => {
    markOnboarded("user-1");
    clearOnboarded("user-1");
    expect(hasOnboarded("user-1")).toBe(false);
  });

  it("tracks guests independently", () => {
    markOnboarded(null);
    expect(hasOnboarded(null)).toBe(true);
    expect(hasOnboarded("user-1")).toBe(false);
  });

  it("runs the intro longer on the first visit", () => {
    expect(introDuration(true)).toBeGreaterThan(introDuration(false));
  });
});
