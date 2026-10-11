// viewportCam.test.ts — the view maths behind the 3D viewport: orbit camera,
// camera POV, projection to screen space and the inverse picking rays. These
// guard the invariants that used to be broken (the eye and the projection
// basis disagreed, so nothing lined up on screen).
import { describe, expect, it } from "vitest";
import { createCamera, v3, type Vec3 } from "@/lib/scene3d";
import {
  DEG,
  orbitEye,
  panDelta,
  projectPoint,
  rayThroughPixel,
  viewAngles,
  viewBasis,
  viewSource,
  type OrbitCam,
} from "@/lib/viewportCam";

const SIZE = { w: 800, h: 600 };
const FOCAL = 700;

/** The orbit camera at a Blender-ish home position. */
const home = (): OrbitCam => ({ yaw: -0.7, pitch: -0.42, dist: 17, tx: 0, ty: 0.5, tz: 0 });

const centre = (p: { x: number; y: number }) => {
  expect(p.x).toBeCloseTo(SIZE.w / 2, 4);
  expect(p.y).toBeCloseTo(SIZE.h / 2, 4);
};

/** Projects through the home orbit camera. */
const projectHome = (point: Vec3) =>
  projectPoint(point, viewSource(home()), SIZE.w, SIZE.h, FOCAL);

describe("orbit camera", () => {
  it("sits `dist` away from the target", () => {
    const cam = home();
    const eye = orbitEye(cam);
    expect(Math.hypot(eye[0] - cam.tx, eye[1] - cam.ty, eye[2] - cam.tz)).toBeCloseTo(cam.dist, 6);
  });

  it("looks down on the target when the pitch is negative", () => {
    const cam = home();
    const eye = orbitEye(cam);
    expect(eye[1]).toBeGreaterThan(cam.ty);
    const view = viewSource(cam);
    // Looking down means the forward direction points towards -Y.
    expect(view.forward[1]).toBeLessThan(0);
  });

  it("places the target at the centre of the screen from every angle", () => {
    for (const yaw of [-0.9, -0.4, 0, 0.7, Math.PI / 2, Math.PI * 0.9]) {
      for (const pitch of [-1.45, -0.42, 0, 0.6, 1.4]) {
        const cam = { ...home(), yaw, pitch };
        const view = viewSource(cam);
        const target: Vec3 = [cam.tx, cam.ty, cam.tz];
        centre(projectPoint(target, view, SIZE.w, SIZE.h, FOCAL));
      }
    }
  });

  it("puts +X to the right and +Y to the top of the screen", () => {
    // A front view: camera on -Z looking towards +Z.
    const view = viewSource({ yaw: 0, pitch: 0, dist: 10, tx: 0, ty: 0, tz: 0 });
    const right = projectPoint(v3(2, 0, 0), view, SIZE.w, SIZE.h, FOCAL);
    const up = projectPoint(v3(0, 2, 0), view, SIZE.w, SIZE.h, FOCAL);
    const closer = projectPoint(v3(0, 0, 2), view, SIZE.w, SIZE.h, FOCAL);
    expect(right.x).toBeGreaterThan(SIZE.w / 2);
    expect(up.y).toBeLessThan(SIZE.h / 2);
    // Nearing the camera (+Z here) is further away, so it shrinks towards centre.
    expect(Math.abs(closer.x - SIZE.w / 2)).toBeLessThan(1);
  });

  it("views from above in the top view", () => {
    const view = viewSource({ yaw: 0, pitch: -1.49, dist: 10, tx: 0, ty: 0, tz: 0 });
    const eye = view.eye;
    expect(eye[1]).toBeGreaterThan(0);
    // Looking straight down, +Z on the floor maps to the top of the screen.
    const p = projectPoint(v3(0, 0, 3), view, SIZE.w, SIZE.h, FOCAL);
    expect(p.y).toBeLessThan(SIZE.h / 2);
  });

  it("views from the right in the right view", () => {
    const view = viewSource({ yaw: -Math.PI / 2, pitch: 0, dist: 10, tx: 0, ty: 0, tz: 0 });
    expect(view.eye[0]).toBeGreaterThan(0);
  });
});

describe("camera pov", () => {
  it("renders through the scene camera's position and lens", () => {
    const cam = createCamera(v3(7, 5, 9), v3(0, 1, 0));
    const view = viewSource(home(), {
      position: cam.transform.position,
      rotation: cam.transform.rotation,
      fov: cam.camera!.fov,
    });
    expect(view.eye).toEqual([7, 5, 9]);
    // The point the camera aims at lands in the middle of the view.
    const angles = viewAngles(view);
    const aim = v3(
      view.eye[0] + view.forward[0] * 5,
      view.eye[1] + view.forward[1] * 5,
      view.eye[2] + view.forward[2] * 5,
    );
    centre(projectPoint(aim, view, SIZE.w, SIZE.h, FOCAL));
    expect(Number.isFinite(angles.yaw)).toBe(true);
  });

  it("falls back to the orbit camera when there is no scene camera", () => {
    const cam = home();
    const view = viewSource(cam, null);
    expect(view.eye).toEqual(orbitEye(cam));
  });

  it("narrows the view as the lens fov shrinks", () => {
    const wide = projectHome(v3(3, 0, 0));
    const cam = { ...home() };
    const narrowView = { ...viewSource(cam), fov: 20 };
    const narrow = projectPoint(v3(3, 0, 0), narrowView, SIZE.w, SIZE.h, FOCAL);
    // A narrower field of view magnifies, so the point sits further from centre.
    expect(Math.abs(narrow.x - SIZE.w / 2)).toBeGreaterThan(Math.abs(wide.x - SIZE.w / 2));
  });
});

describe("picking rays", () => {
  it("shoots through the pixel that was clicked", () => {
    const view = viewSource(home());
    for (const [px, py] of [
      [SIZE.w / 2, SIZE.h / 2],
      [120, 90],
      [610, 470],
      [400, 300],
    ]) {
      const ray = rayThroughPixel(px, py, view, SIZE.w, SIZE.h, FOCAL);
      // Walk to the depth where a point would project onto that pixel.
      const depth = 6;
      const point: Vec3 = [
        ray.origin[0] + ray.dir[0] * depth,
        ray.origin[1] + ray.dir[1] * depth,
        ray.origin[2] + ray.dir[2] * depth,
      ];
      const p = projectPoint(point, view, SIZE.w, SIZE.h, FOCAL);
      expect(p.x).toBeCloseTo(px, 3);
      expect(p.y).toBeCloseTo(py, 3);
    }
  });

  it("works the same through a scene camera", () => {
    const cam = createCamera(v3(4, 2, 6), v3(0, 0, 0));
    const view = viewSource(home(), {
      position: cam.transform.position,
      rotation: cam.transform.rotation,
      fov: cam.camera!.fov,
    });
    const ray = rayThroughPixel(300, 200, view, SIZE.w, SIZE.h, FOCAL);
    expect(Math.hypot(...ray.dir)).toBeCloseTo(1, 6);
    // Straight ahead: the camera's own aim projects to the centre.
    const aim = v3(
      view.eye[0] + view.forward[0] * 4,
      view.eye[1] + view.forward[1] * 4,
      view.eye[2] + view.forward[2] * 4,
    );
    centre(projectPoint(aim, view, SIZE.w, SIZE.h, FOCAL));
  });

  it("points the centre ray along the view direction", () => {
    const view = viewSource(home());
    const ray = rayThroughPixel(SIZE.w / 2, SIZE.h / 2, view, SIZE.w, SIZE.h, FOCAL);
    ray.dir.forEach((c, i) => expect(c).toBeCloseTo(view.forward[i], 6));
  });
});

describe("view basis", () => {
  it("is orthonormal for any direction", () => {
    for (const yaw of [0, 0.9, -2.2, Math.PI]) {
      for (const pitch of [-1.4, -0.3, 0.5, 1.4]) {
        const view = viewSource({ yaw, pitch, dist: 10, tx: 1, ty: 2, tz: 3 });
        const { forward, right, up } = viewBasis(view.forward);
        expect(Math.hypot(...forward)).toBeCloseTo(1, 6);
        expect(Math.hypot(...right)).toBeCloseTo(1, 6);
        expect(Math.hypot(...up)).toBeCloseTo(1, 6);
        const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        expect(dot(forward, right)).toBeCloseTo(0, 6);
        expect(dot(forward, up)).toBeCloseTo(0, 6);
        expect(dot(right, up)).toBeCloseTo(0, 6);
      }
    }
  });

  it("survives looking straight down", () => {
    const view = viewSource({ yaw: 0, pitch: -Math.PI / 2 + 1e-6, dist: 10, tx: 0, ty: 0, tz: 0 });
    const { forward, right, up } = viewBasis(view.forward);
    expect(right.every(Number.isFinite)).toBe(true);
    expect(up.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...right)).toBeCloseTo(1, 6);
  });
});

describe("panning", () => {
  it("moves the view against the drag so the scene follows the cursor", () => {
    const cam = home();
    const delta = panDelta(cam, 10, 10, FOCAL);
    const { right, up } = viewBasis(viewSource(cam).forward);
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // Dragging right walks the camera left, so the target moves screen-left.
    expect(dot(delta, right)).toBeLessThan(0);
    // Dragging down lifts the camera, so the target moves up.
    expect(dot(delta, up)).toBeGreaterThan(0);
  });

  it("keeps the scene pinned to the cursor", () => {
    // Simulate a pan and confirm a world point moves with the drag.
    const cam = home();
    const focal = FOCAL;
    const k = cam.dist / focal;
    const dx = 60;
    const view = viewSource(cam);
    const { forward, right, up } = viewBasis(view.forward);
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // The camera and the target both shift by the pan delta.
    const shift = panDelta(cam, dx, 0, focal);
    const eyeAfter: Vec3 = [
      view.eye[0] + shift[0],
      view.eye[1] + shift[1],
      view.eye[2] + shift[2],
    ];
    // A point at the target's depth, held at arm's length to the right.
    const probe = v3(
      cam.tx + forward[0] * cam.dist + right[0] * 3,
      cam.ty + forward[1] * cam.dist + right[1] * 3,
      cam.tz + forward[2] * cam.dist + right[2] * 3,
    );
    const before = projectPoint(probe, view, SIZE.w, SIZE.h, focal);
    const after = projectPoint(probe, { ...view, eye: eyeAfter }, SIZE.w, SIZE.h, focal);
    expect(after.x - before.x).toBeCloseTo(dx * 0.97, 0);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    expect(dot(shift, right)).toBeCloseTo(-dx * k, 6);
  });

  it("is proportional to the focal length and distance", () => {
    const a = panDelta(home(), 10, 0, 700);
    const b = panDelta(home(), 10, 0, 1400);
    expect(Math.hypot(...a)).toBeCloseTo(Math.hypot(...b) * 2, 6);
  });
});

describe("angles", () => {
  it("reports the same yaw/pitch the camera was built from", () => {
    const view = viewSource({ yaw: -0.7, pitch: -0.42, dist: 10, tx: 0, ty: 0, tz: 0 });
    const { yaw, pitch } = viewAngles(view);
    expect(yaw).toBeCloseTo(-0.7, 6);
    expect(pitch).toBeCloseTo(-0.42, 6);
  });

  it("keeps degrees out of the picture", () => {
    expect(DEG).toBeCloseTo(Math.PI / 180, 12);
  });
});
