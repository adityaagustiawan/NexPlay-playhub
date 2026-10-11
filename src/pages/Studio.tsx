// Studio.tsx — "Nexstudio", a Roblox-Studio-style visual editor for NEXCONSOLE
// games. Edit a game's gameplay config (mode, difficulty, tuning, theme, names)
// with a live playable viewport, then Save (draft) or Publish/Update it back to
// the same Supabase row so the NexConsole app shows the change.
//
// Layout: Explorer (left) · Viewport (centre) · Inspector (right).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { asJson } from "@/lib/supabaseJson";
import { loadGameRecord, type GameRecord } from "@/engine/gameLoader";
import type { GamePackage } from "@/engine/gameLoader";
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
  ExternalLink,
  ArrowLeft,
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

  const [config, setConfig] = useState<StudioConfig>(DEFAULT_CONFIG);
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(gameKeyParam));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelKey>("game");
  const [nonce, setNonce] = useState(0);

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
      const gp = rec.gameplay as Record<string, any>;
      setRecord(rec);
      setConfig({
        ...DEFAULT_CONFIG,
        title: rec.title ?? DEFAULT_CONFIG.title,
        description: rec.description ?? DEFAULT_CONFIG.description,
        mode: ["catch", "shooter", "runner"].includes(gp?.mode) ? gp.mode : DEFAULT_CONFIG.mode,
        difficulty: ["easy", "medium", "hard"].includes(gp?.difficulty)
          ? gp.difficulty
          : DEFAULT_CONFIG.difficulty,
        levels: Number(gp?.levels) || DEFAULT_CONFIG.levels,
        goal: Number(gp?.goal) || DEFAULT_CONFIG.goal,
        speed: Number(gp?.speed) || DEFAULT_CONFIG.speed,
        spawnMs: Number(gp?.spawnMs) || DEFAULT_CONFIG.spawnMs,
        theme: { ...DEFAULT_CONFIG.theme, ...(gp?.theme ?? {}) },
        names: { ...DEFAULT_CONFIG.names, ...(gp?.names ?? {}) },
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [gameKeyParam]);

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

  const persist = async (publish: boolean) => {
    setNotice(null);
    setError(null);
    if (!user) {
      setError("Sign in to save your game.");
      return;
    }
    setBusy(true);
    try {
      const gameplay = buildGameplay(config);
      const assets = { palette: "custom", generatedBy: "nexstudio", prompt: config.description };
      const studioData = { source: "nexstudio", editedAt: new Date().toISOString() };

      if (record) {
        const alreadyReleased = Boolean(record.released_at);
        const releasedAt = publish && !alreadyReleased ? new Date().toISOString() : record.released_at;
        const nextVersion = publish
          ? Math.max(1, (record.version ?? 1) + (alreadyReleased ? 1 : 0))
          : record.version;
        const update = {
          title: config.title,
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
          title: config.title,
          description: config.description,
          gameplay,
          assets,
          released_at: releasedAt,
          status: publish && !alreadyReleased ? "pending" : record.status,
          version: nextVersion,
        });
        setNonce((n) => n + 1);
        setNotice(
          publish
            ? alreadyReleased
              ? "Updated — players get the new version."
              : "Submitted for review — it's playable now."
            : "Draft saved.",
        );
      } else {
        const gameKey = `${slugify(config.title)}-${Date.now().toString(36)}`;
        const { data, error: insErr } = await supabase
          .from("games")
          .insert({
            user_id: user.id,
            game_key: gameKey,
            title: config.title,
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
        setParams({ game: gameKey }, { replace: true });
        setNonce((n) => n + 1);
        setNotice("Saved. Press Publish to submit it for review.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  // Only the owner may save/publish; everyone else gets a read-only editor.
  const isOwner = !record || (!!user && user.id === record.user_id);

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
              <Select
                value={config.mode}
                onValueChange={(v) => setConfig((c) => ({ ...c, mode: v as Mode }))}
              >
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
                    setConfig((c) => ({
                      ...c,
                      levels: clampNumber(e.target.value, 1, 10, c.levels),
                    }))
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
              <Input
                value={config.names.player}
                onChange={(e) => setNames("player", e.target.value)}
              />
            </div>
            <ColorField
              label="Player color"
              value={config.theme.player}
              onChange={(v) => setTheme("player", v)}
            />
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-3 md:px-4 border-b border-border bg-sidebar">
        <Link
          to="/create"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground shrink-0"
          title="Back to NexConsole"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <span className="font-heading text-sm font-bold">
            NEX<span className="text-primary">STUDIO</span>
          </span>
        </div>
        <div className="hidden sm:block flex-1 min-w-0">
          <Input
            value={config.title}
            onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
            className="h-8 max-w-xs bg-background"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {record && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/play/${record.game_key}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Play
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => persist(false)} disabled={busy || !isOwner}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
          <Button size="sm" onClick={() => persist(true)} disabled={busy || !isOwner}>
            <Upload className="h-4 w-4 mr-1" />
            {record?.released_at ? "Update" : "Publish"}
          </Button>
        </div>
      </header>

      {/* Status bar */}
      {(notice || error) && (
        <div
          className={`px-4 py-2 text-xs font-body flex items-center gap-2 shrink-0 ${
            error ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"
          }`}
        >
          {error ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {error ?? notice}
        </div>
      )}

      {/* Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] overflow-hidden">
        {/* Explorer */}
        <aside className="hidden lg:flex flex-col border-r border-border bg-sidebar/50 overflow-y-auto">
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

        {/* Viewport */}
        <main className="relative overflow-auto bg-[repeating-conic-gradient(#0000_0%_25%,#00000022_0%_50%)] bg-[length:24px_24px] p-4">
          <div className="max-w-3xl mx-auto">
            <GamePreview
              pkg={pkg}
              title={config.title || "Untitled"}
              onOpenFull={record ? () => navigate(`/play/${record.game_key}`) : undefined}
            />
          </div>
        </main>

        {/* Inspector */}
        <aside className="border-l border-border bg-sidebar/50 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground font-heading border-b border-border">
            Properties — {EXPLORER.find((e) => e.key === selected)?.label}
          </div>
          <div className="p-4">{inspector()}</div>
        </aside>
      </div>

      {!user && (
        <div className="px-4 py-2 bg-yellow-500/15 text-yellow-600 text-xs font-body">
          You're not signed in — <Link to="/login" className="underline">sign in</Link> to save or
          publish.
        </div>
      )}
      {user && record && !isOwner && (
        <div className="px-4 py-2 bg-yellow-500/15 text-yellow-600 text-xs font-body">
          Read-only — you can only edit games you created.
        </div>
      )}
    </div>
  );
};

export default Studio;
