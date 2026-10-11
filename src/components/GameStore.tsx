// GameStore — the in-game item shop a creator sells in their game. Prices are
// shown in NexCoins; buying one moves those NexCoins to the creator as
// DevCoins (50 DevCoins = $0.99 for them to cash out). The purchase itself is
// performed server-side, because only the service role may move coins.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Loader2, PackageOpen, CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchItemsForGame,
  fetchOwnedItems,
  purchaseItem,
  type GameItem,
} from "@/lib/devcoinsApi";

interface GameStoreProps {
  gameId: string;
  /** When set, the creator's own shop is highlighted instead of buyable. */
  creatorId?: string;
}

export function GameStore({ gameId, creatorId }: GameStoreProps) {
  const { user, profile, isBlocked, refreshProfile } = useAuth();
  const [items, setItems] = useState<GameItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwnShop = Boolean(user && creatorId && user.id === creatorId);

  const refreshOwned = useCallback(async (buyerId: string) => {
    const ids = await fetchOwnedItems(gameId, buyerId);
    setOwned(new Set(ids));
  }, [gameId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchItemsForGame(gameId)
      .then(async (rows) => {
        if (!alive) return;
        setItems(rows.filter((item) => item.active));
        if (user) await refreshOwned(user.id);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load the store");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [gameId, user, refreshOwned]);

  const coins = profile?.coins ?? 0;

  // Group by category so a shop with many items stays readable.
  const grouped = useMemo(() => {
    const groups = new Map<string, GameItem[]>();
    for (const item of items) {
      const key = item.category?.trim() || "Items";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()];
  }, [items]);

  const handleBuy = async (item: GameItem) => {
    if (!user) {
      setError("Sign in to buy items.");
      return;
    }
    setError(null);
    setBusyId(item.id);
    try {
      await purchaseItem(item.id);
      await refreshOwned(user.id);
      await refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm font-bold text-foreground">Item Shop</h2>
        </div>
        {user ? (
          <Badge variant="secondary" className="gap-1 font-body text-xs">
            <Coins className="h-3 w-3" />
            <span className="tabular-nums">{coins.toLocaleString("en-US")} NexCoins</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 font-body text-xs">
            <Lock className="h-3 w-3" />
            Sign in to buy
          </Badge>
        )}
      </header>

      {isBlocked && (
        <p className="font-body text-xs text-destructive">
          Your account is suspended or banned, so purchases are disabled.
        </p>
      )}

      {error && (
        <p className="font-body text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {grouped.map(([category, rows]) => (
          <div key={category} className="space-y-2">
            <h3 className="font-heading text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {rows.map((item) => {
                const isOwned = owned.has(item.id);
                const affordable = coins >= item.price_coins;
                const busy = busyId === item.id;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
                  >
                    <span aria-hidden className="text-2xl leading-none">
                      {item.emoji || "🎁"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="truncate font-body text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1 font-body text-xs text-primary">
                        <Coins className="h-3 w-3" />
                        <span className="tabular-nums">
                          {item.price_coins.toLocaleString("en-US")}
                        </span>
                      </p>
                    </div>
                    {isOwned ? (
                      <Badge className="shrink-0 gap-1 font-body text-[11px]" variant="secondary">
                        <CheckCircle2 className="h-3 w-3" />
                        Owned
                      </Badge>
                    ) : isOwnShop ? (
                      <Badge variant="outline" className="shrink-0 font-body text-[11px]">
                        Your item
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={affordable ? "default" : "outline"}
                        className="shrink-0"
                        disabled={!user || isBlocked || busy}
                        onClick={() => void handleBuy(item)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Buy"
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="font-body text-[11px] text-muted-foreground">
        Every NexCoin you spend goes straight to the creator as a DevCoin. They can cash
        out at 50 DevCoins = $0.99, from 200 DevCoins.
      </p>
    </section>
  );
}
