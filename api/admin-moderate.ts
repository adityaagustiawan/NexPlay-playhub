// Vercel function: /api/admin-moderate
// Admin moderation of reported players. Only callers whose profile role is
// 'admin' may use it. The service-role client lets a permanent ban also block
// sign-in (Supabase GoTrue ban), while suspensions expire on their own.
//
//   POST { targetUserId, action, reason?, durationHours?, reportIds? }
//   Authorization: Bearer <access token>
//   -> { ok: true, targetUserId, action, until?, authBan }
//
// action is one of: ban | suspend | unban | unsuspend | resolve | dismiss
import { getAdminClient, isServerConfigured } from "../lib/server/admin.js";

export const config = { runtime: "nodejs" } as const;

const ACTIONS = ["ban", "suspend", "unban", "unsuspend", "resolve", "dismiss"] as const;
type Action = (typeof ACTIONS)[number];

// ~100 years, GoTrue treats a very long ban as permanent.
const PERMANENT_BAN = "876000h";
const MAX_REASON = 500;
const MAX_SUSPEND_HOURS = 24 * 365 * 10; // 10 years

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

export async function POST(request: Request): Promise<Response> {
  // 1) Authentication is required before anything else.
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Missing access token" }, 401);
  }

  if (!isServerConfigured()) {
    return json({ error: "SERVER_NOT_CONFIGURED" }, 503);
  }

  let body: {
    targetUserId?: string;
    action?: string;
    reason?: string;
    durationHours?: number;
    reportIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body?.action ?? "") as Action;
  if (!ACTIONS.includes(action)) {
    return json({ error: "Unknown action" }, 400);
  }

  const reason = typeof body?.reason === "string" ? body.reason.slice(0, MAX_REASON).trim() : "";
  const reportIds = Array.isArray(body?.reportIds)
    ? body.reportIds.filter((id): id is string => typeof id === "string").slice(0, 200)
    : [];

  const admin = getAdminClient();

  // 2) Resolve the caller from their JWT and require the admin role.
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }
  const caller = userData.user;

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (callerProfile?.role !== "admin") {
    return json({ error: "FORBIDDEN", message: "Admin access required." }, 403);
  }

  // resolve/dismiss only need the report ids.
  if (action === "resolve" || action === "dismiss") {
    await resolveReports(admin, caller.id, reportIds, action === "resolve" ? "resolved" : "dismissed", reason);
    return json({ ok: true, action, reports: reportIds.length }, 200);
  }

  // 3) Bans/suspensions target a real player.
  const targetUserId = String(body?.targetUserId ?? "");
  if (!targetUserId) {
    return json({ error: "Missing targetUserId" }, 400);
  }
  if (targetUserId === caller.id) {
    return json({ error: "You cannot moderate your own account." }, 400);
  }

  const { data: target } = await admin
    .from("profiles")
    .select("user_id, display_name, role")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target) {
    return json({ error: "Player not found" }, 404);
  }
  if (target.role === "admin") {
    return json({ error: "Admins cannot be banned or suspended." }, 400);
  }

  let until: string | null = null;
  let banDuration = "none";
  const patch: Record<string, unknown> = {};

  if (action === "ban") {
    patch.is_banned = true;
    patch.banned_reason = reason || "Banned by an administrator.";
    patch.suspended_until = null;
    patch.suspended_reason = null;
    banDuration = PERMANENT_BAN;
  } else if (action === "suspend") {
    const hours = Number(body?.durationHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_SUSPEND_HOURS) {
      return json({ error: "Invalid suspension duration" }, 400);
    }
    until = new Date(Date.now() + hours * 3600_000).toISOString();
    patch.is_banned = false;
    patch.banned_reason = null;
    patch.suspended_until = until;
    patch.suspended_reason = reason || "Suspended by an administrator.";
    banDuration = `${Math.max(1, Math.round(hours))}h`;
  } else if (action === "unban") {
    patch.is_banned = false;
    patch.banned_reason = null;
    banDuration = "none";
  } else if (action === "unsuspend") {
    patch.suspended_until = null;
    patch.suspended_reason = null;
    banDuration = "none";
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update(patch)
    .eq("user_id", targetUserId);
  if (profileError) {
    return json({ error: profileError.message }, 500);
  }

  // 4) Mirror the block at the auth layer so a permanent ban also stops
  //    sign-in and a suspension lifts itself when the window elapses.
  let authBan: "applied" | "failed" | "skipped" = "skipped";
  try {
    const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: banDuration,
    });
    authBan = authError ? "failed" : "applied";
    if (authError) {
      console.error("auth ban failed:", authError.message);
    }
  } catch (err) {
    authBan = "failed";
    console.error("auth ban threw:", err);
  }

  // 5) Close out the reports that triggered the action. (resolve/dismiss were
  //    handled above, so any ban/suspend/unban here marks reports resolved.)
  const resolvedStatus = "resolved";
  if (reportIds.length > 0) {
    await resolveReports(admin, caller.id, reportIds, resolvedStatus, reason, action, until ?? undefined);
  } else {
    // No explicit ids: sweep every still-pending report against this player.
    const { data: pending } = await admin
      .from("reports")
      .select("id")
      .eq("reported_user_id", targetUserId)
      .eq("status", "pending");
    const ids = (pending ?? []).map((r) => r.id as string);
    if (ids.length > 0) {
      await resolveReports(admin, caller.id, ids, resolvedStatus, reason, action, until ?? undefined);
    }
  }

  // 6) Audit trail.
  await admin.from("moderation_actions").insert({
    admin_id: caller.id,
    target_user_id: targetUserId,
    action,
    reason: reason || null,
    until,
  });

  return json({ ok: true, targetUserId, action, until, authBan }, 200);
}

async function resolveReports(
  admin: ReturnType<typeof getAdminClient>,
  adminId: string,
  ids: string[],
  status: string,
  reason: string,
  action?: string,
  until?: string,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await admin
    .from("reports")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      action: action ?? status,
      resolution: reason || (until ? `Suspended until ${until}` : null),
    })
    .in("id", ids);
  if (error) {
    console.error("resolving reports failed:", error.message);
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
