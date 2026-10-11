// moderation.ts — shared types + pure helpers for admin moderation and the
// "report a player" flow. Kept free of Supabase calls so it can be unit-tested
// and reused by both the client and the admin dashboard.

export type ModerationKind = "banned" | "suspended";

export interface BlockedAccount {
  is_banned?: boolean | null;
  banned_reason?: string | null;
  suspended_until?: string | null;
  suspended_reason?: string | null;
}

export interface BlockedState {
  blocked: boolean;
  kind: ModerationKind | null;
  until: string | null;
  reason: string | null;
}

/** Suspension presets shown in the admin dashboard. */
export const SUSPEND_PRESETS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
] as const;

/** Preset reasons offered when reporting a player. */
export const REPORT_REASONS = [
  "Cheating or exploits",
  "Harassment or hate speech",
  "Inappropriate content",
  "Spam or scam",
  "Impersonation",
  "Something else",
] as const;

/**
 * A player is blocked when they are banned, or suspended and the window has
 * not yet elapsed. `now` is injectable so tests are deterministic.
 */
export function blockedState(account: BlockedAccount | null | undefined, now: number = Date.now()): BlockedState {
  if (!account) return { blocked: false, kind: null, until: null, reason: null };

  if (account.is_banned) {
    return {
      blocked: true,
      kind: "banned",
      until: null,
      reason: account.banned_reason ?? null,
    };
  }

  if (account.suspended_until) {
    const until = new Date(account.suspended_until).getTime();
    if (Number.isFinite(until) && until > now) {
      return {
        blocked: true,
        kind: "suspended",
        until: account.suspended_until,
        reason: account.suspended_reason ?? null,
      };
    }
  }

  return { blocked: false, kind: null, until: null, reason: null };
}

/** Human-friendly "how long is left" for a suspension. */
export function formatRemaining(until: string, now: number = Date.now()): string {
  const ms = new Date(until).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "expired";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** A short status label for a player row / badge. */
export function moderationStatus(account: BlockedAccount | null | undefined, now: number = Date.now()): string {
  const state = blockedState(account, now);
  if (state.kind === "banned") return "Banned";
  if (state.kind === "suspended") return `Suspended · ${formatRemaining(state.until!, now)} left`;
  return "Active";
}

export interface ReportRow {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  reason: string;
  status: string | null;
  created_at: string;
}

export interface ReportedPlayerGroup {
  userId: string;
  reports: ReportRow[];
  pending: number;
  total: number;
  latestAt: string;
}

/**
 * Group reports by the player they target so the dashboard can show one row per
 * reported player with a report count. Newest activity first.
 */
export function groupReportsByUser(reports: ReportRow[]): ReportedPlayerGroup[] {
  const byUser = new Map<string, ReportRow[]>();
  for (const report of reports) {
    const key = report.reported_user_id ?? "unknown";
    const list = byUser.get(key);
    if (list) list.push(report);
    else byUser.set(key, [report]);
  }

  return Array.from(byUser.entries())
    .map(([userId, list]) => {
      const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
      return {
        userId,
        reports: sorted,
        pending: sorted.filter((r) => (r.status ?? "pending") === "pending").length,
        total: sorted.length,
        latestAt: sorted[0]?.created_at ?? "",
      };
    })
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

/** Short label for a moderation action (audit trail / buttons). */
export function actionLabel(action: string): string {
  switch (action) {
    case "ban":
      return "Banned";
    case "suspend":
      return "Suspended";
    case "unban":
      return "Unbanned";
    case "unsuspend":
      return "Unsuspended";
    case "resolve":
      return "Report resolved";
    case "dismiss":
      return "Report dismissed";
    default:
      return action;
  }
}
