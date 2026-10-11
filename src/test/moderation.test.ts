import { describe, it, expect } from "vitest";
import {
  blockedState,
  formatRemaining,
  moderationStatus,
  groupReportsByUser,
  actionLabel,
  SUSPEND_PRESETS,
  REPORT_REASONS,
  type ReportRow,
} from "../lib/moderation";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");

describe("blockedState", () => {
  it("treats a missing profile as not blocked", () => {
    expect(blockedState(null, NOW).blocked).toBe(false);
    expect(blockedState(undefined, NOW).blocked).toBe(false);
  });

  it("treats a clean account as not blocked", () => {
    const state = blockedState({ is_banned: false, suspended_until: null }, NOW);
    expect(state.blocked).toBe(false);
    expect(state.kind).toBeNull();
  });

  it("flags a banned account and carries the reason", () => {
    const state = blockedState({ is_banned: true, banned_reason: "Cheating" }, NOW);
    expect(state.blocked).toBe(true);
    expect(state.kind).toBe("banned");
    expect(state.reason).toBe("Cheating");
  });

  it("flags a suspension that is still in the future", () => {
    const until = new Date(NOW + 3 * 3600_000).toISOString();
    const state = blockedState({ is_banned: false, suspended_until: until, suspended_reason: "Spam" }, NOW);
    expect(state.blocked).toBe(true);
    expect(state.kind).toBe("suspended");
    expect(state.until).toBe(until);
  });

  it("ignores a suspension whose window already elapsed", () => {
    const until = new Date(NOW - 1000).toISOString();
    expect(blockedState({ suspended_until: until }, NOW).blocked).toBe(false);
  });

  it("prefers the ban when both flags are present", () => {
    const until = new Date(NOW + 3600_000).toISOString();
    const state = blockedState({ is_banned: true, suspended_until: until }, NOW);
    expect(state.kind).toBe("banned");
  });
});

describe("formatRemaining", () => {
  it("reports minutes for short windows", () => {
    expect(formatRemaining(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toBe("5 minutes");
  });

  it("reports hours mid-range", () => {
    expect(formatRemaining(new Date(NOW + 3 * 3600_000).toISOString(), NOW)).toBe("3 hours");
  });

  it("reports days for long windows", () => {
    expect(formatRemaining(new Date(NOW + 4 * 24 * 3600_000).toISOString(), NOW)).toBe("4 days");
  });

  it("handles singular units and expired windows", () => {
    expect(formatRemaining(new Date(NOW + 3600_000).toISOString(), NOW)).toBe("1 hour");
    expect(formatRemaining(new Date(NOW - 1).toISOString(), NOW)).toBe("expired");
  });
});

describe("moderationStatus", () => {
  it("labels active, banned and suspended accounts", () => {
    expect(moderationStatus({}, NOW)).toBe("Active");
    expect(moderationStatus({ is_banned: true }, NOW)).toBe("Banned");
    const until = new Date(NOW + 2 * 3600_000).toISOString();
    expect(moderationStatus({ suspended_until: until }, NOW)).toBe("Suspended · 2 hours left");
  });
});

describe("groupReportsByUser", () => {
  const report = (over: Partial<ReportRow>): ReportRow => ({
    id: Math.random().toString(36).slice(2),
    reporter_id: "reporter",
    reported_user_id: "player-1",
    reason: "cheating",
    status: "pending",
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  it("groups by the reported player and counts pending reports", () => {
    const groups = groupReportsByUser([
      report({ reported_user_id: "a", status: "pending", created_at: "2026-01-01T00:00:00.000Z" }),
      report({ reported_user_id: "a", status: "resolved", created_at: "2026-01-02T00:00:00.000Z" }),
      report({ reported_user_id: "b", status: "pending", created_at: "2026-01-03T00:00:00.000Z" }),
    ]);
    expect(groups).toHaveLength(2);
    // Newest activity first: b (Jan 3) before a (Jan 2).
    expect(groups[0].userId).toBe("b");
    expect(groups[0].total).toBe(1);
    const a = groups.find((g) => g.userId === "a")!;
    expect(a.total).toBe(2);
    expect(a.pending).toBe(1);
  });

  it("buckets reports with no target under 'unknown'", () => {
    const groups = groupReportsByUser([report({ reported_user_id: null })]);
    expect(groups[0].userId).toBe("unknown");
  });
});

describe("actionLabel", () => {
  it("maps every moderation action to a readable label", () => {
    expect(actionLabel("ban")).toBe("Banned");
    expect(actionLabel("suspend")).toBe("Suspended");
    expect(actionLabel("unban")).toBe("Unbanned");
    expect(actionLabel("unsuspend")).toBe("Unsuspended");
    expect(actionLabel("resolve")).toBe("Report resolved");
    expect(actionLabel("dismiss")).toBe("Report dismissed");
  });
});

describe("presets", () => {
  it("offers ascending suspension windows", () => {
    const hours = SUSPEND_PRESETS.map((p) => p.hours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    expect(hours[0]).toBeGreaterThan(0);
  });

  it("offers report reasons", () => {
    expect(REPORT_REASONS.length).toBeGreaterThan(0);
    expect(REPORT_REASONS).toContain("Cheating or exploits");
  });
});
