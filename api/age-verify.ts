// Vercel function: /api/age-verify
//
//   POST { "action": "challenge" }
//      -> { token, question, expiresIn }   (signed arithmetic captcha)
//
//   POST { "action": "age", birthDate, deviceHash, captchaToken, captchaAnswer,
//          policyAccepted, guardianAcknowledged, parentalNoticeAcknowledged,
//          devAgreementAccepted }   Authorization: Bearer <access token>
//      -> { ok: true, bracket, guardianRequired }
//
//   POST { "action": "creator", deviceHash, policyVersion }  Bearer <token>
//      -> { ok: true }
//
// The client never writes verification rows directly (RLS blocks it); every
// record is created here after server-side checks.
import {
  assertTopupEligible as _unusedAssertTopupEligible,
  bracketForAge,
  computeAge,
  createCaptcha,
  CREATOR_POLICY_VERSION,
  MAX_PLAUSIBLE_AGE,
  recordAgeVerification,
  recordCreatorAgreement,
  verifyCaptcha,
} from "../lib/server/ageVerification.js";
import { getAdminClient, isServerConfigured } from "../lib/server/admin.js";

// referenced only to keep the import graph obvious for tree-shakers/tests
void _unusedAssertTopupEligible;

export const config = { runtime: "nodejs" } as const;

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body?.action ?? "");

  // The captcha challenge is anonymous: it's just a signed puzzle.
  if (action === "challenge") {
    return json(createCaptcha(), 200);
  }

  if (action !== "age" && action !== "creator") {
    return json({ error: "Unknown action" }, 400);
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing access token" }, 401);
  if (!isServerConfigured()) {
    return json({ error: "SERVER_NOT_CONFIGURED", message: "Missing Supabase server env." }, 503);
  }

  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);
  const user = userData.user;

  try {
    if (action === "creator") {
      const policyVersion = String(body?.policyVersion ?? CREATOR_POLICY_VERSION);
      const deviceHash = typeof body?.deviceHash === "string" ? body.deviceHash : null;
      await recordCreatorAgreement(admin, {
        userId: user.id,
        deviceHash,
        policyVersion,
      });
      return json({ ok: true, policyVersion }, 200);
    }

    // action === "age"
    const deviceHash = String(body?.deviceHash ?? "");
    if (deviceHash.length < 8 || deviceHash.length > 200) {
      return json({ error: "DEVICE_UNKNOWN", message: "Missing or invalid device identifier." }, 400);
    }

    const birthDate = String(body?.birthDate ?? "");
    const age = computeAge(birthDate);
    if (age === null || age > MAX_PLAUSIBLE_AGE) {
      return json(
        { error: "INVALID_BIRTH_DATE", message: "Enter a valid date of birth." },
        400,
      );
    }

    const bracket = bracketForAge(age);
    if (bracket === "blocked") {
      return json(
        {
          error: "AGE_TOO_YOUNG",
          message:
            "NexCoins are only available to players aged 15 and over. Ask a parent or guardian for help.",
        },
        403,
      );
    }

    if (!verifyCaptcha(String(body?.captchaToken ?? ""), String(body?.captchaAnswer ?? ""))) {
      return json(
        { error: "CAPTCHA_FAILED", message: "That answer wasn't right. Try the new question." },
        400,
      );
    }

    const policyAccepted = body?.policyAccepted === true;
    const guardianAcknowledged = body?.guardianAcknowledged === true;
    const parentalNoticeAcknowledged = body?.parentalNoticeAcknowledged === true;
    const devAgreementAccepted = body?.devAgreementAccepted === true;

    if (!policyAccepted) {
      return json(
        { error: "POLICY_REQUIRED", message: "You must accept the top-up policy to continue." },
        400,
      );
    }
    if (bracket === "minor" && !guardianAcknowledged) {
      return json(
        {
          error: "GUARDIAN_REQUIRED",
          message: "A parent or guardian must acknowledge top-ups on this device.",
        },
        400,
      );
    }
    if (bracket === "minor" && !parentalNoticeAcknowledged) {
      return json(
        {
          error: "PARENTAL_NOTICE_REQUIRED",
          message: "Please confirm you've read the parental supervision note.",
        },
        400,
      );
    }
    if (bracket === "senior" && !devAgreementAccepted) {
      return json(
        {
          error: "DEV_AGREEMENT_REQUIRED",
          message: "Accept the creator content agreement to continue.",
        },
        400,
      );
    }

    const row = await recordAgeVerification(admin, {
      userId: user.id,
      deviceHash,
      declaredAge: age,
      bracket,
      policyAccepted,
      guardianAcknowledged,
      parentalNoticeAcknowledged,
      devAgreementAccepted,
      captchaPassed: true,
    });

    // Seniors who accept the creator agreement are recorded once, globally.
    if (row.bracket === "senior" && devAgreementAccepted) {
      await recordCreatorAgreement(admin, {
        userId: user.id,
        deviceHash,
        policyVersion: CREATOR_POLICY_VERSION,
        declaredAge: age,
      });
    }

    return json(
      {
        ok: true,
        bracket: row.bracket,
        guardianRequired: row.bracket === "minor",
      },
      200,
    );
  } catch (err) {
    console.error("age-verify failed:", err);
    return json({ error: "SERVER_ERROR", message: "Could not save your verification. Try again." }, 500);
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
