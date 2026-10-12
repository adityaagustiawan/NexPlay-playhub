// Vercel function: /api/request-payout
// Asks to exchange DevCoins for real money. The RPC debits the balance while
// the request is pending (so it cannot be double-spent) and rejects anything
// under the 200-DevCoin floor.
//
//   POST { devcoins, method }
//   Authorization: Bearer <access token>
//   -> { ok: true, devcoins, amountCents, payoutId }
import { getAdminClient, isServerConfigured } from "../lib/server/admin.js";
import { MAX_METHOD } from "../lib/payout.js";

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

  let body: { devcoins?: number | string; method?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Round down so a fractional request never turns into a fractional cent.
  const devcoins = Math.floor(Number(body?.devcoins));
  if (!Number.isFinite(devcoins) || devcoins <= 0) {
    return json({ error: "Enter how many DevCoins to withdraw." }, 400);
  }

  const method = typeof body?.method === "string" ? body.method.slice(0, MAX_METHOD) : "";

  const supabase = getAdminClient();

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }

  const { data, error } = await supabase.rpc("request_devcoin_payout", {
    p_user: userData.user.id,
    p_devcoins: devcoins,
    p_method: method,
  });

  if (error) {
    const message = error.message || "Cash-out failed";
    const status = /at least 200|not enough/i.test(message) ? 400 : 500;
    return json({ error: message }, status);
  }

  const result = data as {
    ok: boolean;
    devcoins: number;
    amountCents: number;
    payoutId: string;
  } | null;

  return json({ ok: true, ...(result ?? {}) }, 200);
}

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
