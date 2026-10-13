// viewport2dDraw.ts — pure canvas drawing helpers for the 2D viewport.
// Kept separate from Viewport2D.tsx so the maths stays testable.
import type { Scene2D, SceneObject2D, Vec2 } from "@/lib/scene2d";

export interface Xform {
  /** world -> screen */
  sx: (x: number) => number;
  sy: (y: number) => number;
  /** screen -> world */
  wx: (x: number) => number;
  wy: (y: number) => number;
  zoom: number;
}

export function makeXform(view: { x: number; y: number; zoom: number }, w: number, h: number): Xform {
  const { zoom } = view;
  const ox = w / 2;
  const oy = h / 2;
  return {
    zoom,
    sx: (x) => ox + (x + view.x) * zoom,
    sy: (y) => oy + (y + view.y) * zoom,
    wx: (p) => (p - ox) / zoom - view.x,
    wy: (p) => (p - oy) / zoom - view.y,
  };
}

/** world (or local) point of a node-local point, honouring pivot + transform. */
export function localToWorld(o: SceneObject2D, lx: number, ly: number): Vec2 {
  const [px, py] = o.transform.position;
  const [pivX, pivY] = o.pivot;
  const s = o.transform.scale;
  const r = (o.transform.rotation * Math.PI) / 180;
  const dx = lx - pivX;
  const dy = ly - pivY;
  const rx = dx * s[0] * Math.cos(r) - dy * s[1] * Math.sin(r);
  const ry = dx * s[0] * Math.sin(r) + dy * s[1] * Math.cos(r);
  return [px + pivX + rx, py + pivY + ry];
}

/** node-local point of a world point (inverse of localToWorld). */
export function worldToLocal(o: SceneObject2D, wx: number, wy: number): Vec2 {
  const [px, py] = o.transform.position;
  const [pivX, pivY] = o.pivot;
  const s = o.transform.scale;
  const r = (o.transform.rotation * Math.PI) / 180;
  const dx = wx - px - pivX;
  const dy = wy - py - pivY;
  const rx = dx * Math.cos(r) + dy * Math.sin(r);
  const ry = -dx * Math.sin(r) + dy * Math.cos(r);
  return [rx / s[0] + pivX, ry / s[1] + pivY];
}

/** Corners of a node's rect in node-local space (origin = node center). */
export function localCorners(o: SceneObject2D): Vec2[] {
  const w = o.width / 2;
  const h = o.height / 2;
  return [
    [-w, -h],
    [w, -h],
    [w, h],
    [-w, h],
  ];
}

export function applyTransform(ctx: CanvasRenderingContext2D, o: SceneObject2D) {
  const [px, py] = o.transform.position;
  const [pivX, pivY] = o.pivot;
  const [sx, sy] = o.transform.scale;
  const r = (o.transform.rotation * Math.PI) / 180;
  ctx.translate(px, py);
  ctx.translate(pivX, pivY);
  ctx.rotate(r);
  ctx.scale(sx, sy);
  ctx.translate(-pivX, -pivY);
}

const imageCache = new Map<string, HTMLImageElement>();
const REDRAW_EVENT = "2d-node-redraw";
export function loadImage(src: string): HTMLImageElement | null {
  const hit = imageCache.get(src);
  if (hit) return hit.complete && hit.naturalWidth > 0 ? hit : null;
  const img = new Image();
  img.onload = () => window.dispatchEvent(new Event(REDRAW_EVENT));
  img.onerror = () => window.dispatchEvent(new Event(REDRAW_EVENT));
  img.src = src;
  imageCache.set(src, img);
  return null;
}

export type GridVisibility = Scene2D["gridVisibility"];

export function gridVisible(scene: Scene2D, gridSnapping: boolean): boolean {
  if (scene.gridVisibility === "never") return false;
  if (scene.gridVisibility === "snapping") return gridSnapping;
  return true;
}

/** A visible ruler tick interval (world units) that is >= minPx apart. */
export function tickInterval(step: number, zoom: number, minPx: number): number {
  const px = step * zoom;
  if (px >= minPx) return step;
  let s = step;
  while (s * zoom < minPx) s *= 2;
  return s;
}

export interface ViewTransform2DLike {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Godot's _zoom_on_position: zoom the view while keeping the world point under
 * (px, py) pinned to that same screen position.
 */
export function zoomAtPoint(
  view: ViewTransform2DLike,
  factor: number,
  px: number,
  py: number,
  w: number,
  h: number,
): ViewTransform2DLike {
  const xf = makeXform(view, w, h);
  const wx = xf.wx(px);
  const wy = xf.wy(py);
  const zoom = Math.max(0.05, Math.min(64, view.zoom * factor));
  return {
    zoom,
    x: (px - w / 2) / zoom - wx,
    y: (py - h / 2) / zoom - wy,
  };
}
