// scene2d.ts — 2D scene model + editor settings, modelled on Godot's 2D workspace.
//
// Mirrors the parts of Godot's CanvasItem/Node2D editor that matter for a web
// game studio: per-node transform (position / rotation / scale), a rotation
// pivot, Z-index, node locking, a configurable grid, smart + grid snapping
// (including pixel snapping), ruler guides and the editor view transform.
// See editor/scene/canvas_item_editor_plugin.h in godotengine/godot.

export type Vec2 = [number, number];
export type Object2DKind = "rect" | "sprite" | "text";

/** Godot Node2D transform: position, rotation (degrees), per-axis scale. */
export interface Transform2D {
  position: Vec2;
  rotation: number; // degrees
  scale: Vec2;
}

/** Godot CanvasItem + Node2D editor state for one 2D node. */
export interface SceneObject2D {
  id: string;
  name: string;
  kind: Object2DKind;
  transform: Transform2D;
  color: string;
  visible: boolean;
  width: number;
  height: number;
  text?: string;
  src?: string;
  /** Godot CanvasItem Z_Index — higher paints in front. */
  zIndex: number;
  /** Rotation/scale pivot in node-local space (Godot's edit pivot, default 0,0). */
  pivot: Vec2;
  /** Node lock: not selectable / not draggable in the viewport. */
  locked: boolean;
}

/** Godot's grid settings (Configure Snap ▸ Grid Offset / Grid Step / …). */
export interface GridSettings2D {
  offset: Vec2;
  step: Vec2;
  /** Draw an infinite "primary" line every N steps. */
  primary: number;
  /** 2ⁿ multiplier applied to the step (numPad * and /). */
  multiplier: number;
}

/** Godot's snap settings. */
export interface SnapSettings2D {
  /** "Use Smart Snap" master switch (Shift+S). */
  smart: boolean;
  /** "Use Grid Snap" master switch (Shift+G). */
  grid: boolean;
  /** Snap to other nodes' sides/centers. */
  otherNodes: boolean;
  /** Snap to ruler guides. */
  guides: boolean;
  snapRelative: boolean;
  snapPixel: boolean;
  rotationSnap: boolean;
  scaleSnap: boolean;
  rotationOffset: number;
  rotationStep: number;
  scaleStep: number;
}

/** Editor view transform (persists, like Godot's canvas state). */
export interface ViewTransform2D {
  x: number;
  y: number;
  zoom: number;
}

export interface Scene2D {
  objects: SceneObject2D[];
  selectedId?: string | null;
  /** Full selection (Godot box-select / shift-click). `selectedId` mirrors the first. */
  selectedIds?: string[];
  grid: GridSettings2D;
  snap: SnapSettings2D;
  view: ViewTransform2D;
  /** Ruler guide positions in world units. */
  guides: { v: number[]; h: number[] };
  /** Godot grid visibility: always / only when snapping / never. */
  gridVisibility: "always" | "snapping" | "never";
  showRulers: boolean;
  showHelpers: boolean;
  /** Project (game) window size the anchors/guides are authored against. */
  windowSize: { width: number; height: number };
}

export const DEFAULT_GRID: GridSettings2D = {
  offset: [0, 0],
  step: [16, 16],
  primary: 8,
  multiplier: 0,
};

export const DEFAULT_SNAP: SnapSettings2D = {
  smart: true,
  grid: false,
  otherNodes: true,
  guides: true,
  snapRelative: false,
  snapPixel: true,
  rotationSnap: false,
  scaleSnap: false,
  rotationOffset: 0,
  rotationStep: 15,
  scaleStep: 0.1,
};

const RULER = 16; // Godot's ruler width (scaled)

let idCounter = 0;
const nextId = (p = "obj2d") => `${p}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const vec2 = (v: unknown, dx: number, dy: number): Vec2 => [
  Array.isArray(v) ? num(v[0], dx) : dx,
  Array.isArray(v) ? num(v[1], dy) : dy,
];
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Godot's Math::stepify — snap a value to multiples of a step. */
export function stepify(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

/** The effective grid step, honouring Godot's 2ⁿ step multiplier. */
export function gridStepPx(grid: GridSettings2D | undefined): Vec2 {
  const g = grid ?? DEFAULT_GRID;
  const m = Math.max(-4, Math.min(4, Math.round(g.multiplier)));
  const f = Math.pow(2, m);
  return [Math.max(1, g.step[0] * f), Math.max(1, g.step[1] * f)];
}

/** Axis-aligned bounds of a (possibly rotated / scaled) node — world units. */
export function objectBounds(o: SceneObject2D): [Vec2, Vec2] {
  const [x, y] = o.transform.position;
  const sx = o.transform.scale[0];
  const sy = o.transform.scale[1];
  const w = (o.width / 2) * Math.abs(sx);
  const h = (o.height / 2) * Math.abs(sy);
  if (o.transform.rotation === 0 || w === 0 || h === 0) return [[x - w, y - h], [x + w, y + h]];
  const r = (o.transform.rotation * Math.PI) / 180;
  const c = Math.cos(r) * 0; // rotation handled below via AABB of rotated rect
  void c;
  // AABB of the rotated rect, expressed around the node origin.
  const ex = Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * h;
  const ey = Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * h;
  return [[x - ex, y - ey], [x + ex, y + ey]];
}

export interface SnapHint {
  axis: "x" | "y";
  at: number;
  kind: "node" | "guide" | "grid" | "pixel";
  /** World-space extent of the hint line, for drawing. */
  span?: [Vec2, Vec2];
}

export interface SnapOptions {
  selfId?: string | null;
  /** Godot inverts smart snapping while Ctrl is held. */
  invertSmart?: boolean;
  /** Smart-snap radius in screen pixels (Godot uses 10). */
  radiusPx?: number;
  zoom?: number;
}

/**
 * Godot's CanvasItemEditor::snap_point — snap a point to the nearest of
 * [other nodes' sides/centers, guides, grid, pixel], in that priority order.
 * Grid and pixel are "forced" (always apply); node/guide snaps apply within a
 * screen-space radius.
 */
export function snapPoint2D(scene: Scene2D, p: Vec2, opts: SnapOptions = {}): { point: Vec2; hints: SnapHint[] } {
  const s = scene.snap;
  const smart = s.smart !== !!opts.invertSmart;
  const radius = (opts.radiusPx ?? 10) / Math.max(0.05, opts.zoom ?? 1);
  let [x, y] = p;
  const hints: SnapHint[] = [];

  const tryAxis = (axis: "x" | "y", candidates: { at: number; kind: SnapHint["kind"]; span?: [Vec2, Vec2] }[], forced: boolean) => {
    const v = axis === "x" ? x : y;
    let best: number | null = null;
    let bestCand: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      const d = Math.abs(c.at - v);
      if (forced ? true : d <= radius) {
        if (best === null || d < best) {
          best = d;
          bestCand = c;
        }
      }
    }
    if (bestCand && (forced || best! > 0.0001)) {
      if (axis === "x") {
        x = bestCand.at;
        hints.push({ axis, at: bestCand.at, kind: bestCand.kind, span: bestCand.span });
      } else {
        y = bestCand.at;
        hints.push({ axis, at: bestCand.at, kind: bestCand.kind, span: bestCand.span });
      }
    }
  };

  if (smart) {
    if (s.otherNodes) {
      const vx: { at: number; kind: SnapHint["kind"]; span?: [Vec2, Vec2] }[] = [];
      const vy: { at: number; kind: SnapHint["kind"]; span?: [Vec2, Vec2] }[] = [];
      for (const o of scene.objects) {
        if (o.id === opts.selfId || !o.visible || o.locked) continue;
        const [[x0, y0], [x1, y1]] = objectBounds(o);
        vx.push({ at: (x0 + x1) / 2, kind: "node", span: [[x0, y0], [x1, y1]] });
        vx.push({ at: x0, kind: "node", span: [[x0, y0], [x1, y1]] });
        vx.push({ at: x1, kind: "node", span: [[x0, y0], [x1, y1]] });
        vy.push({ at: (y0 + y1) / 2, kind: "node", span: [[x0, y0], [x1, y1]] });
        vy.push({ at: y0, kind: "node", span: [[x0, y0], [x1, y1]] });
        vy.push({ at: y1, kind: "node", span: [[x0, y0], [x1, y1]] });
      }
      tryAxis("x", vx, false);
      tryAxis("y", vy, false);
    }
    if (s.guides) {
      tryAxis("x", scene.guides.v.map((at) => ({ at, kind: "guide" as const })), false);
      tryAxis("y", scene.guides.h.map((at) => ({ at, kind: "guide" as const })), false);
    }
  }

  if (s.grid) {
    const step = gridStepPx(scene.grid);
    // Godot's "Snap Relative" shifts the grid to the selection's origin.
    const sel = findObject(scene, opts.selfId);
    const offset: Vec2 = s.snapRelative && sel ? [...sel.transform.position] as Vec2 : [...scene.grid.offset] as Vec2;
    tryAxis("x", [{ at: stepify(x - offset[0], step[0]) + offset[0], kind: "grid" }], true);
    tryAxis("y", [{ at: stepify(y - offset[1], step[1]) + offset[1], kind: "grid" }], true);
  }

  if (s.snapPixel) {
    tryAxis("x", [{ at: Math.round(x), kind: "pixel" }], true);
    tryAxis("y", [{ at: Math.round(y), kind: "pixel" }], true);
  }

  return { point: [x, y], hints };
}

/** Godot's CanvasItemEditor::snap_angle (degrees in, degrees out). */
export function snapAngle2D(scene: Scene2D, deg: number, invert = false): number {
  const s = scene.snap;
  if (!(s.rotationSnap !== invert) || s.rotationStep <= 0) return deg;
  return stepify(deg - s.rotationOffset, s.rotationStep) + s.rotationOffset;
}

/** Godot's scale snapping (used by the scale mode handles). */
export function snapScale2D(scene: Scene2D, scale: Vec2, invert = false): Vec2 {
  const s = scene.snap;
  if (!(s.scaleSnap !== invert) || s.scaleStep <= 0) return scale;
  return [stepify(scale[0], s.scaleStep), stepify(scale[1], s.scaleStep)];
}

export function createScene2D(): Scene2D {
  return {
    objects: [],
    selectedId: null,
    grid: { ...DEFAULT_GRID, offset: [0, 0], step: [16, 16] },
    snap: { ...DEFAULT_SNAP },
    view: { x: 0, y: 0, zoom: 1 },
    guides: { v: [], h: [] },
    gridVisibility: "always",
    showRulers: true,
    showHelpers: true,
    windowSize: { width: 1152, height: 648 },
  };
}

export function createRect(name = "Rect", x = 0, y = 0, w = 80, h = 40): SceneObject2D {
  return {
    id: nextId("rect"),
    name,
    kind: "rect",
    transform: { position: [x, y], rotation: 0, scale: [1, 1] },
    color: "#4f8cff",
    visible: true,
    width: w,
    height: h,
    zIndex: 0,
    pivot: [0, 0],
    locked: false,
  };
}

export function createSprite(name = "Sprite", src = "", x = 0, y = 0, w = 64, h = 64): SceneObject2D {
  return {
    id: nextId("sprite"),
    name,
    kind: "sprite",
    transform: { position: [x, y], rotation: 0, scale: [1, 1] },
    color: "transparent",
    visible: true,
    width: w,
    height: h,
    src,
    zIndex: 0,
    pivot: [0, 0],
    locked: false,
  };
}

/** Godot's Label2D — a text node. */
export function createText(name = "Label", text = "Text", x = 0, y = 0, size = 20): SceneObject2D {
  return {
    id: nextId("label"),
    name,
    kind: "text",
    transform: { position: [x, y], rotation: 0, scale: [1, 1] },
    color: "#ffffff",
    visible: true,
    width: Math.max(24, (text || "").length * size * 0.55),
    height: size,
    text,
    zIndex: 0,
    pivot: [0, 0],
    locked: false,
  };
}

export function addObject(s: Scene2D, o: SceneObject2D): Scene2D {
  return { ...s, objects: [...s.objects, o] };
}

export function patchObject(s: Scene2D, id: string, patch: Partial<SceneObject2D>): Scene2D {
  return {
    ...s,
    objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
}

export function patchTransform(s: Scene2D, id: string, patch: Partial<Transform2D>): Scene2D {
  return {
    ...s,
    objects: s.objects.map((o) => (o.id === id ? { ...o, transform: { ...o.transform, ...patch } } : o)),
  };
}

export function removeObject(s: Scene2D, id: string): Scene2D {
  const objects = s.objects.filter((o) => o.id !== id);
  return {
    ...s,
    objects,
    selectedId: s.selectedId === id ? null : s.selectedId,
  };
}

export function findObject(s: Scene2D, id?: string | null): SceneObject2D | undefined {
  if (!id) return undefined;
  return s.objects.find((o) => o.id === id);
}

export function selectObject(s: Scene2D, id: string | null): Scene2D {
  if (!id) return { ...s, selectedId: null, selectedIds: [] };
  const o = findObject(s, id);
  if (!o || o.locked) return s;
  return { ...s, selectedId: id, selectedIds: [id] };
}

/** Replace the selection with several ids (Godot shift-click / box-select). */
export function selectMany(s: Scene2D, ids: string[]): Scene2D {
  const ok = ids.filter((id) => {
    const o = findObject(s, id);
    return o && !o.locked;
  });
  return { ...s, selectedId: ok[0] ?? null, selectedIds: ok };
}

/** Toggle one id in the selection (Godot's Ctrl/Shift click on a node). */
export function toggleSelected(s: Scene2D, id: string): Scene2D {
  const cur = s.selectedIds ?? (s.selectedId ? [s.selectedId] : []);
  const o = findObject(s, id);
  if (!o || o.locked) return s;
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  return { ...s, selectedId: next[0] ?? null, selectedIds: next };
}

const withSelection = (s: Scene2D, ids: string[]): Scene2D => {
  const ok = ids.filter((id) => findObject(s, id));
  return { ...s, selectedId: ok[0] ?? null, selectedIds: ok };
};

/** New objects paint on top of the old ones (Godot appends to the scene tree). */
export function addObjectOnTop(s: Scene2D, o: SceneObject2D): Scene2D {
  const top = s.objects.reduce((m, o2) => Math.max(m, o2.zIndex), 0);
  return addObject(s, { ...o, zIndex: top + 1 });
}

export function serializeScene2D(s: Scene2D): string {
  return JSON.stringify({
    version: 2,
    objects: s.objects,
    grid: s.grid,
    snap: s.snap,
    view: s.view,
    guides: s.guides,
    gridVisibility: s.gridVisibility,
    showRulers: s.showRulers,
    showHelpers: s.showHelpers,
    windowSize: s.windowSize,
  });
}

function normalizeObject(raw: unknown): SceneObject2D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = (o.kind as Object2DKind) ?? "rect";
  if (!["rect", "sprite", "text"].includes(kind)) return null;
  const t = (o.transform ?? {}) as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id : nextId(kind),
    name: typeof o.name === "string" ? o.name : kind,
    kind,
    transform: {
      position: vec2(t.position, 0, 0),
      rotation: num(t.rotation, 0),
      scale: vec2(t.scale, 1, 1).map((v) => (v === 0 ? 1 : v)) as Vec2,
    },
    color: typeof o.color === "string" ? o.color : "#4f8cff",
    visible: bool(o.visible, true),
    width: Math.max(1, num(o.width, 32)),
    height: Math.max(1, num(o.height, 32)),
    text: typeof o.text === "string" ? o.text : undefined,
    src: typeof o.src === "string" ? o.src : undefined,
    zIndex: num(o.zIndex, 0),
    pivot: vec2(o.pivot, 0, 0),
    locked: bool(o.locked, false),
  };
}

/** Accepts any (possibly older or partially hand-written) payload. */
export function normalizeScene2D(raw: unknown): Scene2D {
  const base = createScene2D();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  const objects = Array.isArray(d.objects)
    ? (d.objects.map(normalizeObject).filter(Boolean) as SceneObject2D[])
    : [];
  const g = (d.grid ?? {}) as Record<string, unknown>;
  const sp = (d.snap ?? {}) as Record<string, unknown>;
  const v = (d.view ?? {}) as Record<string, unknown>;
  const gu = (d.guides ?? {}) as Record<string, unknown>;
  const ws = (d.windowSize ?? {}) as Record<string, unknown>;
  const vis = d.gridVisibility;
  return {
    objects,
    selectedId: typeof d.selectedId === "string" ? d.selectedId : null,
    grid: {
      offset: vec2(g.offset, 0, 0),
      step: vec2(g.step, 16, 16).map((n) => Math.max(1, n)) as Vec2,
      primary: Math.max(1, Math.round(num(g.primary, 8))),
      multiplier: Math.max(-4, Math.min(4, Math.round(num(g.multiplier, 0)))),
    },
    snap: {
      smart: bool(sp.smart, base.snap.smart),
      grid: bool(sp.grid, base.snap.grid),
      otherNodes: bool(sp.otherNodes, base.snap.otherNodes),
      guides: bool(sp.guides, base.snap.guides),
      snapRelative: bool(sp.snapRelative, base.snap.snapRelative),
      snapPixel: bool(sp.snapPixel, base.snap.snapPixel),
      rotationSnap: bool(sp.rotationSnap, base.snap.rotationSnap),
      scaleSnap: bool(sp.scaleSnap, base.snap.scaleSnap),
      rotationOffset: num(sp.rotationOffset, 0),
      rotationStep: Math.max(1, num(sp.rotationStep, 15)),
      scaleStep: Math.max(0.01, num(sp.scaleStep, 0.1)),
    },
    view: {
      x: num(v.x, 0),
      y: num(v.y, 0),
      zoom: Math.max(0.05, Math.min(64, num(v.zoom, 1))),
    },
    guides: {
      v: Array.isArray(gu.v) ? gu.v.filter((n): n is number => typeof n === "number") : [],
      h: Array.isArray(gu.h) ? gu.h.filter((n): n is number => typeof n === "number") : [],
    },
    gridVisibility: vis === "snapping" || vis === "never" ? vis : "always",
    showRulers: bool(d.showRulers, true),
    showHelpers: bool(d.showHelpers, true),
    windowSize: {
      width: Math.max(1, num(ws.width, 1152)),
      height: Math.max(1, num(ws.height, 648)),
    },
  };
}

export function deserializeScene2D(json: string): Scene2D {
  try {
    return normalizeScene2D(JSON.parse(json));
  } catch {
    return createScene2D();
  }
}

export { RULER as RULER_WIDTH };
