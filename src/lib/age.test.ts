import { describe, it, expect } from "vitest";
import {
  computeAge,
  parseBirthDate,
  bracketForAge,
  mostRestrictive,
  requirementsForBracket,
  isPackageAllowedForBracket,
  MINIMUM_TOPUP_AGE,
  ADULT_AGE,
  SENIOR_AGE,
} from "@/lib/age";

const NOW = new Date("2026-10-10T00:00:00Z");

describe("parseBirthDate", () => {
  it("parses a valid date", () => {
    expect(parseBirthDate("2008-05-01")?.toISOString()).toBe("2008-05-01T00:00:00.000Z");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseBirthDate("2008-5-1")).toBeNull();
    expect(parseBirthDate("not-a-date")).toBeNull();
    expect(parseBirthDate("2008-02-30")).toBeNull();
    expect(parseBirthDate("")).toBeNull();
  });
});

describe("computeAge", () => {
  it("counts whole years and hasn't had this year's birthday yet", () => {
    // Born Nov 2008 → on 10 Oct 2026 they are 17, not 18.
    expect(computeAge("2008-11-20", NOW)).toBe(17);
  });

  it("increments after the birthday passes", () => {
    expect(computeAge("2008-10-09", NOW)).toBe(18);
  });

  it("handles a leap-day birthday", () => {
    expect(computeAge("2008-02-29", new Date("2026-03-01T00:00:00Z"))).toBe(18);
  });

  it("returns null for future or invalid dates", () => {
    expect(computeAge("2030-01-01", NOW)).toBeNull();
    expect(computeAge("nope", NOW)).toBeNull();
  });
});

describe("bracketForAge", () => {
  it("blocks under 15", () => {
    expect(bracketForAge(14)).toBe("blocked");
    expect(bracketForAge(MINIMUM_TOPUP_AGE)).toBe("minor");
  });

  it("splits minor / adult / senior at the boundaries", () => {
    expect(bracketForAge(15)).toBe("minor");
    expect(bracketForAge(17)).toBe("minor");
    expect(bracketForAge(ADULT_AGE)).toBe("adult");
    expect(bracketForAge(49)).toBe("adult");
    expect(bracketForAge(SENIOR_AGE)).toBe("senior");
    expect(bracketForAge(90)).toBe("senior");
  });
});

describe("mostRestrictive", () => {
  it("keeps the stronger protection and never relaxes a minor", () => {
    expect(mostRestrictive("minor", "adult")).toBe("minor");
    expect(mostRestrictive("adult", "senior")).toBe("senior");
    expect(mostRestrictive("adult", "minor")).toBe("minor");
    expect(mostRestrictive("senior", "adult")).toBe("senior");
  });
});

describe("requirementsForBracket", () => {
  it("only minors need guardian + parental notice", () => {
    expect(requirementsForBracket("minor")).toMatchObject({
      guardian: true,
      parentalNotice: true,
      devAgreement: false,
    });
  });

  it("only seniors need the creator agreement", () => {
    expect(requirementsForBracket("senior")).toMatchObject({
      guardian: false,
      devAgreement: true,
    });
  });

  it("adults still pass a captcha and accept the policy", () => {
    expect(requirementsForBracket("adult")).toMatchObject({
      captcha: true,
      policy: true,
      guardian: false,
      devAgreement: false,
    });
  });
});

describe("isPackageAllowedForBracket", () => {
  it("enforces the minor per-purchase cap", () => {
    expect(isPackageAllowedForBracket("minor", 25)).toBe(true);
    expect(isPackageAllowedForBracket("minor", 39.99)).toBe(false);
    expect(isPackageAllowedForBracket("adult", 74.99)).toBe(true);
  });
});
