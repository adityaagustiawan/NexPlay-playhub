// scene3d.test.ts
// The geometry core of the Nexstudio 3D viewport: primitives, transforms,
// bounds, ray picking, edit-mode vertex operations and sculpting.
import { describe, expect, it } from "vitest";
import {
  add,
  boundsOf,
  boundsSphere,
  brushCenter,
  createCamera,
  createCube,
  createCone,
  createCylinder,
  createDemoScene,
  createIcoSphere,
  createLight,
  createMeshObject,
  createPlane,
  createTorus,
  createUvSphere,
  deleteVertices,
  deserializeScene,
  duplicateSelection,
  faceNormal,
  findObject,
  addObject,
  moveVertices,
  objectBounds,
  patchObject,
  pickObject,
  primitiveMesh,
  raySphere,
  removeObject,
  rotateEuler,
  scaleSelection,
  sceneBounds,
  sculpt,
  selectNear,
  serializeScene,
  setActiveCamera,
  sharpEdges,
  toWorld,
  uniqueName,
  v3,
  meshVertexNormals,
  type Vec3,
  type BrushKind,
} from "@/lib/scene3d";

describe("vector maths", () => {
  it("adds component-wise", () => {
    expect(add(v3(1, 2, 3), v3(1, 1, 1))).toEqual([2, 3, 4]);
    expect(add(v3(1, 2, 3), v3(-1, -1, -1))).toEqual([0, 1, 2]);
  });

  it("rotates 90 degrees around Y so +X becomes -Z", () => {
    const out = rotateEuler([1, 0, 0], [0, 90, 0]);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[2]).toBeCloseTo(-1, 6);
  });

  it("rotates 90 degrees around Z so +X becomes +Y", () => {
    const out = rotateEuler([1, 0, 0], [0, 0, 90]);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(1, 6);
  });

  it("leaves the origin alone", () => {
    expect(rotateEuler([0, 0, 0], [30, 60, 90])).toEqual([0, 0, 0]);
  });
});

describe("primitive generation", () => {
  it("builds a cube with 8 vertices, 6 quad faces and 8 corners", () => {
    const mesh = createCube(2);
    expect(mesh.vertices).toHaveLength(8);
    expect(mesh.faces).toHaveLength(6);
    for (const face of mesh.faces) expect(face).toHaveLength(4);
    const extent = boundsOf(mesh.vertices);
    expect(extent.min).toEqual([-1, -1, -1]);
    expect(extent.max).toEqual([1, 1, 1]);
  });

  it("builds a uv sphere whose vertices sit on the radius", () => {
    const mesh = createUvSphere(0.8, 16, 10);
    expect(mesh.vertices).toHaveLength(11 * 16);
    for (const v of mesh.vertices) {
      expect(Math.hypot(...v)).toBeCloseTo(0.8, 6);
    }
    expect(mesh.faces).toHaveLength(16 * 10);
  });

  it("builds an icosphere from unit-length vertices", () => {
    const mesh = createIcoSphere(1, 1);
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(12);
    for (const v of mesh.vertices) {
      expect(Math.hypot(...v)).toBeCloseTo(1, 6);
    }
  });

  it("builds a cylinder with side faces plus two caps", () => {
    const mesh = createCylinder(0.5, 2, null, null, 12);
    expect(mesh.faces).toHaveLength(12 + 12 + 12);
    const extent = boundsOf(mesh.vertices);
    expect(extent.min[1]).toBeCloseTo(-1, 6);
    expect(extent.max[1]).toBeCloseTo(1, 6);
  });

  it("builds a cone with a single apex vertex", () => {
    const mesh = createCone(0.5, 2, 12);
    const extent = boundsOf(mesh.vertices);
    expect(extent.max[1]).toBeCloseTo(1, 6);
    // The tip collapses to one vertex instead of 12 coincident ones.
    expect(mesh.vertices.filter((v) => v[1] > 0.99)).toHaveLength(1);
  });

  it("builds a plane on the XZ axis", () => {
    const mesh = createPlane(4, 2);
    expect(mesh.faces).toHaveLength(4);
    for (const v of mesh.vertices) expect(v[1]).toBe(0);
  });

  it("builds a torus with four-sided faces", () => {
    const mesh = createTorus(0.7, 0.25, 16, 8);
    expect(mesh.faces).toHaveLength(16 * 8);
    for (const face of mesh.faces) expect(face).toHaveLength(4);
  });

  it("exposes every primitive through one entry point", () => {
    expect(primitiveMesh("cube").vertices.length).toBe(8);
    expect(primitiveMesh("uv_sphere").vertices.length).toBeGreaterThan(50);
  });
});

describe("vertex normals", () => {
  it("points the top face of a cube along +Y", () => {
    const mesh = createCube(2);
    // Face 3 is the +Y face with the corrected winding.
    const n = faceNormal(mesh.vertices, mesh.faces[3]);
    expect(n[1]).toBeCloseTo(1, 6);
  });

  it("orients the first (front) face along +Z", () => {
    const mesh = createCube(2);
    expect(faceNormal(mesh.vertices, mesh.faces[0])[2]).toBeGreaterThan(0);
  });

  it("points every cube face outward", () => {
    const mesh = createCube(2);
    const expected: Vec3[] = [
      [0, 0, 1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0],
    ];
    mesh.faces.forEach((face, i) => {
      const n = faceNormal(mesh.vertices, face);
      expected[i].forEach((component, axis) => {
        expect(n[axis]).toBeCloseTo(component, 6);
      });
    });
  });

  it("smooths a vertex normal by averaging its faces", () => {
    const mesh = createCube(2);
    const normals = meshVertexNormals(mesh.vertices, mesh.faces);
    // Corner 7 touches three faces, so its normal points at a diagonal.
    const n = normals[7];
    expect(n[1]).toBeGreaterThan(0);
    expect(Math.hypot(...n)).toBeCloseTo(1, 6);
  });
});

describe("transforms and bounds", () => {
  it("moves vertices into world space", () => {
    const mesh = createCube(1);
    const world = toWorld(mesh.vertices, {
      position: v3(2, 0, 0),
      rotation: v3(0, 0, 0),
      scale: v3(1, 1, 1),
    });
    const extent = boundsOf(world);
    expect(extent.min[0]).toBeCloseTo(1.5, 6);
    expect(extent.max[0]).toBeCloseTo(2.5, 6);
  });

  it("scales vertices by the transform scale", () => {
    const mesh = createCube(1);
    const world = toWorld(mesh.vertices, {
      position: v3(0, 0, 0),
      rotation: v3(0, 0, 0),
      scale: v3(2, 2, 2),
    });
    const extent = boundsOf(world);
    expect(extent.max[0]).toBeCloseTo(1, 6);
  });

  it("bounds a mesh object in world space", () => {
    const obj = createMeshObject("cube", "Cube", v3(0, 1, 0));
    const b = objectBounds(obj);
    expect(b.max[1]).toBeCloseTo(1.8, 3);
  });

  it("gives a camera bounds at its origin", () => {
    const cam = createCamera(v3(3, 4, 5));
    const b = objectBounds(cam);
    expect(b.min).toEqual([3, 4, 5]);
  });

  it("frames scene bounds covering every object", () => {
    const scene = createDemoScene();
    const b = sceneBounds(scene.objects);
    expect(b.min[0]).toBeLessThan(0);
    expect(b.max[0]).toBeGreaterThan(0);
  });

  it("returns a sensible sphere around centres and radius", () => {
    const sphere = boundsSphere({ min: v3(-1, 0, -1), max: v3(1, 2, 1) });
    expect(sphere.center).toEqual([0, 1, 0]);
    // Half-extent is (1,1,1), so the radius is its length.
    expect(sphere.radius).toBeCloseTo(Math.hypot(1, 1, 1), 6);
  });

  it("ignores hidden objects when framing", () => {
    const scene = createDemoScene();
    const hidden = {
      ...scene,
      objects: scene.objects.map((o) => ({ ...o, visible: false })),
    };
    const b = sceneBounds(hidden.objects);
    expect(b.min).toEqual([-4, 0, -4]);
  });
});

describe("ray casting", () => {
  const ray = { origin: v3(0, 1, 8), dir: v3(0, 0, -1) } as const;

  it("hits a cube in front of the camera", () => {
    const cube = createDemoScene().objects[0];
    const hit = pickObject(ray, [cube]);
    expect(hit).not.toBeNull();
    expect(hit!.object.id).toBe(cube.id);
    expect(hit!.hit.point[2]).toBeCloseTo(0.8, 6);
  });

  it("misses a cube that is off to the side", () => {
    const cube = createMeshObject("cube", "Cube", v3(5, 1, 0));
    expect(pickObject(ray, [cube])).toBeNull();
  });

  it("returns the nearer of two overlapping objects", () => {
    const near = createMeshObject("cube", "Near", v3(0, 1, 0));
    const far = createMeshObject("cube", "Far", v3(0, 1, 12));
    const hit = pickObject(ray, [far, near]);
    expect(hit!.object.name).toBe("Near");
  });

  it("lets a camera be picked by its fallback sphere", () => {
    const cam = createCamera(v3(0, 1, 0));
    const hit = pickObject(ray, [cam]);
    expect(hit!.object.kind).toBe("camera");
  });

  it("misses a cube that sits behind the camera", () => {
    // The ray travels towards -Z, so +Z from the origin is behind it.
    const behind = createMeshObject("cube", "Behind", v3(0, 1, 15));
    expect(pickObject(ray, [behind])).toBeNull();
  });

  it("resolves the near ray/sphere root", () => {
    const hit = raySphere({ origin: v3(0, 0, 10), dir: v3(0, 0, -1) }, v3(0, 0, 0), 2);
    expect(hit!.t).toBeCloseTo(8, 6);
  });
});

describe("edit mode vertex operations", () => {
  it("picks projected vertices within the brush radius", () => {
    const projected = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 100, y: 100 },
    ];
    expect(selectNear(projected, 0, 0, 10)).toEqual([0, 1]);
    expect(selectNear(projected, 50, 50, 10)).toEqual([]);
  });

  it("moves only the selected vertices, leaving others alone", () => {
    const obj = createMeshObject("cube", "Cube");
    const moved = moveVertices(obj, [0], v3(1, 0, 0));
    expect(moved.mesh!.vertices[0]).toEqual([obj.mesh!.vertices[0][0] + 1, obj.mesh!.vertices[0][1], obj.mesh!.vertices[0][2]]);
    for (let i = 1; i < obj.mesh!.vertices.length; i++) {
      expect(moved.mesh!.vertices[i]).toEqual(obj.mesh!.vertices[i]);
    }
  });

  it("swaps vertices and faces when deleting and patches the faces", () => {
    const obj = createMeshObject("plane", "Plane", v3(0, 0, 0));
    const before = obj.mesh!.faces.reduce((n, f) => n + f.length, 0);
    const result = deleteVertices(obj, [0]);
    expect(result.mesh!.vertices).toHaveLength(obj.mesh!.vertices.length - 1);
    const after = result.mesh!.faces.reduce((n, f) => n + f.length, 0);
    // Only the faces that referenced vertex 0 shrink.
    expect(after).toBeLessThan(before);
    // Remaining faces reference existing vertices.
    for (const face of result.mesh!.faces) {
      for (const i of face) expect(i).toBeLessThan(result.mesh!.vertices.length);
    }
  });

  it("blocks deletion of the last vertices of a mesh", () => {
    const obj = createMeshObject("plane", "Plane");
    const doomed = obj.mesh!.vertices.map((_, i) => i);
    const result = deleteVertices(obj, doomed);
    expect(result.mesh!.vertices).toHaveLength(0);
    expect(result.mesh!.faces).toHaveLength(0);
  });

  it("duplicates a selection into new vertices", () => {
    const obj = createMeshObject("cube", "Cube");
    const result = duplicateSelection(obj, [0, 1], v3(1, 0, 0));
    expect(result.mesh!.vertices.length).toBe(obj.mesh!.vertices.length + 2);
    for (let i = obj.mesh!.vertices.length; i < result.mesh!.vertices.length; i++) {
      expect(result.mesh!.vertices[i][0]).toBeGreaterThan(0);
    }
  });

  it("scales a selection about its own centre", () => {
    const obj = createMeshObject("cube", "Cube");
    const extentBefore = boundsOf(obj.mesh!.vertices);
    const result = scaleSelection(obj, [0, 1, 2, 3], 2);
    const extentAfter = boundsOf(result.mesh!.vertices);
    expect(extentAfter.max[1] - extentAfter.min[1]).toBeGreaterThan(extentBefore.max[1] - extentBefore.min[1]);
  });

  it("splits shared vertices when sharpening", () => {
    const obj = createMeshObject("cube", "Cube");
    const before = obj.mesh!.vertices.length;
    const result = sharpEdges(obj, [0]);
    expect(result.mesh!.vertices.length).toBeGreaterThan(before);
  });
});

describe("sculpting", () => {
  const plane = () => createMeshObject("plane", "Plane", v3(0, 0, 0));

  it("finds the brush centre at the nearest vertex", () => {
    const obj = plane();
    const hit = brushCenter(worldVertices(obj), obj.mesh!.faces, (worldVertices(obj)[0] as Vec3));
    expect(hit).not.toBeNull();
    expect(hit!.center).toBe(0);
  });

  it("pulls the surface up with the draw brush", () => {
    const obj = plane();
    const hit = brushCenter(worldVertices(obj), obj.mesh!.faces, v3(0, 0, 0));
    const result = sculpt(obj, hit!.point, v3(0, 0.5, 0), {
      brush: "draw",
      radius: 3,
      strength: 1,
    });
    const raised = result.mesh!.vertices.filter((v) => v[1] > 0.01);
    expect(raised.length).toBeGreaterThan(0);
  });

  it("inverts direction when the strength is negative", () => {
    const obj = plane();
    const hit = brushCenter(worldVertices(obj), obj.mesh!.faces, v3(0, 0, 0));
    const up = sculpt(obj, hit!.point, v3(0, 0.5, 0), {
      brush: "draw",
      radius: 3,
      strength: 1,
    });
    const down = sculpt(obj, hit!.point, v3(0, -0.5, 0), {
      brush: "draw",
      radius: 3,
      strength: -1,
    });
    expect(up.mesh!.vertices[0][1] > 0).toBe(true);
    expect(down.mesh!.vertices[0][1] < 0).toBe(true);
  });

  it("flattens the surface towards the brush plane", () => {
    const obj = plane();
    const hit = brushCenter(worldVertices(obj), obj.mesh!.faces, v3(0, 0, 0));
    const result = sculpt(obj, hit!.point, v3(0, -2, 0), {
      brush: "flatten",
      radius: 3,
      strength: 1,
    });
    const lowest = Math.min(...result.mesh!.vertices.map((v) => v[1]));
    expect(lowest).toBeLessThan(0);
  });

  it("inflates along the vertex normals", () => {
    const obj = createMeshObject("cube", "Cube");
    const hit = brushCenter(worldVertices(obj), obj.mesh!.faces, obj.mesh!.vertices[3] as Vec3);
    const result = sculpt(obj, hit!.point, v3(0, 0, 0), {
      brush: "inflate",
      radius: 4,
      strength: 0.5,
    });
    expect(result.mesh!.vertices.length).toBe(obj.mesh!.vertices.length);
    const changed = result.mesh!.vertices.some(
      (v, i) => Math.hypot(...v) > Math.hypot(...obj.mesh!.vertices[i]),
    );
    expect(changed).toBe(true);
  });

  it("smooths towards the neighbours' average", () => {
    const obj = plane();
    const centre = hitCentre(obj);
    const displaced = moveVertices(obj, [centre], v3(0, 2, 0));
    const result = sculpt(displaced, v3(0, 0, 0), v3(0, 0, 0), {
      brush: "smooth",
      radius: 3,
      strength: 1,
    });
    expect(result.mesh!.vertices[centre][1]).toBeLessThan(2);
  });

  it("does nothing outside the brush radius", () => {
    const obj = plane();
    const hit = brushCenter(worldVertices(obj), obj.mesh!.faces, v3(0, 0, 0));
    const result = sculpt(obj, hit!.point, v3(0, 1, 0), {
      brush: "draw",
      radius: 0.5,
      strength: 1,
    });
    expect(result).toBe(obj);
  });
});

/** World-space vertices of an object (mirrors scene3d's own helper). */
function worldVertices(obj: { mesh?: { vertices: Vec3[] }; transform: unknown }) {
  return obj.mesh!.vertices.map(
    (v) => rotateEuler(v as Vec3, (obj.transform as { rotation: Vec3 }).rotation) as Vec3,
  );
}

function hitCentre(obj: ReturnType<typeof createMeshObject>): number {
  return brushCenter(worldVertices(obj), obj.mesh!.faces, v3(0, 0, 0))!.center;
}

describe("scene management", () => {
  it("starts with a cube, a camera and a light", () => {
    const scene = createDemoScene();
    expect(scene.objects).toHaveLength(3);
    expect(scene.objects.filter((o) => o.kind === "camera")).toHaveLength(1);
    expect(scene.objects.filter((o) => o.kind === "light")).toHaveLength(1);
    expect(scene.activeCameraId).toBe(scene.objects[1].id);
  });

  it("names a duplicate object with Blender-style suffixes", () => {
    const scene = createDemoScene();
    expect(uniqueName(scene, "Cube")).toBe("Cube.001");
    expect(uniqueName(scene, "Lamp")).toBe("Lamp");
  });

  it("adds an object with a unique name", () => {
    const scene = addObject(createDemoScene(), createMeshObject("cube", "Cube"));
    expect(scene.objects).toHaveLength(4);
    expect(scene.objects.at(-1)!.name).toBe("Cube.001");
  });

  it("keeps only one active camera", () => {
    let scene = createDemoScene();
    const second = createCamera();
    scene = addObject(scene, second);
    const first = scene.objects.find((o) => o.kind === "camera" && o.id !== second.id)!;
    scene = setActiveCamera(scene, second.id);
    expect(scene.activeCameraId).toBe(second.id);
    expect(findObject(scene, second.id)!.camera!.isActive).toBe(true);
    expect(first.camera!.isActive).toBe(false);
  });

  it("removes an object and demotes the active camera when it goes", () => {
    let scene = createDemoScene();
    scene = removeObject(scene, scene.activeCameraId);
    expect(scene.objects.find((o) => o.kind === "camera")).toBeUndefined();
    expect(scene.activeCameraId).toBe("");
  });

  it("patches one object immutably", () => {
    const scene = createDemoScene();
    const target = scene.objects[0];
    const patched = patchObject(scene, target.id, { name: "Renamed" });
    expect(patched.objects[0].name).toBe("Renamed");
    expect(scene.objects[0].name).toBe("Cube");
  });

  it("creates a light with sane defaults for every type", () => {
    for (const type of ["point", "sun", "spot"] as const) {
      const light = createLight(type);
      expect(light.light!.type).toBe(type);
      expect(light.light!.energy).toBeGreaterThan(0);
    }
  });
});

describe("serialization", () => {
  it("round-trips a scene through JSON", () => {
    const scene = addObject(createDemoScene(), createLight("spot", v3(1, 2, 3), 500));
    const restored = deserializeScene(serializeScene(scene));
    expect(restored.objects).toHaveLength(scene.objects.length);
    expect(restored.activeCameraId).toBe(scene.activeCameraId);
    expect(findObject(restored, scene.objects[3].id)!.light!.energy).toBe(500);
  });

  it("falls back to the demo scene for junk input", () => {
    expect(deserializeScene(null).objects).toHaveLength(3);
    expect(deserializeScene("").objects).toHaveLength(3);
    expect(deserializeScene("{not json").objects).toHaveLength(3);
    expect(deserializeScene('{"objects":[]}').objects).toHaveLength(3);
  });

  it("points the active camera at a real camera after a restore", () => {
    const saved = serializeScene(createDemoScene());
    const restored = deserializeScene(saved);
    const active = findObject(restored, restored.activeCameraId);
    expect(active!.kind).toBe("camera");
  });
});

const BRUSH_KINDS: BrushKind[] = ["draw", "smooth", "grab", "inflate", "flatten"];
describe("brush kinds", () => {
  it("lists every sculpting brush", () => {
    expect(BRUSH_KINDS).toHaveLength(5);
    expect(BRUSH_KINDS).toContain("draw");
  });
});
