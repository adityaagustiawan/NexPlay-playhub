import { describe, it, expect } from "vitest";
import {
  createCaptcha,
  verifyCaptcha,
  bracketForAge,
  computeAge,
  mostRestrictive,
  MINIMUM_TOPUP_AGE,
  ADULT_AGE,
  SENIOR_AGE,
} from "../../lib/server/ageVerification";

function answerFrom(question: string): string {
  const [a, op, b] = question.split(" ");
  return String(op === "+" ? Number(a) + Number(b) : Number(a) - Number(b));
}

describe("server captcha", () => {
  it("issues a signed, well-formed challenge", () => {
    const c = createCaptcha(1_000_000);
    expect(c.question).toMatch(/^\d+ [+-] \d+$/);
    expect(c.token).toContain(".");
    expect(c.expiresIn).toBeGreaterThan(0);
  });

  it("accepts the correct answer and rejects a wrong one", () => {
    const c = createCaptcha(1_000_000);
    expect(verifyCaptcha(c.token, answerFrom(c.question), 1_000_000)).toBe(true);
    expect(verifyCaptcha(c.token, "999999", 1_000_000)).toBe(false);
  });

  it("rejects an expired or tampered token", () => {
    const c = createCaptcha(1_000_000);
    const future = 1_000_000 + (c.expiresIn + 1) * 1000;
    expect(verifyCaptcha(c.token, answerFrom(c.question), future)).toBe(false);

    const [payload] = c.token.split(".");
    expect(verifyCaptcha(`${payload}.deadbeef`, answerFrom(c.question), 1_000_000)).toBe(false);
    expect(verifyCaptcha("garbage", "1", 1_000_000)).toBe(false);
  });

  it("produces non-negative subtraction questions", () => {
    for (let i = 0; i < 50; i++) {
      const c = createCaptcha(1_000_000);
      expect(Number(answerFrom(c.question))).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("server age rules match the client", () => {
  it("computes ages", () => {
    expect(computeAge("2008-11-20", new Date("2026-10-10T00:00:00Z"))).toBe(17);
    expect(computeAge("2008-10-09", new Date("2026-10-10T00:00:00Z"))).toBe(18);
    expect(computeAge("2008-02-30", new Date("2026-10-10T00:00:00Z"))).toBeNull();
  });

  it("brackets ages", () => {
    expect(bracketForAge(MINIMUM_TOPUP_AGE - 1)).toBe("blocked");
    expect(bracketForAge(MINIMUM_TOPUP_AGE)).toBe("minor");
    expect(bracketForAge(ADULT_AGE)).toBe("adult");
    expect(bracketForAge(SENIOR_AGE)).toBe("senior");
  });

  it("never relaxes a recorded bracket", () => {
    expect(mostRestrictive("minor", "adult")).toBe("minor");
    expect(mostRestrictive("adult", "minor")).toBe("minor");
  });
});
