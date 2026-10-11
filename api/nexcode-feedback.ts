// Vercel function: /api/nexcode-feedback
// Records how a player rated a NexCode generation (1 = worst … 5 = best) so the
// engine can learn from what works. Ownership is enforced server-side: you can
// only rate a generation you created.
//
//   POST { "generationId": "<uuid>", "rating": 1..5 }
//   Authorization: Bearer <access token>
import { getAdminClient } from "../lib/server/admin.js";

export const config = { runtime: "nodejs" } as const;

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

export async function POST(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing access token" }, 401);

  let body: { generationId?: unknown; rating?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const generationId = typeof body.generationId === "string" ? body.generationId : "";
  const rating = Number(body.rating);
  if (!generationId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: "generationId and an integer rating 1-5 are required" }, 400);
  }

  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return json({ error: "SERVER_NOT_CONFIGURED" }, 503);
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);

  const { data, error } = await admin
    .from("nexcode_learning")
    .update({ rating, rated_at: new Date().toISOString() })
    .eq("id", generationId)
    .eq("user_id", userData.user.id)
    .select("id")
    .maybeSingle();

  if (error) return json({ error: error.message }, 400);
  if (!data) return json({ error: "Generation not found" }, 404);
  return json({ ok: true, rating });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
