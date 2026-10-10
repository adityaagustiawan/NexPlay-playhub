// Vercel function: /api/topup-webhook
// Stripe webhook endpoint. Verifies the signature, then credits NexCoins to the
// player via the service-role client (idempotent per checkout session).
import Stripe from "stripe";
import { getAdminClient } from "../lib/server/admin.js";

export const config = { runtime: "nodejs" } as const;

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return json(
      { error: "PAYMENTS_NOT_CONFIGURED", message: "Stripe webhook secret is not configured." },
      503
    );
  }

  // Stripe also requires the raw body for signature verification.
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2026-09-30.endive",
    });
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return json({ error: "Invalid signature" }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return json({ ok: true }, 200);
    }
    const userId = session.metadata?.user_id;
    const coins = Number(session.metadata?.coins ?? 0);
    const amountCents = Number(session.metadata?.amount_cents ?? 0);
    const sessionId = session.id;
    if (!userId || !coins || !sessionId) {
      return json({ error: "Missing metadata" }, 400);
    }

    try {
      await creditCoins({ sessionId, userId, coins, amountCents });
    } catch (err) {
      console.error("crediting coins failed:", err);
      // Return 500 so Stripe retries; crediting is idempotent keyed on session id.
      return json({ error: "crediting failed" }, 500);
    }
  }

  return json({ ok: true }, 200);
}

async function creditCoins(input: {
  sessionId: string;
  userId: string;
  coins: number;
  amountCents: number;
}): Promise<void> {
  const admin = getAdminClient();

  // Idempotency: record the checkout first; skip crediting if we already saw it.
  const { data: inserted } = await admin
    .from("topup_payments")
    .upsert(
      {
        id: input.sessionId,
        user_id: input.userId,
        coins: input.coins,
        amount_cents: input.amountCents,
        status: "paid",
      },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (!inserted?.id) {
    // Already processed — never double-credit.
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("coins")
    .eq("user_id", input.userId)
    .maybeSingle();

  const current = typeof profile?.coins === "number" ? profile.coins : 0;
  const { error } = await admin
    .from("profiles")
    .update({ coins: current + input.coins })
    .eq("user_id", input.userId);

  if (error) {
    throw error;
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}