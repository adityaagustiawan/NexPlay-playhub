// Age policy for NexCoin top-ups. Pure functions only — no React, no network —
// so the exact same rules can be unit-tested and mirrored on the server
// (api/_lib/ageVerification.ts).

/** Hard floor: nobody under 15 may buy or use NexCoins. */
export const MINIMUM_TOPUP_AGE = 15;
/** 18 is the age of majority for unsupervised purchases. */
export const ADULT_AGE = 18;
/** 50+ gets a "did you mistype?" warning and the creator agreement. */
export const SENIOR_AGE = 50;
/** Anything above this is treated as a bogus birth date. */
export const MAX_PLAUSIBLE_AGE = 120;

/** Minors can't buy any single package above this (USD). */
export const MINOR_MAX_PACKAGE_USD = 25;
/** Minors can't spend more than this per calendar day (USD). */
export const MINOR_DAILY_CAP_USD = 50;

/** Bump when the wording of the content policy changes. */
export const CREATOR_POLICY_VERSION = "2026-10-10";

export type AgeBracket = "blocked" | "minor" | "adult" | "senior";

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict YYYY-MM-DD date, returning null for impossible dates. */
export function parseBirthDate(value: string): Date | null {
  if (!BIRTH_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Whole years since the birth date, or null when the input is invalid/future. */
export function computeAge(birthDate: string, now: Date = new Date()): number | null {
  const dob = parseBirthDate(birthDate);
  if (!dob) return null;
  if (dob.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function bracketForAge(age: number): AgeBracket {
  if (age < MINIMUM_TOPUP_AGE) return "blocked";
  if (age < ADULT_AGE) return "minor";
  if (age < SENIOR_AGE) return "adult";
  return "senior";
}

export function isPlausibleAge(age: number | null): age is number {
  return age !== null && age >= 0 && age <= MAX_PLAUSIBLE_AGE;
}

/**
 * How restrictive a bracket is. Used to keep the strongest protection once a
 * device has been verified — a device that agreed as a minor can never be
 * "relaxed" to adult by re-submitting a different birth year.
 */
const RESTRICTIVENESS: Record<AgeBracket, number> = {
  blocked: 4,
  minor: 3,
  senior: 2,
  adult: 1,
};

/** Returns the more restrictive of two brackets (ties keep the first). */
export function mostRestrictive(a: AgeBracket, b: AgeBracket): AgeBracket {
  return RESTRICTIVENESS[b] > RESTRICTIVENESS[a] ? b : a;
}

export interface VerificationRequirements {
  captcha: boolean;
  policy: boolean;
  guardian: boolean;
  parentalNotice: boolean;
  devAgreement: boolean;
}

export function requirementsForBracket(bracket: AgeBracket): VerificationRequirements {
  return {
    captcha: bracket !== "blocked",
    policy: bracket !== "blocked",
    guardian: bracket === "minor",
    parentalNotice: bracket === "minor",
    devAgreement: bracket === "senior",
  };
}

export function bracketLabel(bracket: string): string {
  switch (bracket) {
    case "minor":
      return "Minor (15–17)";
    case "adult":
      return "Adult (18–49)";
    case "senior":
      return "Senior (50+)";
    default:
      return "Unverified";
  }
}

/** Small helper for the UI: is a package within the minor per-purchase cap? */
export function isPackageAllowedForBracket(bracket: AgeBracket, priceUsd: number): boolean {
  if (bracket === "minor") return priceUsd <= MINOR_MAX_PACKAGE_USD;
  return true;
}
