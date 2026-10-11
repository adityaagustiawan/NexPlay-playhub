// Viewport3D.tsx — a small, dependency-free 3D viewport for Nexstudio.
// Draws the game's world (player / collectibles / hazards) on a Blender-style
// grid floor with orbit (drag), pan (right-drag / Shift-drag) and zoom (wheel).
// Used whenever a game's dimension is "3d" so the editor matches what was made.
import { useEffect, useRef } from "react";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Viewport3DTheme {
  bg: string;
  player: string;
  good: string;
  bad: string;
  accent: string;
  text: string;
}

interface Props {
  mode: string;
  goal: number;
  theme: Viewport3DTheme;
}

const LIGHT: Vec3 = { x: -0.4, y: 0.88, z: 0.42 };
const HALF = 13;

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6) || "888888", 16);
  if (!Number.isFinite(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export function Viewport3D({ mode, goal, theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cam = { yaw: -0.7, pitch: 0.42, dist: 17, tx: 0, ty: 0.5, tz: 0 };
    let w = 1;
    let h = 1;
    let focal = 900;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      focal = Math.min(w, h) * 1.15;
      draw();
    };

    const rotate = (p: Vec3) => {
      const cy = Math.cos(cam.yaw);
      const sy = Math.sin(cam.yaw);
      const cp = Math.cos(cam.pitch);
      const sp = Math.sin(cam.pitch);
      const x1 = cy * p.x - sy * p.z;
      const z1 = sy * p.x + cy * p.z;
      const y2 = cp * p.y - sp * z1;
      const z2 = sp * p.y + cp * z1;
      return { x: x1, y: y2, z: z2 };
    };

    const project = (p: Vec3) => {
      const r = rotate({ x: p.x - cam.tx, y: p.y - cam.ty, z: p.z - cam.tz });
      const zc = r.z + cam.dist;
      if (zc < 0.2) return { x: 0, y: 0, z: -1, s: 0 };
      return { x: w / 2 + (r.x * focal) / zc, y: h / 2 - (r.y * focal) / zc, z: zc, s: focal / zc };
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
      for (let i = -HALF; i <= HALF; i++) {
        const major = i === 0;
        const fade = i % 5 === 0 ? 0.5 : 0.22;
        const col = major ? `rgba(150,150,150,0.35)` : `rgba(140,140,140,${fade * 0.5})`;
        if (i !== 0) {
          line({ x: i, y: 0, z: -HALF }, { x: i, y: 0, z: HALF }, col);
          line({ x: -HALF, y: 0, z: i }, { x: HALF, y: 0, z: i }, col);
        }
      }
      // Coloured floor axes (Blender: X red, Z blue)
      line({ x: -HALF, y: 0, z: 0 }, { x: HALF, y: 0, z: 0 }, "rgba(192,75,75,0.85)", 1.5);
      line({ x: 0, y: 0, z: -HALF }, { x: 0, y: 0, z: HALF }, "rgba(75,106,192,0.85)", 1.5);
      line({ x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 0 }, "rgba(90,170,90,0.85)", 1.5);
    };

    const BOX_FACES: { i: number[]; n: Vec3 }[] = [
      { i: [0, 1, 2, 3], n: { x: 0, y: 0, z: -1 } },
      { i: [4, 5, 6, 7], n: { x: 0, y: 0, z: 1 } },
      { i: [0, 1, 5, 4], n: { x: 0, y: -1, z: 0 } },
      { i: [3, 2, 6, 7], n: { x: 0, y: 1, z: 0 } },
      { i: [0, 3, 7, 4], n: { x: -1, y: 0, z: 0 } },
      { i: [1, 2, 6, 5], n: { x: 1, y: 0, z: 0 } },
    ];

    const drawBox = (c: Vec3, size: number, color: string) => {
      const s = size / 2;
      const corners: Vec3[] = [
        { x: c.x - s, y: c.y - s, z: c.z - s },
        { x: c.x + s, y: c.y - s, z: c.z - s },
        { x: c.x + s, y: c.y + s, z: c.z - s },
        { x: c.x - s, y: c.y + s, z: c.z - s },
        { x: c.x - s, y: c.y - s, z: c.z + s },
        { x: c.x + s, y: c.y - s, z: c.z + s },
        { x: c.x + s, y: c.y + s, z: c.z + s },
        { x: c.x - s, y: c.y + s, z: c.z + s },
      ];
      const proj = corners.map(project);
      const faces = BOX_FACES.map((f) => {
        const pts = f.i.map((i) => proj[i]);
        const avg = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4;
        const lum = 0.42 + 0.58 * Math.max(0, f.n.x * LIGHT.x + f.n.y * LIGHT.y + f.n.z * LIGHT.z);
        return { pts, avg, fill: shade(color, lum) };
      })
        .filter((f) => f.pts.every((p) => p.z > 0))
        .sort((a, b) => b.avg - a.avg);
      for (const f of faces) {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let k = 1; k < f.pts.length; k++) ctx.lineTo(f.pts[k].x, f.pts[k].y);
        ctx.closePath();
        ctx.fillStyle = f.fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const drawSphere = (c: Vec3, r: number, color: string) => {
      const p = project(c);
      if (p.z <= 0) return;
      const sr = Math.max(2, r * p.s);
      const g = ctx.createRadialGradient(p.x - sr * 0.35, p.y - sr * 0.35, sr * 0.1, p.x, p.y, sr);
      g.addColorStop(0, shade(color, 1.35));
      g.addColorStop(0.6, color);
      g.addColorStop(1, shade(color, 0.55));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const buildScene = () => {
      const boxes: { c: Vec3; size: number; color: string }[] = [];
      const spheres: { c: Vec3; r: number; color: string }[] = [];
      // Player
      boxes.push({ c: { x: 0, y: 0.7, z: 0 }, size: 1.3, color: theme.player });
      // Collectibles ring
      const n = Math.max(3, Math.min(12, goal));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rad = 3.6 + (i % 2) * 1.4;
        spheres.push({ c: { x: Math.cos(a) * rad, y: 0.6, z: Math.sin(a) * rad }, r: 0.42, color: theme.good });
      }
      // Hazards
      const hn = mode === "runner" ? 5 : 4;
      for (let i = 0; i < hn; i++) {
        const a = (i / hn) * Math.PI * 2 + 0.5;
        const rad = 6.4;
        boxes.push({
          c: { x: Math.cos(a) * rad, y: 0.55, z: Math.sin(a) * rad },
          size: 1.09 + (i % 3) * 0.22,
          color: theme.bad,
        });
      }
      return { boxes, spheres };
    };

    const draw = () => {
      // Background gradient (Blender-ish viewport)
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#2b2b2b");
      bg.addColorStop(1, "#1a1a1a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      drawGrid();
      const { boxes, spheres } = buildScene();

      // Painter's algorithm across the whole scene
      const items = [
        ...spheres.map((s) => ({ kind: "s" as const, ...s, depth: project(s.c).z })),
        ...boxes.map((b) => ({ kind: "b" as const, ...b, depth: project(b.c).z })),
      ].sort((a, b) => b.depth - a.depth);

      for (const it of items) {
        if (it.kind === "b") drawBox(it.c, it.size, it.color);
        else drawSphere(it.c, it.r, it.color);
      }

      drawGizmo();
    };

    const drawGizmo = () => {
      const ox = w - 34;
      const oy = 34;
      const len = 22;
      const axis = (v: Vec3, color: string, label: string) => {
        const r = rotate(v);
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
      axis({ x: 1, y: 0, z: 0 }, "#c04b4b", "X");
      axis({ x: 0, y: 1, z: 0 }, "#5aaa5a", "Y");
      axis({ x: 0, y: 0, z: 1 }, "#4b6ac0", "Z");
      ctx.beginPath();
      ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#d0d0d0";
      ctx.fill();
    };

    // --- Input ---
    let dragging = false;
    let panning = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      panning = e.button === 2 || e.shiftKey;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (panning) {
        const k = cam.dist / focal;
        cam.tx -= dx * k * Math.cos(cam.yaw);
        cam.tz += dx * k * Math.sin(cam.yaw);
        cam.ty += dy * k;
      } else {
        cam.yaw += dx * 0.009;
        cam.pitch = Math.max(0.05, Math.min(1.5, cam.pitch - dy * 0.009));
      }
      draw();
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.dist = Math.max(5, Math.min(60, cam.dist * (1 + e.deltaY * 0.0012)));
      draw();
    };
    const onContext = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, [mode, goal, theme]);

  return <canvas ref={canvasRef} className="block h-full w-full cursor-grab touch-none active:cursor-grabbing" />;
}
