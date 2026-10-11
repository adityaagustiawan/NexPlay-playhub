// devcoinsApi.ts
// Thin client wrappers around the DevCoin economy. Reads go straight to
// Supabase (RLS already scopes them to the caller); anything that *moves*
// money goes through the serverless endpoints, because the Postgres RPCs that
// touch NexCoins/DevCoins are service-role only.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type GameItem = Database["public"]["Tables"]["game_items"]["Row"];
export type ItemPurchase = Database["public"]["Tables"]["item_purchases"]["Row"];
export type DevcoinLedger = Database["public"]["Tables"]["devcoin_ledger"]["Row"];
export type DevcoinPayout = Database["public"]["Tables"]["devcoin_payouts"]["Row"];

export type PurchaseResult = {
  ok: boolean;
  coins: number;
  price: number;
  creatorDevcoins: number;
  purchaseId: string;
};

export type PayoutResult = {
  ok: boolean;
  devcoins: number;
  amountCents: number;
  payoutId: string;
};

/** Access token for the current session, or null when signed out. */
async function authToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await authToken();
  if (!token) {
    throw new Error("Please sign in to continue.");
  }
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page).
  }
  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return payload as T;
}

// ---------------------------------------------------------------- items

/** Store items for a game, in display order. */
export async function fetchItemsForGame(gameId: string): Promise<GameItem[]> {
  const { data, error } = await supabase
    .from("game_items")
    .select()
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Every store item a creator sells across all of their games. */
export async function fetchItemsForCreator(creatorId: string): Promise<GameItem[]> {
  const { data, error } = await supabase
    .from("game_items")
    .select()
    .eq("creator_id", creatorId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ItemDraft = {
  game_id: string;
  creator_id: string;
  name: string;
  description?: string | null;
  price_coins: number;
  emoji?: string | null;
  category?: string | null;
  active?: boolean;
  sort_order?: number;
};

export async function createItem(draft: ItemDraft): Promise<GameItem> {
  const { data, error } = await supabase.from("game_items").insert(draft).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateItem(id: string, patch: Partial<ItemDraft>): Promise<void> {
  const { error } = await supabase.from("game_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("game_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- purchases

/** Buy an item. The server validates ownership, price and balance. */
export async function purchaseItem(itemId: string): Promise<PurchaseResult> {
  return post<PurchaseResult>("/api/purchase-item", { itemId });
}

/** Items the signed-in player already bought in a given game. */
export async function fetchOwnedItems(gameId: string, buyerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("item_purchases")
    .select("item_id")
    .eq("game_id", gameId)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.item_id))];
}

// ---------------------------------------------------------------- earnings

/** DevCoin ledger for a creator, newest first. */
export async function fetchDevcoinLedger(userId: string, limit = 100): Promise<DevcoinLedger[]> {
  const { data, error } = await supabase
    .from("devcoin_ledger")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Cash-out requests for a creator, newest first. */
export async function fetchPayouts(userId: string): Promise<DevcoinPayout[]> {
  const { data, error } = await supabase
    .from("devcoin_payouts")
    .select()
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Ask to exchange DevCoins for real money (200 DevCoin floor). */
export async function requestPayout(devcoins: number, method: string): Promise<PayoutResult> {
  return post<PayoutResult>("/api/request-payout", { devcoins, method });
}

/** Sales that credited a creator, newest first. */
export async function fetchCreatorSales(creatorId: string, limit = 200): Promise<ItemPurchase[]> {
  const { data, error } = await supabase
    .from("item_purchases")
    .select()
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------- admin
    .select()
    .order("requested_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Approve or reject a payout request (admins only). */
export async function resolvePayout(
  payoutId: string,
  approve: boolean,
  note?: string,
): Promise<{ ok: boolean; status: string }> {
  return post("/api/resolve-payout", { payoutId, approve, note });
}
