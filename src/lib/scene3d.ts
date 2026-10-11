// scene3d.ts — the pure geometry core for Nexstudio's 3D viewport.
//
// Everything here is plain data + functions with no React and no canvas, so
// the maths (primitive generation, transforms, bounds, ray picking, edit-mode
// vertex operations and sculpting) can be unit tested. The canvas renderer
// in Viewport3D consumes these results.
//
// Space conventions match Blender's: right-handed, +Y up, -Z into the screen.

export type Vec3 = [number, number, number];

export type PrimitiveKind =
  | "cube"
  | "uv_sphere"
  | "ico_sphere"
  | "cylinder"
  | "cone"
  | "plane"
  | "torus"
  | "suzanne";

export type ObjectKind = "mesh" | "camera" | "light" | "empty";

export type LightKind = "point" | "sun" | "spot";

export type BrushKind = "draw" | "smooth" | "grab" | "inflate" | "flatten";

/** A polygon mesh in object-local space. */
export interface MeshData {
  vertices: Vec3[];
  /** Polygons as lists of vertex indices (quads and triangles mix freely). */
  faces: number[][];
}

export interface Transform {
  /** Position in world space. */
  position: Vec3;
  /** XYZ Euler angles in degrees. */
  rotation: Vec3;
  /** Per-axis scale, 1 = unchanged. */
  scale: Vec3;
}

export interface SceneObject {
  id: string;
  name: string;
  kind: ObjectKind;
  primitive?: PrimitiveKind;
  mesh?: MeshData;
  transform: Transform;
  color: string;
  visible: boolean;
  /** Light source settings (kind === "light"). */
  light?: { type: LightKind; energy: number; color: string };
  /** Camera settings (kind === "camera"). */
  camera?: { fov: number; isActive: boolean };
  /** Optional link back to a gameplay role the object stands for. */
  role?: "player" | "collectible" | "hazard" | "environment" | "shop";
}

export interface Scene {
  objects: SceneObject[];
  activeCameraId: string;
}

// ------------------------------------------------------------------ vec math

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len > 1e-9 ? scale(a, 1 / len) : v3(0, 0, 0);
}

export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Rotates a point by XYZ Euler angles given in degrees. */
export function rotateEuler(p: Vec3, deg: Vec3): Vec3 {
  let [x, y, z] = p;
  const rz = (deg[2] * Math.PI) / 180;
  const rx = (deg[0] * Math.PI) / 180;
  const ry = (deg[1] * Math.PI) / 180;
  // Z
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  // X
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  // Y
  [x, z] = [x * Math.cos(ry) - z * Math.sin(ry), x * Math.sin(ry) + z * Math.cos(ry)];
  return [x, y, z];
}

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
