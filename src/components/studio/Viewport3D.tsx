// Viewport3D.tsx — the 3D viewport for Nexstudio.
//
// A small, dependency-free software renderer that draws the editable scene
// from src/lib/scene3d.ts on a Blender-style grid. On top of the orbit/pan/
// zoom navigation it supports:
//
//   * object picking by clicking (ray cast against the mesh)
//   * a translate/rotate/scale gizmo matching the active tool
//   * a camera POV mode that renders through the active camera, and lets you
//     aim / move that camera and zoom its lens
//   * light and camera helpers drawn in the scene
//   * a 3D cursor that new objects spawn on
//   * edit mode vertex editing and sculpt-mode brushes
//
// Zoom works for every input device: mouse wheel, trackpad pinch (ctrl+wheel
// or the Safari gesture event) and two-finger touch. The wheel/pinch handlers
// live on the surrounding element (useBlenderInput) because they have to see
// events the canvas pointer capture would swallow; this file only keeps out of
// their way while a two-finger gesture is running.
//
// The camera maths lives in src/lib/viewportCam.ts (unit tested); this file
// only projects, shades and paints.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import {
  activeCamera,
  add as addVec,
  boundsSphere,
  cameraBasis,
  findObject,
  faceNormal,
  meshVertexNormals,
  normalize,
  objectBounds,
  pickObject,
  rayPlaneY,
  rotateEuler,
  scale as scaleVec,
  sceneBounds,
  selectNear,
  sub as subVec,
  toLocal,
  toLocalDir,
  toWorld,
  v3,
  type Scene,
  type SceneObject,
  type Vec3,
} from "@/lib/scene3d";
import {
  DEG,
  orbitEye,
  panDelta,
  projectPoint,
  rayThroughPixel,
  viewBasis,
  viewSource,
  type OrbitCam,
} from "@/lib/viewportCam";

export type ViewName = "front" | "back" | "left" | "right" | "top" | "bottom" | "camera";
export type TransformMode = "move" | "rotate" | "scale";

export interface Viewport3DTheme {
  bg: string;
  player: string;
  good: string;
  bad: string;
  accent: string;
  text: string;
}

const DEFAULT_THEME: Viewport3DTheme = {
  bg: "#2b2b2b",
  player: "#e0e0e0",
  good: "#8fc07f",
  bad: "#c05b5b",
  accent: "#4772b3",
  text: "#e0e0e0",
};

export interface Viewport3DHandle {
  setView: (view: ViewName) => void;
  frameAll: () => void;
  frameSelected: () => void;
  zoom: (factor: number) => void;
  orbit: (dx: number, dy: number) => void;
  pan: (dx: number, dy: number) => void;
  reset: () => void;
  /** Switches the viewport between the editor camera and the active camera. */
  setCameraPov: (on: boolean) => void;
}

export interface Viewport3DProps {
  scene: Scene;
  /** Object id under selection, or null. */
  selectedId: string | null;
  /** Vertex indices selected in edit mode. */
  selectedVertices: number[];
  /** "object" | "edit" | "sculpt" | "vertexpaint" */
  editMode: string;
  /** Active sculpt brush. */
  brush: string;
  /** Brush radius in world units. */
  brushRadius: number;
  brushStrength: number;
  /** Gizmo the active tool implies. */
  transformMode?: TransformMode;
  /** 3D cursor position, in world units. */
  cursor?: Vec3;
  /** True while the Cursor tool is active (clicks move the cursor). */
  cursorTool?: boolean;
  onSelectObject?: (id: string | null) => void;
  onSelectVertices?: (indices: number[]) => void;
  /** Called with the drag delta in world units, on the drag plane. */
  onTransform?: (delta: Vec3, mode: "move" | "rotate" | "scale") => void;
  onSculpt?: (localPoint: Vec3, delta: Vec3) => void;
  /** Drops the 3D cursor at a world point (Cursor tool). */
  onSetCursor?: (point: Vec3) => void;
  /** Renders through the active camera when set. */
  cameraPov?: boolean;
  /** POV mode: moves the active camera by a world-space delta. */
  onCameraMove?: (delta: Vec3) => void;
  /** POV mode: rotates the active camera, in degrees (yaw, then pitch). */
  onCameraOrbit?: (dYawDeg: number, dPitchDeg: number) => void;
  /** POV mode: zooms the active camera's lens (factor > 1 = narrower FOV). */
  onCameraZoom?: (factor: number) => void;
  theme?: Viewport3DTheme;
}

/** Everything the canvas handlers read, so they can stay attached once. */
interface PropsSnapshot {
  scene: Scene;
  selectedId: string | null;
  selectedVertices: number[];
  editMode: string;
  brush: string;
  brushRadius: number;
  brushStrength: number;
  transformMode: TransformMode;
  cursor?: Vec3;
  cursorTool: boolean;
  onSelectObject?: (id: string | null) => void;
  onSelectVertices?: (indices: number[]) => void;
  onTransform?: (delta: Vec3, mode: "move" | "rotate" | "scale") => void;
  onSculpt?: (localPoint: Vec3, delta: Vec3) => void;
  onSetCursor?: (point: Vec3) => void;
  cameraPov: boolean;
  onCameraMove?: (delta: Vec3) => void;
  onCameraOrbit?: (dYawDeg: number, dPitchDeg: number) => void;
  onCameraZoom?: (factor: number) => void;
}

interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
}

const HOME: Cam = { yaw: -0.7, pitch: -0.42, dist: 17, tx: 0, ty: 0.5, tz: 0 };
const HALF = 13;
const PITCH_MIN = -1.5;
const PITCH_MAX = 1.5;
/** Degrees of camera rotation per pixel of drag. */
const ORBIT_DEG_PER_PX = (0.009 * 180) / Math.PI;
/** Fixed FOV size the helpers use to gauge how big to draw themselves. */
const HELPERS: Vec3 = v3(0, 0, 0);

export const Viewport3D = forwardRef<Viewport3DHandle, Viewport3DProps>(function Viewport3D(
  {
    scene,
    selectedId,
    selectedVertices,
    editMode,
    brush,
    brushRadius,
    brushStrength,
    transformMode = "move",
    cursor,
    cursorTool = false,
    onSelectObject,
    onSelectVertices,
    onTransform,
    onSculpt,
    onSetCursor,
    cameraPov = false,
    onCameraMove,
    onCameraOrbit,
    onCameraZoom,
    theme = DEFAULT_THEME,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam>({ ...HOME });
  const focalRef = useRef(900);
  const drawRef = useRef<() => void>(() => {});
  const sizeRef = useRef({ w: 1, h: 1 });

  // Latest props for the canvas event handlers, which are attached once.
  const propsRef = useRef<PropsSnapshot>({
    scene,
    selectedId,
    selectedVertices,
    editMode,
    brush,
    brushRadius,
    brushStrength,
    transformMode,
    cursor,
    cursorTool,
    onSelectObject,
    onSelectVertices,
    onTransform,
    onSculpt,
    onSetCursor,
    cameraPov,
    onCameraMove,
    onCameraOrbit,
    onCameraZoom,
  });
  propsRef.current = {
    scene,
    selectedId,
    selectedVertices,
    editMode,
    brush,
    brushRadius,
    brushStrength,
    transformMode,
    cursor,
    cursorTool,
    onSelectObject,
    onSelectVertices,
    onTransform,
    onSculpt,
    onSetCursor,
    cameraPov,
    onCameraMove,
    onCameraOrbit,
    onCameraZoom,
  };

  /** The camera to render with right now (scene camera when in POV). */
  const currentView = useCallback(() => {
    const sceneCam = propsRef.current.cameraPov
      ? activeCamera(propsRef.current.scene)
      : undefined;
    const cam = camRef.current;
    const view = sceneCam
      ? viewSource(cam, {
          position: sceneCam.transform.position,
          rotation: sceneCam.transform.rotation,
          fov: sceneCam.camera?.fov,
        })
      : viewSource(cam);
    return view;
  }, []);

  // ---------------------------------------------------------------- drawing

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cam = camRef.current;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      focalRef.current = Math.min(w, h) * 1.15;
      draw();
    };

    const project = (p: Vec3) => projectPoint(p, currentView(), sizeRef.current.w, sizeRef.current.h, focalRef.current);

    const line = (a: Vec3, b: Vec3, color: string, width = 1) => {
      const pa = project(a);
      const pb = project(b);
      if (pa.z < 0 || pb.z < 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    };

    const drawGrid = () => {
      if (propsRef.current.cameraPov) return;
      for (let i = -HALF; i <= HALF; i++) {
        if (i === 0) continue;
        const fade = i % 5 === 0 ? 0.25 : 0.11;
        const col = `rgba(140,140,150,${fade})`;
        line(v3(i, 0, -HALF), v3(i, 0, HALF), col);
        line(v3(-HALF, 0, i), v3(HALF, 0, i), col);
      }
      line(v3(-HALF, 0, 0), v3(HALF, 0, 0), "rgba(192,75,75,0.85)", 1.5);
      line(v3(0, 0, -HALF), v3(0, 0, HALF), "rgba(75,106,192,0.85)", 1.5);
      line(v3(0, 0, 0), v3(0, 4, 0), "rgba(90,170,90,0.85)", 1.5);
    };

    /** Lights that point at the surface, plus a very weak ambient wash. */
    const lightContributions = (normal: Vec3, world: Vec3[]) => {
      const lamps = propsRef.current.scene.objects.filter((o) => o.kind === "light" && o.visible);
      let r = 0.11;
      let g = 0.11;
      let b = 0.13;
      for (const lamp of lamps) {
        const toLamp = subVec(lamp.transform.position, world[0] as Vec3);
        const dist = Math.max(0.6, Math.hypot(...toLamp));
        const falloff = Math.min(2, 900 / (dist * dist));
        const lambert = Math.max(0, normal[0] * toLamp[0] + normal[1] * toLamp[1] + normal[2] * toLamp[2]) / dist;
        const [lr, lg, lb] = parseHex(lamp.light?.color ?? "#ffffff");
        const w = (lamp.light?.energy ?? 800) / 800 * lambert * falloff;
        r += (lr / 255) * w;
        g += (lg / 255) * w;
        b += (lb / 255) * w;
      }
      return [r, g, b];
    };

    type Drawable = {
      obj: SceneObject;
      world: Vec3[];
      faces: number[][];
      depth: number;
    };

    const drawMesh = (d: Drawable, selected: boolean, isLightSource: boolean) => {
      const { obj, world, faces } = d;
      const proj = world.map(project);
      if (proj.some((p) => p.z < 0)) return;

      const painter = faces
        .map((face, fi) => {
          const pts = face.map((i) => proj[i]);
          if (pts.some((p) => p.z < 0)) return null;
          const avg = pts.reduce((sum, p) => sum + p.z, 0) / pts.length;
          const n = faceNormal(world, face);
          // Flat face normal is enough for a stylised look and is cheap.
          const lum = lightContributions(n, world);
          return { pts, avg, lum, fi };
        })
        .filter((f): f is { pts: { x: number; y: number }[]; avg: number; lum: number[]; fi: number } => f !== null)
        .sort((a, b) => b.avg - a.avg);

      // Backface culling keeps the inside of closed meshes from showing.
      for (const face of painter) {
        const [r, g, b] = face.lum;
        ctx.beginPath();
        ctx.moveTo(face.pts[0].x, face.pts[0].y);
        for (let k = 1; k < face.pts.length; k++) ctx.lineTo(face.pts[k].x, face.pts[k].y);
        ctx.closePath();
        ctx.fillStyle = isLightSource
          ? shadeRgb(theme.accent, 1.1)
          : `rgb(${Math.round(Math.min(1, r) * 255)},${Math.round(Math.min(1, g) * 255)},${Math.round(Math.min(1, b) * 255)})`;
        ctx.fill();
        ctx.strokeStyle = selected ? "#ffa028" : "rgba(0,0,0,0.35)";
        ctx.lineWidth = selected ? 1.6 : 1;
        ctx.stroke();
      }

      if (selected && !propsRef.current.cameraPov) {
        // Wireframe on top of the selection makes the shape readable.
        ctx.strokeStyle = "rgba(255,200,80,0.5)";
        ctx.lineWidth = 1;
        for (const face of faces) {
          for (let k = 0; k < face.length; k++) {
            const a = proj[face[k]];
            const b = proj[face[(k + 1) % face.length]];
            if (a.z < 0 || b.z < 0) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    const drawCameraHelper = (obj: SceneObject) => {
      const { position, rotation } = obj.transform;
      const { forward, right, up } = cameraBasis(rotation);
      // A small frustum: body rectangle, wedge nose, then the viewing axis.
      const at = (p: Vec3): Vec3 => addVec(position, p);
      const corners: Vec3[] = [-0.55, 0.55].flatMap((x) =>
        [-0.4, 0.4].map((y) => addVec(addVec(scaleVec(right, x), scaleVec(up, y)), scaleVec(forward, 0.9))),
      );
      const tip = at(scaleVec(forward, 1.5));
      for (const c of corners) line(tip, c, "rgba(40,40,40,0.9)");
      for (let i = 0; i < 4; i++) {
        line(corners[i], corners[(i + 1) % 4], "rgba(40,40,40,0.9)");
      }
      // The viewing direction, so the aim is obvious.
      const ahead = at(scaleVec(forward, 3.2));
      line(tip, ahead, "rgba(80,120,200,0.8)", 1.5);
      if (obj.camera?.isActive) {
        // A small solid triangle on the aim line marks the active camera.
        for (const side of [right, up]) {
          line(ahead, at(addVec(scaleVec(forward, 3.2), scaleVec(side, -0.3))), "rgba(80,120,200,0.9)", 1);
        }
      }
    };

    const drawLightHelper = (obj: SceneObject) => {
      const p = obj.transform.position;
      const colour = obj.light?.color ?? "#fff2d6";
      const point = project(p);
      if (point.z < 0) return;
      const r = Math.max(3, 0.22 * point.s);
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = shadeRgb(colour, 0.95, 0.95);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Rays hint at a point light; suns and spots just glow.
      if (obj.light?.type !== "point") return;
      const { right, up } = cameraBasis(obj.transform.rotation);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const tip = addVec(addVec(p, scaleVec(right, Math.cos(a) * 0.5)), scaleVec(up, Math.sin(a) * 0.5));
        const t = project(tip);
        if (t.z < 0) continue;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(255,240,210,0.28)";
        ctx.stroke();
      }
    };

    const distTo = (obj: SceneObject) => {
      const view = currentView();
      return Math.max(0.001, Math.hypot(...subVec(obj.transform.position, view.eye)));
    };

    /** The transform gizmo, matching the active G/R/S tool. */
    const drawGizmo = () => {
      const obj = findObject(propsRef.current.scene, propsRef.current.selectedId);
      if (!obj || propsRef.current.cameraPov) return;
      const p = obj.transform.position;
      const len = Math.max(1.2, distTo(obj) * 0.22);
      const origin = project(p);
      if (origin.z < 0) return;
      const axes: [Vec3, string][] = [
        [v3(1, 0, 0), "#e05a5a"],
        [v3(0, 1, 0), "#6fd16f"],
        [v3(0, 0, 1), "#5a86e0"],
      ];

      if (propsRef.current.transformMode === "rotate") {
        // One ring per axis, in the plane perpendicular to it.
        ctx.lineWidth = 1.6;
        for (const [axis, colour] of axes) {
          ctx.strokeStyle = colour;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            const c = Math.cos(a) * len;
            const s = Math.sin(a) * len;
            const local =
              axis[0] === 1 ? v3(0, c, s) : axis[1] === 1 ? v3(c, 0, s) : v3(c, s, 0);
            const q = project(v3(p[0] + local[0], p[1] + local[1], p[2] + local[2]));
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          }
          ctx.stroke();
        }
      }

      for (const [axis, colour] of axes) {
        const tip = project(v3(p[0] + axis[0] * len, p[1] + axis[1] * len, p[2] + axis[2] * len));
        if (tip.z < 0) continue;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.fillStyle = colour;
        if (propsRef.current.transformMode === "scale") {
          ctx.fillRect(tip.x - 4, tip.y - 4, 8, 8);
        } else {
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    /** Vertices of the selection, highlighted in edit mode. */
    const drawVertices = () => {
      const obj = findObject(propsRef.current.scene, propsRef.current.selectedId);
      if (!obj?.mesh) return;
      const world = toWorld(obj.mesh.vertices, obj.transform);
      const picked = new Set(propsRef.current.selectedVertices);
      for (let i = 0; i < world.length; i++) {
        const p = project(world[i]);
        if (p.z < 0) continue;
        const isPicked = picked.has(i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, isPicked ? 3.6 : 2, 0, Math.PI * 2);
        ctx.fillStyle = isPicked ? "#ffa028" : "rgba(255,255,255,0.75)";
        ctx.fill();
      }
    };

    /** Blender's 3D cursor: a ring with crosshair lines where new objects go. */
    const drawCursor = () => {
      const c = propsRef.current.cursor;
      if (!c || propsRef.current.cameraPov) return;
      const p = project(c);
      if (p.z < 0) return;
      const r = Math.max(5, 0.18 * p.s);
      ctx.strokeStyle = propsRef.current.cursorTool ? "#ff8f6b" : "rgba(230,120,120,0.85)";
      ctx.lineWidth = propsRef.current.cursorTool ? 1.6 : 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - r * 1.5, p.y);
      ctx.lineTo(p.x + r * 1.5, p.y);
      ctx.moveTo(p.x, p.y - r * 1.5);
      ctx.lineTo(p.x, p.y + r * 1.5);
      ctx.stroke();
    };

    const drawAxisGizmo = () => {
      const { w } = sizeRef.current;
      const ox = w - 34;
      const oy = 34;
      const len = 22;
      const { right, up, forward } = viewBasis(currentView().forward);
      const axis = (v: Vec3, color: string, label: string) => {
        const x = ox + (v[0] * right[0] + v[1] * up[0] + v[2] * forward[0]) * len;
        const y = oy - (v[0] * right[1] + v[1] * up[1] + v[2] * forward[1]) * len;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(label, x + (v[0] >= 0 ? 2 : -8), y + (v[1] >= 0 ? 9 : -2));
      };
      axis(v3(1, 0, 0), "#c04b4b", "X");
      axis(v3(0, 1, 0), "#5aaa5a", "Y");
      axis(v3(0, 0, 1), "#4b6ac0", "Z");
    };

    function draw() {
      const { w, h } = sizeRef.current;
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#2b2b2b");
      bg.addColorStop(1, "#1a1a1a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      drawGrid();

      const view = currentView();
      const drawables: Drawable[] = [];
      for (const obj of propsRef.current.scene.objects) {
        if (!obj.visible) continue;
        // Skip the camera we are looking through, so it doesn't fill the view.
        if (propsRef.current.cameraPov && obj.id === propsRef.current.scene.activeCameraId) continue;
        const world = toWorld(obj.mesh?.vertices ?? [], obj.transform);
        drawables.push({
          obj,
          world,
          faces: obj.mesh?.faces ?? [],
          depth: Math.hypot(...subVec(obj.transform.position, view.eye)),
        });
      }
      drawables.sort((a, b) => b.depth - a.depth);

      for (const d of drawables) {
        if (d.faces.length === 0) {
          if (d.obj.kind === "camera") drawCameraHelper(d.obj);
          if (d.obj.kind === "light") drawLightHelper(d.obj);
          continue;
        }
        drawMesh(d, d.obj.id === propsRef.current.selectedId, d.obj.kind === "light");
      }

      if (propsRef.current.editMode === "edit" || propsRef.current.editMode === "vertexpaint") drawVertices();
      if (!propsRef.current.cameraPov) drawGizmo();
      drawCursor();
      drawAxisGizmo();
    }
    drawRef.current = draw;

    // ------------------------------------------------------- interactions

    /** Builds a world-space ray through a canvas position. */
    const rayFromPixel = (px: number, py: number) =>
      rayThroughPixel(px, py, currentView(), sizeRef.current.w, sizeRef.current.h, focalRef.current);

    let dragging = false;
    let panning = false;
    let sculpting = false;
    let lastX = 0;
    let lastY = 0;
    /** Gizmo axis grabbed by the last pointer-down, if any. */
    let axisGrab: Vec3 | null = null;
    /** Live pointers, so a two-finger pinch cancels any drag in progress. */
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchActive = false;

    const canvasPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    /** Which gizmo axis a click lands on, or null. */
    const axisAt = (px: number, py: number): Vec3 | null => {
      const obj = findObject(propsRef.current.scene, propsRef.current.selectedId);
      if (!obj) return null;
      const p = obj.transform.position;
      const len = Math.max(1.2, distTo(obj) * 0.22);
      const origin = project(p);
      if (origin.z < 0) return null;
      for (const axis of [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)]) {
        const tip = project(v3(p[0] + axis[0] * len, p[1] + axis[1] * len, p[2] + axis[2] * len));
        if (tip.z < 0) continue;
        if (Math.hypot(tip.x - px, tip.y - py) <= 7) return axis;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      const p = canvasPoint(e);
      pointers.set(e.pointerId, p);
      canvas.setPointerCapture(e.pointerId);

      if (pointers.size >= 2) {
        // Two fingers down: the pinch gesture belongs to the wheel/touch
        // handlers on the surrounding element, so the canvas stands down.
        pinchActive = true;
        dragging = false;
        panning = false;
        sculpting = false;
        axisGrab = null;
        return;
      }

      dragging = true;
      lastX = p.x;
      lastY = p.y;

      // The Cursor tool only moves the 3D cursor, never selects.
      if (propsRef.current.cursorTool && e.button === 0) {
        const hit = rayPlaneY(rayFromPixel(p.x, p.y));
        if (hit) {
          propsRef.current.onSetCursor?.(hit);
          draw();
        }
        return;
      }

      if (propsRef.current.editMode === "sculpt" && e.button === 0) {
        sculpting = true;
        return;
      }
      if (e.button === 2 || e.shiftKey) {
        panning = true;
        return;
      }

      const handle = axisAt(p.x, p.y);
      if (handle) {
        axisGrab = handle;
        return;
      }

      // Edit mode picks vertices instead of objects.
      if (propsRef.current.editMode === "edit" || propsRef.current.editMode === "vertexpaint") {
        const obj = findObject(propsRef.current.scene, propsRef.current.selectedId);
        if (obj?.mesh) {
          const world = toWorld(obj.mesh.vertices, obj.transform);
          const projected = world.map(project);
          const near = new Set(selectNear(projected, p.x, p.y, 8));
          const current = new Set(propsRef.current.selectedVertices);
          for (const i of near) {
            if (e.shiftKey || e.ctrlKey) {
              if (current.has(i)) current.delete(i);
              else current.add(i);
            } else {
              current.add(i);
            }
          }
          if (!e.shiftKey && !e.ctrlKey && near.size === 0) current.clear();
          propsRef.current.onSelectVertices?.([...current]);
        }
        return;
      }

      const ray = rayFromPixel(p.x, p.y);
      const hit = pickObject(ray, propsRef.current.scene.objects);
      propsRef.current.onSelectObject?.(hit ? hit.object.id : null);
    };

    const onMove = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, canvasPoint(e));
      if (pinchActive) return;
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const dx = px - lastX;
      const dy = py - lastY;
      lastX = px;
      lastY = py;
      const p = propsRef.current;

      if (sculpting) {
        const ray = rayFromPixel(px, py);
        const obj = findObject(p.scene, p.selectedId);
        if (obj?.mesh) {
          // Walk the ray to the brush plane in front of the object.
          const centre = objectBounds(obj);
          const mid = scaleVec(
            v3(
              (centre.min[0] + centre.max[0]) / 2,
              (centre.min[1] + centre.max[1]) / 2,
              (centre.min[2] + centre.max[2]) / 2,
            ),
            1,
          );
          const toMid = subVec(mid, ray.origin);
          const along = normalize(ray.dir);
          const travel = (toMid[0] * along[0] + toMid[1] * along[1] + toMid[2] * along[2]) || 1;
          const hit = [
            ray.origin[0] + along[0] * travel,
            ray.origin[1] + along[1] * travel,
            ray.origin[2] + along[2] * travel,
          ] as Vec3;
          // sculpt() works in object-local space, so bring the hit across.
          const localPoint = toLocal(hit, obj.transform);
          const localDelta = toLocalDir(v3(dx * travel * 0.004, -dy * travel * 0.004, 0), obj.transform);
          p.onSculpt?.(localPoint, localDelta);
        }
        return;
      }

      if (panning) {
        const k = cam.dist / focalRef.current;
        if (p.cameraPov) {
          // Right-drag moves the camera: strafe with X, dolly with Y.
          const camObj = activeCamera(p.scene);
          if (camObj) {
            const { right, forward } = cameraBasis(camObj.transform.rotation);
            p.onCameraMove?.(addVec(scaleVec(right, dx * k), scaleVec(forward, -dy * k)));
          }
        } else {
          const delta = panDelta(cam, dx, dy, focalRef.current);
          cam.tx += delta[0];
          cam.ty += delta[1];
          cam.tz += delta[2];
        }
        draw();
        return;
      }

      if (axisGrab) {
        // Drag along the grabbed axis: project the screen delta onto it.
        const travel = cam.dist / focalRef.current;
        const mode = p.transformMode;
        if (mode === "move") {
          p.onTransform?.(
            v3(axisGrab[0] * dx * travel, axisGrab[1] * -dy * travel, axisGrab[2] * dx * travel),
            "move",
          );
        } else if (mode === "rotate") {
          p.onTransform?.(v3(-dy * travel, dx * travel, 0), "rotate");
        } else {
          p.onTransform?.(v3(dx * travel, dy * travel, 0), "scale");
        }
        return;
      }

      if (p.cameraPov) {
        // In camera view a plain drag aims the camera.
        p.onCameraOrbit?.(dx * ORBIT_DEG_PER_PX, dy * ORBIT_DEG_PER_PX);
        return;
      }

      applyOrbit(dx, dy, false);
    };

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchActive = false;
      dragging = false;
      panning = false;
      sculpting = false;
      axisGrab = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const onContext = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("contextmenu", onContext);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, [editMode, cameraPov, theme, transformMode, currentView]);

  const applyOrbit = useCallback((dx: number, dy: number, pan: boolean) => {
    const cam = camRef.current;
    if (pan) {
      // Kept in sync with panDelta() in viewportCam.ts.
      const k = cam.dist / focalRef.current;
      const delta = panDelta(cam, dx, dy, focalRef.current);
      cam.tx += delta[0];
      cam.ty += delta[1];
      cam.tz += delta[2];
      void k;
    } else {
      cam.yaw += dx * 0.009;
      cam.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch - dy * 0.009));
    }
    drawRef.current();
  }, []);

  /** Points the editor camera at a bounds sphere and backs off to fit it. */
  const frameBounds = useCallback((b: { min: Vec3; max: Vec3 }) => {
    const cam = camRef.current;
    const { center, radius } = boundsSphere(b);
    cam.tx = center[0];
    cam.ty = center[1];
    cam.tz = center[2];
    cam.dist = Math.max(3, Math.min(80, radius / Math.tan((25 * Math.PI) / 180)));
    drawRef.current();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setView(view: ViewName) {
        const cam = camRef.current;
        const r = Math.PI / 2;
        switch (view) {
          case "front": cam.yaw = 0; cam.pitch = 0; break;
          case "back": cam.yaw = Math.PI; cam.pitch = 0; break;
          case "right": cam.yaw = -r; cam.pitch = 0; break;
          case "left": cam.yaw = r; cam.pitch = 0; break;
          // Negative pitch looks down from above, matching viewSource().
          case "top": cam.yaw = 0; cam.pitch = -1.49; break;
          case "bottom": cam.yaw = 0; cam.pitch = 1.49; break;
          case "camera": cam.yaw = HOME.yaw; cam.pitch = HOME.pitch; break;
          default: cam.yaw = HOME.yaw; cam.pitch = HOME.pitch; break;
        }
        drawRef.current();
      },
      frameAll() {
        frameBounds(sceneBounds(propsRef.current.scene.objects));
      },
      frameSelected() {
        const obj = findObject(propsRef.current.scene, propsRef.current.selectedId);
        frameBounds(obj ? objectBounds(obj) : sceneBounds(propsRef.current.scene.objects));
      },
      zoom(factor: number) {
        if (propsRef.current.cameraPov) {
          propsRef.current.onCameraZoom?.(factor);
          return;
        }
        const cam = camRef.current;
        cam.dist = Math.max(3, Math.min(80, cam.dist / factor));
        drawRef.current();
      },
      orbit(dx: number, dy: number) {
        if (propsRef.current.cameraPov) {
          propsRef.current.onCameraOrbit?.(dx * ORBIT_DEG_PER_PX, dy * ORBIT_DEG_PER_PX);
          return;
        }
        applyOrbit(dx, dy, false);
      },
      pan(dx: number, dy: number) {
        if (propsRef.current.cameraPov) {
          const camObj = activeCamera(propsRef.current.scene);
          const k = camRef.current.dist / focalRef.current;
          if (camObj) {
            const { right, forward } = cameraBasis(camObj.transform.rotation);
            propsRef.current.onCameraMove?.(addVec(scaleVec(right, dx * k), scaleVec(forward, -dy * k)));
          }
          return;
        }
        applyOrbit(dx, dy, true);
      },
      reset() {
        camRef.current = { ...HOME };
        focalRef.current = Math.min(sizeRef.current.w, sizeRef.current.h) * 1.15;
        drawRef.current();
      },
      setCameraPov(on: boolean) {
        // The prop drives the render; this call just refreshes the canvas.
        propsRef.current = { ...propsRef.current, cameraPov: on };
        drawRef.current();
      },
    }),
    [applyOrbit, frameBounds, currentView],
  );

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full cursor-crosshair touch-none"
      data-edit-mode={editMode}
      data-camera-pov={cameraPov ? "on" : "off"}
    />
  );
});
