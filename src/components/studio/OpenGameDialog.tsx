// OpenGameDialog.tsx — File ▸ Open: lists the signed-in creator's games so they
// can reopen something they previously made or updated and keep editing it.
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FolderOpen, Globe, FileEdit } from "lucide-react";

export interface GameSummary {
  game_key: string;
  title: string;
  status: string | null;
  is_draft: boolean;
  released_at: string | null;
  updated_at: string;
  version: number;
}

export async function loadMyGames(userId: string): Promise<GameSummary[]> {
  const { data, error } = await supabase
    .from("games")
    .select("game_key,title,status,is_draft,released_at,updated_at,version")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[studio] loadMyGames failed:", error.message);
    return [];
  }
  return (data ?? []) as GameSummary[];
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

interface Props {
  open: boolean;
  games: GameSummary[];
  loading: boolean;
  currentKey: string | null;
  onClose: () => void;
  onOpen: (game: GameSummary) => void;
  onNew: () => void;
}

export function OpenGameDialog({ open, games, loading, currentKey, onClose, onOpen, onNew }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-start justify-center pt-24 px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <FolderOpen className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm font-bold text-foreground">Open game</h2>
          <button
            onClick={onNew}
            className="ml-auto text-xs font-body text-primary hover:underline"
            type="button"
          >
            + New game
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && games.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-body text-sm text-muted-foreground">
                You haven't made any games yet.
              </p>
              <button
                onClick={onNew}
                type="button"
                className="mt-2 text-sm font-body text-primary hover:underline"
              >
                Create your first game
              </button>
            </div>
          )}
          {!loading &&
            games.map((g) => {
              const released = Boolean(g.released_at);
              const isCurrent = g.game_key === currentKey;
              return (
                <button
                  key={g.game_key}
                  type="button"
                  onClick={() => onOpen(g)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 transition-colors ${
                    isCurrent ? "bg-primary/10" : "hover:bg-secondary/60"
                  }`}
                >
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    {released ? (
                      <Globe className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <FileEdit className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-foreground truncate">
                      {g.title || "Untitled"}
                      {isCurrent && <span className="text-primary"> · open</span>}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {released ? `Published · v${g.version}` : "Draft"} · edited{" "}
                      {relativeTime(g.updated_at)}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
