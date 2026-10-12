// ItemStoreEditor — creator-side management of the items they sell inside
// their own games. Everything here is plain CRUD on `game_items`, which RLS
// already restricts to the game's owner. Prices are in NexCoins, and every
// NexCoin spent by a player credits the creator one DevCoin.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  createItem,
  deleteItem,
  fetchItemsForCreator,
  updateItem,
  type GameItem,
} from "@/lib/devcoinsApi";
import { validateItemPrice } from "@/lib/devcoins";

export type OwnGame = { id: string; title: string };

interface ItemStoreEditorProps {
  creatorId: string;
  games: OwnGame[];
}

const EMPTY = { name: "", description: "", emoji: "", category: "" };

export function ItemStoreEditor({ creatorId, games }: ItemStoreEditorProps) {
  const [items, setItems] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [draft, setDraft] = useState(EMPTY);
  const [draftPrice, setDraftPrice] = useState("250");

  const refresh = useCallback(async () => {
    if (!creatorId) return;
    const rows = await fetchItemsForCreator(creatorId);
    setItems(rows);
  }, [creatorId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load items");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  // Default the picker to the first game that already has items, else the
  // first own game.
  useEffect(() => {
    if (selectedGame || games.length === 0) return;
    const withItems = games.find((g) => items.some((i) => i.game_id === g.id));
    setSelectedGame((withItems ?? games[0]).id);
  }, [games, items, selectedGame]);

  const gameId = selectedGame || games[0]?.id || "";

  const visible = useMemo(
    () => items.filter((item) => item.game_id === gameId),
    [items, gameId],
  );

  const handleAdd = async () => {
    if (!creatorId || !gameId) return;
    const price = validateItemPrice(draftPrice);
    if (price.error) {
      setError(price.error);
      return;
    }
    if (!draft.name.trim()) {
      setError("Give the item a name.");
      return;
    }
    setError(null);
    setBusy("new");
    try {
      await createItem({
        game_id: gameId,
        creator_id: creatorId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        emoji: draft.emoji.trim() || null,
        category: draft.category.trim() || null,
        price_coins: price.value,
      });
      setDraft(EMPTY);
      setDraftPrice("250");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create item");
    } finally {
      setBusy(null);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<GameItem>) => {
    setBusy(id);
    try {
      await updateItem(id, patch);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update item");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this item? Past sales stay on the books.")) return;
    setBusy(id);
    try {
      await deleteItem(id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete item");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <p className="font-body text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your items…
      </p>
    );
  }

  if (games.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        Create a game first — items are sold inside your games.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="font-body text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="font-body text-xs text-muted-foreground" htmlFor="store-game">
          Game
        </label>
        <select
          id="store-game"
          value={gameId}
          onChange={(event) => setSelectedGame(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 font-body text-xs text-foreground"
        >
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </select>
      </div>

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
            >
              <span aria-hidden className="text-xl leading-none">
                {item.emoji || "🎁"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">
                  {item.name}
                  {item.category && (
                    <span className="ml-2 font-body text-[11px] text-muted-foreground">
                      {item.category}
                    </span>
                  )}
                </p>
                <p className="flex items-center gap-1 font-body text-xs text-primary">
                  <Coins className="h-3 w-3" />
                  <span className="tabular-nums">
                    {item.price_coins.toLocaleString("en-US")}
                  </span>
                  <span className="text-muted-foreground">NexCoins</span>
                </p>
              </div>
              <label className="flex items-center gap-1.5 font-body text-[11px] text-muted-foreground">
                <Switch
                  checked={item.active}
                  disabled={busy === item.id}
                  onCheckedChange={(checked) => void handleUpdate(item.id, { active: checked })}
                />
                {item.active ? "On sale" : "Hidden"}
              </label>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${item.name}`}
                disabled={busy === item.id}
                onClick={() => void handleDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <p className="font-heading text-xs font-semibold text-foreground">Add an item</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Item name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <Input
            placeholder="Emoji (optional)"
            value={draft.emoji}
            maxLength={4}
            onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
          />
          <Input
            placeholder="Price in NexCoins"
            value={draftPrice}
            inputMode="numeric"
            onChange={(event) => setDraftPrice(event.target.value)}
          />
          <Input
            placeholder="Category (optional)"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </div>
        <Textarea
          placeholder="Short description players will see (optional)"
          value={draft.description}
          rows={2}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary" className="gap-1 font-body text-[11px]">
            1 NexCoin spent = 1 DevCoin earned
          </Badge>
          <Button size="sm" disabled={busy === "new"} onClick={() => void handleAdd()}>
            {busy === "new" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="font-body text-[11px] text-muted-foreground flex items-start gap-1.5">
        <Save className="h-3 w-3 mt-0.5 shrink-0" />
        Prices are in NexCoins. Players pay them from their balance and you are credited
        the same number of DevCoins — 50 DevCoins are worth $0.99 once you cash out.
      </p>
    </div>
  );
}
