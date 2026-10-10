// POST /api/topup-checkout
// Creates a Stripe Checkout Session for an authenticated player.
// Requires: Authorization: Bearer <supabase access token>
// Body:     { "packageId": "3" }
// Response: { "url": "https://checkout.stripe.com/c/pay/..." }
import Stripe from "stripe";
import { findPackage } from "../lib/server/packages";
import { getAdminClient, isServerConfigured } from "../lib/server/admin";

export const config = { runtime: "nodejs" } as const;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1) Unauthenticated clients are rejected before anything else.
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Missing access token" }, 401);
  }

  // 2) Payments must be configured server-side.
  if (!process.env.STRIPE_SECRET_KEY) {
    return json(
      {
        error: "PAYMENTS_NOT_CONFIGURED",
        message:
          "Payments are not connected yet. Ask the admin to add Stripe keys (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) to the server — no charge was made.",
      },
      503
    );
  }
  if (!isServerConfigured()) {
    return json({ error: "SERVER_NOT_CONFIGURED", message: "Missing Supabase server env." }, 503);
  }

  let body: { packageId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const pkg = findPackage(String(body?.packageId ?? ""));
  if (!pkg) {
    return json({ error: "Unknown package" }, 400);
  }

  // 3) Resolve the player from their JWT.
  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }
  const user = userData.user;

  // 4) Create the Stripe Checkout Session. The server owns the price — the
  //    client never sends currency amounts.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-09-30.endive",
  });
  const coins = pkg.coins + pkg.bonus;

  const origin = process.env.SITE_URL || "https://nexconsole.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pkg.priceCents,
          product_data: {
            name: `${pkg.coins.toLocaleString()} NexCoins`,
            description:
              pkg.bonus > 0 ? `+${pkg.bonus} bonus (${coins.toLocaleString()} total)` : undefined,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      package_id: pkg.id,
      coins: String(coins),
      amount_cents: String(pkg.priceCents),
    },
    success_url: `${origin}/topup?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/topup?cancelled=1`,
  });

  return json({ url: session.url }, 200);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}