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
import {
  activeCamera,
  addObject,
  cloneObject,
  createCamera,
  createDemoScene,
  createLight,
  createMeshObject,
  deleteVertices,
  deserializeScene,
  duplicateSelection,
  findObject,
  moveVertices,
  nextId,
  patchObject,
  removeObject,
  scaleSelection,
  sculpt,
  serializeScene,
  setActiveCamera,
  spawnTransform,
  uniqueName,
  v3,
  type LightKind,
  type PrimitiveKind,
  type Scene,
  type Vec3,
} from "@/lib/scene3d";
import { StudioMenu, type StudioMenuEntry } from "@/components/studio/StudioMenu";
import { Outliner, type OutlinerKey } from "@/components/studio/Outliner";
import { PropertiesPanel, type PropTab } from "@/components/studio/PropertiesPanel";
import { OpenGameDialog, loadMyGames, type GameSummary } from "@/components/studio/OpenGameDialog";
import { OperatorSearch, type StudioOperator } from "@/components/studio/OperatorSearch";
import { useBlenderInput } from "@/hooks/useBlenderInput";
import { WorkspaceRenderer, type Workspace } from "@/components/studio/WorkspaceRenderer";
import { AIAssistant } from "@/components/studio/AIAssistant";
import { MusePromptBar } from "@/components/studio/MusePromptBar";
import { ResizeGrip } from "@/components/studio/ResizeGrip";
import { StudioIntro } from "@/components/studio/StudioIntro";
import { StudioTour } from "@/components/studio/StudioTour";
import { BuildProgress } from "@/components/studio/BuildProgress";
import { Tip } from "@/components/studio/Tip";
import { useMuse } from "@/hooks/useMuse";
import { useStoredNumber, useStoredFlag } from "@/hooks/useStoredNumber";
import { clearOnboarded, hasOnboarded, markOnboarded } from "@/lib/onboarding";
import type { MuseAction } from "@/lib/musePlan";
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
  Bot,
  PanelRight,
  PenTool,
  Play,
  Plus,
  RotateCw,
  Ruler,
  Save,
  Settings2,
  Sparkles,
  Square,
  Sun,
  Upload,
  Video,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const WORKSPACES = ["Layout", "Modeling", "Shading", "Animation", "Rendering", "Scripting"];

// Minimum time the "asset import" build overlay stays visible when saving.
const BUILD_MIN_MS = 1600;

/** Display label for an addable primitive. */
const primitiveLabel = (kind: PrimitiveKind): string =>
  ({
    cube: "Cube",
    uv_sphere: "UV Sphere",
    ico_sphere: "Ico Sphere",
    cylinder: "Cylinder",
    cone: "Cone",
    plane: "Plane",
    torus: "Torus",
    suzanne: "Suzanne",
  })[kind];

/** Keeps object scale inside a sane range so gizmo drags can't explode. */
const clampScale = (v: number) => Math.max(0.02, Math.min(40, v));

const TOOL_TIPS: Record<string, string> = {
  Layout: "Model, script and preview — the default Blender-style layout.",
  Modeling: "Edit the mesh and object transforms.",
  Shading: "Materials, textures and the image editor.",
  Animation: "Dope sheet, graph editor and timeline.",
  Rendering: "Node editor, output and render settings.",
  Scripting: "Write and run game logic in the console.",
};

const TOOLS = [
  { icon: MousePointer2, label: "Select Box", shortcut: "B", tip: "Box-select objects by dragging in the viewport." },
  { icon: Circle, label: "Cursor", shortcut: "Shift+Space", tip: "Place the 3D cursor — new objects spawn from it." },
  { icon: Move, label: "Move", shortcut: "G", tip: "Grab the selected object and move it." },
  { icon: RotateCw, label: "Rotate", shortcut: "R", tip: "Rotate the selected object around its pivot." },
  { icon: Maximize2, label: "Scale", shortcut: "S", tip: "Resize the selected object." },
  { icon: Ruler, label: "Measure", shortcut: "M", tip: "Measure distances between points in the viewport." },
  { icon: PenTool, label: "Annotate", shortcut: "D", tip: "Draw freehand notes on the viewport." },
  { icon: Crosshair, label: "Add", shortcut: "Shift+A", tip: "Add a new object at the cursor." },
  { icon: Plus, label: "Add Object", tip: "Add a game object — player, pickups or hazards." },
];

const SHADING = [
  { id: "wire", icon: Circle, label: "Wireframe", tip: "Show edges only." },
  { id: "solid", icon: Square, label: "Solid", tip: "Default shaded viewport." },
  { id: "mat", icon: Sun, label: "Material Preview", tip: "Preview materials with a studio light." },
  { id: "rend", icon: Camera, label: "Rendered", tip: "Full render preview." },
];

/** Sculpt-mode brushes, mirroring Blender's brush presets. */
const SCULPT_BRUSHES: { id: string; label: string; tip: string; hint?: string }[] = [
  { id: "draw", label: "Draw", tip: "Pull the surface along the stroke", hint: "X" },
  { id: "smooth", label: "Smooth", tip: "Relax the surface toward its neighbours", hint: "S" },
  { id: "grab", label: "Grab", tip: "Drag the surface with the stroke", hint: "G" },
  { id: "inflate", label: "Inflate", tip: "Push the surface out along its normal", hint: "I" },
  { id: "flatten", label: "Flatten", tip: "Pull the surface onto the brush's entry plane", hint: "Shift+F" },
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
  const { user, loading: authLoading } = useAuth();
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

  // ---- 3D scene (the Blender-like editor) ----
  const [scene, setScene] = useState<Scene>(() => createDemoScene());
  const [objectId, setObjectId] = useState<string | null>(null);
  const [selectedVertices, setSelectedVertices] = useState<number[]>([]);
  const [cameraPov, setCameraPov] = useState(false);
  const [brush, setBrush] = useState<string>("draw");
  const [brushRadius, setBrushRadius] = useState(1.6);
  const [brushStrength, setBrushStrength] = useState(0.4);
  /** The 3D cursor new objects spawn on (Blender: click with the Cursor tool). */
  const [cursor, setCursor] = useState<Vec3>(() => v3(0, 0, 0));
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Shell state
  const [workspace, setWorkspace] = useState("Layout");
  const [propTab, setPropTab] = useState("scene");
  const [shading, setShading] = useState("solid");
  const [tool, setTool] = useState("Select Box");
  const [editMode, setEditMode] = useState("Object Mode");
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showPanels, setShowPanels] = useState(true);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [museActivity, setMuseActivity] = useState<string | null>(null);

  // Resizable panel sizes (persisted between sessions).
  const [museWidth, setMuseWidth] = useStoredNumber("nexstudio_muse_w", 340);
  const [panelWidth, setPanelWidth] = useStoredNumber("nexstudio_panel_w", 320);
  const [outlinerHeight, setOutlinerHeight] = useStoredNumber("nexstudio_outliner_h", 200);

  // Preferences & first-run onboarding.
  const [showTips, setShowTips] = useStoredFlag("nexstudio_tips", true);
  const [showIntro, setShowIntro] = useState(false);
  const [introFirstRun, setIntroFirstRun] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [onboardReady, setOnboardReady] = useState(false);
  const [build, setBuild] = useState<{ active: boolean; complete: boolean; mode: "save" | "publish" }>({
    active: false,
    complete: false,
    mode: "save",
  });

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

  // First-run onboarding: the opening animation shows on every open, and the
  // full "how to use" tour only the first time this account opens the studio.
  useEffect(() => {
    if (authLoading || onboardReady) return;
    setOnboardReady(true);
    setIntroFirstRun(!hasOnboarded(user?.id));
    setShowIntro(true);
  }, [authLoading, onboardReady, user?.id]);

  const finishIntro = useCallback(() => {
    setShowIntro(false);
    if (introFirstRun) setTourOpen(true);
  }, [introFirstRun]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    markOnboarded(user?.id);
  }, [user?.id]);

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

  // ---- 3D scene actions (Blender-style Add, delete, transform, sculpt) ----

  const selectedObject = findObject(scene, objectId);

  /** Blender's mode names → the keys the viewport works with. */
  const modeKey =
    editMode === "Edit Mode"
      ? "edit"
      : editMode === "Sculpt Mode"
        ? "sculpt"
        : editMode === "Vertex Paint"
          ? "vertexpaint"
          : "object";

  /** Adds a primitive from the Add menu on top of the 3D cursor. */
  const addPrimitive = useCallback((kind: PrimitiveKind) => {
    setScene((s) => {
      const obj = createMeshObject(kind, primitiveLabel(kind), v3(0, 0, 0));
      return addObject(s, { ...obj, transform: spawnTransform(cursor, kind) });
    });
    setNotice(`Added ${primitiveLabel(kind)} at the 3D cursor.`);
    setObjectId(null);
  }, [cursor]);

  const addLightObject = useCallback(
    (type: LightKind) => {
      setScene((s) =>
        addObject(s, {
          ...createLight(type, v3(cursor[0], cursor[1] + 3, cursor[2])),
        }),
      );
      setNotice(`Added ${type} light.`);
    },
    [cursor],
  );

  const addCameraObject = useCallback(() => {
    setScene((s) =>
      addObject(s, createCamera(v3(cursor[0], cursor[1] + 2.5, cursor[2] + 4), v3(cursor[0], cursor[1], cursor[2]))),
    );
    setNotice("Added camera — select it, then Object ▸ Set Active Camera to look through it.");
  }, [cursor]);

  const deleteSelectedObject = useCallback(() => {
    if (!objectId) {
      setNotice("Select an object first.");
      return;
    }
    setScene((s) => removeObject(s, objectId));
    setObjectId(null);
    setSelectedVertices([]);
    setNotice("Deleted object.");
  }, [objectId]);

  /** Deletes the selected vertices in edit mode (Blender: X). */
  const deleteSelectedVertices = useCallback(() => {
    if (!objectId || selectedVertices.length === 0) {
      setNotice("Select vertices to delete (Edit Mode, click them).");
      return;
    }
    setScene((s) => {
      const obj = findObject(s, objectId);
      if (!obj?.mesh) return s;
      return patchObject(s, objectId, { mesh: deleteVertices(obj, selectedVertices).mesh });
    });
    setSelectedVertices([]);
    setNotice(`Deleted ${selectedVertices.length} vertices.`);
  }, [objectId, selectedVertices]);

  /** Extrudes/duplicates the selected vertices (Blender: Shift+D). */
  const duplicateSelectedVertices = useCallback(
    (offset: Vec3 = v3(0.5, 0, 0.5)) => {
      if (!objectId || selectedVertices.length === 0) {
        setNotice("Select vertices to duplicate (Edit Mode, click them).");
        return;
      }
      setScene((s) => {
        const obj = findObject(s, objectId);
        if (!obj?.mesh) return s;
        return patchObject(s, objectId, { mesh: duplicateSelection(obj, selectedVertices, offset).mesh });
      });
      setSelectedVertices([]);
      setNotice("Duplicated selection.");
    },
    [objectId, selectedVertices],
  );

  /** Scales the selected vertices about their own centre (Blender: S). */
  const scaleSelectedVertices = useCallback(
    (factor = 1.2) => {
      if (!objectId || selectedVertices.length === 0) {
        setNotice("Select vertices to scale (Edit Mode, click them).");
        return;
      }
      setScene((s) => {
        const obj = findObject(s, objectId);
        if (!obj?.mesh) return s;
        return patchObject(s, objectId, { mesh: scaleSelection(obj, selectedVertices, factor).mesh });
      });
      setNotice(`Scaled selection ×${factor}.`);
    },
    [objectId, selectedVertices],
  );

  /** Selects every vertex of the edited mesh (Blender: A). */
  const selectAllVertices = useCallback(() => {
    const obj = findObject(scene, objectId);
    if (!obj?.mesh) {
      setNotice("Select a mesh object first.");
      return;
    }
    setSelectedVertices(obj.mesh.vertices.map((_, i) => i));
    setNotice(`Selected ${obj.mesh.vertices.length} vertices.`);
  }, [objectId, scene]);

  /** Makes the selected camera the one the viewport looks through. */
  const makeActiveCamera = useCallback((id: string) => {
    setScene((s) => setActiveCamera(s, id));
    setNotice("Active camera set — the viewport can now view its POV.");
  }, []);

  /** Makes the currently selected camera active, if any. */
  const activateSelectedCamera = useCallback(() => {
    if (!selectedObject || selectedObject.kind !== "camera") {
      setNotice("Select a camera first.");
      return;
    }
    makeActiveCamera(selectedObject.id);
  }, [makeActiveCamera, selectedObject]);

  /** Toggles looking through the active camera (Blender: Numpad 0). */
  const toggleCameraPov = useCallback(() => {
    const active = activeCamera(scene);
    if (!active) {
      setNotice("No camera in the scene — add one from Add ▸ Camera.");
      return;
    }
    setCameraPov((on) => !on);
  }, [scene]);

  useEffect(() => {
    if (config.dimension !== "3d") setCameraPov(false);
  }, [config.dimension]);

  /** POV mode: move the active camera by a world-space delta. */
  const moveActiveCamera = useCallback((delta: Vec3) => {
    setScene((s) => {
      const cam = activeCamera(s);
      if (!cam) return s;
      return patchObject(s, cam.id, {
        transform: {
          ...cam.transform,
          position: [
            cam.transform.position[0] + delta[0],
            cam.transform.position[1] + delta[1],
            cam.transform.position[2] + delta[2],
          ],
        },
      });
    });
  }, []);

  /** POV mode: aim the active camera, in degrees (yaw, then pitch). */
  const orbitActiveCamera = useCallback((dYaw: number, dPitch: number) => {
    setScene((s) => {
      const cam = activeCamera(s);
      if (!cam) return s;
      const pitch = Math.max(-89, Math.min(89, cam.transform.rotation[0] + dPitch));
      return patchObject(s, cam.id, {
        transform: {
          ...cam.transform,
          rotation: [pitch, cam.transform.rotation[1] + dYaw, cam.transform.rotation[2]],
        },
      });
    });
  }, []);

  /** POV mode: zoom the active camera's lens (factor > 1 = telephoto). */
  const zoomActiveCamera = useCallback((factor: number) => {
    setScene((s) => {
      const cam = activeCamera(s);
      if (!cam) return s;
      const fov = Math.max(10, Math.min(120, (cam.camera?.fov ?? 50) / factor));
      return patchObject(s, cam.id, { camera: { ...cam.camera!, fov } });
    });
  }, []);

  const duplicateSelectedObject = useCallback(() => {
    if (!selectedObject) {
      setNotice("Select an object first.");
      return;
    }
    setScene((s) => {
      const copy = cloneObject(selectedObject);
      // Offset the copy so it is clearly a new object, not the original.
      copy.transform.position = [
        copy.transform.position[0] + 1.5,
        copy.transform.position[1],
        copy.transform.position[2] + 1.5,
      ];
      return addObject(s, copy);
    });
    setNotice("Duplicated object.");
  }, [selectedObject]);

  /** Blender's X: delete a vertex selection in edit mode, else the object. */
  const deleteSelection = useCallback(() => {
    if (modeKey !== "object" && selectedVertices.length > 0) {
      deleteSelectedVertices();
      return;
    }
    deleteSelectedObject();
  }, [deleteSelectedObject, deleteSelectedVertices, modeKey, selectedVertices.length]);

  /** Blender's Shift+D: duplicate the selection. */
  const duplicateSelectionAction = useCallback(() => {
    if (modeKey !== "object" && selectedVertices.length > 0) {
      duplicateSelectedVertices();
      return;
    }
    duplicateSelectedObject();
  }, [duplicateSelectedObject, duplicateSelectedVertices, modeKey, selectedVertices.length]);

  const toggleObjectVisible = useCallback(
    (id: string, visible: boolean) => {
      setScene((s) => patchObject(s, id, { visible }));
    },
    [],
  );

  /** Gizmo drag: move / rotate / scale the selected object. */
  const handleTransform = useCallback(
    (delta: Vec3, mode: "move" | "rotate" | "scale") => {
      if (!objectId || !selectedObject) return;
      setScene((s) => {
        const obj = findObject(s, objectId);
        if (!obj) return s;
        if (mode === "move") {
          return patchObject(s, objectId, {
            transform: {
              ...obj.transform,
              position: [
                obj.transform.position[0] + delta[0],
                obj.transform.position[1] + delta[1],
                obj.transform.position[2] + delta[2],
              ],
            },
          });
        }
        if (mode === "rotate") {
          return patchObject(s, objectId, {
            transform: {
              ...obj.transform,
              rotation: [
                obj.transform.rotation[0] + delta[0] * 40,
                obj.transform.rotation[1] + delta[1] * 40,
                obj.transform.rotation[2] + delta[2] * 40,
              ],
            },
          });
        }
        const f = 1 + (delta[0] + delta[1] + delta[2]) * 0.55;
        return patchObject(s, objectId, {
          transform: {
            ...obj.transform,
            scale: [
              clampScale(obj.transform.scale[0] * f),
              clampScale(obj.transform.scale[1] * f),
              clampScale(obj.transform.scale[2] * f),
            ],
          },
        });
      });
    },
    [objectId, selectedObject],
  );

  /** Sculpt stroke: deform the selected mesh's vertices around the hit. */
  const handleSculpt = useCallback(
    (localPoint: Vec3, delta: Vec3) => {
      if (!objectId) return;
      setScene((s) => {
        const obj = findObject(s, objectId);
        if (!obj?.mesh) return s;
        const shaped = sculpt(obj, localPoint, delta, {
          brush: brush as "draw" | "smooth" | "grab" | "inflate" | "flatten",
          radius: brushRadius,
          strength: brushStrength,
        });
        return patchObject(s, objectId, { mesh: shaped.mesh });
      });
    },
    [brush, brushRadius, brushStrength, objectId],
  );

  /** Edit mode: slide the selected vertices by an object-local delta (grab). */
  const handleMoveVertices = useCallback(
    (localDelta: Vec3) => {
      if (!objectId || selectedVertices.length === 0) return;
      setScene((s) => {
        const obj = findObject(s, objectId);
        if (!obj?.mesh) return s;
        return patchObject(s, objectId, { mesh: moveVertices(obj, selectedVertices, localDelta).mesh });
      });
    },
    [objectId, selectedVertices],
  );

  /** Number inputs in the properties panel drive the same transforms. */
  const setObjectTransform = useCallback(
    (
      key: "position" | "rotation" | "scale",
      axis: 0 | 1 | 2,
      value: number,
    ) => {
      if (!objectId) return;
      setScene((s) => {
        const obj = findObject(s, objectId);
        if (!obj) return s;
        const next = [...obj.transform[key]] as Vec3;
        next[axis] = value;
        return patchObject(s, objectId, { transform: { ...obj.transform, [key]: next } });
      });
    },
    [objectId],
  );

  const persist = async (publish: boolean, opts?: { asNew?: boolean; title?: string }) => {
    setNotice(null);
    setError(null);
    if (!user) {
      setError("Sign in to save your game.");
      return;
    }
    // Saving a draft shows the Unity-style asset-import/compile overlay.
    const showBuild = !publish;
    const startedAt = Date.now();
    if (showBuild) setBuild({ active: true, complete: false, mode: "save" });
    setBusy(true);
    let ok = false;
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
      ok = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      if (showBuild) {
        if (ok) {
          const remaining = BUILD_MIN_MS - (Date.now() - startedAt);
          if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
          setBuild((b) => ({ ...b, complete: true }));
          await new Promise((r) => setTimeout(r, 550));
        }
        setBuild((b) => ({ ...b, active: false }));
      }
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

  // Muse (the AI assistant) applies a fully-formed config + reports its actions.
  const applyMuseConfig = useCallback((next: StudioConfig, actions: MuseAction[]) => {
    setConfig(next);
    setNonce((n) => n + 1);
    const n = actions.length;
    setNotice(`Muse updated “${next.title}” — ${n} change${n === 1 ? "" : "s"}. Save to keep it.`);
  }, []);

  // One shared Muse conversation, driven by either the side panel or the prompt bar.
  const muse = useMuse(config, applyMuseConfig, setMuseActivity);

  const isOwner = !record || (!!user && user.id === record.user_id);
  const setDimension = (d: Dimension) => setConfig((c) => ({ ...c, dimension: d }));
  // Which axis the gizmo drags on, mirroring Blender's G/R/S tools.
  const transformMode = tool === "Rotate" ? "rotate" : tool === "Scale" ? "scale" : "move";

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
    { id: "view.ai", label: "View: Toggle AI Assistant", hint: "A", run: () => setShowAIAssistant((v) => !v) },
    { id: "ai.muse", label: "Muse: Build / edit with AI", hint: "A", run: () => setShowAIAssistant(true) },
    { id: "view.front", label: "View: Front", hint: "1", run: () => viewportRef.current?.setView("front") },
    { id: "view.right", label: "View: Right", hint: "3", run: () => viewportRef.current?.setView("right") },
    { id: "view.top", label: "View: Top", hint: "7", run: () => viewportRef.current?.setView("top") },
    { id: "view.camera", label: "View: Camera POV", hint: "0", run: toggleCameraPov },
    { id: "view.frame", label: "View: Frame All", hint: "Home", run: () => viewportRef.current?.frameAll() },
    { id: "view.frame.selected", label: "View: Frame Selected", run: () => viewportRef.current?.frameSelected() },
    { id: "view.zoom.in", label: "View: Zoom In", hint: "Ctrl + +", run: () => viewportRef.current?.zoom(1.25) },
    { id: "view.zoom.out", label: "View: Zoom Out", hint: "Ctrl + -", run: () => viewportRef.current?.zoom(0.8) },
    { id: "view.toolbar", label: "View: Toggle Toolbar", hint: "T", run: () => setShowToolbar((v) => !v) },
    { id: "view.properties", label: "View: Toggle Properties", hint: "N", run: () => setShowPanels((v) => !v) },
    {
      id: "object.mode",
      label: "Object: Toggle Edit / Object Mode",
      hint: "Tab",
      run: () => setEditMode((m) => (m === "Object Mode" ? "Edit Mode" : "Object Mode")),
    },
    { id: "object.duplicate", label: "Object: Duplicate", hint: "Shift+D", run: duplicateSelectionAction },
    { id: "object.delete", label: "Object: Delete", hint: "X", run: deleteSelection },
    { id: "object.active.camera", label: "Object: Set Active Camera", run: activateSelectedCamera },
    // Add ▸ Mesh
    ...(["cube", "uv_sphere", "ico_sphere", "cylinder", "cone", "plane", "torus"] as PrimitiveKind[]).map((kind) => ({
      id: `add.mesh.${kind}`,
      label: `Add: Mesh ▸ ${primitiveLabel(kind)}`,
      run: () => addPrimitive(kind),
    })),
    { id: "add.mesh.suzanne", label: "Add: Mesh ▸ Suzanne", run: () => addPrimitive("suzanne") },
    { id: "add.light.point", label: "Add: Light ▸ Point", run: () => addLightObject("point") },
    { id: "add.light.sun", label: "Add: Light ▸ Sun", run: () => addLightObject("sun") },
    { id: "add.light.spot", label: "Add: Light ▸ Spot", run: () => addLightObject("spot") },
    { id: "add.camera", label: "Add: Camera", run: addCameraObject },
    { id: "mesh.vertices.all", label: "Mesh: Select All Vertices", hint: "A", run: selectAllVertices },
    { id: "mesh.vertices.duplicate", label: "Mesh: Duplicate Vertices", run: duplicateSelectedVertices },
    { id: "mesh.vertices.scale", label: "Mesh: Scale Vertices", run: () => scaleSelectedVertices(1.2) },
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
  // numpad views, X delete, Shift+D duplicate, Shift+A add, F3 operator search.
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
      // Sculpt mode borrows Blender's brush hotkeys (X/S/G/I, Shift+F).
      if (modeKey === "sculpt") {
        const k = e.key.toLowerCase();
        if (e.shiftKey && k === "f") {
          e.preventDefault();
          setBrush("flatten");
          return;
        }
        const brushKey: Record<string, string> = { x: "draw", s: "smooth", g: "grab", i: "inflate" };
        if (!e.ctrlKey && !e.metaKey && !e.altKey && brushKey[k]) {
          e.preventDefault();
          setBrush(brushKey[k]);
          return;
        }
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setEditMode((m) => (m === "Object Mode" ? "Edit Mode" : "Object Mode"));
        return;
      }
      if (e.shiftKey && e.key === "A") {
        e.preventDefault();
        setAddMenuOpen((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelectionAction();
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
          toggleCameraPov();
          break;
        case "Home":
          viewportRef.current?.frameAll();
          break;
        case ".":
          viewportRef.current?.frameSelected();
          break;
        case "A":
          if (modeKey === "edit" || modeKey === "vertexpaint") selectAllVertices();
          else setShowAIAssistant((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.dimension, deleteSelection, duplicateSelectionAction, modeKey, selectAllVertices, toggleCameraPov]);

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
        { label: "Muse AI Assistant", shortcut: "Shift+A", onSelect: () => setShowAIAssistant((v) => !v), checked: showAIAssistant },
        { separator: true },
        { label: "Fullscreen", onSelect: toggleFullscreen },
        { separator: true },
        { label: "Reload viewport", onSelect: () => setNonce((n) => n + 1) },
      ],
    },
    {
      label: "AI",
      items: [
        { label: "Toggle Muse assistant", shortcut: "Shift+A", onSelect: () => setShowAIAssistant((v) => !v), checked: showAIAssistant },
        { label: "Open Muse (Build mode)", onSelect: () => setShowAIAssistant(true) },
        { separator: true },
        { label: "Offline Muse works with no API key", disabled: true },
        { label: "Free models: Pollinations · Groq · Cerebras · OpenRouter", disabled: true },
        { label: "Local CLI bridge: Ollama · LM Studio · g4f", disabled: true },
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
        { separator: true },
        { label: "How to use (tutorial)", onSelect: () => setTourOpen(true) },
        {
          label: "Replay opening animation",
          onSelect: () => {
            setIntroFirstRun(false);
            setShowIntro(true);
          },
        },
        { label: "Show tool tips", checked: showTips, onSelect: () => setShowTips(!showTips) },
        { separator: true },
        {
          label: "Reset tips & tutorial",
          onSelect: () => {
            clearOnboarded(user?.id);
            setNotice("Tips & tutorial reset — they'll show again next time you open the studio.");
          },
        },
        { separator: true },
        { label: "Toolbar / Properties / Mode", shortcut: "T · N · Tab", disabled: true },
        { label: "Views: Front/Right/Top/Camera", shortcut: "1 / 3 / 7 / 0", disabled: true },
        { label: "Move ← → / WASD · Space = shoot/jump", disabled: true },
      ],
    },
  ];

  /** Blender's Add menu: Mesh / Light / Camera, spawning on the 3D cursor. */
  const addMenuItems: StudioMenuEntry[] = [
    { section: "Mesh" },
    ...(Object.keys(primitiveLabel) as PrimitiveKind[]).map((kind) => ({
      label: primitiveLabel[kind],
      onSelect: () => addPrimitive(kind),
    })),
    { separator: true },
    { section: "Light" },
    { label: "Point", onSelect: () => addLightObject("point") },
    { label: "Sun", onSelect: () => addLightObject("sun") },
    { label: "Spot", onSelect: () => addLightObject("spot") },
    { separator: true },
    { section: "Camera" },
    { label: "Camera", onSelect: addCameraObject },
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
        { label: "Frame All", shortcut: "Home", onSelect: () => viewportRef.current?.frameAll() },
        { label: "Frame Selected", shortcut: ".", onSelect: () => viewportRef.current?.frameSelected() },
        { label: "Front", shortcut: "1", onSelect: () => viewportRef.current?.setView("front") },
        { label: "Right", shortcut: "3", onSelect: () => viewportRef.current?.setView("right") },
        { label: "Top", shortcut: "7", onSelect: () => viewportRef.current?.setView("top") },
        { label: "Camera POV", shortcut: "0", checked: cameraPov, onSelect: toggleCameraPov },
        { label: "Zoom In", shortcut: "Ctrl + +", onSelect: () => viewportRef.current?.zoom(1.25) },
        { label: "Zoom Out", shortcut: "Ctrl + -", onSelect: () => viewportRef.current?.zoom(0.8) },
        { separator: true },
        { label: "Toggle Toolbar", shortcut: "T", checked: showToolbar, onSelect: () => setShowToolbar((v) => !v) },
        { label: "Toggle Properties", shortcut: "N", checked: showPanels, onSelect: () => setShowPanels((v) => !v) },
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
      items: addMenuItems,
    },
    {
      label: "Object",
      items: [
        { label: "Duplicate", shortcut: "Shift+D", onSelect: duplicateSelectionAction },
        { label: "Delete", shortcut: "X", onSelect: deleteSelection },
        { separator: true },
        {
          label: "Set Active Camera",
          onSelect: activateSelectedCamera,
          disabled: !selectedObject || selectedObject.kind !== "camera",
        },
        {
          label: "Clear Location",
          onSelect: () => {
            if (!objectId) {
              setNotice("Select an object first.");
              return;
            }
            setScene((s) => {
              const obj = findObject(s, objectId);
              if (!obj) return s;
              return patchObject(s, objectId, { transform: { ...obj.transform, position: v3(0, 0, 0) } });
            });
          },
        },
      ],
    },
  ];

  /** Blender's brush/vertex strip under the header, per editing mode. */
  const modeBar =
    config.dimension !== "3d" ? null : (
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#1d1d1d] bg-[#2b2b2b] px-2 text-[10px] text-[#b0b0b0]">
        {modeKey === "sculpt" && (
          <>
            <span className="uppercase tracking-wide text-[#8a8a8a]">Brush</span>
            {SCULPT_BRUSHES.map((b) => (
              <button
                key={b.id}
                type="button"
                title={`${b.tip}${b.hint ? ` (${b.hint})` : ""}`}
                onClick={() => setBrush(b.id)}
                className={`rounded-[3px] px-1.5 py-0.5 ${brush === b.id ? "bg-[#4772b3] text-white" : "hover:bg-[#3a3a3a]"}`}
              >
                {b.label}
              </button>
            ))}
            <span className="mx-1 h-3.5 w-px bg-[#3d3d3d]" />
            <label className="flex items-center gap-1" title="Brush radius (world units)">
              Radius
              <input
                type="range"
                min={0.2}
                max={4}
                step={0.1}
                value={brushRadius}
                aria-label="Brush radius"
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                className="h-3 w-20 accent-[#4772b3]"
              />
              <span className="w-6 tabular-nums text-[#d6d6d6]">{brushRadius.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1" title="Brush strength (negative pulls the surface in)">
              Strength
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={brushStrength}
                aria-label="Brush strength"
                onChange={(e) => setBrushStrength(Number(e.target.value))}
                className="h-3 w-20 accent-[#4772b3]"
              />
              <span className="w-6 tabular-nums text-[#d6d6d6]">{brushStrength.toFixed(2)}</span>
            </label>
            <span className="ml-auto text-[#8a8a8a]">Drag on the mesh to sculpt</span>
          </>
        )}
        {modeKey === "edit" && (
          <>
            <span className="uppercase tracking-wide text-[#8a8a8a]">Mesh</span>
            <span className="tabular-nums text-[#d6d6d6]">
              {selectedObject?.mesh ? selectedObject.mesh.vertices.length : 0} verts
            </span>
            <span className="tabular-nums text-[#8f8f8f]">{selectedVertices.length} selected</span>
            <span className="mx-1 h-3.5 w-px bg-[#3d3d3d]" />
            <button type="button" title="Duplicate the selected vertices (Shift+D)" onClick={() => duplicateSelectedVertices()} className="rounded-[3px] px-1.5 py-0.5 hover:bg-[#3a3a3a]">
              Duplicate
            </button>
            <button type="button" title="Scale the selected vertices about their centre" onClick={() => scaleSelectedVertices(1.2)} className="rounded-[3px] px-1.5 py-0.5 hover:bg-[#3a3a3a]">
              Scale
            </button>
            <button type="button" title="Select every vertex (A)" onClick={selectAllVertices} className="rounded-[3px] px-1.5 py-0.5 hover:bg-[#3a3a3a]">
              Select All
            </button>
            <button type="button" title="Delete the selected vertices (X)" onClick={deleteSelectedVertices} className="rounded-[3px] px-1.5 py-0.5 hover:bg-[#3a3a3a]">
              Delete
            </button>
            <span className="ml-auto text-[#8a8a8a]">Click vertices · drag a selected one to move it</span>
          </>
        )}
        {modeKey === "object" && config.dimension === "3d" && (
          <>
            <span className="uppercase tracking-wide text-[#8a8a8a]">Cursor</span>
            <span className="tabular-nums text-[#d6d6d6]">
              {cursor.map((c) => c.toFixed(1)).join(", ")}
            </span>
            {cameraPov && <span className="ml-auto text-[#7fb2e8]">Camera POV — drag aims · right-drag moves · wheel zooms the lens</span>}
          </>
        )}
      </div>
    );

  /** The Add menu, shown as a flyout from the toolbar's Add tool. */
  const addMenuFlyout = (
    <div className="absolute left-full top-0 z-10 ml-1 w-[190px] rounded-[4px] border border-[#3d3d3d] bg-[#2b2b2b]/98 p-1 shadow-xl">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-[#8a8a8a]">Mesh</div>
      <div className="grid grid-cols-2 gap-0.5">
        {(Object.keys(primitiveLabel) as PrimitiveKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              addPrimitive(kind);
              setAddMenuOpen(false);
            }}
            className="truncate rounded-[3px] px-2 py-1 text-left text-[11px] text-[#d6d6d6] hover:bg-[#3a3a3a]"
          >
            {primitiveLabel[kind]}
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-[#3d3d3d] px-2 py-1 text-[10px] uppercase tracking-wide text-[#8a8a8a]">Light</div>
      <div className="flex gap-0.5">
        {(["point", "sun", "spot"] as LightKind[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              addLightObject(type);
              setAddMenuOpen(false);
            }}
            className="capitalize rounded-[3px] px-2 py-1 text-[11px] text-[#d6d6d6] hover:bg-[#3a3a3a]"
          >
            {type}
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-[#3d3d3d] pt-1">
        <button
          type="button"
          onClick={() => {
            addCameraObject();
            setAddMenuOpen(false);
          }}
          className="w-full rounded-[3px] px-2 py-1 text-left text-[11px] text-[#d6d6d6] hover:bg-[#3a3a3a]"
        >
          Camera
        </button>
      </div>
      <p className="px-2 pb-1 pt-1.5 text-[10px] leading-snug text-[#7f7f7f]">
        New objects land on the 3D cursor. Pick the Cursor tool and click the floor to move it.
      </p>
    </div>
  );
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
            <Tip key={ws} label={`${ws} workspace`} description={TOOL_TIPS[ws]} enabled={showTips} side="bottom">
              <button
                type="button"
                onClick={() => setWorkspace(ws)}
                className={`rounded-[3px] px-2 text-[11px] ${
                  workspace === ws ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
                }`}
              >
                {ws}
              </button>
            </Tip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 px-2">
          <span className="hidden rounded-[3px] border border-[#3d3d3d] px-2 py-1 text-[10px] text-[#b0b0b0] lg:inline">
            {config.title || "Untitled"} · Scene
          </span>
          <span className="hidden rounded-[3px] border border-[#3d3d3d] px-2 py-1 text-[10px] text-[#b0b0b0] xl:inline">
            ViewLayer
          </span>
          <Tip label="Muse AI assistant" description="Build or edit the game from a prompt." shortcut="Shift+A" enabled={showTips} side="bottom">
            <button type="button" title="Toggle AI Assistant (Shift+A)" onClick={() => setShowAIAssistant((v) => !v)} className={iconBtn(showAIAssistant)}>
              <Bot className="h-4 w-4" />
            </button>
          </Tip>
          <Tip label="Properties panel" description="Show or hide the Outliner and Properties side panel." shortcut="N" enabled={showTips} side="bottom">
            <button type="button" title="Toggle Properties" onClick={() => setShowPanels((v) => !v)} className={iconBtn(showPanels)}>
              <PanelRight className="h-4 w-4" />
            </button>
          </Tip>
          <Tip label="Save draft" description="Keep a private, unpublished copy of the game." shortcut="Ctrl+S" enabled={showTips} side="bottom">
            <button
              type="button"
              onClick={() => persist(false)}
              disabled={busy || !isOwner}
              className="flex h-7 items-center gap-1 rounded-[3px] border border-[#4a4a4a] px-2 text-[11px] text-[#d0d0d0] hover:bg-[#3a3a3a] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          </Tip>
          <Tip label={record?.released_at ? "Update (publish)" : "Publish"} description="Submit the game for review — players can then play it." shortcut="Ctrl+Shift+S" enabled={showTips} side="bottom">
            <button
              type="button"
              onClick={() => persist(true)}
              disabled={busy || !isOwner}
              className="flex h-7 items-center gap-1 rounded-[3px] bg-[#4772b3] px-2 text-[11px] text-white hover:bg-[#5a85c6] disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" />
              {record?.released_at ? "Update" : "Publish"}
            </button>
          </Tip>
          <Tip label="Exit to NexConsole" description="Leave the studio and return to your dashboard." enabled={showTips} side="bottom">
            <button type="button" title="Exit to NexConsole" onClick={() => navigate("/create")} className={iconBtn()}>
              <LogOut className="h-4 w-4" />
            </button>
          </Tip>
        </div>
      </div>

      {/* ---- Main area ---- */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Viewport header (shared across workspaces) */}
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
            {topMenus ? null : null}
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
                  <Tip key={s.id} label={s.label} description={s.tip} enabled={showTips} side="bottom">
                    <button type="button" title={s.label} onClick={() => setShading(s.id)} className={iconBtn(shading === s.id)}>
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  </Tip>
                );
              })}
              <div className="mx-1 h-4 w-px bg-[#3d3d3d]" />
              <span className="text-[10px] text-[#8f8f8f]">Viewport</span>
              {dimension === "3d" && (
                <>
                  <Tip label="Zoom out" description="Wheel, pinch or two-finger drag zoom." shortcut="Ctrl + -" enabled={showTips} side="bottom">
                    <button type="button" title="Zoom out (Ctrl + -)" onClick={() => viewportRef.current?.zoom(0.8)} className={iconBtn()}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                  </Tip>
                  <Tip label="Zoom in" description="Wheel, pinch or two-finger drag zoom." shortcut="Ctrl + +" enabled={showTips} side="bottom">
                    <button type="button" title="Zoom in (Ctrl + +)" onClick={() => viewportRef.current?.zoom(1.25)} className={iconBtn()}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </Tip>
                  <Tip
                    label={cameraPov ? "Look through camera (on)" : "Look through camera"}
                    description="Render through the active scene camera. Drag aims it, right-drag moves it, wheel zooms its lens."
                    shortcut="0"
                    enabled={showTips}
                    side="bottom"
                  >
                    <button
                      type="button"
                      title="Camera POV (0)"
                      aria-pressed={cameraPov}
                      onClick={toggleCameraPov}
                      className={iconBtn(cameraPov)}
                    >
                      <Video className="h-3.5 w-3.5" />
                    </button>
                  </Tip>
                </>
              )}
              <Tip label="2D viewport" description="Flat canvas for 2D games." enabled={showTips} side="bottom">
                <button type="button" onClick={() => setDimension("2d")} className={segCls(dimension === "2d")}>
                  2D
                </button>
              </Tip>
              <Tip label="3D viewport" description="Full 3D world with orbit / pan / zoom." enabled={showTips} side="bottom">
                <button type="button" onClick={() => setDimension("3d")} className={segCls(dimension === "3d")}>
                  3D
                </button>
              </Tip>
            </div>
          </div>

          {/* Workspace content */}
          <WorkspaceRenderer
            workspace={workspace as any}
            config={config}
            pkg={pkg}
            record={record}
            dimension={dimension}
            nonce={nonce}
            selected={selected}
            onSelect={setSelected}
            propTab={propTab}
            setPropTab={setPropTab}
            propTabs={PROP_TABS}
            propertiesContent={propertiesContent}
            showPanels={showPanels}
            showToolbar={showToolbar}
            editMode={editMode}
            tool={tool}
            setTool={setTool}
            shading={shading}
            headerMenus={headerMenus}
            headerMenusRender={() => null}
            tools={TOOLS}
            viewportRef={viewportRef}
            viewportBodyRef={viewportBodyRef}
            viewport={{
              scene,
              selectedId: objectId,
              selectedVertices,
              editMode: modeKey,
              brush,
              brushRadius,
              brushStrength,
              transformMode,
              cursor,
              cursorTool: tool === "Cursor",
              cameraPov,
              onSelectObject: (id) => setObjectId(id),
              onSelectVertices: (idx) => setSelectedVertices(idx),
              onTransform: handleTransform,
              onSculpt: handleSculpt,
              onSetCursor: (p) => setCursor(p),
              setCameraPov: (on) => setCameraPov(on),
              onCameraMove: moveActiveCamera,
              onCameraOrbit: orbitActiveCamera,
              onCameraZoom: zoomActiveCamera,
            }}
            outlinerObjects={scene.objects}
            selectedObjectId={objectId}
            onSelectObject={(id) => setObjectId(id)}
            onToggleObjectVisible={toggleObjectVisible}
            modeBar={modeBar}
            addMenu={addMenuFlyout}
            panelWidth={panelWidth}
            setPanelWidth={setPanelWidth}
            outlinerHeight={outlinerHeight}
            setOutlinerHeight={setOutlinerHeight}
            showTips={showTips}
          />
          {showAIAssistant && <MusePromptBar muse={muse} />}
        </div>
        {showAIAssistant && (
          <>
            <ResizeGrip
              axis="x"
              invert
              size={museWidth}
              min={240}
              max={720}
              onResize={setMuseWidth}
              onReset={() => setMuseWidth(340)}
              title="Drag to resize Muse · double-click to reset"
              className="hidden lg:flex"
            />
            <div className="hidden shrink-0 flex-col border-l border-black lg:flex" style={{ width: museWidth }}>
              <AIAssistant muse={muse} />
            </div>
          </>
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

      {/* ---- Muse activity overlay (shows the AI is creating) ---- */}
      {museActivity && (
        <div className="pointer-events-none fixed inset-x-0 top-12 z-50 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-[#4772b3] bg-[#1d1d1d]/95 px-4 py-1.5 text-[11px] text-[#dbe7ff] shadow-xl">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#7bd88f]" />
            <span>{museActivity}</span>
            <span className="text-[#8f8f8f]">· AI working on “{config.title || "Untitled"}”</span>
          </div>
        </div>
      )}

      <OperatorSearch open={operatorOpen} operators={operators} onClose={() => setOperatorOpen(false)} />

      {/* ---- First-run onboarding + build overlay ---- */}
      {showIntro && <StudioIntro firstRun={introFirstRun} onDone={finishIntro} />}
      <StudioTour open={tourOpen} onClose={closeTour} />
      <BuildProgress active={build.active} complete={build.complete} mode={build.mode} />

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
