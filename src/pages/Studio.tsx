// Studio.tsx — "Nexstudio". A Blender-inspired, taskbar-first web editor for
// NEXCONSOLE games: the game runs fullscreen with just a top menu bar
// (File / Edit / View / Game / Recent / Help). File ▸ Open reopens any game you
// previously made or updated and keeps editing it; Save / Publish write back to
// the same Supabase row so the NexConsole app shows the change.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { asJson } from "@/lib/supabaseJson";
import { loadGameRecord, type GameRecord, type GamePackage } from "@/engine/gameLoader";
import {
  DEFAULT_CONFIG,
  GOOD_LABEL,
  BAD_LABEL,
  buildGameplay,
  clampNumber,
  slugify,
  type Difficulty,
  type Mode,
  type StudioConfig,
} from "@/lib/studioConfig";
import { GamePreview } from "@/components/GamePreview";
import { MenuBar, type MenuDef } from "@/components/studio/MenuBar";
import { OpenGameDialog, loadMyGames, type GameSummary } from "@/components/studio/OpenGameDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gamepad2,
  Save,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  User,
  Target,
  Bomb,
  Palette,
  Gauge,
  LayoutGrid,
  PanelLeft,
  PanelRight,
  LogOut,
} from "lucide-react";

type SelKey = "game" | "player" | "good" | "bad" | "environment" | "performance";

const EXPLORER: { key: SelKey; label: string; icon: typeof Boxes }[] = [
  { key: "game", label: "Game Settings", icon: Boxes },
  { key: "player", label: "Player", icon: User },
  { key: "good", label: "Collectibles", icon: Target },
  { key: "bad", label: "Hazards", icon: Bomb },
  { key: "environment", label: "Environment", icon: Palette },
  { key: "performance", label: "Performance", icon: Gauge },
];

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="font-body text-xs text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
        aria-label={`${label} color`}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 font-mono text-xs"
      />
    </div>
  </div>
);

const Studio = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const gameKeyParam = params.get("game");

  const rootRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_CONFIG);
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(gameKeyParam));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelKey>("game");
  const [nonce, setNonce] = useState(0);
  // Panels start closed so the editor is fullscreen with only the taskbar.
  const [showExplorer, setShowExplorer] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [myGames, setMyGames] = useState<GameSummary[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Load an existing game when ?game=<game_key> is present.
  useEffect(() => {
    let alive = true;
    if (!gameKeyParam) {
      setLoading(false);
      setRecord(null);
      setConfig(DEFAULT_CONFIG);
      return;
    }
    setLoading(true);
    (async () => {
      const rec = await loadGameRecord(gameKeyParam);
      if (!alive) return;
      if (!rec) {
        setError(`Game "${gameKeyParam}" was not found.`);
        setLoading(false);
        return;
      }
      const gp = rec.gameplay as Record<string, unknown>;
      setRecord(rec);
      setConfig({
        ...DEFAULT_CONFIG,
        title: rec.title ?? DEFAULT_CONFIG.title,
        description: rec.description ?? DEFAULT_CONFIG.description,
        mode: ["catch", "shooter", "runner"].includes(gp?.mode as string)
          ? (gp.mode as Mode)
          : DEFAULT_CONFIG.mode,
        difficulty: ["easy", "medium", "hard"].includes(gp?.difficulty as string)
          ? (gp.difficulty as Difficulty)
          : DEFAULT_CONFIG.difficulty,
        levels: Number(gp?.levels) || DEFAULT_CONFIG.levels,
        goal: Number(gp?.goal) || DEFAULT_CONFIG.goal,
        speed: Number(gp?.speed) || DEFAULT_CONFIG.speed,
        spawnMs: Number(gp?.spawnMs) || DEFAULT_CONFIG.spawnMs,
        theme: { ...DEFAULT_CONFIG.theme, ...((gp?.theme as object) ?? {}) },
        names: { ...DEFAULT_CONFIG.names, ...((gp?.names as object) ?? {}) },
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [gameKeyParam]);

  const refreshMyGames = useCallback(async () => {
    if (!user) {
      setMyGames([]);
      return;
    }
    setGamesLoading(true);
    const list = await loadMyGames(user.id);
    setMyGames(list);
    setGamesLoading(false);
  }, [user]);

  useEffect(() => {
    refreshMyGames();
  }, [refreshMyGames]);

  const pkg: GamePackage = useMemo(
    () => ({
      gameplay: buildGameplay(config),
      assets: { palette: "custom", generatedBy: "nexstudio", prompt: config.description },
      title: config.title,
    }),
    [config],
  );

  const setTheme = (k: keyof StudioConfig["theme"], v: string) =>
    setConfig((c) => ({ ...c, theme: { ...c.theme, [k]: v } }));
  const setNames = (k: keyof StudioConfig["names"], v: string) =>
    setConfig((c) => ({ ...c, names: { ...c.names, [k]: v } }));

  const persist = async (publish: boolean, opts?: { asNew?: boolean; title?: string }) => {
    setNotice(null);
    setError(null);
    if (!user) {
      setError("Sign in to save your game.");
      return;
    }
    setBusy(true);
    try {
      const title = opts?.title ?? config.title;
      const gameplay = buildGameplay(config);
      const assets = { palette: "custom", generatedBy: "nexstudio", prompt: config.description };
      const studioData = { source: "nexstudio", editedAt: new Date().toISOString() };

      if (record && !opts?.asNew) {
        const alreadyReleased = Boolean(record.released_at);
        const releasedAt = publish && !alreadyReleased ? new Date().toISOString() : record.released_at;
        const nextVersion = publish
          ? Math.max(1, (record.version ?? 1) + (alreadyReleased ? 1 : 0))
          : record.version;
        const update = {
          title,
          description: config.description,
          gameplay: asJson(gameplay),
          assets: asJson(assets),
          studio_data: asJson(studioData),
          updated_at: new Date().toISOString(),
          version: nextVersion,
          ...(publish && !alreadyReleased
            ? { released_at: releasedAt, status: "pending", is_draft: false }
            : {}),
        };
        const { error: updErr } = await supabase.from("games").update(update).eq("id", record.id);
        if (updErr) throw new Error(updErr.message);
        setRecord({
          ...record,
          title,
          description: config.description,
          gameplay,
          assets,
          released_at: releasedAt,
          status: publish && !alreadyReleased ? "pending" : record.status,
          version: nextVersion,
        });
        setConfig((c) => ({ ...c, title }));
        setNonce((n) => n + 1);
        setNotice(
          publish
            ? alreadyReleased
              ? "Updated — players get the new version."
              : "Submitted for review — it's playable now."
            : "Draft saved.",
        );
      } else {
        const gameKey = `${slugify(title)}-${Date.now().toString(36)}`;
        const { data, error: insErr } = await supabase
          .from("games")
          .insert({
            user_id: user.id,
            game_key: gameKey,
            title,
            description: config.description,
            gameplay: asJson(gameplay),
            assets: asJson(assets),
            studio_data: asJson(studioData),
            version: 1,
            status: "draft",
            is_draft: true,
            plays: 0,
            likes: 0,
            favorites: 0,
            engine_type: "nexstudio",
          })
          .select("*")
          .single();
        if (insErr) throw new Error(insErr.message);
        setRecord(data as GameRecord);
        setConfig((c) => ({ ...c, title }));
        setParams({ game: gameKey }, { replace: true });
        setNonce((n) => n + 1);
        setNotice("Saved. Use File ▸ Publish to submit it for review.");
      }
      refreshMyGames();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const newGame = () => {
    setParams({}, { replace: true });
    setRecord(null);
    setConfig(DEFAULT_CONFIG);
    setSelected("game");
    setError(null);
    setNotice("New game — edit it, then Save.");
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const openGame = (g: GameSummary) => {
    setOpenDialog(false);
    setParams({ game: g.game_key });
  };

  // Only the owner may save/publish; everyone else gets a read-only editor.
  const isOwner = !record || (!!user && user.id === record.user_id);

  // Keyboard shortcuts (Blender-ish): Ctrl+S save, Ctrl+Shift+S update, Ctrl+O open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        persist(e.shiftKey);
      } else if (k === "o") {
        e.preventDefault();
        refreshMyGames();
        setOpenDialog(true);
      } else if (k === "n") {
        e.preventDefault();
        newGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, record, busy, isOwner, user]);

  const menus: MenuDef[] = useMemo(
    () => [
      {
        label: "File",
        items: [
          { label: "New Game", shortcut: "Ctrl+N", onSelect: newGame },
          {
            label: "Open Game…",
            shortcut: "Ctrl+O",
            onSelect: () => {
              refreshMyGames();
              setOpenDialog(true);
            },
          },
          { separator: true },
          {
            label: "Save",
            shortcut: "Ctrl+S",
            onSelect: () => persist(false),
            disabled: busy || !isOwner,
          },
          {
            label: record?.released_at ? "Update (publish)" : "Publish",
            shortcut: "Ctrl+Shift+S",
            onSelect: () => persist(true),
            disabled: busy || !isOwner,
          },
          { separator: true },
          {
            label: "Save a copy…",
            onSelect: () => persist(false, { asNew: true, title: `${config.title} copy` }),
            disabled: busy || !user,
          },
          {
            label: "Play in new tab",
            onSelect: record ? () => window.open(`/play/${record.game_key}`, "_blank") : undefined,
            disabled: !record,
          },
          { separator: true },
          { label: "Exit to NexConsole", onSelect: () => navigate("/create") },
        ],
      },
      {
        label: "Edit",
        items: [
          {
            label: "Reset settings to defaults",
            onSelect: () =>
              setConfig((c) => ({ ...DEFAULT_CONFIG, title: c.title, description: c.description })),
          },
        ],
      },
      {
        label: "View",
        items: [
          { label: "Explorer", checked: showExplorer, onSelect: () => setShowExplorer((v) => !v) },
          {
            label: "Properties",
            checked: showProperties,
            onSelect: () => setShowProperties((v) => !v),
          },
          { separator: true },
          { label: "Fullscreen", shortcut: "F11", onSelect: toggleFullscreen },
        ],
      },
      {
        label: "Game",
        items: [
          { label: "Catch", checked: config.mode === "catch", onSelect: () => setConfig((c) => ({ ...c, mode: "catch" })) },
          { label: "Shooter", checked: config.mode === "shooter", onSelect: () => setConfig((c) => ({ ...c, mode: "shooter" })) },
          { label: "Runner", checked: config.mode === "runner", onSelect: () => setConfig((c) => ({ ...c, mode: "runner" })) },
          { separator: true },
          { label: "Easy", checked: config.difficulty === "easy", onSelect: () => setConfig((c) => ({ ...c, difficulty: "easy" })) },
          { label: "Medium", checked: config.difficulty === "medium", onSelect: () => setConfig((c) => ({ ...c, difficulty: "medium" })) },
          { label: "Hard", checked: config.difficulty === "hard", onSelect: () => setConfig((c) => ({ ...c, difficulty: "hard" })) },
        ],
      },
      {
        label: "Recent",
        items:
          myGames.length > 0
            ? myGames
                .slice(0, 12)
                .map((g) => ({
                  label: g.title || "Untitled",
                  checked: g.game_key === gameKeyParam,
                  onSelect: () => setParams({ game: g.game_key }),
                }))
            : [{ label: "No games yet", disabled: true }],
      },
      {
        label: "Help",
        items: [
          {
            label: "About Nexstudio",
            onSelect: () =>
              setNotice("Nexstudio — taskbar-first game editor. File ▸ Open to edit a previous game."),
          },
          { label: "Move ← → / WASD · Space = shoot/jump", disabled: true },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, record, busy, isOwner, user, myGames, gameKeyParam, showExplorer, showProperties],
  );

  // ---- Inspector groups ----
  const inspector = () => {
    switch (selected) {
      case "game":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">Title</Label>
              <Input
                value={config.title}
                onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">Description</Label>
              <Textarea
                rows={2}
                value={config.description}
                onChange={(e) => setConfig((c) => ({ ...c, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">Mode</Label>
              <Select value={config.mode} onValueChange={(v) => setConfig((c) => ({ ...c, mode: v as Mode }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catch">Catch</SelectItem>
                  <SelectItem value="shooter">Shooter</SelectItem>
                  <SelectItem value="runner">Runner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">Difficulty</Label>
              <Select
                value={config.difficulty}
                onValueChange={(v) => setConfig((c) => ({ ...c, difficulty: v as Difficulty }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">Levels</Label>
                <Input
                  type="number"
                  value={config.levels}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, levels: clampNumber(e.target.value, 1, 10, c.levels) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-muted-foreground">Goal</Label>
                <Input
                  type="number"
                  value={config.goal}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, goal: clampNumber(e.target.value, 1, 999, c.goal) }))
                  }
                />
              </div>
            </div>
          </div>
        );
      case "player":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">Player name</Label>
              <Input value={config.names.player} onChange={(e) => setNames("player", e.target.value)} />
            </div>
            <ColorField label="Player color" value={config.theme.player} onChange={(v) => setTheme("player", v)} />
          </div>
        );
      case "good":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">
                {GOOD_LABEL[config.mode]} name
              </Label>
              <Input value={config.names.good} onChange={(e) => setNames("good", e.target.value)} />
            </div>
            <ColorField
              label={`${GOOD_LABEL[config.mode]} color`}
              value={config.theme.good}
              onChange={(v) => setTheme("good", v)}
            />
          </div>
        );
      case "bad":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">
                {BAD_LABEL[config.mode]} name
              </Label>
              <Input value={config.names.bad} onChange={(e) => setNames("bad", e.target.value)} />
            </div>
            <ColorField
              label={`${BAD_LABEL[config.mode]} color`}
              value={config.theme.bad}
              onChange={(v) => setTheme("bad", v)}
            />
          </div>
        );
      case "environment":
        return (
          <div className="space-y-4">
            <ColorField label="Background" value={config.theme.bg} onChange={(v) => setTheme("bg", v)} />
            <ColorField label="Accent" value={config.theme.accent} onChange={(v) => setTheme("accent", v)} />
            <ColorField label="Text" value={config.theme.text} onChange={(v) => setTheme("text", v)} />
          </div>
        );
      case "performance":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">
                Speed — {config.speed.toFixed(1)}
              </Label>
              <input
                type="range"
                min={1}
                max={8}
                step={0.1}
                value={config.speed}
                onChange={(e) => setConfig((c) => ({ ...c, speed: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-muted-foreground">
                Spawn every {config.spawnMs} ms
              </Label>
              <input
                type="range"
                min={300}
                max={2000}
                step={20}
                value={config.spawnMs}
                onChange={(e) => setConfig((c) => ({ ...c, spawnMs: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        );
    }
  };

  if (loading && !record) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <MenuBar
        menus={menus}
        brand={
          <>
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="font-heading text-xs font-bold tracking-wide">
              NEX<span className="text-primary">STUDIO</span>
            </span>
            <input
              value={config.title}
              onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
              aria-label="Game title"
              className="h-6 w-40 rounded border border-transparent bg-transparent px-1.5 text-xs font-body text-foreground hover:border-border focus:border-border focus:outline-none"
            />
          </>
        }
        right={
          <>
            <button
              type="button"
              title="Toggle Explorer"
              onClick={() => setShowExplorer((v) => !v)}
              className={`h-7 w-7 flex items-center justify-center rounded ${
                showExplorer ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Toggle Properties"
              onClick={() => setShowProperties((v) => !v)}
              className={`h-7 w-7 flex items-center justify-center rounded ${
                showProperties ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <PanelRight className="h-4 w-4" />
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => persist(false)}
              disabled={busy || !isOwner}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button size="sm" className="h-7 px-2" onClick={() => persist(true)} disabled={busy || !isOwner}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              {record?.released_at ? "Update" : "Publish"}
            </Button>
            <button
              type="button"
              title="Exit to NexConsole"
              onClick={() => navigate("/create")}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary/60"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        }
      />

      {(notice || error) && (
        <div
          className={`px-4 py-1.5 text-xs font-body flex items-center gap-2 shrink-0 ${
            error ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"
          }`}
        >
          {error ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {error ?? notice}
        </div>
      )}

      {/* Fullscreen workspace */}
      <div className="relative flex-1 min-h-0 flex">
        {showExplorer && (
          <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar/60 overflow-y-auto">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground font-heading border-b border-border flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5" /> Explorer
            </div>
            <nav className="p-2 space-y-0.5">
              {EXPLORER.map((item) => {
                const Icon = item.icon;
                const label =
                  item.key === "good"
                    ? GOOD_LABEL[config.mode]
                    : item.key === "bad"
                      ? BAD_LABEL[config.mode]
                      : item.label;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSelected(item.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-body text-left transition-colors ${
                      selected === item.key
                        ? "bg-primary/20 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        <main className="relative flex-1 min-h-0 bg-black">
          <GamePreview
            fill
            pkg={pkg}
            title={config.title || "Untitled"}
            onOpenFull={record ? () => navigate(`/play/${record.game_key}`) : undefined}
          />
        </main>

        {showProperties && (
          <aside className="w-72 shrink-0 border-l border-border bg-sidebar/60 overflow-y-auto">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground font-heading border-b border-border">
              Properties — {EXPLORER.find((e) => e.key === selected)?.label}
            </div>
            <div className="p-4">{inspector()}</div>
          </aside>
        )}
      </div>

      {!user && (
        <div className="px-4 py-1.5 bg-yellow-500/15 text-yellow-600 text-xs font-body">
          You're not signed in — <Link to="/login" className="underline">sign in</Link> to save or publish.
        </div>
      )}
      {user && record && !isOwner && (
        <div className="px-4 py-1.5 bg-yellow-500/15 text-yellow-600 text-xs font-body">
          Read-only — you can only edit games you created.
        </div>
      )}

      <OpenGameDialog
        open={openDialog}
        games={myGames}
        loading={gamesLoading}
        currentKey={gameKeyParam}
        onClose={() => setOpenDialog(false)}
        onOpen={openGame}
        onNew={() => {
          setOpenDialog(false);
          newGame();
        }}
      />
    </div>
  );
};

export default Studio;
