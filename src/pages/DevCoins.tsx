// DevCoins.tsx — a creator's wallet. Players buying items in your games credit
// you DevCoins (1 NexCoin spent = 1 DevCoin). DevCoins are not spendable in the
// store; they exist to be exchanged for real money:
//
//     50 DevCoins = $0.99      minimum cash-out: 200 DevCoins
//
// A cash-out debits the balance immediately so it can't be double-spent; an
// admin then pays it out manually, and a rejected request is refunded.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Coins,
  Info,
  Loader2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchDevcoinLedger,
  fetchPayouts,
  requestPayout,
  summariseEarnings,
  fetchCreatorSales,
} from "@/lib/devcoinsApi";
import { useAuth } from "@/hooks/useAuth";
import {
  canCashOut,
  devcoinsToCents,
  devcoinsToUsd,
  devcoinsUntilCashOut,
  formatDevcoins,
  formatUsd,
  ledgerKindLabel,
  MIN_PAYOUT_DEVCOINS,
  PAYOUT_METHODS,
  payoutStatusLabel,
  validatePayout,
} from "@/lib/devcoins";
import { supabase } from "@/integrations/supabase/client";

const DevCoins = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [sales, setSales] = useState<Awaited<ReturnType<typeof fetchCreatorSales>>>([]);
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof fetchDevcoinLedger>>>([]);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof fetchPayouts>>>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(String(MIN_PAYOUT_DEVCOINS));
  const [method, setMethod] = useState<string>(PAYOUT_METHODS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const balance = profile?.devcoins ?? 0;

  const load = useCallback(async () => {
    if (!user) return;
    const [salesRows, ledgerRows, payoutRows, gamesRows] = await Promise.all([
      fetchCreatorSales(user.id),
      fetchDevcoinLedger(user.id),
      fetchPayouts(user.id),
      supabase.from("games").select("id, title").eq("user_id", user.id),
    ]);
    setSales(salesRows);
    setLedger(ledgerRows);
    setPayouts(payoutRows);
    const map: Record<string, string> = {};
    for (const row of gamesRows.data ?? []) map[row.id] = row.title;
    setTitles(map);
  }, [user]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load your wallet");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  const earnings = useMemo(() => summariseEarnings(sales, titles), [sales, titles]);

  const cents = devcoinsToCents(balance);
  const allowCashOut = canCashOut(balance);
  const pendingPayout = payouts.some((p) => p.status === "pending");

  const handleRequestPayout = async () => {
    if (!user) return;
    setError(null);
    setNotice(null);
    const check = validatePayout(balance, amount);
    if (check.error) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      await requestPayout(check.value, method);
      setNotice(`Cash-out requested — ${formatUsd(devcoinsToCents(check.value))} is on its way.`);
      await Promise.all([load(), refreshProfile()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cash-out request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="font-heading text-xl font-bold text-foreground">DevCoins</h1>
        </header>

        {error && (
          <p className="font-body text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="font-body text-xs text-primary" role="status">
            {notice}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="font-body text-xs text-muted-foreground mb-1">Balance</p>
            <p className="font-heading text-2xl font-bold text-foreground tabular-nums">
              {formatDevcoins(balance)}
              <span className="ml-1 text-sm font-medium text-muted-foreground">DevCoins</span>
            </p>
            <p className="font-body text-xs text-muted-foreground">≈ {devcoinsToUsd(balance)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="font-body text-xs text-muted-foreground mb-1">Total earned</p>
            <p className="font-heading text-2xl font-bold text-foreground tabular-nums">
              {formatDevcoins(earnings.totalEarned)}
            </p>
            <p className="font-body text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {earnings.sales.toLocaleString("en-US")} item sales
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="font-body text-xs text-muted-foreground mb-1">Rate</p>
            <p className="font-heading text-2xl font-bold text-foreground">$0.99</p>
            <p className="font-body text-xs text-muted-foreground">per 50 DevCoins</p>
          </div>
        </div>

        {/* Cash-out */}
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-sm font-bold text-foreground">Cash out</h2>
          </div>

          <p className="font-body text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Exchange DevCoins for money at {MIN_PAYOUT_DEVCOINS.toLocaleString("en-US")} DevCoins
            minimum. 50 DevCoins = $0.99.
          </p>

          {!allowCashOut && (
            <p className="font-body text-xs text-muted-foreground">
              You need {formatDevcoins(devcoinsUntilCashOut(balance))} more DevCoins before you can
              cash out.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="space-y-1">
              <span className="font-body text-[11px] text-muted-foreground">DevCoins to withdraw</span>
              <Input
                value={amount}
                inputMode="numeric"
                disabled={!allowCashOut || busy || pendingPayout}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="font-body text-[11px] text-muted-foreground">Payout method</span>
              <select
                value={method}
                disabled={busy || pendingPayout}
                onChange={(event) => setMethod(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-xs text-foreground"
              >
                {PAYOUT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!allowCashOut || busy || pendingPayout}
              onClick={() => void handleRequestPayout()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Request payout"
              )}
            </Button>
          </div>

          <p className="font-body text-[11px] text-muted-foreground">
            {allowCashOut
              ? `${formatDevcoins(balance)} DevCoins ≈ ${formatUsd(cents)}`
              : `${formatDevcoins(balance)} DevCoins ≈ ${formatUsd(cents)}`}
            {pendingPayout && " — a request is already being processed."}
          </p>
        </section>

        {/* Payout history */}
        {payouts.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h2 className="font-heading text-sm font-bold text-foreground">Cash-out requests</h2>
            <ul className="space-y-2">
              {payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-foreground">
                      {formatDevcoins(payout.devcoins)} DevCoins → {formatUsd(payout.amount_cents)}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {new Date(payout.requested_at).toLocaleString("en-US")}
                      {payout.method ? ` · ${payout.method}` : ""}
                      {payout.note ? ` · ${payout.note}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={payout.status === "paid" ? "default" : "secondary"}
                    className="shrink-0 font-body text-[11px]"
                  >
                    {payoutStatusLabel(payout.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Per-game earnings */}
        {earnings.perGame.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h2 className="font-heading text-sm font-bold text-foreground">Earnings by game</h2>
            <ul className="space-y-2">
              {earnings.perGame.map((row) => (
                <li
                  key={row.gameId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"
                >
                  <span className="truncate font-body text-sm text-foreground">{row.title}</span>
                  <span className="shrink-0 font-body text-xs text-muted-foreground tabular-nums">
                    {formatDevcoins(row.devcoins)} DevCoins · {row.sales} sales
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ledger */}
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h2 className="font-heading text-sm font-bold text-foreground">History</h2>
          {loading ? (
            <p className="font-body text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          ) : ledger.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">
              No DevCoin activity yet. Add items to your games from the Creator page and players
              buying them credits you DevCoins.
            </p>
          ) : (
            <ul className="space-y-2">
              {ledger.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-foreground">{ledgerKindLabel(row.kind)}</p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("en-US")}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-body text-sm tabular-nums ${
                      row.amount >= 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {row.amount >= 0 ? "+" : ""}
                    {formatDevcoins(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="flex items-start gap-1.5 font-body text-[11px] text-muted-foreground">
          <Coins className="h-3 w-3 mt-0.5 shrink-0" />
          DevCoins cannot be spent in the shop — they are your earnings, converted from the
          NexCoins your players spend. 50 DevCoins are worth $0.99, from 200 DevCoins up.
        </p>
      </div>
    </AppLayout>
  );
};

export default DevCoins;
