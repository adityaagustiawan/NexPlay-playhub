// Client wrappers around the /api/age-verify endpoint plus a helper to read
// the caller's stored verification for the current device.
import { supabase } from "@/integrations/supabase/client";
import type { AgeBracket } from "@/lib/age";

export interface CaptchaChallenge {
  token: string;
  question: string;
  expiresIn: number;
}

export interface StoredVerification {
  bracket: AgeBracket;
  captcha_passed: boolean;
  policy_accepted: boolean;
  guardian_acknowledged: boolean;
  parental_control_notice: boolean;
  dev_agreement_accepted: boolean;
}

export class AgeApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "AgeApiError";
    this.code = code;
  }
}

async function post(body: Record<string, unknown>, token?: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch("/api/age-verify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new AgeApiError(
      String(data?.message || data?.error || `Request failed (${res.status})`),
      typeof data?.error === "string" ? data.error : undefined,
    );
  }
  return data;
}

export async function fetchCaptchaChallenge(): Promise<CaptchaChallenge> {
  const data = await post({ action: "challenge" });
  if (typeof data.token !== "string" || typeof data.question !== "string") {
    throw new AgeApiError("Could not load the verification challenge.");
  }
  return {
    token: data.token,
    question: data.question,
    expiresIn: typeof data.expiresIn === "number" ? data.expiresIn : 600,
  };
}

export interface AgeVerificationInput {
  birthDate: string;
  deviceHash: string;
  captchaToken: string;
  captchaAnswer: string;
  policyAccepted: boolean;
  guardianAcknowledged: boolean;
  parentalNoticeAcknowledged: boolean;
  devAgreementAccepted: boolean;
}

export interface AgeVerificationResult {
  bracket: AgeBracket;
  guardianRequired: boolean;
}

export async function submitAgeVerification(
  input: AgeVerificationInput,
  accessToken: string,
): Promise<AgeVerificationResult> {
  const data = await post({ action: "age", ...input }, accessToken);
  return {
    bracket: (data.bracket as AgeBracket) ?? "adult",
    guardianRequired: Boolean(data.guardianRequired),
  };
}

export async function submitCreatorAgreement(
  input: { deviceHash: string; policyVersion: string },
  accessToken: string,
): Promise<void> {
  await post({ action: "creator", ...input }, accessToken);
}

/** Read the caller's stored verification for the current device (RLS: own row). */
export async function fetchStoredVerification(
  userId: string,
  deviceHash: string,
): Promise<StoredVerification | null> {
  const { data, error } = await supabase
    .from("age_verifications")
    .select(
      "bracket, captcha_passed, policy_accepted, guardian_acknowledged, parental_control_notice, dev_agreement_accepted",
    )
    .eq("user_id", userId)
    .eq("device_hash", deviceHash)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredVerification | null) ?? null;
}

/** True when a stored row satisfies every obligation for its bracket. */
export function verificationIsComplete(v: StoredVerification | null): boolean {
  if (!v) return false;
  if (!v.captcha_passed || !v.policy_accepted) return false;
  if (v.bracket === "minor" && !(v.guardian_acknowledged && v.parental_control_notice)) return false;
  if (v.bracket === "senior" && !v.dev_agreement_accepted) return false;
  return true;
}
