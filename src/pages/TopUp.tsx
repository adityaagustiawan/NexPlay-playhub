import { AppLayout } from "@/components/AppLayout";
import { topUpPackages } from "@/data/gameData";
import { Coins, Zap, Gift, CheckCircle } from "lucide-react";
import { useState } from "react";

const TopUp = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  const handlePurchase = () => {
    if (selected) {
      setPurchased(true);
      setTimeout(() => {
        setPurchased(false);
        setSelected(null);
      }, 2000);
    }
  };

  return (
    <AppLayout>
      {purchased && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center">
          <CheckCircle className="h-16 w-16 text-success mb-4" />
          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Purchase Complete</h2>
          <p className="font-body text-muted-foreground">Coins added to your account.</p>
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
          <p className="font-heading text-2xl font-bold text-foreground">0</p>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {topUpPackages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg.id)}
            className={`bg-card border-2 rounded-xl p-5 text-left relative transition-colors ${
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
          className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-8 py-3 rounded-lg flex items-center gap-3 hover:opacity-90 transition-opacity"
        >
          <Coins className="h-5 w-5" />
          Purchase Now
        </button>
      )}
    </AppLayout>
  );
};

export default TopUp;
