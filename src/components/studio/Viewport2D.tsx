// Viewport2D.tsx — the 2D Canvas Item Editor, modelled on Godot's editor.
//
// Faithful to godotengine/godot's editor/scene/canvas_item_editor_plugin:
//   Tools      Select(Q) Move(W) Rotate(E) Scale(S) Ruler(R) Pan(G or Space)
//   Zoom       Ctrl+= / Ctrl+- / Ctrl+0, zoom widget, zoom at cursor, middle-drag
//   Grid       offset / step / primary lines / 2^multiplier / visibility modes
//   Snapping   Smart Snap(Shift+S) Grid Snap(Shift+G) rotation, scale, relative,
//              pixel, and snap-to-other-nodes / guides
//   Selection  click, Shift/Ctrl toggle, box-select, multi-transform, node lock
//   View       rulers (16px), drag-out guides, F center, Shift+F frame
//   Pivot      rotation/scale pivot drag (Godot's edit pivot)
//   Undo       transforms commit once per drag (Godot's _commit_drag)
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createRect,
  createSprite,
  createText,
  findObject,
  gridStepPx,
  objectBounds,
  patchTransform,
  selIdsOf,
  snapAngle2D,
  TOOL_KEYS,
  TOOL_LABELS,
  type Tool2D,
  snapPoint2D,
  snapScale2D,
  RULER_WIDTH,
  type Scene2D,
  type SceneObject2D,
  type Vec2,
  type SnapHint,
} from "@/lib/scene2d";
import {
  makeXform,
  tickInterval,
  loadImage,
  applyTransform,
  gridVisible,
  localToWorld,
  worldToLocal,
  zoomAtPoint,
  type Xform,
} from "@/lib/viewport2dDraw";

interface Props {
  scene: Scene2D;
  tool: Tool2D;
  onToolChange: (t: Tool2D) => void;
  onSelect: (id: string | null) => void;
  onSelectMany: (ids: string[]) => void;
  /** Live update (viewport moves) — does NOT create an undo step. */
  onChange: (patch: (s: Scene2D) => Scene2D) => void;
  /** Structural change or end-of-drag — creates one undo step. */
  onCommit: (patch?: (s: Scene2D) => Scene2D) => void;
  onDeleteSelected?: () => void;
  localSpace?: boolean;
}

type Drag =
  | { kind: "none" }
  | { kind: "pan"; last: [number, number] }
  | {
      kind: "move";
      startWorld: Vec2;
      /** per-node snapshot, so each drag sets an absolute (not cumulative) pose */
      starts: Array<{ id: string; position: Vec2 }>;
      axis: "x" | "y" | null;
      moved: boolean;
    }
  | {
      kind: "rotate";
      startAngle: number;
      pivot: Vec2;
      startRot: number;
      pivotOffset: Vec2 | null;
      moved: boolean;
    }
  | {
      kind: "scale";
      pivot: Vec2;
      startDist: number;
      axes: "x" | "y" | "both";
      startScale: Vec2;
      moved: boolean;
    }
  | { kind: "box"; startWorld: Vec2; cur: Vec2; additive: boolean }
  | { kind: "guide"; axis: "x" | "y"; at: number }
  | { kind: "pivot"; startLocal: Vec2; moved: boolean }
  | { kind: "ruler"; from: Vec2; to: Vec2 };

const HANDLE_PX = 8;
const AXIS_LEN = 72;

export function Viewport2D({
  scene,
  tool,
  onToolChange,
  onSelect,
  onSelectMany,
  onChange,
  onCommit,
  onDeleteSelected,
  localSpace = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [drag, setDrag] = useState<Drag>({ kind: "none" });
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ sx: number; sy: number; world: Vec2 } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const dragRef = useRef<Drag>({ kind: "none" });
  const sizeRef = useRef(size);
  const sceneRef = useRef(scene);
  const redrawRef = useRef<() => void>(() => {});

  dragRef.current = drag;
  sizeRef.current = size;
  sceneRef.current = scene;

  const xform: Xform = useMemo(
    () => makeXform(scene.view, size.w - RULER_WIDTH, size.h - RULER_WIDTH),
    [scene.view, size.w, size.h],
  );
  const xfRef = useRef(xform);
  xfRef.current = xform;

  const ids = selIdsOf(scene);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const snapOf = (world: Vec2, selfId: string | null, invert: boolean) =>
    snapPoint2D(sceneRef.current, world, {
      selfId,
      invertSmart: invert,
      zoom: sceneRef.current.view.zoom,
    });


  /* ---------------------------------------------------------------- sizing */

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ----------------------------------------------------------- view/zoom */

  const setView = useCallback(
    (next: Partial<Scene2D["view"]>) => {
      onChange((s) => {
        const v = { ...s.view, ...next };
        v.zoom = Math.max(0.05, Math.min(64, v.zoom));
        return { ...s, view: v };
      });
    },
    [onChange],
  );

  const zoomAt = useCallback(
    (factor: number, screen?: [number, number]) => {
      const W = Math.max(1, sizeRef.current.w - RULER_WIDTH);
      const H = Math.max(1, sizeRef.current.h - RULER_WIDTH);
      const px = screen ? screen[0] - RULER_WIDTH : W / 2;
      const py = screen ? screen[1] - RULER_WIDTH : H / 2;
      setView(zoomAtPoint(sceneRef.current.view, factor, px, py, W, H));
    },
    [setView],
  );

  const selectionBounds = useCallback(() => {
    const sc = sceneRef.current;
    const sel = selIdsOf(sc).map((id) => findObject(sc, id)).filter(Boolean) as SceneObject2D[];
    const list = sel.length ? sel : sc.objects;
    if (!list.length) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const o of list) {
      const [[a, b], [c, d]] = objectBounds(o);
      x0 = Math.min(x0, a);
      y0 = Math.min(y0, b);
      x1 = Math.max(x1, c);
      y1 = Math.max(y1, d);
    }
    return { x0, y0, x1, y1 };
  }, []);

  const centerSelection = useCallback(() => {
    const b = selectionBounds();
    if (!b) return;
    setView({ x: -(b.x0 + b.x1) / 2, y: -(b.y0 + b.y1) / 2 });
  }, [selectionBounds, setView]);

  const frameSelection = useCallback(() => {
    const b = selectionBounds();
    if (!b) return;
    const W = Math.max(1, sizeRef.current.w - RULER_WIDTH);
    const H = Math.max(1, sizeRef.current.h - RULER_WIDTH);
    const zoom = Math.max(0.05, Math.min(64, Math.min(W / (b.x1 - b.x0 + 80), H / (b.y1 - b.y0 + 80))));
    setView({ x: -(b.x0 + b.x1) / 2, y: -(b.y0 + b.y1) / 2, zoom });
  }, [selectionBounds, setView]);

  /* --------------------------------------------------------------- helpers */

  const screenOf = useCallback((e: { clientX: number; clientY: number }): [number, number] => {
    const c = canvasRef.current;
    if (!c) return [0, 0];
    const r = c.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }, []);

  const worldOf = useCallback((s: [number, number]): Vec2 => {
    const xf = xfRef.current;
    return [xf.wx(s[0] - RULER_WIDTH), xf.wy(s[1] - RULER_WIDTH)];
  }, []);

  const toScreen = useCallback((p: Vec2): [number, number] => {
    const xf = xfRef.current;
    return [xf.sx(p[0]) + RULER_WIDTH, xf.sy(p[1]) + RULER_WIDTH];
  }, []);

  const hitTest = useCallback((world: Vec2): string | null => {
    const sc = sceneRef.current;
    const list = sc.objects
      .filter((o) => o.visible && !o.locked) // Godot's node lock
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex);
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      const local = worldToLocal(o, world[0], world[1]);
      if (Math.abs(local[0]) <= o.width / 2 && Math.abs(local[1]) <= o.height / 2) return o.id;
    }
    return null;
  }, []);

  /** World pivot of the primary selected node. */
  const pivotWorld = useCallback((): Vec2 => {
    const sc = sceneRef.current;
    const primary = findObject(sc, selIdsOf(sc)[0]);
    if (!primary) return [0, 0];
    const p = localToWorld(primary, primary.pivot[0], primary.pivot[1]);
    return p;
  }, []);

  /** Snapshot every selected node's position at drag start (Godot's prev_xform). */
  const snapshotStarts = (sc: Scene2D) =>
    selIdsOf(sc).map((id) => {
      const o = findObject(sc, id);
      return { id, position: [...(o ? o.transform.position : [0, 0])] as Vec2 };
    });


  /* -------------------------------------------------------------- drawing */

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = sizeRef.current.w;
    const H = sizeRef.current.h;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const sc = sceneRef.current;
    const xf = makeXform(sc.view, W - RULER_WIDTH, H - RULER_WIDTH);
    const vw = W - RULER_WIDTH;
    const vh = H - RULER_WIDTH;
    const stepPx = gridStepPx(sc.grid);

    // rulers sit on top; the canvas area starts at the ruler strip
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(RULER_WIDTH, RULER_WIDTH, vw, vh);

    ctx.save();
    ctx.translate(RULER_WIDTH, RULER_WIDTH);
    ctx.beginPath();
    ctx.rect(0, 0, vw, vh);
    ctx.clip();

    if (gridVisible(sc, sc.snap.grid)) drawGrid(ctx, xf, vw, vh, sc, stepPx);
    drawGuides(ctx, xf, vw, vh, sc);
    drawWindowRect(ctx, xf, sc);
    drawObjects(ctx, xf, sc, idsRef.current, hover);
    drawSelection(ctx, toScreen, sc, idsRef.current, tool, localSpace, spaceHeld);
    drawSnapHints(ctx, toScreen, drag);
    if (drag.kind === "box") drawBox(ctx, toScreen, drag.startWorld, drag.cur);
    if (drag.kind === "ruler") drawRulerTool(ctx, toScreen, drag.from, drag.to);
    if (drag.kind === "guide") drawGuideGhost(ctx, toScreen, drag.axis, drag.at);
    ctx.restore();

    drawRulers(ctx, W, H, xf, sc);
  }, [drag, hover, localSpace, spaceHeld, toScreen, tool]);

  redrawRef.current = draw;
  useEffect(() => {
    draw();
  }, [draw, scene, size]);
  useEffect(() => {
    const onR = () => redrawRef.current();
    window.addEventListener("resize", onR);
    window.addEventListener("2d-node-redraw", onR);
    return () => {
      window.removeEventListener("resize", onR);
      window.removeEventListener("2d-node-redraw", onR);
    };
  }, []);

  /* -------------------------------------------------------------- pointers */

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    // Pointer capture keeps a drag alive outside the canvas (not available in jsdom).
    if (typeof c.setPointerCapture === "function" && e.pointerId != null) {
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be released */
      }
    }
    c.focus();
    const s = screenOf(e);
    const world = worldOf(s);
    const sc = sceneRef.current;
    setMenu(null);

    // --- rulers: drag out a guide ---
    if (s[0] < RULER_WIDTH && s[1] >= RULER_WIDTH) {
      const snapped = snapOf(world, null, false).point;
      setDrag({ kind: "guide", axis: "x", at: snapped[0] });
      return;
    }
    if (s[1] < RULER_WIDTH && s[0] >= RULER_WIDTH) {
      const snapped = snapOf(world, null, false).point;
      setDrag({ kind: "guide", axis: "y", at: snapped[1] });
      return;
    }

    if (e.button === 1 || spaceHeld || tool === "pan") {
      setDrag({ kind: "pan", last: s });
      return;
    }
    if (e.button === 2) {
      setMenu({ sx: s[0], sy: s[1], world });
      return;
    }

    const sel = selIdsOf(sc);
    const primary = findObject(sc, sel[0]);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const invert = e.ctrlKey || e.metaKey;

    // --- gizmo handles of the current selection ---
    if (sel.length && sc.showHelpers && primary) {
      const pv = localToWorld(primary, primary.pivot[0], primary.pivot[1]);
      const pivotMoved = primary.pivot[0] !== 0 || primary.pivot[1] !== 0;
      // Godot's edit pivot is only drag-enabled once it is off the origin, so
      // clicking a node's centre in Select mode still moves it.
      if (pivotMoved && dist2(toScreen(pv), s) <= HANDLE_PX + 3) {
        const local = worldToLocal(primary, world[0], world[1]);
        setDrag({ kind: "pivot", startLocal: local, moved: false });
        return;
      }
      for (const h of handlesFor(primary, tool, localSpace, sc.view.zoom)) {
        if (dist2(toScreen(localToWorld(primary, h.local[0], h.local[1])), s) <= HANDLE_PX + 2) {
          if (h.kind === "axis") {
            setDrag({ kind: "move", startWorld: world, starts: snapshotStarts(sc), axis: h.axis ?? null, moved: false });
          } else if (h.kind === "corner" || h.kind === "edge") {
            setDrag({
              kind: "scale",
              pivot: pv,
              startDist: Math.max(0.001, dist2(world, pv)),
              axes: h.scaleAxes,
              startScale: primary.transform.scale,
              moved: false,
            });
          } else {
            setDrag({
              kind: "rotate",
              startAngle: Math.atan2(world[1] - pv[1], world[0] - pv[0]),
              pivot: pv,
              startRot: primary.transform.rotation,
              pivotOffset: null,
              moved: false,
            });
          }
          return;
        }
      }
    }

    if (tool === "ruler") {
      setDrag({ kind: "ruler", from: world, to: world });
      return;
    }

    const hitId = hitTest(world);
    if (hitId) {
      if (invert && tool === "select") {
        // Godot select mode: Ctrl+drag rotates the clicked node.
        const obj = findObject(sc, hitId) as SceneObject2D;
        const pivot: Vec2 = [obj.transform.position[0] + obj.pivot[0], obj.transform.position[1] + obj.pivot[1]];
        setDrag({
          kind: "rotate",
          startAngle: Math.atan2(world[1] - pivot[1], world[0] - pivot[0]),
          pivot,
          startRot: obj.transform.rotation,
          pivotOffset: null,
          moved: false,
        });
        if (additive && !sel.includes(hitId)) onSelectMany([...sel, hitId]);
        else if (!sel.includes(hitId)) onSelect(hitId);
        return;
      }
      if (additive) {
        if (!sel.includes(hitId)) onSelectMany([...sel, hitId]);
        setDrag({ kind: "move", startWorld: world, starts: snapshotStarts(sc), axis: null, moved: false });
        return;
      }
      if (!sel.includes(hitId)) onSelect(hitId);
      setDrag({ kind: "move", startWorld: world, starts: snapshotStarts(sc), axis: null, moved: false });
      return;
    }

    if (!additive) onSelect(null);
    setDrag({ kind: "box", startWorld: world, cur: world, additive });
  };


  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = screenOf(e);
    const world = worldOf(s);
    const d = dragRef.current;

    if (d.kind === "none") {
      const hit = hitTest(world);
      setHover((h) => (h === hit ? h : hit));
      return;
    }

    if (d.kind === "pan") {
      const dx = s[0] - d.last[0];
      const dy = s[1] - d.last[1];
      setView({ x: sceneRef.current.view.x + dx / sceneRef.current.view.zoom, y: sceneRef.current.view.y + dy / sceneRef.current.view.zoom });
      setDrag({ kind: "pan", last: s });
      return;
    }
    if (d.kind === "guide") {
      const snapped = snapOf(world, null, false).point;
      setDrag({ kind: "guide", axis: d.axis, at: d.axis === "x" ? snapped[0] : snapped[1] });
      return;
    }
    if (d.kind === "box") {
      setDrag({ ...d, cur: world });
      return;
    }
    if (d.kind === "ruler") {
      const snapped = snapOf(world, null, false).point;
      setDrag({ ...d, to: snapped });
      return;
    }
    if (d.kind === "pivot") {
      const obj = findObject(sceneRef.current, idsRef.current[0]);
      if (!obj) return;
      const snapped = snapOf(world, obj.id, false).point;
      onChange((sc) => ({
        ...sc,
        objects: sc.objects.map((o) => (o.id === obj.id ? { ...o, pivot: worldToLocal(o, snapped[0], snapped[1]) } : o)),
      }));
      return;
    }

    if (d.kind === "move") {
      // The primary's target position is snapped; every other selected node
      // moves by the same delta (Godot's multi-node translate).
      const start = d.starts.find((x) => x.id === idsRef.current[0]) ?? d.starts[0];
      const want: Vec2 = [start.position[0] + (world[0] - d.startWorld[0]), start.position[1] + (world[1] - d.startWorld[1])];
      const { point, hints } = snapOf(want, start.id, false);
      const next: Vec2 = d.axis === "x" ? [point[0], start.position[1]] : d.axis === "y" ? [start.position[0], point[1]] : point;
      const delta: Vec2 = [next[0] - start.position[0], next[1] - start.position[1]];
      onChange((s2) => ({
        ...s2,
        objects: s2.objects.map((o) => {
          const st = d.starts.find((x) => x.id === o.id);
          if (!st) return o;
          return {
            ...o,
            transform: { ...o.transform, position: [st.position[0] + delta[0], st.position[1] + delta[1]] as Vec2 },
          };
        }),
      }));
      const nd = { ...d, moved: true } as unknown as { moved: boolean; hints?: SnapHint[] };
      nd.hints = hints;
      setDrag(nd as unknown as Drag);
      return;
    }

    if (d.kind === "rotate") {
      const angle = Math.atan2(world[1] - d.pivot[1], world[0] - d.pivot[0]);
      let deg = d.startRot + ((angle - d.startAngle) * 180) / Math.PI;
      deg = snapAngle2D(sceneRef.current, deg, false);
      onChange((s2) => ({
        ...s2,
        objects: s2.objects.map((o) => (o.id === idsRef.current[0] ? patchTransform(s2, o.id, { rotation: deg }).objects[0] : o)),
      }));
      setDrag({ ...d, moved: true });
      return;
    }

    if (d.kind === "scale") {
      const f = Math.max(0.001, dist2(world, d.pivot) / d.startDist);
      const raw = snapScale2D(sceneRef.current, [f, f], false);
      const sx = d.axes === "y" ? d.startScale[0] : Math.max(0.05, d.startScale[0] * raw[0]);
      const sy = d.axes === "x" ? d.startScale[1] : Math.max(0.05, d.startScale[1] * raw[1]);
      onChange((s2) => ({
        ...s2,
        objects: s2.objects.map((o) => (o.id === idsRef.current[0] ? { ...o, transform: { ...o.transform, scale: [sx, sy] as Vec2 } } : o)),
      }));
      setDrag({ ...d, moved: true });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    const c = canvasRef.current;
    if (typeof c?.hasPointerCapture === "function" && c?.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
    if (d.kind === "none") return;

    if (d.kind === "box") {
      const x0 = Math.min(d.startWorld[0], d.cur[0]);
      const x1 = Math.max(d.startWorld[0], d.cur[0]);
      const y0 = Math.min(d.startWorld[1], d.cur[1]);
      const y1 = Math.max(d.startWorld[1], d.cur[1]);
      const inside = sceneRef.current.objects
        .filter((o) => o.visible && !o.locked)
        .filter((o) => {
          const [[a, b], [c2, dd]] = objectBounds(o);
          return a <= x1 && c2 >= x0 && b <= y1 && dd >= y0;
        })
        .map((o) => o.id);
      const prev = d.additive ? selIdsOf(sceneRef.current) : [];
      onSelectMany(inside.length ? Array.from(new Set([...prev, ...inside])) : []);
      if (!inside.length) onSelect(null);
    } else if (d.kind === "guide") {
      const at = d.at;
      const axis = d.axis;
      onCommit((sc) => ({
        ...sc,
        guides: axis === "x" ? { ...sc.guides, v: [...sc.guides.v, at] } : { ...sc.guides, h: [...sc.guides.h, at] },
      }));
    } else if ("moved" in d && d.moved) {
      onCommit();
    }
    setDrag({ kind: "none" });
  };


  /* ------------------------------------------------------------- keyboard */

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const k = e.key.toLowerCase();
    // Undo/redo is owned by the Studio (window-level) handler.
    if ((e.ctrlKey || e.metaKey) && k === "z") return;
    if ((e.ctrlKey || e.metaKey) && (k === "=" || k === "+")) {
      e.preventDefault();
      zoomAt(1.2);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === "-") {
      e.preventDefault();
      zoomAt(1 / 1.2);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === "0") {
      e.preventDefault();
      setView({ x: 0, y: 0, zoom: 1 });
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (TOOL_KEYS[k]) {
      e.preventDefault();
      onToolChange(TOOL_KEYS[k]);
      return;
    }
    switch (e.key) {
      case "f":
        e.preventDefault();
        centerSelection();
        break;
      case "F":
        e.preventDefault();
        frameSelection();
        break;
      case "y":
        e.preventDefault();
        onCommit((sc) => ({ ...sc, guides: { v: [], h: [] } }));
        break;
      case "h":
        e.preventDefault();
        onCommit((sc) => ({ ...sc, showHelpers: !sc.showHelpers }));
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        onDeleteSelected?.();
        break;
      case "Escape":
        setMenu(null);
        onSelect(null);
        break;
      case "*":
        onCommit((sc) => ({ ...sc, grid: { ...sc.grid, multiplier: Math.max(-4, sc.grid.multiplier - 1) } }));
        break;
      case "/":
        onCommit((sc) => ({ ...sc, grid: { ...sc.grid, multiplier: Math.min(4, sc.grid.multiplier + 1) } }));
        break;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        e.preventDefault();
        const nudge = e.shiftKey ? gridStepPx(scene.grid)[0] : 1;
        const dx = e.key === "ArrowLeft" ? -nudge : e.key === "ArrowRight" ? nudge : 0;
        const dy = e.key === "ArrowUp" ? -nudge : e.key === "ArrowDown" ? nudge : 0;
        onCommit((sc) => ({
          ...sc,
          objects: sc.objects.map((o) =>
            selIdsOf(sc).includes(o.id)
              ? { ...o, transform: { ...o.transform, position: [o.transform.position[0] + dx, o.transform.position[1] + dy] as Vec2 } }
              : o,
          ),
        }));
        break;
      }
      default:
        break;
    }
  };

  // Space is Godot's temporary pan modifier.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " ") setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* --------------------------------------------------------------- events */

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, screenOf(e));
      return;
    }
    e.preventDefault();
    if (e.shiftKey) setView({ x: scene.view.x + e.deltaY / scene.view.zoom });
    else setView({ y: scene.view.y + e.deltaY / scene.view.zoom });
  };

  /* --------------------------------------------------------- context menu */

  const addAt = (kind: "rect" | "sprite" | "text") => {
    const at: Vec2 = menu ? menu.world : [0, 0];
    onCommit((s) => {
      const base =
        kind === "rect"
          ? createRect("Rect", at[0], at[1])
          : kind === "sprite"
            ? createSprite("Sprite", "", at[0], at[1])
            : createText("Label", "Text", at[0], at[1]);
      const top = s.objects.reduce((m, o2) => Math.max(m, o2.zIndex), 0);
      const node = { ...base, zIndex: top + 1 };
      return { ...s, objects: [...s.objects, node], selectedId: node.id, selectedIds: [node.id] };
    });
    setMenu(null);
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close, { once: true });
    window.addEventListener("keydown", close, { once: true });
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);


  /* ----------------------------------------------------------------- JSX */

  const stepPx = gridStepPx(scene.grid);
  const status = [
    `${TOOL_LABELS[tool].label} (${TOOL_LABELS[tool].key})`,
    `${Math.round(scene.view.zoom * 100)}%`,
    `grid ${Math.round(stepPx[0])}px`,
    `smart ${scene.snap.smart ? "on" : "off"}`,
    `grid-snap ${scene.snap.grid ? "on" : "off"}`,
    spaceHeld ? "panning" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#2b2b2b]" data-2d-viewport>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block h-full w-full outline-none"
        style={{ cursor: tool === "pan" || spaceHeld ? "grab" : tool === "ruler" ? "crosshair" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      />
      {menu && (
        <div
          className="absolute z-30 min-w-[168px] rounded-[3px] border border-black bg-[#303030] py-1 text-[11px] text-[#d0d0d0] shadow-xl"
          style={{ left: menu.sx, top: menu.sy }}
        >
          <CtxItem label="Add Rect Node" onClick={() => addAt("rect")} />
          <CtxItem label="Add Sprite Node" onClick={() => addAt("sprite")} />
          <CtxItem label="Add Text Label" onClick={() => addAt("text")} />
          <div className="my-1 h-px bg-[#1d1d1d]" />
          <CtxItem
            label="Move Selected Here"
            disabled={!ids.length}
            onClick={() => {
              onCommit((sc) => ({
                ...sc,
                objects: sc.objects.map((o) =>
                  ids.includes(o.id)
                    ? { ...o, transform: { ...o.transform, position: [menu.world[0], menu.world[1]] as Vec2 } }
                    : o,
                ),
              }));
              setMenu(null);
            }}
          />
          <CtxItem
            label="Delete Selected"
            disabled={!ids.length}
            onClick={() => {
              onDeleteSelected?.();
              setMenu(null);
            }}
          />
          <div className="my-1 h-px bg-[#1d1d1d]" />
          <CtxItem label="Center Selection (F)" onClick={() => { centerSelection(); setMenu(null); }} />
          <CtxItem label="Frame Selection (Shift+F)" onClick={() => { frameSelection(); setMenu(null); }} />
          <div className="my-1 h-px bg-[#1d1d1d]" />
          <CtxItem label="Clear Guides (Y)" onClick={() => { onCommit((sc) => ({ ...sc, guides: { v: [], h: [] } })); setMenu(null); }} />
          <CtxItem
            label={scene.snap.grid ? "Grid Snap: Off" : "Grid Snap: On"}
            onClick={() => {
              onCommit((sc) => ({ ...sc, snap: { ...sc.snap, grid: !sc.snap.grid } }));
              setMenu(null);
            }}
          />
          <CtxItem
            label={scene.snap.smart ? "Smart Snap: Off" : "Smart Snap: On"}
            onClick={() => {
              onCommit((sc) => ({ ...sc, snap: { ...sc.snap, smart: !sc.snap.smart } }));
              setMenu(null);
            }}
          />
        </div>
      )}
      <div className="pointer-events-none absolute bottom-1 left-[18px] rounded bg-[#1f1f1f]/80 px-2 text-[10px] text-[#9a9a9a]">
        {status}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- primitives */

function CtxItem({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full px-3 py-1 text-left hover:bg-[#4772b3] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}

const dist2 = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

interface Handle {
  local: Vec2;
  kind: "axis" | "corner" | "edge" | "rotate";
  axis: "x" | "y" | null;
  scaleAxes: "x" | "y" | "both";
}

/** Godot's per-tool handles, in node-local space. */
function handlesFor(o: SceneObject2D, tool: string, localSpace: boolean, zoom = 1): Handle[] {
  const w = o.width / 2;
  const h = o.height / 2;
  // Axis grips sit a fixed *screen* distance from the origin so they stay
  // clickable at any zoom (Godot draws its axis gizmos in screen space).
  const axisLen = AXIS_LEN / Math.max(0.05, zoom);
  if (tool === "move") {
    const out: Handle[] = [
      { local: [0, 0], kind: "axis", axis: null, scaleAxes: "both" },
    ];
    if (localSpace) {
      out.push({ local: [axisLen, 0], kind: "axis", axis: "x", scaleAxes: "x" });
      out.push({ local: [0, axisLen], kind: "axis", axis: "y", scaleAxes: "y" });
    }
    return out;
  }
  if (tool === "scale") {
    return [
      { local: [-w, -h], kind: "corner", axis: null, scaleAxes: "both" },
      { local: [w, -h], kind: "corner", axis: null, scaleAxes: "both" },
      { local: [w, h], kind: "corner", axis: null, scaleAxes: "both" },
      { local: [-w, h], kind: "corner", axis: null, scaleAxes: "both" },
      { local: [0, -h], kind: "edge", axis: null, scaleAxes: "y" },
      { local: [w, 0], kind: "edge", axis: null, scaleAxes: "x" },
      { local: [0, h], kind: "edge", axis: null, scaleAxes: "y" },
      { local: [-w, 0], kind: "edge", axis: null, scaleAxes: "x" },
    ];
  }
  if (tool === "rotate") return [{ local: [w, 0], kind: "rotate", axis: null, scaleAxes: "both" }];
  // Select mode: red circles on the corners (Godot's scale grips).
  return [
    { local: [-w, -h], kind: "corner", axis: null, scaleAxes: "both" },
    { local: [w, -h], kind: "corner", axis: null, scaleAxes: "both" },
    { local: [w, h], kind: "corner", axis: null, scaleAxes: "both" },
    { local: [-w, h], kind: "corner", axis: null, scaleAxes: "both" },
  ];
}


/* ---------------------------------------------------------------- drawing */

const GRID_COLOR = "#3a3a3a";
const GRID_MAJOR = "#484848";
const GUIDE_COLOR = "#00e0a4";
const SEL_COLOR = "#f4982b";
const HOVER_COLOR = "#9fc7ff";

function drawGrid(
  ctx: CanvasRenderingContext2D,
  xf: Xform,
  w: number,
  h: number,
  scene: Scene2D,
  step: Vec2,
) {
  const z = xf.zoom;
  const primaryEvery = scene.grid.primary;
  // first visible world coordinate
  const x0 = xf.wx(0);
  const y0 = xf.wy(0);
  const offsetX = scene.grid.offset[0];
  const offsetY = scene.grid.offset[1];
  const kx0 = Math.floor((x0 - offsetX) / step[0]);
  const kx1 = Math.ceil((xf.wx(w) - offsetX) / step[0]);
  const ky0 = Math.floor((y0 - offsetY) / step[1]);
  const ky1 = Math.ceil((xf.wy(h) - offsetY) / step[1]);
  ctx.lineWidth = 1;
  for (let k = kx0; k <= kx1; k++) {
    const worldX = offsetX + k * step[0];
    const sx = xf.sx(worldX);
    ctx.strokeStyle = k % primaryEvery === 0 ? GRID_MAJOR : GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(sx, xf.sy(y0));
    ctx.lineTo(sx, xf.sy(y0 + h / z));
    ctx.stroke();
  }
  for (let k = ky0; k <= ky1; k++) {
    const worldY = offsetY + k * step[1];
    const sy = xf.sy(worldY);
    ctx.strokeStyle = k % primaryEvery === 0 ? GRID_MAJOR : GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(xf.sx(x0), sy);
    ctx.lineTo(xf.sx(x0 + w / z), sy);
    ctx.stroke();
  }
  // origin axes
  ctx.strokeStyle = "#5a5a5a";
  ctx.beginPath();
  ctx.moveTo(0, xf.sy(0));
  ctx.lineTo(w, xf.sy(0));
  ctx.moveTo(xf.sx(0), 0);
  ctx.lineTo(xf.sx(0), h);
  ctx.stroke();
}

function drawGuides(ctx: CanvasRenderingContext2D, xf: Xform, w: number, h: number, scene: Scene2D) {
  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (const gx of scene.guides.v) {
    const sx = xf.sx(gx);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  }
  for (const gy of scene.guides.h) {
    const sy = xf.sy(gy);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWindowRect(ctx: CanvasRenderingContext2D, xf: Xform, scene: Scene2D) {
  const { width, height } = scene.windowSize;
  const x = xf.sx(0);
  const y = xf.sy(0);
  const w = width * xf.zoom;
  const h = height * xf.zoom;
  ctx.save();
  ctx.strokeStyle = "#6b6b6b";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(120,170,255,0.06)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawObjects(
  ctx: CanvasRenderingContext2D,
  xf: Xform,
  scene: Scene2D,
  selectedIds: string[],
  hoverId: string | null,
) {
  const list = scene.objects.slice().sort((a, b) => a.zIndex - b.zIndex);
  // hover highlight first so it sits under objects
  if (hoverId) {
    const o = scene.objects.find((x) => x.id === hoverId);
    if (o) {
      const p = localToWorld(o, 0, 0);
      ctx.save();
      ctx.strokeStyle = HOVER_COLOR;
      ctx.lineWidth = 1.5 / xf.zoom;
      ctx.setLineDash([3 / xf.zoom, 3 / xf.zoom]);
      ctx.translate(p[0], p[1]);
      ctx.rotate((o.transform.rotation * Math.PI) / 180);
      ctx.strokeRect(-o.width / 2, -o.height / 2, o.width, o.height);
      ctx.restore();
    }
  }
  for (const o of list) {
    if (!o.visible) continue;
    ctx.save();
    applyTransform(ctx, o);
    if (o.kind === "rect") {
      ctx.fillStyle = o.color || "#4f8cff";
      ctx.fillRect(-o.width / 2, -o.height / 2, o.width, o.height);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1 / xf.zoom;
      ctx.strokeRect(-o.width / 2, -o.height / 2, o.width, o.height);
    } else if (o.kind === "sprite") {
      if (o.src) {
        const img = loadImage(o.src);
        if (img) ctx.drawImage(img, -o.width / 2, -o.height / 2, o.width, o.height);
      } else {
        ctx.fillStyle = "#5a6472";
        ctx.fillRect(-o.width / 2, -o.height / 2, o.width, o.height);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1 / xf.zoom;
        ctx.beginPath();
        ctx.moveTo(-o.width / 2, o.height / 2);
        ctx.lineTo(o.width / 2, -o.height / 2);
        ctx.moveTo(-o.width / 2, -o.height / 2);
        ctx.lineTo(o.width / 2, o.height / 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = o.color || "#fff";
      ctx.font = `${o.height}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(o.text || "Text", -o.width / 2, 0);
    }
    ctx.restore();
  }
  // locked / invisible node markers (Godot draws helpers)
  if (scene.showHelpers) {
    for (const o of scene.objects) {
      if (!o.visible) {
        const p = localToWorld(o, 0, 0);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#b0b0b0";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1 / xf.zoom;
        ctx.translate(p[0], p[1]);
        ctx.rotate((o.transform.rotation * Math.PI) / 180);
        ctx.strokeRect(-o.width / 2, -o.height / 2, o.width, o.height);
        ctx.restore();
      }
    }
  }
}


type ToScreen = (p: Vec2) => [number, number];

function drawSelection(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  scene: Scene2D,
  ids: string[],
  tool: string,
  localSpace: boolean,
  spaceHeld: boolean,
) {
  if (!scene.showHelpers || spaceHeld) return;
  for (const id of ids) {
    const o = scene.objects.find((x) => x.id === id);
    if (!o) continue;
    const corners = [
      localToWorld(o, -o.width / 2, -o.height / 2),
      localToWorld(o, o.width / 2, -o.height / 2),
      localToWorld(o, o.width / 2, o.height / 2),
      localToWorld(o, -o.width / 2, o.height / 2),
    ];
    ctx.save();
    ctx.strokeStyle = SEL_COLOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    corners.forEach((p, i) => {
      const s = toScreen(p);
      if (i === 0) ctx.moveTo(s[0], s[1]);
      else ctx.lineTo(s[0], s[1]);
    });
    ctx.closePath();
    ctx.stroke();

    // pivot cross
    const pv = toScreen(localToWorld(o, o.pivot[0], o.pivot[1]));
    ctx.beginPath();
    ctx.moveTo(pv[0] - 4, pv[1]);
    ctx.lineTo(pv[0] + 4, pv[1]);
    ctx.moveTo(pv[0], pv[1] - 4);
    ctx.lineTo(pv[0], pv[1] + 4);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#ffd166";
    ctx.stroke();

    // handles
    const handles = handlesFor(o, tool, localSpace, scene.view.zoom);
    for (const hd of handles) {
      const p = toScreen(localToWorld(o, hd.local[0], hd.local[1]));
      if (hd.kind === "axis" && hd.axis) {
        // arrow line from origin to the handle
        const c = toScreen(localToWorld(o, 0, 0));
        ctx.strokeStyle = hd.axis === "x" ? "#e05a5a" : "#5ad46a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = SEL_COLOR;
        ctx.strokeStyle = "#1d1d1d";
        ctx.lineWidth = 1;
        ctx.fillRect(p[0] - 3.2, p[1] - 3.2, 6.4, 6.4);
        ctx.strokeRect(p[0] - 3.2, p[1] - 3.2, 6.4, 6.4);
      }
    }
    ctx.restore();
  }
}

function drawSnapHints(ctx: CanvasRenderingContext2D, toScreen: ToScreen, drag: Drag) {
  const d = drag as unknown as { hints?: SnapHint[] };
  if (!d.hints?.length) return;
  ctx.save();
  ctx.strokeStyle = "#6cf0c8";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  for (const hint of d.hints) {
    if (hint.axis === "x") {
      const [x, y0] = toScreen([hint.at, 0]);
      ctx.beginPath();
      ctx.moveTo(x, y0 - 100000);
      ctx.lineTo(x, y0 + 100000);
      ctx.stroke();
    } else {
      const [x, y1] = toScreen([0, hint.at]);
      ctx.beginPath();
      ctx.moveTo(x - 100000, y1);
      ctx.lineTo(x + 100000, y1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBox(ctx: CanvasRenderingContext2D, toScreen: ToScreen, a: Vec2, b: Vec2) {
  const s0 = toScreen(a);
  const s1 = toScreen(b);
  ctx.save();
  ctx.fillStyle = "rgba(120,170,255,0.12)";
  ctx.strokeStyle = "#78aaff";
  ctx.lineWidth = 1;
  const x = Math.min(s0[0], s1[0]);
  const y = Math.min(s0[1], s1[1]);
  const w = Math.abs(s1[0] - s0[0]);
  const h = Math.abs(s1[1] - s0[1]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawGuideGhost(ctx: CanvasRenderingContext2D, toScreen: ToScreen, axis: "x" | "y", at: number) {
  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  const p = toScreen(axis === "x" ? [at, 0] : [0, at]);
  ctx.beginPath();
  if (axis === "x") {
    ctx.moveTo(p[0], 0);
    ctx.lineTo(p[0], 100000);
  } else {
    ctx.moveTo(0, p[1]);
    ctx.lineTo(100000, p[1]);
  }
  ctx.stroke();
  ctx.restore();
}

/** Godot's ruler tool: dx / dy / total + angles. */
function drawRulerTool(ctx: CanvasRenderingContext2D, toScreen: ToScreen, from: Vec2, to: Vec2) {
  const a = toScreen(from);
  const b = toScreen(to);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const total = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  for (const p of [a, b]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "11px system-ui";
  ctx.fillText(`dx ${dx.toFixed(0)}  dy ${dy.toFixed(0)}  |d| ${total.toFixed(0)}  ${angle.toFixed(1)}°`, a[0] + 10, a[1] - 8);
  ctx.restore();
}

/** Godot's rulers: numbered ticks, plus the current cursor readout. */
function drawRulers(ctx: CanvasRenderingContext2D, W: number, H: number, xf: Xform, scene: Scene2D) {
  if (!scene.showRulers) return;
  const R = RULER_WIDTH;
  ctx.save();
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, 0, W, R);
  ctx.fillRect(0, 0, R, H);
  ctx.fillStyle = "#202020";
  ctx.fillRect(0, 0, R, R);

  const step = tickInterval(gridStepPx(scene.grid)[0], xf.zoom, 46);
  const x0 = xf.wx(0);
  const y0 = xf.wy(0);
  const kx0 = Math.floor(x0 / step);
  const kx1 = Math.ceil(xf.wx(W - R) / step);
  const ky0 = Math.floor(y0 / step);
  const ky1 = Math.ceil(xf.wy(H - R) / step);

  ctx.strokeStyle = "#707070";
  ctx.fillStyle = "#9a9a9a";
  ctx.font = "9px system-ui";
  ctx.textBaseline = "top";
  ctx.beginPath();
  for (let k = kx0; k <= kx1; k++) {
    const x = xf.sx(k * step);
    if (k % 5 === 0) {
      ctx.moveTo(x, R - 6);
      ctx.lineTo(x, R);
      ctx.fillText(String(k), x + 2, 2);
    } else {
      ctx.moveTo(x, R - 3);
      ctx.lineTo(x, R);
    }
  }
  ctx.stroke();
  ctx.beginPath();
  for (let k = ky0; k <= ky1; k++) {
    const y = xf.sy(k * step);
    if (k % 5 === 0) {
      ctx.moveTo(R - 6, y);
      ctx.lineTo(R, y);
      ctx.save();
      ctx.translate(2, y + 2);
      ctx.fillText(String(k), 0, 0);
      ctx.restore();
    } else {
      ctx.moveTo(R - 3, y);
      ctx.lineTo(R, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

