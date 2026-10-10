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
//      -> { ok: true, policyVersion }
//
// The client never writes verification rows directly (RLS blocks it); every
// record is created here after server-side checks.
import {
  createCaptcha,
  CREATOR_POLICY_VERSION,
  recordCreatorAgreement,
  verifyAndRecordAge,
} from "../lib/server/ageVerification.js";
import { getAdminClient, isServerConfigured } from "../lib/server/admin.js";

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
      await recordCreatorAgreement(admin, { userId: user.id, deviceHash, policyVersion });
      return json({ ok: true, policyVersion }, 200);
    }

    // action === "age"
    const deviceHash = String(body?.deviceHash ?? "");
    if (deviceHash.length < 8 || deviceHash.length > 200) {
      return json({ error: "DEVICE_UNKNOWN", message: "Missing or invalid device identifier." }, 400);
    }

    const result = await verifyAndRecordAge(admin, {
      userId: user.id,
      deviceHash,
      birthDate: String(body?.birthDate ?? ""),
      captchaToken: String(body?.captchaToken ?? ""),
      captchaAnswer: String(body?.captchaAnswer ?? ""),
      policyAccepted: body?.policyAccepted === true,
      guardianAcknowledged: body?.guardianAcknowledged === true,
      parentalNoticeAcknowledged: body?.parentalNoticeAcknowledged === true,
      devAgreementAccepted: body?.devAgreementAccepted === true,
    });

    if (!result.ok) {
      const status = result.code === "AGE_TOO_YOUNG" ? 403 : 400;
      return json({ error: result.code, message: result.message }, status);
    }

    return json(
      { ok: true, bracket: result.bracket, guardianRequired: result.guardianRequired },
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
