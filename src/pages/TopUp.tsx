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
          <CheckCircle className="h-16 w-16 text-primary mb-4" />
          <h2 className="font-heading text-2xl text-foreground mb-2">PURCHASE COMPLETE</h2>
          <p className="font-body text-muted-foreground">Coins added to your account.</p>
        </div>
      )}

      <h1 className="font-heading text-3xl font-bold text-foreground mb-2">TOP UP</h1>
      <p className="font-body text-muted-foreground mb-8">
        Get Astro Coins to purchase games, cosmetics, and in-game items.
      </p>

      {/* Current Balance */}
      <div className="bg-card border border-border p-6 mb-8 flex items-center gap-4 max-w-sm">
        <div className="bg-primary p-3">
          <Coins className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <p className="font-body text-xs text-muted-foreground">CURRENT BALANCE</p>
          <p className="font-heading text-2xl font-bold text-foreground">1,250</p>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {topUpPackages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg.id)}
            className={`bg-card border-2 p-6 text-left relative ${
              selected === pkg.id ? "border-primary" : "border-border"
            } ${pkg.popular ? "" : ""}`}
          >
            {pkg.popular && (
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground font-heading text-[10px] px-2 py-1">
                POPULAR
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-heading text-xl font-bold text-foreground">
                {pkg.coins.toLocaleString()}
              </span>
            </div>
            {pkg.bonus > 0 && (
              <div className="flex items-center gap-1 mb-3">
                <Gift className="h-3 w-3 text-accent" />
                <span className="font-body text-xs text-accent">
                  +{pkg.bonus} bonus coins
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

      {/* Purchase Button */}
      {selected && (
        <button
          onClick={handlePurchase}
          className="bg-primary text-primary-foreground font-heading text-sm px-8 py-4 flex items-center gap-3"
        >
          <Coins className="h-5 w-5" />
          PURCHASE NOW
        </button>
      )}
    </AppLayout>
  );
};

export default TopUp;
