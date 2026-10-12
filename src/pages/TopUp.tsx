import { AppLayout } from "@/components/AppLayout";
import { AgeGate, type AgeGateResult } from "@/components/AgeGate";
import { topUpPackages } from "@/data/gameData";
import { useAuth } from "@/hooks/useAuth";
<<<<<<< HEAD
import { getDeviceHash } from "@/lib/device";
import {
  fetchStoredVerification,
  verificationIsComplete,
  type StoredVerification,
} from "@/lib/ageApi";
import {
  bracketLabel,
  isPackageAllowedForBracket,
  MINOR_DAILY_CAP_USD,
  MINOR_MAX_PACKAGE_USD,
} from "@/lib/age";
import {
  Coins,
  Zap,
  Gift,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
  ShieldCheck,
  Lock,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const VERIFICATION_CODES = new Set([
  "AGE_VERIFICATION_REQUIRED",
  "GUARDIAN_CONSENT_REQUIRED",
  "DEV_AGREEMENT_REQUIRED",
  "DEVICE_UNKNOWN",
]);
=======
import { Coins, Zap, Gift, AlertCircle, Loader2, CheckCircle2, Info, Crown } from "lucide-react";
import { useEffect, useState } from "react";
>>>>>>> origin/main

const TopUp = () => {
  const { user, session, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

<<<<<<< HEAD
  // Age verification state for this device.
  const [deviceHash, setDeviceHash] = useState<string | null>(null);
  const [verification, setVerification] = useState<StoredVerification | null>(null);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

=======
>>>>>>> origin/main
  // Handle returning from Stripe (success or cancel).
  const params = new URLSearchParams(window.location.search);
  const justPaid = params.get("success") === "1";
  const cancelled = params.get("cancelled") === "1";
<<<<<<< HEAD
=======
  const unlockPro = params.get("unlock") === "pro";
>>>>>>> origin/main

  useEffect(() => {
    if (justPaid) {
      // Balance updates via the webhook; refresh to show the new coins.
      refreshProfile();
      window.history.replaceState({}, "", "/topup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

<<<<<<< HEAD
  // Resolve this device and load any stored agreement. If it's missing or
  // incomplete the gate opens automatically.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setDeviceHash(null);
      setVerification(null);
      setVerified(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    getDeviceHash()
      .then((hash) => {
        if (cancelled) return;
        setDeviceHash(hash);
        return fetchStoredVerification(user.id, hash).then((stored) => {
          if (cancelled) return;
          setVerification(stored);
          const complete = verificationIsComplete(stored);
          setVerified(complete);
          setGateOpen(!complete);
        });
      })
      .catch(() => {
        if (!cancelled) setGateOpen(true);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleVerified = useCallback(
    async (result: AgeGateResult) => {
      setGateOpen(false);
      // Always trust the server's confirmation immediately; then reconcile.
      setVerification({
        bracket: result.bracket,
        captcha_passed: true,
        policy_accepted: true,
        guardian_acknowledged: result.guardianRequired,
        parental_control_notice: result.guardianRequired,
        dev_agreement_accepted: result.bracket === "senior",
      });
      setVerified(true);
      if (!user || !deviceHash) return;
      try {
        const stored = await fetchStoredVerification(user.id, deviceHash);
        if (stored) {
          setVerification(stored);
          setVerified(verificationIsComplete(stored));
        }
      } catch {
        // Keep the optimistic state — the server already stored the row.
      }
    },
    [user, deviceHash],
  );

  const handleSelectPackage = (id: string) => {
    if (!verified) {
      setGateOpen(true);
      return;
    }
    setSelected(id);
  };

  const handlePurchase = async () => {
    if (!selected || loading) return;
    if (!verified || !deviceHash) {
      setGateOpen(true);
      return;
    }
=======
  const handlePurchase = async () => {
    if (!selected || loading) return;
>>>>>>> origin/main
    setLoading(true);
    setError(null);
    try {
      const token = session?.access_token;
      if (!token) {
        setError("You need to sign in before purchasing NexCoins.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/topup-checkout", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
<<<<<<< HEAD
        body: JSON.stringify({ packageId: selected, deviceHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (VERIFICATION_CODES.has(String(data?.error))) {
          setVerified(false);
          setGateOpen(true);
        }
=======
        body: JSON.stringify({ packageId: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
>>>>>>> origin/main
        setError(data?.message || data?.error || `Request failed (${res.status})`);
        setLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("No checkout URL returned by the server.");
      }
    } catch {
      setError("Can't reach the payment server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const bracket = verification?.bracket ?? null;
  const isMinor = bracket === "minor";

  return (
    <AppLayout>
<<<<<<< HEAD
      <AgeGate open={gateOpen} onVerified={handleVerified} onClose={() => setGateOpen(false)} />

=======
>>>>>>> origin/main
      {justPaid && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center gap-3 max-w-2xl">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="font-body text-sm text-emerald-500">
            Payment received! Your NexCoins have been added to your account.
          </p>
        </div>
      )}
      {cancelled && (
        <div className="bg-muted border border-border rounded-xl p-4 mb-6 flex items-center gap-3 max-w-2xl">
          <Info className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="font-body text-sm text-muted-foreground">
            Checkout cancelled — nothing was charged and no coins were added.
          </p>
        </div>
      )}
<<<<<<< HEAD
=======
      {unlockPro && !justPaid && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6 flex items-start gap-3 max-w-2xl">
          <Crown className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="font-body text-sm text-foreground">
            <span className="font-semibold">Unlock Pro Creator.</span> Complete any
            top-up once and you'll get unlimited game creation in Creator Studio —
            no subscription, no recurring charge.
          </p>
        </div>
      )}
>>>>>>> origin/main
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6 flex items-start gap-3 max-w-2xl">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Top Up</h1>
      <p className="font-body text-muted-foreground mb-8">
        Get NexCoins to purchase games, cosmetics, and in-game items.
      </p>

      {/* Age verification status */}
      {user && (
        <div className="max-w-2xl mb-6">
          {checking ? (
            <div className="bg-muted border border-border rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />
              <p className="font-body text-sm text-muted-foreground">
                Checking this device…
              </p>
            </div>
          ) : verified ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-heading text-sm font-bold text-emerald-500">
                  Device verified · {bracketLabel(bracket ?? "adult")}
                </p>
                {isMinor && (
                  <p className="font-body text-xs text-muted-foreground mt-1">
                    Parent/guardian consent is recorded on this device. Up to $
                    {MINOR_MAX_PACKAGE_USD} per purchase, ${MINOR_DAILY_CAP_USD} per
                    day.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-heading text-sm font-bold text-amber-500">
                  Verify your age to unlock top-ups
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  A one-time check per device, with extra parental controls for
                  under-18s.
                </p>
              </div>
              <button
                onClick={() => setGateOpen(true)}
                className="bg-amber-500 text-background font-heading text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shrink-0"
              >
                Verify
              </button>
            </div>
          )}
        </div>
      )}

      {/* Current Balance */}
      <div className="bg-card border border-border rounded-xl p-5 mb-8 flex items-center gap-4 max-w-sm">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Coins className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-body text-xs text-muted-foreground">Current Balance</p>
          <p className="font-heading text-2xl font-bold text-foreground">
            {user ? (profile?.coins ?? 0).toLocaleString() : "—"}
          </p>
          {!user && (
            <p className="font-body text-xs text-muted-foreground">
              <a href="/login" className="text-primary hover:underline">Sign in</a> to see your balance
            </p>
          )}
        </div>
      </div>

      {isMinor && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 max-w-2xl flex items-start gap-3">
          <Users className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="font-body text-xs text-muted-foreground">
            Under-18 account: packages above ${MINOR_MAX_PACKAGE_USD} are locked.
            Ask a parent or guardian to be present for every purchase.
          </p>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
<<<<<<< HEAD
        {topUpPackages.map((pkg) => {
          const allowed = !isMinor || isPackageAllowedForBracket("minor", pkg.price);
          return (
            <button
              key={pkg.id}
              onClick={() => allowed && handleSelectPackage(pkg.id)}
              disabled={loading || !allowed}
              className={`bg-card border-2 rounded-xl p-5 text-left relative transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                selected === pkg.id ? "border-primary" : "border-border hover:border-primary/40"
              }`}
            >
              {pkg.popular && allowed && (
                <div className="absolute top-3 right-3 bg-accent text-accent-foreground font-heading text-[10px] font-bold px-2 py-1 rounded-md">
                  Popular
                </div>
              )}
              {!allowed && (
                <div className="absolute top-3 right-3 bg-muted text-muted-foreground font-heading text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Under 18
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <Coins className="h-5 w-5 text-primary" />
                <span className="font-heading text-xl font-bold text-foreground">
                  {pkg.coins.toLocaleString()}
=======
        {topUpPackages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg.id)}
            disabled={loading}
            className={`bg-card border-2 rounded-xl p-5 text-left relative transition-colors disabled:opacity-50 ${
              selected === pkg.id ? "border-primary" : "border-border hover:border-primary/40"
            }`}
          >
            {pkg.popular && (
              <div className="absolute top-3 right-3 bg-accent text-accent-foreground font-heading text-[10px] font-bold px-2 py-1 rounded-md">
                Popular
              </div>
            )}
            <div className="flex items-center gap-3 mb-3">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-heading text-xl font-bold text-foreground">
                {pkg.coins.toLocaleString()}
              </span>
            </div>
            {pkg.bonus > 0 && (
              <div className="flex items-center gap-1 mb-3">
                <Gift className="h-3 w-3 text-accent" />
                <span className="font-body text-xs text-accent font-medium">
                  +{pkg.bonus} bonus
>>>>>>> origin/main
                </span>
              </div>
              {pkg.bonus > 0 && (
                <div className="flex items-center gap-1 mb-3">
                  <Gift className="h-3 w-3 text-accent" />
                  <span className="font-body text-xs text-accent font-medium">
                    +{pkg.bonus} bonus
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-heading text-lg text-foreground">${pkg.price}</span>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-8 py-3 rounded-lg flex items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Coins className="h-5 w-5" />}
<<<<<<< HEAD
          {loading ? "Opening secure checkout…" : verified ? "Purchase Now" : "Verify to continue"}
=======
          {loading ? "Opening secure checkout…" : "Purchase Now"}
>>>>>>> origin/main
        </button>
      )}
    </AppLayout>
  );
};

export default TopUp;