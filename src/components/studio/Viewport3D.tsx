// Viewport3D.tsx — the 3D viewport for Nexstudio.
//
// A small, dependency-free software renderer that draws the editable scene
// from src/lib/scene3d.ts on a Blender-style grid. On top of the orbit/pan/
// zoom navigation it supports:
//
//   * object picking by clicking (ray cast against the mesh)
//   * a translate/rotate/scale gizmo on the selection
//   * a camera POV mode that renders from the active camera
//   * light and camera helpers drawn in the scene
//   * edit mode vertex editing and sculpt-mode brushes
//
// Geometry, transforms, picking and sculpting all come from scene3d.ts; this
// file only projects to 2D, shades and paints.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import {
  activeCamera,
  boundsSphere,
  findObject,
  faceNormal,
  meshVertexNormals,
  normalize,
  objectBounds,
  pickObject,
  rotateEuler,
  sub as subVec,
  scale as scaleVec,
  sceneBounds,
  toWorld,
  v3,
  type Scene,
  type SceneObject,
  type Vec3,
} from "@/lib/scene3d";

export type ViewName = "front" | "back" | "left" | "right" | "top" | "bottom" | "camera";

export interface Viewport3DTheme {
  bg: string;
  player: string;
  good: string;
  bad: string;
  accent: string;
  text: string;
}

export interface Viewport3DHandle {
  setView: (view: ViewName) => void;
  frameAll: () => void;
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
  onSelectObject?: (id: string | null) => void;
  onSelectVertices?: (indices: number[]) => void;
  /** Called with the drag delta in world units, on the drag plane. */
  onTransform?: (delta: Vec3, mode: "move" | "rotate" | "scale") => void;
  onSculpt?: (localPoint: Vec3, delta: Vec3) => void;
  /** Renders through the active camera when set. */
  cameraPov?: boolean;
  theme: Viewport3DTheme;
}

interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
}

const HOME: Cam = { yaw: -0.7, pitch: 0.42, dist: 17, tx: 0, ty: 0.5, tz: 0 };
const LIGHT_DIR: Vec3 = [-0.4, 0.88, 0.42];
const HALF = 13;
const PITCH_MIN = -1.5;
const PITCH_MAX = 1.5;
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ 2d helpers

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6) || "888888", 16);
  if (!Number.isFinite(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeRgb(hex: string, factor: number, alpha = 1): string {
  const [r, g, b] = parseHex(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
}

interface Proj {
  x: number;
  y: number;
  z: number;
  s: number;
}

export const Viewport3D = forwardRef<Viewport3DHandle, Viewport3DProps>(function Viewport3D(
  {
    scene,
    selectedId,
    selectedVertices,
    editMode,
    brush,
    brushRadius,
    brushStrength,
    onSelectObject,
    onSelectVertices,
    onTransform,
    onSculpt,
    cameraPov = false,
    theme,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam>({ ...HOME });
  const focalRef = useRef(900);
  const drawRef = useRef<() => void>(() => {});
  const sizeRef = useRef({ w: 1, h: 1 });

  // Latest props for the canvas event handlers, which are attached once.
  const propsRef = useRef({
    scene,
    selectedId,
    selectedVertices,
    editMode,
    brush,
    brushRadius,
    brushStrength,
    onSelectObject,
    onSelectVertices,
    onTransform,
    onSculpt,
    cameraPov,
  });
  propsRef.current = {
    scene,
    selectedId,
    selectedVertices,
    editMode,
    brush,
    brushRadius,
    brushStrength,
    onSelectObject,
    onSelectVertices,
    onTransform,
    onSculpt,
    cameraPov,
  };

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

    // Editor-camera basis: look from yaw/pitch towards the target.
    const eyeOf = (c: Cam): Vec3 => {
      const cp = Math.cos(c.pitch);
      return [
        c.tx + Math.sin(c.yaw) * cp * c.dist,
        c.ty + Math.sin(c.pitch) * c.dist,
        c.tz - Math.cos(c.yaw) * cp * c.dist,
      ];
    };

    /** Camera used for projection: the editor cam, or a scene camera in POV. */
    const currentCamera = () => {
      if (!propsRef.current.cameraPov) {
        const c = cam;
        return { eye: eyeOf(c), yaw: c.yaw, pitch: c.pitch, fov: 50 };
      }
      const camObj = activeCamera(propsRef.current.scene);
      if (!camObj) {
        const c = cam;
        return { eye: eyeOf(c), yaw: c.yaw, pitch: c.pitch, fov: 50 };
      }
      return {
        eye: camObj.transform.position,
        yaw: camObj.transform.rotation[1] * DEG,
        pitch: -camObj.transform.rotation[0] * DEG,
        fov: camObj.camera?.fov ?? 50,
      };
    };

    const rotate = (p: Vec3, yaw: number, pitch: number) => {
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const x1 = cy * p[0] - sy * p[2];
      const z1 = sy * p[0] + cy * p[2];
      const y2 = cp * p[1] - sp * z1;
      const z2 = sp * p[1] + cp * z1;
      return { x: x1, y: y2, z: z2 };
    };

    /** Projects a world point to screen space. Invalid when behind the eye. */
    const project = (p: Vec3): Proj => {
      const { w, h } = sizeRef.current;
      const view = currentCamera();
      const r = rotate(subVec(p, view.eye), view.yaw, view.pitch);
      const zc = r.z;
      if (zc < 0.15) return { x: 0, y: 0, z: -1, s: 0 };
      // A smaller focal length = a wider field of view.
      const focal = focalRef.current * (50 / view.fov);
      return {
        x: w / 2 + (r.x * focal) / zc,
        y: h / 2 - (r.y * focal) / zc,
        z: zc,
        s: focal / zc,
      };
    };

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
        const col = `rgba(140,140,140,${fade})`;
        line(v3(i, 0, -HALF), v3(i, 0, HALF), col);
        line(v3(-HALF, 0, i), v3(HALF, 0, i), col);
      }
      line(v3(-HALF, 0, 0), v3(HALF, 0, 0), "rgba(192,75,75,0.85)", 1.5);
      line(v3(0, 0, -HALF), v3(0, 0, HALF), "rgba(75,106,192,0.85)", 1.5);
      line(v3(0, 0, 0), v3(0, 4, 0), "rgba(90,170,90,0.85)", 1.5);
    };

    /** Lights that point at the surface, plus a very weak ambient wash. */
    const lightContributions = (normal: Vec3, world: Vec3[]) => {
      const lamps = propsRef.current.scene.objects.filter((o) => o.kind === "light");
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
        .filter((f): f is { pts: Proj[]; avg: number; lum: number[]; fi: number } => f !== null)
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

      if (selected && !cameraPov) {
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
      const back = rotateEuler(v3(-0.5, -0.4, 0.7), rotation);
      const front = rotateEuler(v3(0, 0, 0), rotation);
      const corners = [
        rotateEuler(v3(-0.55, -0.4, 0.25), rotation),
        rotateEuler(v3(0.55, -0.4, 0.25), rotation),
        rotateEuler(v3(0.55, 0.4, 0.25), rotation),
        rotateEuler(v3(-0.55, 0.4, 0.25), rotation),
      ];
      const at = (p: Vec3): Vec3 => [position[0] + p[0], position[1] + p[1], position[2] + p[2]];
      const f = at(front);
      const b = at(back);
      const world = corners.map(at);
      for (const c of world) line(f, c, "rgba(40,40,40,0.9)");
      for (let i = 0; i < 4; i++) {
        const a = world[i];
        const c = world[(i + 1) % 4];
        line(a, c, "rgba(40,40,40,0.9)");
      }
      // The viewing direction, so the aim is obvious.
      const ahead = rotateEuler(v3(0, 0, -3), rotation);
      line(f, at(ahead), "rgba(80,120,200,0.8)", 1.5);
      void b;
      if (obj.camera?.isActive) {
        line(f, at(rotateEuler(v3(-0.25, 0.12, -1.2), rotation)), "rgba(80,120,200,0.9)", 1);
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
      // Rays hint at a point light; a sun just glows.
      if (obj.light?.type !== "point") return;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const tip = v3(p[0] + Math.cos(a) * 0.5, p[1] + Math.sin(a) * 0.5, p[2]);
        const t = project(tip);
        if (t.z < 0) continue;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(255,240,210,0.28)";
        ctx.stroke();
      }
    };

    /** The transform gizmo: three axis handles through the object origin. */
    const drawGizmo = () => {
      const obj = findObject(propsRef.current.scene, propsRef.current.selectedId);
      if (!obj || propsRef.current.cameraPov) return;
      const p = obj.transform.position;
      const len = Math.max(1.2, distTo(obj) * 0.22);
      const axes: [Vec3, string][] = [
        [v3(1, 0, 0), "#e05a5a"],
        [v3(0, 1, 0), "#6fd16f"],
        [v3(0, 0, 1), "#5a86e0"],
      ];
      const origin = project(p);
      if (origin.z < 0) return;
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
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const distTo = (obj: SceneObject) => {
      const view = currentCamera();
      return Math.max(0.001, Math.hypot(...subVec(obj.transform.position, view.eye)));
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

    const drawAxisGizmo = () => {
      const { w } = sizeRef.current;
      const ox = w - 34;
      const oy = 34;
      const len = 22;
      const view = currentCamera();
      const axis = (v: Vec3, color: string, label: string) => {
        const r = rotate(v, view.yaw, view.pitch);
        const ex = ox + r.x * len;
        const ey = oy - r.y * len;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(label, ex + (r.x >= 0 ? 2 : -8), ey + (r.y >= 0 ? 9 : -2));
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
          depth: Math.hypot(...subVec(obj.transform.position, currentCamera().eye)),
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

      if (editMode === "edit" || editMode === "vertexpaint") drawVertices();
      if (!cameraPov) drawGizmo();
      drawAxisGizmo();
    }
    drawRef.current = draw;

    // ------------------------------------------------------- interactions

    /** Builds a world-space ray through a canvas position. */
    const rayFromPixel = (px: number, py: number) => {
      const { w, h } = sizeRef.current;
      const view = currentCamera();
      const halfW = Math.tan(((view.fov / 2) * Math.PI) / 180);
      const halfH = halfW * (h / Math.max(1, w));
      const nx = (px - w / 2) / Math.max(1, w);
      const ny = (h / 2 - py) / Math.max(1, h);
      const right = rotate(v3(1, 0, 0), view.yaw, view.pitch);
      const up = rotate(v3(0, 1, 0), view.yaw, view.pitch);
      const forward = rotate(v3(0, 0, -1), view.yaw, view.pitch);
      const dir = normalize(
        v3(
          forward[0] + (right[0] * nx * 2 + up[0] * ny * 2) * halfW,
          forward[1] + (right[1] * nx * 2 + up[1] * ny * 2) * halfW,
          forward[2] + (right[2] * nx * 2 + up[2] * ny * 2) * halfW,
        ),
      );
      return { origin: view.eye, dir };
    };

    let dragging = false;
    let panning = false;
    let sculpting = false;
    let lastX = 0;
    let lastY = 0;
    /** Gizmo axis grabbed by the last pointer-down, if any. */
    let axisGrab: Vec3 | null = null;

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
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      dragging = true;
      lastX = px;
      lastY = py;
      canvas.setPointerCapture(e.pointerId);

      if (propsRef.current.editMode === "sculpt" && e.button === 0) {
        sculpting = true;
        return;
      }
      if (e.button === 2 || e.shiftKey) {
        panning = true;
        return;
      }

      const handle = axisAt(px, py);
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
          const near = new Set<number>();
          for (let i = 0; i < projected.length; i++) {
            if (projected[i].z < 0) continue;
            if (Math.hypot(projected[i].x - px, projected[i].y - py) <= 8) near.add(i);
          }
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

      const ray = rayFromPixel(px, py);
      const hit = pickObject(ray, propsRef.current.scene.objects);
      propsRef.current.onSelectObject?.(hit ? hit.object.id : null);
    };

    const onMove = (e: PointerEvent) => {
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
          const world = toWorld(obj.mesh.vertices, obj.transform);
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
          p.onSculpt?.(hit, v3(dx * travel * 0.004, -dy * travel * 0.004, 0));
        }
        return;
      }

      if (panning) {
        const k = cam.dist / focalRef.current;
        cam.tx -= dx * k * Math.cos(cam.yaw);
        cam.tz += dx * k * Math.sin(cam.yaw);
        cam.ty += dy * k;
        draw();
        return;
      }

      if (axisGrab) {
        // Drag along the grabbed axis: project the screen delta onto it.
        const travel = cam.dist / focalRef.current;
        p.onTransform?.(
          v3(axisGrab[0] * dx * travel, axisGrab[1] * -dy * travel, axisGrab[2] * dx * travel),
          "move",
        );
        return;
      }

      applyOrbit(dx, dy, false);
    };

    const onUp = (e: PointerEvent) => {
      dragging = false;
      panning = false;
      sculpting = false;
      axisGrab = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const onContext = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("contextmenu", onContext);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, [editMode, cameraPov, theme]);

  const applyOrbit = useCallback((dx: number, dy: number, pan: boolean) => {
    const cam = camRef.current;
    if (pan) {
      const k = cam.dist / focalRef.current;
      cam.tx -= dx * k * Math.cos(cam.yaw);
      cam.tz += dx * k * Math.sin(cam.yaw);
      cam.ty += dy * k;
    } else {
      cam.yaw += dx * 0.009;
      cam.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch - dy * 0.009));
    }
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
          case "top": cam.yaw = 0; cam.pitch = 1.49; break;
          case "bottom": cam.yaw = 0; cam.pitch = -1.49; break;
          case "camera": cam.yaw = HOME.yaw; cam.pitch = HOME.pitch; break;
          default: cam.yaw = HOME.yaw; cam.pitch = HOME.pitch; break;
        }
        drawRef.current();
      },
      frameAll() {
        const cam = camRef.current;
        const b = sceneBounds(propsRef.current.scene.objects);
        const { center, radius } = boundsSphere(b);
        cam.tx = center[0];
        cam.ty = center[1];
        cam.tz = center[2];
        cam.dist = Math.max(4, Math.min(80, radius / Math.tan((25 * Math.PI) / 180)));
        drawRef.current();
      },
      zoom(factor: number) {
        const cam = camRef.current;
        cam.dist = Math.max(3, Math.min(80, cam.dist / factor));
        drawRef.current();
      },
      orbit(dx: number, dy: number) {
        applyOrbit(dx, dy, false);
      },
      pan(dx: number, dy: number) {
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
    [applyOrbit],
  );

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full cursor-crosshair touch-none"
      data-edit-mode={editMode}
    />
  );
});
