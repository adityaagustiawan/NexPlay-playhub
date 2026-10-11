// Admin.tsx — moderation dashboard. Admins see who has been reported and can
// suspend (timed) or ban (permanent) those players, lift either action, and
// resolve/dismiss the reports. Actions go through /api/admin-moderate (which
// also blocks sign-in via the auth admin API); if that endpoint isn't
// configured, it falls back to writing the profile flags directly.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Clock,
  Flag,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  UserCheck,
  History,
} from "lucide-react";
import { toast } from "sonner";
import type { TablesUpdate } from "@/integrations/supabase/types";
import {
  SUSPEND_PRESETS,
  actionLabel,
  blockedState,
  formatRemaining,
  groupReportsByUser,
  moderationStatus,
  type ReportRow,
} from "@/lib/moderation";
import {
  devcoinsToUsd,
  formatDevcoins,
  formatUsd,
  payoutStatusLabel,
} from "@/lib/devcoins";
import { fetchPendingPayouts, resolvePayout, type DevcoinPayout } from "@/lib/devcoinsApi";

interface ModProfile {
  user_id: string;
  display_name: string | null;
  public_id: string | null;
  role: string | null;
  creator_tier: string | null;
  is_banned: boolean | null;
  banned_reason: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
}

interface AuditRow {
  id: string;
  admin_id: string;
  target_user_id: string;
  action: string;
  reason: string | null;
  until: string | null;
  created_at: string;
}

type Mode = "suspend" | "ban";

const Admin = () => {
  const { session, user } = useAuth();
  const [profiles, setProfiles] = useState<ModProfile[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [payouts, setPayouts] = useState<DevcoinPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Moderation dialog state.
  const [target, setTarget] = useState<ModProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("suspend");
  const [durationHours, setDurationHours] = useState<number>(24);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Payout resolution: which request is being worked on, and its note.
  const [payoutBusy, setPayoutBusy] = useState<string | null>(null);
  const [payoutNotes, setPayoutNotes] = useState<Record<string, string>>({});

  const profileById = useMemo(() => {
    const map = new Map<string, ModProfile>();
    for (const p of profiles) map.set(p.user_id, p);
    return map;
  }, [profiles]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [profilesRes, reportsRes, auditRes, payoutsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "user_id, display_name, public_id, role, creator_tier, is_banned, banned_reason, suspended_until, suspended_reason"
        )
        .order("created_at", { ascending: true }),
      supabase.from("reports").select("id, reporter_id, reported_user_id, reason, status, created_at").order("created_at", { ascending: false }),
      supabase
        .from("moderation_actions")
        .select("id, admin_id, target_user_id, action, reason, until, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      fetchPendingPayouts(),
    ]);

    if (profilesRes.error || reportsRes.error) {
      setLoadError(profilesRes.error?.message || reportsRes.error?.message || "Failed to load");
    }
    setProfiles((profilesRes.data as ModProfile[]) ?? []);
    setReports((reportsRes.data as ReportRow[]) ?? []);
    setAudit((auditRes.data as AuditRow[]) ?? []);
    setPayouts(payoutsRes);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const groups = useMemo(() => {
    const list = pendingOnly ? reports.filter((r) => (r.status ?? "pending") === "pending") : reports;
    return groupReportsByUser(list);
  }, [reports, pendingOnly]);

  const pendingCount = useMemo(
    () => reports.filter((r) => (r.status ?? "pending") === "pending").length,
    [reports]
  );

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.display_name ?? "").toLowerCase().includes(q) ||
        (p.public_id ?? "").toLowerCase().includes(q)
    );
  }, [profiles, query]);

  const openModeration = (player: ModProfile, initial: Mode = "suspend") => {
    setTarget(player);
    setMode(initial);
    setDurationHours(24);
    setReason("");
    setOpen(true);
  };

  const reportIdsFor = (userId: string) =>
    reports
      .filter((r) => r.reported_user_id === userId && (r.status ?? "pending") === "pending")
      .map((r) => r.id);

  /** Call the server endpoint; fall back to a direct profile write if unset. */
  const runAction = async (
    player: ModProfile,
    action: "ban" | "suspend" | "unban" | "unsuspend",
    opts: { reason?: string; durationHours?: number } = {}
  ) => {
    const body = {
      targetUserId: player.user_id,
      action,
      reason: opts.reason,
      durationHours: opts.durationHours,
      reportIds: action === "unban" || action === "unsuspend" ? [] : reportIdsFor(player.user_id),
    };

    setBusy(true);
    let viaServer = true;
    try {
      const res = await fetch("/api/admin-moderate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503 && data?.error === "SERVER_NOT_CONFIGURED") {
          viaServer = false;
        } else {
          throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
        }
      }
    } catch {
      viaServer = false;
    }

    if (!viaServer) {
      const ok = await fallbackModerate(player, action, opts);
      if (!ok.success) {
        setBusy(false);
        toast.error(ok.error ?? "Moderation failed");
        return;
      }
    }

    setBusy(false);
    setOpen(false);
    toast.success(
      `${actionLabel(action)}: ${player.display_name || player.public_id || "player"}${
        viaServer ? "" : " (database only — sign-in block needs the server key)"
      }`
    );
    await loadAll();
  };

  /** Direct-to-DB moderation used when the server function has no service key. */
  const fallbackModerate = async (
    player: ModProfile,
    action: "ban" | "suspend" | "unban" | "unsuspend",
    opts: { reason?: string; durationHours?: number }
  ): Promise<{ success: boolean; error?: string }> => {
    const patch: TablesUpdate<"profiles"> = {};
    if (action === "ban") {
      patch.is_banned = true;
      patch.banned_reason = opts.reason || "Banned by an administrator.";
      patch.suspended_until = null;
      patch.suspended_reason = null;
    } else if (action === "suspend") {
      patch.is_banned = false;
      patch.banned_reason = null;
      patch.suspended_until = new Date(
        Date.now() + (opts.durationHours ?? 24) * 3600_000
      ).toISOString();
      patch.suspended_reason = opts.reason || "Suspended by an administrator.";
    } else if (action === "unban") {
      patch.is_banned = false;
      patch.banned_reason = null;
    } else {
      patch.suspended_until = null;
      patch.suspended_reason = null;
    }

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", player.user_id);
    if (error) return { success: false, error: error.message };

    // Best-effort audit row (RLS lets an admin record their own actions).
    if (user?.id) {
      await supabase.from("moderation_actions").insert({
        admin_id: user.id,
        target_user_id: player.user_id,
        action,
        reason: opts.reason ?? null,
        until: (patch.suspended_until as string | undefined) ?? null,
      });
    }

    const ids = reportIdsFor(player.user_id);
    if (ids.length > 0 && (action === "ban" || action === "suspend")) {
      await supabase
        .from("reports")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          action,
          resolution: opts.reason ?? null,
        })
        .in("id", ids);
    }
    return { success: true };
  };

  /**
   * Approve or reject a DevCoin cash-out request. Rejecting refunds the
   * DevCoins to the creator, approving marks it paid (paid off-platform).
   */
  const handlePayout = async (payout: DevcoinPayout, approve: boolean) => {
    setPayoutBusy(payout.id);
    try {
      await resolvePayout(payout.id, approve, payoutNotes[payout.id]);
      toast.success(
        approve
          ? `Payout marked paid — ${formatDevcoins(payout.devcoins)} DevCoins (${formatUsd(payout.amount_cents)})`
          : `Payout rejected — ${formatDevcoins(payout.devcoins)} DevCoins refunded`
      );
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not resolve payout");
    } finally {
      setPayoutBusy(null);
    }
  };

  const resolveReport = async (report: ReportRow, status: "resolved" | "dismissed") => {
    setBusy(true);
    let viaServer = true;
    try {
      const res = await fetch("/api/admin-moderate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ action: status === "resolved" ? "resolve" : "dismiss", reportIds: [report.id] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!(res.status === 503 && data?.error === "SERVER_NOT_CONFIGURED")) {
          throw new Error(data?.message || data?.error || "Failed");
        }
        viaServer = false;
      }
    } catch {
      viaServer = false;
    }

    if (!viaServer) {
      const { error } = await supabase
        .from("reports")
        .update({
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          action: status === "resolved" ? "resolve" : "dismiss",
        })
        .eq("id", report.id);
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
    }
    setBusy(false);
    toast.success(status === "resolved" ? "Report resolved" : "Report dismissed");
    await loadAll();
  };

  const confirmAction = () => {
    if (!target) return;
    if (mode === "suspend") {
      runAction(target, "suspend", { reason, durationHours });
    } else {
      runAction(target, "ban", { reason });
    }
  };

  const targetState = target ? blockedState(target) : null;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            Review reports and suspend or ban players. Admins also get every Pro feature.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 font-body text-sm font-semibold px-3 py-1.5 rounded-full bg-destructive/15 text-destructive">
            <Flag className="h-4 w-4" /> {pendingCount} pending
          </span>
        )}
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 font-body text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Tabs defaultValue="reported">
        <TabsList>
          <TabsTrigger value="reported">
            Reported players {pendingCount > 0 ? `(${pendingCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="players">All players</TabsTrigger>
          <TabsTrigger value="payouts">
            Cash-outs {payouts.length > 0 ? `(${payouts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        {/* ---- Reported players ---- */}
        <TabsContent value="reported" className="mt-4 space-y-3">
          <label className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
              className="accent-primary"
            />
            Show only pending reports
          </label>

          {loading ? (
            <Loading />
          ) : groups.length === 0 ? (
            <Empty icon={<ShieldCheck className="h-10 w-10 text-muted-foreground mb-3" />} text="No reports to review." />
          ) : (
            groups.map((group) => {
              const player: ModProfile =
                profileById.get(group.userId) ?? {
                  user_id: group.userId,
                  display_name: null,
                  public_id: null,
                  role: null,
                  creator_tier: null,
                  is_banned: false,
                  banned_reason: null,
                  suspended_until: null,
                  suspended_reason: null,
                };
              const state = blockedState(player);
              const isOpen = expanded === group.userId;
              return (
                <div key={group.userId} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => setExpanded(isOpen ? null : group.userId)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      aria-label={isOpen ? "Collapse reports" : "Expand reports"}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Avatar name={player?.display_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-sm font-bold text-foreground truncate">
                          {player?.display_name || "Unknown player"}
                        </p>
                        {player?.public_id && (
                          <span className="font-body text-xs text-muted-foreground">#{player.public_id}</span>
                        )}
                        <StatusBadge account={player} />
                      </div>
                      <p className="font-body text-xs text-muted-foreground truncate">
                        {group.total} report{group.total === 1 ? "" : "s"} · {group.pending} pending · latest{" "}
                        {new Date(group.latestAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openModeration(player, "suspend")}>
                        <Clock className="h-4 w-4 mr-1" /> Suspend
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openModeration(player, "ban")}>
                        <Ban className="h-4 w-4 mr-1" /> Ban
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {group.reports.map((report) => {
                        const reporter = report.reporter_id ? profileById.get(report.reporter_id) : null;
                        const status = report.status ?? "pending";
                        return (
                          <div key={report.id} className="p-4 flex items-start gap-3">
                            <Flag className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="font-body text-sm text-foreground whitespace-pre-wrap break-words">
                                {report.reason}
                              </p>
                              <p className="font-body text-xs text-muted-foreground mt-1">
                                by {reporter?.display_name || "a player"} · {new Date(report.created_at).toLocaleString()} ·{" "}
                                <span
                                  className={
                                    status === "pending"
                                      ? "text-amber-500"
                                      : status === "resolved"
                                        ? "text-emerald-500"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {status}
                                </span>
                              </p>
                            </div>
                            {status === "pending" && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => resolveReport(report, "dismissed")} disabled={busy}>
                                  Dismiss
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => resolveReport(report, "resolved")} disabled={busy}>
                                  Resolve
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {state.blocked && (
                        <LiftBar player={player} state={state} onLift={runAction} busy={busy} />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ---- All players ---- */}
        <TabsContent value="players" className="mt-4 space-y-3">
          <div className="flex items-center bg-card border border-border rounded-lg px-4 py-2.5 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground mr-3" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or public id…"
              className="border-0 bg-transparent focus-visible:ring-0 h-7 px-0"
            />
          </div>

          {loading ? (
            <Loading />
          ) : filteredProfiles.length === 0 ? (
            <Empty icon={<UserCheck className="h-10 w-10 text-muted-foreground mb-3" />} text="No players match." />
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {filteredProfiles.map((player) => {
                const state = blockedState(player);
                return (
                  <div key={player.user_id} className="flex items-center gap-3 p-4">
                    <Avatar name={player.display_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-sm font-bold text-foreground truncate">
                          {player.display_name || "Unnamed"}
                        </p>
                        {player.public_id && (
                          <span className="font-body text-xs text-muted-foreground">#{player.public_id}</span>
                        )}
                        {player.role === "admin" && (
                          <span className="font-body text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                            admin
                          </span>
                        )}
                        {player.creator_tier === "pro" && (
                          <span className="font-body text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            pro
                          </span>
                        )}
                        <StatusBadge account={player} />
                      </div>
                      <p className="font-body text-xs text-muted-foreground truncate">
                        {state.blocked && state.kind === "suspended" && state.until
                          ? `${player.suspended_reason || "Suspended"} · ${formatRemaining(state.until)} left`
                          : player.role === "admin"
                            ? "Administrator"
                            : "Active"}
                      </p>
                    </div>
                    {player.role === "admin" ? (
                      <span className="font-body text-xs text-muted-foreground">protected</span>
                    ) : state.blocked ? (
                      <LiftBar player={player} state={state} onLift={runAction} busy={busy} compact />
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openModeration(player, "suspend")}>
                          <Clock className="h-4 w-4 mr-1" /> Suspend
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openModeration(player, "ban")}>
                          <Ban className="h-4 w-4 mr-1" /> Ban
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---- Audit log ---- */}
        <TabsContent value="audit" className="mt-4">
          {loading ? (
            <Loading />
          ) : audit.length === 0 ? (
            <Empty icon={<History className="h-10 w-10 text-muted-foreground mb-3" />} text="No moderation actions yet." />
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {audit.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-4">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1 font-body text-sm">
                    <span className="font-semibold text-foreground">{actionLabel(row.action)}</span>{" "}
                    <span className="text-muted-foreground">
                      {profileById.get(row.target_user_id)?.display_name || "a player"} by{" "}
                      {profileById.get(row.admin_id)?.display_name || "an admin"}
                    </span>
                    {row.reason && <p className="text-xs text-muted-foreground">{row.reason}</p>}
                    {row.until && (
                      <p className="text-xs text-muted-foreground">until {new Date(row.until).toLocaleString()}</p>
                    )}
                  </div>
                  <span className="font-body text-xs text-muted-foreground shrink-0">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Moderation dialog ---- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Moderate {target?.display_name || "player"}</DialogTitle>
            <DialogDescription>
              {targetState?.blocked
                ? "This player is currently blocked. Lift it below, or change the action."
                : "Choose a suspension window or a permanent ban."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {targetState?.blocked && target && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-body text-xs text-muted-foreground">
                Status: <span className="font-semibold text-foreground">{moderationStatus(target)}</span>
                {targetState.reason ? ` — ${targetState.reason}` : ""}
                <div className="mt-2 flex gap-2">
                  {targetState.kind === "banned" ? (
                    <Button size="sm" variant="outline" onClick={() => runAction(target, "unban")} disabled={busy}>
                      Unban
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => runAction(target, "unsuspend")} disabled={busy}>
                      Unsuspend now
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("suspend")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-body text-sm transition-colors ${
                  mode === "suspend" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <Clock className="h-4 w-4" /> Suspend
              </button>
              <button
                type="button"
                onClick={() => setMode("ban")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-body text-sm transition-colors ${
                  mode === "ban" ? "border-destructive bg-destructive/10 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <Ban className="h-4 w-4" /> Ban
              </button>
            </div>

            {mode === "suspend" && (
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1.5 block">Duration</label>
                <Select value={String(durationHours)} onValueChange={(v) => setDurationHours(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUSPEND_PRESETS.map((preset) => (
                      <SelectItem key={preset.hours} value={String(preset.hours)}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="font-body text-xs text-muted-foreground mb-1.5 block">
                Reason {mode === "ban" ? "(shown on their account)" : "(optional)"}
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why is this player being actioned?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={mode === "ban" ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {mode === "ban" ? "Ban permanently" : `Suspend for ${durationHours}h`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

function Avatar({ name }: { name?: string | null }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-heading text-sm font-bold text-primary shrink-0">
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function StatusBadge({ account }: { account?: ModProfile | null }) {
  const state = blockedState(account);
  if (state.kind === "banned") {
    return (
      <span className="font-body text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive inline-flex items-center gap-1">
        <Ban className="h-3 w-3" /> banned
      </span>
    );
  }
  if (state.kind === "suspended") {
    return (
      <span className="font-body text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> suspended
      </span>
    );
  }
  return (
    <span className="font-body text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 inline-flex items-center gap-1">
      <ShieldCheck className="h-3 w-3" /> active
    </span>
  );
}

function LiftBar({
  player,
  state,
  onLift,
  busy,
  compact,
}: {
  player: ModProfile;
  state: ReturnType<typeof blockedState>;
  onLift: (
    player: ModProfile,
    action: "ban" | "suspend" | "unban" | "unsuspend",
    opts?: { reason?: string; durationHours?: number }
  ) => void;
  busy: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "p-4"}>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onLift(player, state.kind === "banned" ? "unban" : "unsuspend")}
      >
        <ShieldCheck className="h-4 w-4 mr-1" />
        {state.kind === "banned" ? "Unban" : "Unsuspend"}
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div className="bg-card border border-border rounded-xl p-10 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
      {icon}
      <p className="font-body text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default Admin;
