// Vercel function: /api/purchase-item
// Buys a creator's in-game item with the caller's NexCoins. The NexCoins move
// to the creator as DevCoins through the purchase_game_item() RPC, which is
// restricted to the service role — clients can never credit themselves.
//
//   POST { itemId }
//   Authorization: Bearer <access token>
//   -> { ok: true, coins, price, creatorDevcoins, purchaseId }
import { getAdminClient, isServerConfigured } from "../lib/server/admin.js";

export const config = { runtime: "nodejs" } as const;

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

export async function POST(request: Request): Promise<Response> {
  const token = bearer(request);
  if (!token) {
    return json({ error: "Missing access token" }, 401);
  }
  if (!isServerConfigured()) {
    return json({ error: "SERVER_NOT_CONFIGURED" }, 503);
  }

  let body: { itemId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const itemId = String(body?.itemId ?? "");
  if (!itemId) {
    return json({ error: "Missing itemId" }, 400);
  }

  const supabase = getAdminClient();

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }
  const buyerId = userData.user.id;

  const { data, error } = await supabase.rpc("purchase_game_item", {
    p_item_id: itemId,
    p_buyer: buyerId,
  });

  if (error) {
    // The RPC raises readable messages for the predictable cases.
    const message = error.message || "Purchase failed";
    const status = /not enough|not for sale|your account|cannot buy your own|not found/i.test(message)
      ? 400
      : 500;
    return json({ error: message }, status);
  }

  const result = data as {
    ok: boolean;
    coins: number;
    price: number;
    creatorDevcoins: number;
    purchaseId: string;
  } | null;

  return json({ ok: true, ...(result ?? {}) }, 200);
}

function bearer(request: Request): string {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
