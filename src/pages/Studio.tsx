// Studio.tsx — "Nexstudio". A Blender-style, taskbar-first web editor for
// NEXCONSOLE games. The chrome mirrors Blender (top bar with File/Edit/Render/
// Window/Help, workspace tabs, a viewport with header + tool column, an
// Outliner, a Properties editor and a status bar). The viewport follows the
// game's dimension: a 2D game shows the 2D canvas, a 3D game shows a 3D world.
//
// Real Blender cannot be embedded — the referenced blender-web project streams a
// native GPU Blender over WebSocket — so this recreates its interface instead.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type Dimension,
  type Mode,
  type StudioConfig,
} from "@/lib/studioConfig";
import { GamePreview } from "@/components/GamePreview";
import { Viewport3D, type Viewport3DHandle } from "@/components/studio/Viewport3D";
import { StudioMenu, type StudioMenuEntry } from "@/components/studio/StudioMenu";
import { Outliner, type OutlinerKey } from "@/components/studio/Outliner";
import { PropertiesPanel, type PropTab } from "@/components/studio/PropertiesPanel";
import { OpenGameDialog, loadMyGames, type GameSummary } from "@/components/studio/OpenGameDialog";
import { OperatorSearch, type StudioOperator } from "@/components/studio/OperatorSearch";
import { useBlenderInput } from "@/hooks/useBlenderInput";
import {
  AlertTriangle,
  Box,
  Camera,
  CheckCircle2,
  Circle,
  Crosshair,
  Globe,
  Image,
  Loader2,
  LogOut,
  Maximize2,
  Move,
  MousePointer2,
  PanelRight,
  PenTool,
  Play,
  Plus,
  RotateCw,
  Ruler,
  Save,
  Settings2,
  Square,
  Sun,
  Upload,
} from "lucide-react";

const WORKSPACES = ["Layout", "Modeling", "Shading", "Animation", "Rendering", "Scripting"];

const TOOLS = [
  { icon: MousePointer2, label: "Select Box" },
  { icon: Circle, label: "Cursor" },
  { icon: Move, label: "Move" },
  { icon: RotateCw, label: "Rotate" },
  { icon: Maximize2, label: "Scale" },
  { icon: Ruler, label: "Measure" },
  { icon: PenTool, label: "Annotate" },
  { icon: Crosshair, label: "Add" },
  { icon: Plus, label: "Add Object" },
];

const SHADING = [
  { id: "wire", icon: Circle, label: "Wireframe" },
  { id: "solid", icon: Square, label: "Solid" },
  { id: "mat", icon: Sun, label: "Material Preview" },
  { id: "rend", icon: Camera, label: "Rendered" },
];

const PROP_TABS: PropTab[] = [
  { id: "render", label: "Render", icon: Camera },
  { id: "output", label: "Output", icon: Image },
  { id: "scene", label: "Scene", icon: Settings2 },
  { id: "world", label: "World", icon: Globe },
  { id: "object", label: "Object", icon: Box },
];

const inputCls =
  "h-7 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-2 font-body text-[11px] text-[#e0e0e0] outline-none focus:border-[#4772b3]";
const segCls = (on: boolean) =>
  `flex-1 rounded-[3px] px-2 py-1 text-[11px] ${on ? "bg-[#4772b3] text-white" : "bg-[#3a3a3a] text-[#b8b8b8] hover:bg-[#454545]"}`;

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mb-2.5 block">
    <span className="mb-1 block text-[10px] uppercase tracking-wide text-[#8f8f8f]">{label}</span>
    {children}
  </label>
);

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <Field label={label}>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color`}
        className="h-7 w-9 shrink-0 cursor-pointer rounded-[3px] border border-[#4a4a4a] bg-transparent"
      />
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  </Field>
);

// NexPlay brand mark — a play triangle in the NexConsole blue. Replaces the
// Blender logo in the top bar while keeping the Blender-style editor chrome.
const NexPlayLogo = () => (
  <span className="flex select-none items-center gap-1.5 pl-1">
    <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#4772b3]">
      <Play className="h-3 w-3 text-white" fill="currentColor" />
    </span>
    <span className="font-heading text-[13px] font-bold leading-none tracking-wide text-[#e8e8e8]">
      Nex<span className="text-[#5a85c6]">Play</span>
    </span>
  </span>
);

const Studio = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const gameKeyParam = params.get("game");

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport3DHandle>(null);
  const viewportBodyRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_CONFIG);
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(gameKeyParam));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OutlinerKey>("game");

  // Shell state
  const [workspace, setWorkspace] = useState("Layout");
  const [propTab, setPropTab] = useState("scene");
  const [shading, setShading] = useState("solid");
  const [tool, setTool] = useState("Select Box");
  const [editMode, setEditMode] = useState("Object Mode");
  const [showPanels, setShowPanels] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [nonce, setNonce] = useState(0);

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
        dimension: gp?.dimension === "3d" ? "3d" : "2d",
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

  const setOptionals = {
    setTheme: (k: keyof StudioConfig["theme"], v: string) =>
      setConfig((c) => ({ ...c, theme: { ...c.theme, [k]: v } })),
    setNames: (k: keyof StudioConfig["names"], v: string) =>
      setConfig((c) => ({ ...c, names: { ...c.names, [k]: v } })),
  };

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
    setNonce((n) => n + 1);
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

  const isOwner = !record || (!!user && user.id === record.user_id);
  const setDimension = (d: Dimension) => setConfig((c) => ({ ...c, dimension: d }));

  // Input device detection + navigation intents, ported from blender-web's
  // web-input-detector (GHOST-inspired). Drives zoom / pan / orbit in the 3D
  // viewport and reports the detected device (mouse vs trackpad) in the status bar.
  const input = useBlenderInput(
    viewportBodyRef,
    {
      onZoom: (factor) => {
        if (config.dimension === "3d") viewportRef.current?.zoom(factor);
      },
      onPan: (dx, dy) => {
        if (config.dimension === "3d") viewportRef.current?.pan(dx, dy);
      },
      onOrbit: (dx, dy) => {
        if (config.dimension === "3d") viewportRef.current?.orbit(dx, dy);
      },
      onRotate: (radians) => {
        if (config.dimension === "3d") viewportRef.current?.orbit(radians * 60, 0);
      },
    },
    true,
  );

  // Every action in the editor, exposed through Blender's F3 "Operator Search".
  const operators: StudioOperator[] = [
    { id: "file.save", label: "File: Save", hint: "Ctrl+S", run: () => void persist(false) },
    { id: "file.publish", label: "File: Publish / Update", hint: "Ctrl+Shift+S", run: () => void persist(true) },
    {
      id: "file.open",
      label: "File: Open Game…",
      hint: "Ctrl+O",
      run: () => {
        void refreshMyGames();
        setOpenDialog(true);
      },
    },
    { id: "file.new", label: "File: New Game", hint: "Ctrl+N", run: newGame },
    { id: "view.frame_all", label: "View: Frame All", hint: "Numpad .", run: () => viewportRef.current?.frameAll() },
    { id: "view.front", label: "View: Front", hint: "Numpad 1", run: () => viewportRef.current?.setView("front") },
    { id: "view.right", label: "View: Right", hint: "Numpad 3", run: () => viewportRef.current?.setView("right") },
    { id: "view.top", label: "View: Top", hint: "Numpad 7", run: () => viewportRef.current?.setView("top") },
    { id: "view.camera", label: "View: Camera", hint: "Numpad 0", run: () => viewportRef.current?.setView("camera") },
    { id: "view.toolbar", label: "View: Toggle Toolbar", hint: "T", run: () => setShowToolbar((v) => !v) },
    { id: "view.properties", label: "View: Toggle Properties", hint: "N", run: () => setShowPanels((v) => !v) },
    {
      id: "object.mode",
      label: "Object: Toggle Edit / Object Mode",
      hint: "Tab",
      run: () => setEditMode((m) => (m === "Object Mode" ? "Edit Mode" : "Object Mode")),
    },
    { id: "add.2d", label: "Add: 2D Game", run: () => setDimension("2d") },
    { id: "add.3d", label: "Add: 3D Game", run: () => setDimension("3d") },
    { id: "window.fullscreen", label: "Window: Fullscreen", run: toggleFullscreen },
    {
      id: "edit.reset",
      label: "Edit: Reset Settings",
      run: () => setConfig((c) => ({ ...DEFAULT_CONFIG, title: c.title, description: c.description })),
    },
  ];

  // Blender-style unmodified keymap: T toolbar, N properties, Tab mode switch,
  // numpad views, F3 operator search.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "F3") {
        e.preventDefault();
        setOperatorOpen((v) => !v);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setEditMode((m) => (m === "Object Mode" ? "Edit Mode" : "Object Mode"));
        return;
      }
      switch (e.key) {
        case "t":
          setShowToolbar((v) => !v);
          break;
        case "n":
          setShowPanels((v) => !v);
          break;
        case "1":
          viewportRef.current?.setView("front");
          break;
        case "3":
          viewportRef.current?.setView("right");
          break;
        case "7":
          viewportRef.current?.setView("top");
          break;
        case "0":
          viewportRef.current?.setView("camera");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const iconBtn = (on?: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded-[3px] ${
      on ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
    }`;

  const topMenus: { label: string; items: StudioMenuEntry[] }[] = [
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
        { label: "Save", shortcut: "Ctrl+S", onSelect: () => persist(false), disabled: busy || !isOwner },
        {
          label: record?.released_at ? "Update (publish)" : "Publish",
          shortcut: "Ctrl+Shift+S",
          onSelect: () => persist(true),
          disabled: busy || !isOwner,
        },
        {
          label: "Save a copy…",
          onSelect: () => persist(false, { asNew: true, title: `${config.title} copy` }),
          disabled: busy || !user,
        },
        { separator: true },
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
        { label: "Operator Search…", shortcut: "F3", onSelect: () => setOperatorOpen(true) },
        { separator: true },
        {
          label: "Reset settings to defaults",
          onSelect: () => setConfig((c) => ({ ...DEFAULT_CONFIG, title: c.title, description: c.description })),
        },
        { label: "Reload viewport", onSelect: () => setNonce((n) => n + 1) },
      ],
    },
    {
      label: "Render",
      items: [
        { label: "Publish to NexConsole", onSelect: () => persist(true), disabled: busy || !isOwner },
        {
          label: "Render preview (play)",
          onSelect: record ? () => navigate(`/play/${record.game_key}`) : undefined,
          disabled: !record,
        },
        { separator: true },
        { label: "2D", checked: config.dimension === "2d", onSelect: () => setDimension("2d") },
        { label: "3D", checked: config.dimension === "3d", onSelect: () => setDimension("3d") },
      ],
    },
    {
      label: "Window",
      items: [
        { label: "Toggle Toolbar", onSelect: () => setShowToolbar((v) => !v), checked: showToolbar },
        { label: "Toggle Properties", onSelect: () => setShowPanels((v) => !v), checked: showPanels },
        { label: "Fullscreen", onSelect: toggleFullscreen },
        { separator: true },
        { label: "Reload viewport", onSelect: () => setNonce((n) => n + 1) },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "About NexPlay Studio",
          onSelect: () =>
            setNotice(
              "NexPlay Studio — a Blender-inspired game editor. Real Blender is a GPU stream; this recreates its UI. Input handling is ported from blender-web.",
            ),
        },
        { separator: true },
        { label: "Operator Search…", shortcut: "F3", onSelect: () => setOperatorOpen(true) },
        { label: "Toolbar / Properties / Mode", shortcut: "T · N · Tab", disabled: true },
        { label: "Views: Front/Right/Top/Camera", shortcut: "1 / 3 / 7 / 0", disabled: true },
        { label: "Move ← → / WASD · Space = shoot/jump", disabled: true },
      ],
    },
  ];

  const headerMenus: { label: string; items: StudioMenuEntry[] }[] = [
    {
      label: "View",
      items: [
        ...SHADING.map((s) => ({
          label: s.label,
          checked: shading === s.id,
          onSelect: () => setShading(s.id),
        })),
        { separator: true },
        { label: "Frame All", onSelect: () => viewportRef.current?.frameAll() },
        { label: "Front", onSelect: () => viewportRef.current?.setView("front") },
        { label: "Right", onSelect: () => viewportRef.current?.setView("right") },
        { label: "Top", onSelect: () => viewportRef.current?.setView("top") },
        { label: "Camera", onSelect: () => viewportRef.current?.setView("camera") },
        { separator: true },
        { label: "Toggle Toolbar", checked: showToolbar, onSelect: () => setShowToolbar((v) => !v) },
        { label: "Toggle Properties", checked: showPanels, onSelect: () => setShowPanels((v) => !v) },
        { label: "Fullscreen", onSelect: toggleFullscreen },
      ],
    },
    {
      label: "Select",
      items: (["game", "player", "good", "bad", "environment", "world"] as OutlinerKey[]).map((k) => ({
        label: k === "good" ? GOOD_LABEL[config.mode] : k === "bad" ? BAD_LABEL[config.mode] : k,
        checked: selected === k,
        onSelect: () => {
          setSelected(k);
          setPropTab("object");
        },
      })),
    },
    {
      label: "Add",
      items: [
        { label: "2D Game", checked: config.dimension === "2d", onSelect: () => setDimension("2d") },
        { label: "3D Game", checked: config.dimension === "3d", onSelect: () => setDimension("3d") },
        { separator: true },
        { label: "Catch mode", checked: config.mode === "catch", onSelect: () => setConfig((c) => ({ ...c, mode: "catch" })) },
        { label: "Shooter mode", checked: config.mode === "shooter", onSelect: () => setConfig((c) => ({ ...c, mode: "shooter" })) },
        { label: "Runner mode", checked: config.mode === "runner", onSelect: () => setConfig((c) => ({ ...c, mode: "runner" })) },
      ],
    },
    {
      label: "Object",
      items: [
        { label: "Easy", checked: config.difficulty === "easy", onSelect: () => setConfig((c) => ({ ...c, difficulty: "easy" })) },
        { label: "Medium", checked: config.difficulty === "medium", onSelect: () => setConfig((c) => ({ ...c, difficulty: "medium" })) },
        { label: "Hard", checked: config.difficulty === "hard", onSelect: () => setConfig((c) => ({ ...c, difficulty: "hard" })) },
      ],
    },
  ];

  // ---- Properties content per tab ----
  const gameFields = (
    <>
      <Field label="Title">
        <input value={config.title} onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))} className={inputCls} />
      </Field>
      <Field label="Description">
        <textarea
          rows={2}
          value={config.description}
          onChange={(e) => setConfig((c) => ({ ...c, description: e.target.value }))}
          className={`${inputCls} h-auto py-1.5`}
        />
      </Field>
      <Field label="Mode">
        <select
          value={config.mode}
          onChange={(e) => setConfig((c) => ({ ...c, mode: e.target.value as Mode }))}
          className={inputCls}
        >
          <option value="catch">Catch</option>
          <option value="shooter">Shooter</option>
          <option value="runner">Runner</option>
        </select>
      </Field>
      <Field label="Difficulty">
        <select
          value={config.difficulty}
          onChange={(e) => setConfig((c) => ({ ...c, difficulty: e.target.value as Difficulty }))}
          className={inputCls}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </Field>
      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <Field label="Levels">
          <input
            type="number"
            value={config.levels}
            onChange={(e) => setConfig((c) => ({ ...c, levels: clampNumber(e.target.value, 1, 10, c.levels) }))}
            className={inputCls}
          />
        </Field>
        <Field label="Goal">
          <input
            type="number"
            value={config.goal}
            onChange={(e) => setConfig((c) => ({ ...c, goal: clampNumber(e.target.value, 1, 999, c.goal) }))}
            className={inputCls}
          />
        </Field>
      </div>
    </>
  );

  const dimensionBlock = (
    <Field label="Dimension">
      <div className="flex gap-1">
        <button type="button" onClick={() => setDimension("2d")} className={segCls(config.dimension === "2d")}>
          2D
        </button>
        <button type="button" onClick={() => setDimension("3d")} className={segCls(config.dimension === "3d")}>
          3D
        </button>
      </div>
    </Field>
  );

  const objectFields = () => {
    if (selected === "player") {
      return (
        <>
          <Field label="Player name">
            <input value={config.names.player} onChange={(e) => setOptionals.setNames("player", e.target.value)} className={inputCls} />
          </Field>
          <ColorField label="Player color" value={config.theme.player} onChange={(v) => setOptionals.setTheme("player", v)} />
        </>
      );
    }
    if (selected === "good") {
      return (
        <>
          <Field label={`${GOOD_LABEL[config.mode]} name`}>
            <input value={config.names.good} onChange={(e) => setOptionals.setNames("good", e.target.value)} className={inputCls} />
          </Field>
          <ColorField label={`${GOOD_LABEL[config.mode]} color`} value={config.theme.good} onChange={(v) => setOptionals.setTheme("good", v)} />
        </>
      );
    }
    if (selected === "bad") {
      return (
        <>
          <Field label={`${BAD_LABEL[config.mode]} name`}>
            <input value={config.names.bad} onChange={(e) => setOptionals.setNames("bad", e.target.value)} className={inputCls} />
          </Field>
          <ColorField label={`${BAD_LABEL[config.mode]} color`} value={config.theme.bad} onChange={(v) => setOptionals.setTheme("bad", v)} />
        </>
      );
    }
    if (selected === "environment") {
      return (
        <>
          <ColorField label="Background" value={config.theme.bg} onChange={(v) => setOptionals.setTheme("bg", v)} />
          <ColorField label="Accent" value={config.theme.accent} onChange={(v) => setOptionals.setTheme("accent", v)} />
          <ColorField label="Text" value={config.theme.text} onChange={(v) => setOptionals.setTheme("text", v)} />
        </>
      );
    }
    return (
      <>
        <p className="mb-2 text-[11px] text-[#8f8f8f]">Select a node in the Outliner to edit it.</p>
        {gameFields}
      </>
    );
  };

  const propertiesContent = () => {
    switch (propTab) {
      case "scene":
        return (
          <>
            {gameFields}
            {dimensionBlock}
          </>
        );
      case "world":
        return (
          <>
            <p className="mb-2 text-[11px] text-[#8f8f8f]">World / environment colors.</p>
            <ColorField label="Background" value={config.theme.bg} onChange={(v) => setOptionals.setTheme("bg", v)} />
            <ColorField label="Accent" value={config.theme.accent} onChange={(v) => setOptionals.setTheme("accent", v)} />
            <ColorField label="Text" value={config.theme.text} onChange={(v) => setOptionals.setTheme("text", v)} />
          </>
        );
      case "object":
        return objectFields();
      case "render":
        return (
          <>
            <p className="mb-2 text-[11px] text-[#8f8f8f]">Viewport performance.</p>
            <Field label={`Speed — ${config.speed.toFixed(1)}`}>
              <input
                type="range"
                min={1}
                max={8}
                step={0.1}
                value={config.speed}
                onChange={(e) => setConfig((c) => ({ ...c, speed: Number(e.target.value) }))}
                className="w-full accent-[#4772b3]"
              />
            </Field>
            <Field label={`Spawn every ${config.spawnMs} ms`}>
              <input
                type="range"
                min={300}
                max={2000}
                step={20}
                value={config.spawnMs}
                onChange={(e) => setConfig((c) => ({ ...c, spawnMs: Number(e.target.value) }))}
                className="w-full accent-[#4772b3]"
              />
            </Field>
            <Field label="Shading">
              <div className="flex gap-1">
                {SHADING.map((s) => (
                  <button key={s.id} type="button" onClick={() => setShading(s.id)} className={segCls(shading === s.id)}>
                    {s.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </Field>
          </>
        );
      case "output":
        return (
          <>
            <p className="mb-2 text-[11px] text-[#8f8f8f]">
              {record
                ? `Output — v${record.version}${record.released_at ? " (published)" : " (draft)"}`
                : "Output — unsaved game"}
            </p>
            <Field label="Game key">
              <input readOnly value={record?.game_key ?? "—"} className={`${inputCls} text-[#8f8f8f]`} />
            </Field>
            <Field label="Status">
              <input readOnly value={record?.status ?? "unsaved"} className={`${inputCls} text-[#8f8f8f]`} />
            </Field>
            {dimensionBlock}
          </>
        );
      default:
        return gameFields;
    }
  };

  if (loading && !record) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1d1d1d]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8f8f8f]" />
      </div>
    );
  }

  const dimension = config.dimension;

  return (
    <div ref={rootRef} className="flex h-screen flex-col overflow-hidden bg-[#1d1d1d] font-body text-[11px] text-[#d6d6d6] select-none">
      {/* ---- Top bar ---- */}
      <div className="flex h-8 shrink-0 items-stretch border-b border-black bg-[#1d1d1d]">
        <div className="flex items-center px-2">
          <NexPlayLogo />
        </div>
        <div className="flex items-stretch gap-0.5 py-1">
          {topMenus.map((m) => (
            <StudioMenu key={m.label} label={m.label} items={m.items} />
          ))}
        </div>
        <div className="ml-1 flex items-stretch gap-0.5 border-l border-[#3d3d3d] py-1 pl-2">
          {WORKSPACES.map((ws) => (
            <button
              key={ws}
              type="button"
              onClick={() => setWorkspace(ws)}
              className={`rounded-[3px] px-2 text-[11px] ${
                workspace === ws ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
              }`}
            >
              {ws}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 px-2">
          <span className="hidden rounded-[3px] border border-[#3d3d3d] px-2 py-1 text-[10px] text-[#b0b0b0] lg:inline">
            {config.title || "Untitled"} · Scene
          </span>
          <span className="hidden rounded-[3px] border border-[#3d3d3d] px-2 py-1 text-[10px] text-[#b0b0b0] xl:inline">
            ViewLayer
          </span>
          <button type="button" title="Toggle Properties" onClick={() => setShowPanels((v) => !v)} className={iconBtn(showPanels)}>
            <PanelRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => persist(false)}
            disabled={busy || !isOwner}
            className="flex h-7 items-center gap-1 rounded-[3px] border border-[#4a4a4a] px-2 text-[11px] text-[#d0d0d0] hover:bg-[#3a3a3a] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => persist(true)}
            disabled={busy || !isOwner}
            className="flex h-7 items-center gap-1 rounded-[3px] bg-[#4772b3] px-2 text-[11px] text-white hover:bg-[#5a85c6] disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            {record?.released_at ? "Update" : "Publish"}
          </button>
          <button type="button" title="Exit to NexConsole" onClick={() => navigate("/create")} className={iconBtn()}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---- Main area ---- */}
      <div className="flex min-h-0 flex-1">
        {/* Viewport editor */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Viewport header */}
          <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[#1d1d1d] bg-[#303030] px-2">
            <StudioMenu
              label={editMode}
              align="start"
              triggerClassName="flex h-full items-center rounded-[3px] px-2 text-[11px] text-[#d0d0d0] hover:bg-[#3a3a3a] data-[state=open]:bg-[#4772b3] data-[state=open]:text-white"
              items={["Object Mode", "Edit Mode", "Sculpt Mode", "Vertex Paint"].map((m) => ({
                label: m,
                checked: editMode === m,
                onSelect: () => setEditMode(m),
              }))}
            />
            {headerMenus.map((m) => (
              <StudioMenu
                key={m.label}
                label={m.label}
                items={m.items}
                triggerClassName="flex h-full items-center rounded-[3px] px-2 text-[11px] text-[#b0b0b0] hover:bg-[#3a3a3a] data-[state=open]:bg-[#4772b3] data-[state=open]:text-white"
              />
            ))}
            <div className="ml-auto flex items-center gap-1">
              {SHADING.map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.id} type="button" title={s.label} onClick={() => setShading(s.id)} className={iconBtn(shading === s.id)}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
              <div className="mx-1 h-4 w-px bg-[#3d3d3d]" />
              <span className="text-[10px] text-[#8f8f8f]">Viewport</span>
              <button type="button" onClick={() => setDimension("2d")} className={segCls(dimension === "2d")}>
                2D
              </button>
              <button type="button" onClick={() => setDimension("3d")} className={segCls(dimension === "3d")}>
                3D
              </button>
            </div>
          </div>

          {/* Viewport body */}
          <div ref={viewportBodyRef} className="relative min-h-0 flex-1 bg-[#2b2b2b]">
            {/* Tool column */}
            {showToolbar && (
              <div className="absolute left-1 top-1 z-10 flex flex-col gap-0.5 rounded-[4px] bg-[#303030]/95 p-1 shadow-lg">
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.label} type="button" title={t.label} onClick={() => setTool(t.label)} className={iconBtn(tool === t.label)}>
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            )}
            {/* Overlay text */}
            <div className={`pointer-events-none absolute top-2 z-10 text-[10px] text-[#b0b0b0] ${showToolbar ? "left-11" : "left-2"}`}>
              (1) Scene Collection | {editMode}
            </div>
            <div className={`pointer-events-none absolute bottom-2 z-10 text-[10px] text-[#8f8f8f] ${showToolbar ? "left-11" : "left-2"}`}>
              {dimension === "3d" ? "Drag: orbit · Right-drag/Shift-drag: pan · Wheel: zoom" : `${config.mode} view · ${config.dimension.toUpperCase()}`}
            </div>

            {/* Content: 2D canvas or 3D world */}
            <div key={`${dimension}-${nonce}`} className="h-full w-full">
              {dimension === "3d" ? (
                <Viewport3D ref={viewportRef} mode={config.mode} goal={config.goal} theme={config.theme} />
              ) : (
                <GamePreview
                  fill
                  pkg={pkg}
                  title={config.title || "Untitled"}
                  onOpenFull={record ? () => navigate(`/play/${record.game_key}`) : undefined}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right column: Outliner + Properties */}
        {showPanels && (
          <div className="hidden w-[300px] shrink-0 flex-col border-l border-black md:flex">
            <div className="h-44 min-h-0 shrink-0 overflow-hidden border-b border-black bg-[#303030]">
              <Outliner
                title={config.title}
                mode={config.mode}
                selected={selected}
                onSelect={(k) => {
                  setSelected(k);
                  setPropTab("object");
                }}
              />
            </div>
            <PropertiesPanel tabs={PROP_TABS} active={propTab} onChange={setPropTab}>
              {propertiesContent()}
            </PropertiesPanel>
          </div>
        )}
      </div>

      {/* ---- Status bar ---- */}
      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-black bg-[#1d1d1d] px-3 text-[10px] text-[#9a9a9a]">
        <span className={error ? "flex items-center gap-1 text-[#ff6b6b]" : notice ? "flex items-center gap-1 text-[#7bd88f]" : ""}>
          {error ? <AlertTriangle className="h-3 w-3" /> : notice ? <CheckCircle2 className="h-3 w-3" /> : null}
          {error ?? notice ?? "Ready"}
        </span>
        {!user && (
          <span className="text-[#e0b341]">
            Not signed in — <Link to="/login" className="underline">sign in</Link> to save or publish.
          </span>
        )}
        {user && record && !isOwner && <span className="text-[#e0b341]">Read-only — you can only edit games you created.</span>}
        <span className="ml-auto truncate">{config.title || "Untitled"}</span>
        <span>
          {record ? `v${record.version}` : "unsaved"} · {config.dimension.toUpperCase()} · {config.mode}
        </span>
        <span
          className="hidden sm:inline"
          title={`Detected from wheel/gesture patterns (${input.platform})`}
        >
          {input.device === "unknown"
            ? "Input: —"
            : `${input.device === "mouse" ? "Mouse" : "Trackpad"} ${input.confidence}%`}
        </span>
        <button
          type="button"
          onClick={() => setOperatorOpen(true)}
          title="Operator Search (F3)"
          className="font-heading text-[#c8c8c8] hover:text-white"
        >
          NexPlay
        </button>
      </div>

      <OperatorSearch open={operatorOpen} operators={operators} onClose={() => setOperatorOpen(false)} />

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
