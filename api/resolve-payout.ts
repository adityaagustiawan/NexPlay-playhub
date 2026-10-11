// Vercel function: /api/resolve-payout
// Admin resolution of a DevCoin cash-out request. Approving marks the payout
// paid (the operator pays it off-platform); rejecting refunds the DevCoins.
// Only callers whose profile role is 'admin' may use it.
//
//   POST { payoutId, approve, note? }
//   Authorization: Bearer <access token>
//   -> { ok: true, payoutId, status }
import { getAdminClient, isServerConfigured } from "../lib/server/admin.js";
import { cleanText, MAX_NOTE } from "../lib/payout.js";

export const config = { runtime: "nodejs" } as const;

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

export async function POST(request: Request): Promise<Response> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Missing access token" }, 401);
  }
  if (!isServerConfigured()) {
    return json({ error: "SERVER_NOT_CONFIGURED" }, 503);
  }

  let body: { payoutId?: string; approve?: boolean; note?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const payoutId = String(body?.payoutId ?? "");
  if (!payoutId) {
    return json({ error: "Missing payoutId" }, 400);
  }
  if (typeof body?.approve !== "boolean") {
    return json({ error: "Missing approve flag" }, 400);
  }
  const note = cleanText(body?.note, MAX_NOTE);

  const supabase = getAdminClient();

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }
  const caller = userData.user;

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (callerProfile?.role !== "admin") {
    return json({ error: "FORBIDDEN", message: "Admin access required." }, 403);
  }

  const { data: payout } = await supabase
    .from("devcoin_payouts")
    .select("id, user_id, devcoins, amount_cents, status")
    .eq("id", payoutId)
    .maybeSingle();
  if (!payout) {
    return json({ error: "Payout not found" }, 404);
  }
  if (payout.status !== "pending") {
    return json({ error: "Payout already resolved" }, 409);
  }

  const { data, error } = await supabase.rpc("resolve_devcoin_payout", {
    p_payout_id: payoutId,
    p_admin: caller.id,
    p_approve: body.approve,
    p_note: note,
  });

  if (error) {
    return json({ error: error.message || "Could not resolve payout" }, 500);
  }

  return json(
    { ok: true, payoutId, status: body.approve ? "paid" : "rejected", user_id: payout.user_id },
    200,
  );
}

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
