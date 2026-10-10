import { AppLayout } from "@/components/AppLayout";
import { topUpPackages } from "@/data/gameData";
import { useAuth } from "@/hooks/useAuth";
import { Coins, Zap, Gift, AlertCircle, Loader2, CheckCircle2, Info, Crown } from "lucide-react";
import { useEffect, useState } from "react";

const TopUp = () => {
  const { user, session, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle returning from Stripe (success or cancel).
  const params = new URLSearchParams(window.location.search);
  const justPaid = params.get("success") === "1";
  const cancelled = params.get("cancelled") === "1";
  const unlockPro = params.get("unlock") === "pro";

  useEffect(() => {
    if (justPaid) {
      // Balance updates via the webhook; refresh to show the new coins.
      refreshProfile();
      window.history.replaceState({}, "", "/topup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePurchase = async () => {
    if (!selected || loading) return;
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
        body: JSON.stringify({ packageId: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
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

  return (
    <AppLayout>
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

      {/* Packages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg text-foreground">${pkg.price}</span>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-8 py-3 rounded-lg flex items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Coins className="h-5 w-5" />}
          {loading ? "Opening secure checkout…" : "Purchase Now"}
        </button>
      )}
    </AppLayout>
  );
};

export default TopUp;