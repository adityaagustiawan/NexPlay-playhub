// Server-only age verification: signed captcha, bracket rules, DB reads/writes
// and the gate used by /api/topup-checkout.
//
// Mirrors the pure policy in src/lib/age.ts. Keep the thresholds in sync.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getAdminClient } from "./admin.js";

export const MINIMUM_TOPUP_AGE = 15;
export const ADULT_AGE = 18;
export const SENIOR_AGE = 50;
export const MAX_PLAUSIBLE_AGE = 120;

/** Minors can't buy a single package above this (USD cents). */
export const MINOR_MAX_PACKAGE_CENTS = 2500;
/** Minors can't spend more than this per calendar day (USD cents). */
export const MINOR_DAILY_CAP_CENTS = 5000;

export const CREATOR_POLICY_VERSION = "2026-10-10";

export type AgeBracket = "blocked" | "minor" | "adult" | "senior";

export interface AgeVerificationRow {
  id: string;
  user_id: string;
  device_hash: string;
  declared_age: number;
  bracket: AgeBracket;
  captcha_passed: boolean;
  policy_accepted: boolean;
  guardian_acknowledged: boolean;
  parental_control_notice: boolean;
  dev_agreement_accepted: boolean;
}

export interface DeviceAgeRecord {
  device_hash: string;
  bracket: AgeBracket;
  guardian_acknowledged: boolean;
  parental_control_notice: boolean;
  dev_agreement_accepted: boolean;
}

type Admin = ReturnType<typeof getAdminClient>;

// ---------------------------------------------------------------------------
// Age maths (same rules as the client)
// ---------------------------------------------------------------------------
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBirthDate(value: string): Date | null {
  if (!BIRTH_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

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

const RESTRICTIVENESS: Record<AgeBracket, number> = {
  blocked: 4,
  minor: 3,
  senior: 2,
  adult: 1,
};

/** Keep the stronger protection when a device re-submits a different age. */
export function mostRestrictive(a: AgeBracket, b: AgeBracket): AgeBracket {
  return RESTRICTIVENESS[b] > RESTRICTIVENESS[a] ? b : a;
}

// ---------------------------------------------------------------------------
// Captcha: a stateless signed arithmetic challenge (no server session needed).
// ---------------------------------------------------------------------------
const CAPTCHA_TTL_SECONDS = 600;

function captchaSecret(): string {
  return (
    process.env.AGE_CAPTCHA_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    "nexconsole-dev-age-captcha"
  );
}

function hmac(data: string): string {
  return createHmac("sha256", captchaSecret()).update(data).digest("base64url");
}

export interface Captcha {
  token: string;
  question: string;
  expiresIn: number;
}

export function createCaptcha(now: number = Date.now()): Captcha {
  let a = randomInt(3, 13);
  let b = randomInt(2, 12);
  const useAdd = randomInt(0, 2) === 0;
  if (!useAdd && b > a) [a, b] = [b, a];
  const op = useAdd ? "+" : "-";
  const payload = JSON.stringify({ a, b, op, exp: now + CAPTCHA_TTL_SECONDS * 1000 });
  const token = `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;
  return { token, question: `${a} ${op} ${b}`, expiresIn: CAPTCHA_TTL_SECONDS };
}

export function verifyCaptcha(token: string, answer: string, now: number = Date.now()): boolean {
  if (!token || !answer) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = hmac(payload);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return false;

  let parsed: { a?: number; b?: number; op?: string; exp?: number };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return false;
  }
  if (!parsed?.exp || parsed.exp < now) return false;
  const expectedAnswer =
    parsed.op === "+" ? Number(parsed.a) + Number(parsed.b) : Number(parsed.a) - Number(parsed.b);
  return Number(String(answer).trim()) === expectedAnswer;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
export async function getVerification(
  admin: Admin,
  userId: string,
  deviceHash: string,
): Promise<AgeVerificationRow | null> {
  const { data } = await admin
    .from("age_verifications")
    .select("*")
    .eq("user_id", userId)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  return (data as AgeVerificationRow | null) ?? null;
}

export async function getDeviceRecord(
  admin: Admin,
  deviceHash: string,
): Promise<DeviceAgeRecord | null> {
  const { data } = await admin
    .from("device_age_records")
    .select("*")
    .eq("device_hash", deviceHash)
    .maybeSingle();
  return (data as DeviceAgeRecord | null) ?? null;
}

async function upsertDeviceRecord(
  admin: Admin,
  input: {
    deviceHash: string;
    bracket: AgeBracket;
    guardianAcknowledged: boolean;
    parentalNoticeAcknowledged: boolean;
    devAgreementAccepted: boolean;
  },
): Promise<void> {
  const existing = await getDeviceRecord(admin, input.deviceHash);
  const bracket = existing ? mostRestrictive(existing.bracket, input.bracket) : input.bracket;
  const { error } = await admin.from("device_age_records").upsert(
    {
      device_hash: input.deviceHash,
      bracket,
      guardian_acknowledged: Boolean(existing?.guardian_acknowledged || input.guardianAcknowledged),
      parental_control_notice: Boolean(
        existing?.parental_control_notice || input.parentalNoticeAcknowledged,
      ),
      dev_agreement_accepted: Boolean(existing?.dev_agreement_accepted || input.devAgreementAccepted),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "device_hash" },
  );
  if (error) throw error;
}

export interface RecordAgeInput {
  userId: string;
  deviceHash: string;
  declaredAge: number;
  bracket: AgeBracket;
  policyAccepted: boolean;
  guardianAcknowledged: boolean;
  parentalNoticeAcknowledged: boolean;
  devAgreementAccepted: boolean;
  captchaPassed: boolean;
}

export async function recordAgeVerification(
  admin: Admin,
  input: RecordAgeInput,
): Promise<AgeVerificationRow> {
  const existing = await getVerification(admin, input.userId, input.deviceHash);
  // Once a device is protected, it can only get *more* protected — a minor
  // cannot re-submit a different birth year to unlock adult top-ups.
  const bracket = existing ? mostRestrictive(existing.bracket, input.bracket) : input.bracket;

  const payload = {
    user_id: input.userId,
    device_hash: input.deviceHash,
    declared_age: input.declaredAge,
    bracket,
    captcha_passed: Boolean(existing?.captcha_passed || input.captchaPassed),
    policy_accepted: Boolean(existing?.policy_accepted || input.policyAccepted),
    guardian_acknowledged: Boolean(existing?.guardian_acknowledged || input.guardianAcknowledged),
    parental_control_notice: Boolean(
      existing?.parental_control_notice || input.parentalNoticeAcknowledged,
    ),
    dev_agreement_accepted: Boolean(existing?.dev_agreement_accepted || input.devAgreementAccepted),
  };

  const { data, error } = await admin
    .from("age_verifications")
    .upsert(payload, { onConflict: "user_id,device_hash" })
    .select("*")
    .single();
  if (error) throw error;

  // Remember the strongest bracket on this device across all accounts.
  await upsertDeviceRecord(admin, {
    deviceHash: input.deviceHash,
    bracket,
    guardianAcknowledged: input.guardianAcknowledged,
    parentalNoticeAcknowledged: input.parentalNoticeAcknowledged,
    devAgreementAccepted: input.devAgreementAccepted,
  });

  return data as AgeVerificationRow;
}

export async function recordCreatorAgreement(
  admin: Admin,
  input: { userId: string; deviceHash?: string | null; policyVersion: string; declaredAge?: number | null },
): Promise<void> {
  const { error } = await admin.from("creator_agreements").upsert(
    {
      user_id: input.userId,
      device_hash: input.deviceHash ?? null,
      policy_version: input.policyVersion,
      declared_age: input.declaredAge ?? null,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Verify + record (used by /api/age-verify)
// ---------------------------------------------------------------------------
export interface AgeSubmitInput {
  userId: string;
  deviceHash: string;
  birthDate: string;
  captchaToken: string;
  captchaAnswer: string;
  policyAccepted: boolean;
  guardianAcknowledged: boolean;
  parentalNoticeAcknowledged: boolean;
  devAgreementAccepted: boolean;
}

export interface AgeSubmitResult {
  ok: boolean;
  code?: string;
  message?: string;
  bracket?: AgeBracket;
  guardianRequired?: boolean;
}

export async function verifyAndRecordAge(
  admin: Admin,
  input: AgeSubmitInput,
): Promise<AgeSubmitResult> {
  const age = computeAge(input.birthDate);
  if (age === null || age > MAX_PLAUSIBLE_AGE) {
    return { ok: false, code: "INVALID_BIRTH_DATE", message: "Enter a valid date of birth." };
  }

  const declared = bracketForAge(age);
  if (declared === "blocked") {
    return {
      ok: false,
      code: "AGE_TOO_YOUNG",
      message:
        "NexCoins are only available to players aged 15 and over. Ask a parent or guardian for help.",
    };
  }

  if (!verifyCaptcha(input.captchaToken, input.captchaAnswer)) {
    return { ok: false, code: "CAPTCHA_FAILED", message: "That answer wasn't right. Try the new question." };
  }

  if (!input.policyAccepted) {
    return { ok: false, code: "POLICY_REQUIRED", message: "You must accept the top-up policy to continue." };
  }

  // A previously-verified minor device stays a minor device, even for a new
  // account — this is the "can't roll back the agreement" rule.
  const device = await getDeviceRecord(admin, input.deviceHash);
  const effective = device ? mostRestrictive(declared, device.bracket) : declared;

  if (effective === "minor" && !input.guardianAcknowledged) {
    return {
      ok: false,
      code: "GUARDIAN_REQUIRED",
      message: "A parent or guardian must acknowledge top-ups on this device.",
    };
  }
  if (effective === "minor" && !input.parentalNoticeAcknowledged) {
    return {
      ok: false,
      code: "PARENTAL_NOTICE_REQUIRED",
      message: "Please confirm you've read the parental supervision note.",
    };
  }
  if (effective === "senior" && !input.devAgreementAccepted) {
    return {
      ok: false,
      code: "DEV_AGREEMENT_REQUIRED",
      message: "Accept the creator content agreement to continue.",
    };
  }

  const row = await recordAgeVerification(admin, {
    userId: input.userId,
    deviceHash: input.deviceHash,
    declaredAge: age,
    bracket: effective,
    policyAccepted: input.policyAccepted,
    guardianAcknowledged: input.guardianAcknowledged,
    parentalNoticeAcknowledged: input.parentalNoticeAcknowledged,
    devAgreementAccepted: input.devAgreementAccepted,
    captchaPassed: true,
  });

  if (row.bracket === "senior" && input.devAgreementAccepted) {
    await recordCreatorAgreement(admin, {
      userId: input.userId,
      deviceHash: input.deviceHash,
      policyVersion: CREATOR_POLICY_VERSION,
      declaredAge: age,
    });
  }

  return { ok: true, bracket: row.bracket, guardianRequired: row.bracket === "minor" };
}

// ---------------------------------------------------------------------------
// Top-up gate (used by /api/topup-checkout)
// ---------------------------------------------------------------------------
async function minorSpentTodayCents(admin: Admin, userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data } = await admin
    .from("topup_payments")
    .select("amount_cents")
    .eq("user_id", userId)
    .eq("status", "paid")
    .gte("created_at", startOfDay.toISOString());
  const rows = (data as { amount_cents: number }[] | null) ?? [];
  return rows.reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

export interface EligibilityResult {
  ok: boolean;
  code?: string;
  message?: string;
  verification?: AgeVerificationRow;
}

/**
 * The server-side gate. Called by /api/topup-checkout with the device the
 * player is buying from. Clients cannot bypass the UI because a matching,
 * complete age_verifications row is required.
 */
export async function assertTopupEligible(
  admin: Admin,
  userId: string,
  deviceHash: string,
  packageCents: number,
): Promise<EligibilityResult> {
  if (!deviceHash || deviceHash.length < 8) {
    return {
      ok: false,
      code: "DEVICE_UNKNOWN",
      message: "We couldn't identify this device. Refresh the page and try again.",
    };
  }

  const verification = await getVerification(admin, userId, deviceHash);
  if (!verification) {
    return {
      ok: false,
      code: "AGE_VERIFICATION_REQUIRED",
      message: "Verify your age and accept the top-up policy before purchasing NexCoins.",
    };
  }

  if (!verification.captcha_passed || !verification.policy_accepted) {
    return {
      ok: false,
      code: "AGE_VERIFICATION_REQUIRED",
      message: "Your age verification is incomplete. Please verify again.",
    };
  }

  // Combine the account row with the device memory so a fresh account on a
  // previously-minor device can't skip the parental rules.
  const device = await getDeviceRecord(admin, deviceHash);
  const effective = device ? mostRestrictive(verification.bracket, device.bracket) : verification.bracket;

  if (effective === "minor") {
    if (!verification.guardian_acknowledged || !verification.parental_control_notice) {
      return {
        ok: false,
        code: "GUARDIAN_CONSENT_REQUIRED",
        message: "A parent or guardian must approve top-ups on this account before you can buy.",
      };
    }
    if (packageCents > MINOR_MAX_PACKAGE_CENTS) {
      return {
        ok: false,
        code: "MINOR_PACKAGE_LIMIT",
        message: `Players under 18 can only buy packages up to $${(MINOR_MAX_PACKAGE_CENTS / 100).toFixed(0)}.`,
      };
    }
    const spent = await minorSpentTodayCents(admin, userId);
    if (spent + packageCents > MINOR_DAILY_CAP_CENTS) {
      return {
        ok: false,
        code: "MINOR_DAILY_LIMIT",
        message: `Daily top-up limit reached for under-18 accounts ($${(MINOR_DAILY_CAP_CENTS / 100).toFixed(0)}/day). Ask a parent or try again tomorrow.`,
      };
    }
  }

  if (effective === "senior" && !verification.dev_agreement_accepted) {
    return {
      ok: false,
      code: "DEV_AGREEMENT_REQUIRED",
      message: "Accept the NEXCONSOLE creator content agreement to continue.",
    };
  }

  return { ok: true, verification };
}
