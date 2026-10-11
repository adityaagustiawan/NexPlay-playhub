// viewportCam.ts — pure camera maths for the 3D viewport.
//
// Two cameras produce the view: the editor "orbit" camera (yaw/pitch/distance
// around a target) and, in camera POV mode, a scene camera transform. Both are
// projected to screen space and can shoot the rays the pickers need.
//
// Kept free of React and canvas so the view maths (which was previously
// untestable and therefore broken) can be unit tested.
import { cameraBasis, normalize, scale, sub, v3, type Vec3 } from "@/lib/scene3d";

export const DEG = Math.PI / 180;

/** Where the camera is, which way it looks and how wide its lens is. */
export interface ViewSource {
  eye: Vec3;
  forward: Vec3;
  fov: number;
}

/** The editor camera: orbits a target at (tx,ty,tz). */
export interface OrbitCam {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
}

/** A scene camera as the viewport needs it (subset of a `SceneObject`). */
export interface SceneCamView {
  position: Vec3;
  rotation: Vec3;
  fov?: number;
}

/** Eye of the orbit camera: one `dist` behind the target along the view dir. */
export function orbitEye(cam: OrbitCam): Vec3 {
  const cp = Math.cos(cam.pitch);
  return [
    cam.tx - Math.sin(cam.yaw) * cp * cam.dist,
    cam.ty - Math.sin(cam.pitch) * cam.dist,
    cam.tz - Math.cos(cam.yaw) * cp * cam.dist,
  ];
}

/**
 * The view to render with: the scene camera when looking through it, the orbit
 * camera otherwise. `forward` always points from the eye at the target, so the
 * projection below works the same for both.
 */
export function viewSource(cam: OrbitCam, sceneCam?: SceneCamView | null): ViewSource {
  if (sceneCam) {
    const { forward } = cameraBasis(sceneCam.rotation);
    return { eye: sceneCam.position, forward, fov: sceneCam.fov ?? 50 };
  }
  const forward = cameraBasis(v3(-cam.pitch / DEG, cam.yaw / DEG, 0)).forward;
  return { eye: orbitEye(cam), forward, fov: 50 };
}

/** Orthonormal camera basis built from the view direction. */
export function viewBasis(forward: Vec3): { forward: Vec3; right: Vec3; up: Vec3 } {
  const f = normalize(forward);
  // Nudge the world up when looking straight up/down so the frame stays valid.
  const worldUp: Vec3 = Math.abs(f[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const right = normalize([
    worldUp[1] * f[2] - worldUp[2] * f[1],
    worldUp[2] * f[0] - worldUp[0] * f[2],
    worldUp[0] * f[1] - worldUp[1] * f[0],
  ]);
  const up: Vec3 = [
    f[1] * right[2] - f[2] * right[1],
    f[2] * right[0] - f[0] * right[2],
    f[0] * right[1] - f[1] * right[0],
  ];
  return { forward: f, right, up };
}

/** Yaw/pitch of a view source, as `rotateYawPitch` expects them. */
export function viewAngles(view: ViewSource): { yaw: number; pitch: number } {
  return {
    yaw: Math.atan2(view.forward[0], view.forward[2]),
    pitch: -Math.asin(Math.max(-1, Math.min(1, view.forward[1]))),
  };
}

/** Rotates a point into camera space: yaw around Y, then pitch around X. */
export function rotateYawPitch(p: Vec3, yaw: number, pitch: number): { x: number; y: number; z: number } {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = cy * p[0] - sy * p[2];
  const z1 = sy * p[0] + cy * p[2];
  const y2 = cp * p[1] - sp * z1;
  const z2 = sp * p[1] + cp * z1;
  return { x: x1, y: y2, z: z2 };
}

export interface Projected {
  x: number;
  y: number;
  /** Depth along the view axis; <= 0 means behind the eye. */
  z: number;
  /** Pixels per world unit at this depth. */
  s: number;
}

/** Projects a world point to screen space. */
export function projectPoint(p: Vec3, view: ViewSource, w: number, h: number, focal: number): Projected {
  const { yaw, pitch } = viewAngles(view);
  const r = rotateYawPitch(sub(p, view.eye), yaw, pitch);
  const zc = r.z;
  if (zc < 0.15) return { x: 0, y: 0, z: -1, s: 0 };
  const f = focal * (50 / view.fov);
  return {
    x: w / 2 + (r.x * f) / zc,
    y: h / 2 - (r.y * f) / zc,
    z: zc,
    s: f / zc,
  };
}

/**
 * The world-space ray through a canvas pixel — the exact inverse of
 * `projectPoint`, so what you click is what you hit.
 */
export function rayThroughPixel(
  px: number,
  py: number,
  view: ViewSource,
  w: number,
  h: number,
  focal: number,
): { origin: Vec3; dir: Vec3 } {
  const { forward, right, up } = viewBasis(view.forward);
  const f = focal * (50 / view.fov);
  // Screen offset from the centre, expressed in world units at depth 1.
  const sx = (px - w / 2) / f;
  const sy = (h / 2 - py) / f;
  const dir = normalize(
    v3(
      forward[0] + right[0] * sx + up[0] * sy,
      forward[1] + right[1] * sx + up[1] * sy,
      forward[2] + right[2] * sx + up[2] * sy,
    ),
  );
  return { origin: view.eye, dir };
}

/** Direction to move the orbit target when panning, in screen-aligned units. */
export function panDelta(
  cam: OrbitCam,
  dx: number,
  dy: number,
  focal: number,
): Vec3 {
  const k = cam.dist / focal;
  // +right is screen-right; dragging right pulls the target the other way.
  return v3(-Math.cos(cam.yaw) * dx * k, dy * k, Math.sin(cam.yaw) * dx * k);
}
