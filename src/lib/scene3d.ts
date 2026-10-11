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

// ------------------------------------------------------------ primitive builders

/** A box with `size` sides, centred on the origin. */
export const createCube = (size = 1): MeshData => {
  const s = size / 2;
  const vertices: Vec3[] = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
  ];
  const faces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 2, 6, 5],
  ];
  return { vertices, faces };
};

/** A uv sphere: quads between rings, two poles. */
export const createUvSphere = (radius = 1, segments = 24, rings = 16): MeshData => {
  const vertices: Vec3[] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      vertices.push([
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      ]);
    }
  }
  const faces: number[][] = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      const a = r * segments + s;
      const b = r * segments + s1;
      const c = (r + 1) * segments + s1;
      const d = (r + 1) * segments + s;
      faces.push([a, b, c, d]);
    }
  }
  return { vertices, faces };
};

/** An icosphere: a subdivided octahedron, evenly distributed vertices. */
export const createIcoSphere = (radius = 1, subdivisions = 1): MeshData => {
  const t = (1 + Math.sqrt(5)) / 2;
  let vertices: Vec3[] = (
    [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ] as Vec3[]
  ).map((p) => normalize(p));
  let faces: number[][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let pass = 0; pass < subdivisions; pass++) {
    const next: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = midpointVert(vertices, a, b);
      const bc = midpointVert(vertices, b, c);
      const ca = midpointVert(vertices, c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  // midpoints are unit-length from the starts normalise everything to the
  // requested radius.
  return { vertices: vertices.map((p) => scale(p, radius)), faces };
};

/** Adds the unit-length midpoint of two vertices and returns its index. */
function midpointVert(vertices: Vec3[], a: number, b: number): number {
  vertices.push(normalize(add(vertices[a], vertices[b])));
  return vertices.length - 1;
}

/** A cylinder (or cone when radiusTop is 0) along +Y. */
export const createCylinder = (
  radius = 0.6, depth = 2, radiusTop: number | null = null, radiusBottom: number | null = null,
  segments = 24,
): MeshData => {
  const top = radiusTop ?? radius;
  const bottom = radiusBottom ?? radius;
  const vertices: Vec3[] = [];
  for (let s = 0; s < segments; s++) {
    const theta = (s / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);
    vertices.push([x * bottom, -depth / 2, z * bottom]);
  }
  for (let s = 0; s < segments; s++) {
    const theta = (s / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);
    vertices.push([x * top, depth / 2, z * top]);
  }
  const faces: number[][] = [];
  for (let s = 0; s < segments; s++) {
    const s1 = (s + 1) % segments;
    faces.push([s, s1, segments + s1, segments + s]);
  }
  // Caps, collapsed into a triangle when one radius is 0.
  const bottomCenter = vertices.length;
  vertices.push([0, -depth / 2, 0]);
  for (let s = 0; s < segments; s++) faces.push([bottomCenter, (s + 1) % segments, s]);
  const topCenter = vertices.length;
  vertices.push([0, depth / 2, 0]);
  for (let s = 0; s < segments; s++) {
    faces.push([topCenter, segments + s, segments + ((s + 1) % segments)]);
  }
  return { vertices, faces };
};

/** Convenience wrappers for the two cylinder variants. */
export const createCone = (radius = 0.6, depth = 2, segments = 24): MeshData =>
  createCylinder(radius, depth, 0, radius, segments);

/** A flat square in the XZ plane, subdivided so it can be sculpted. */
export const createPlane = (size = 4, divisions = 2): MeshData => {
  const vertices: Vec3[] = [];
  const step = size / divisions;
  const half = size / 2;
  for (let z = 0; z <= divisions; z++) {
    for (let x = 0; x <= divisions; x++) {
      vertices.push([-half + x * step, 0, -half + z * step]);
    }
  }
  const faces: number[][] = [];
  const row = divisions + 1;
  for (let z = 0; z < divisions; z++) {
    for (let x = 0; x < divisions; x++) {
      const a = z * row + x;
      const b = a + 1;
      const c = (z + 1) * row + x + 1;
      const d = (z + 1) * row + x;
      faces.push([a, b, c, d]);
    }
  }
  return { vertices, faces };
};

/** A torus around +Y. */
export const createTorus = (radius = 0.7, tube = 0.25, rings = 32, sides = 16): MeshData => {
  const vertices: Vec3[] = [];
  for (let r = 0; r < rings; r++) {
    const phi = (r / rings) * Math.PI * 2;
    for (let s = 0; s < sides; s++) {
      const theta = (s / sides) * Math.PI * 2;
      const rr = radius + tube * Math.cos(theta);
      vertices.push([rr * Math.cos(phi), tube * Math.sin(theta), rr * Math.sin(phi)]);
    }
  }
  const faces: number[][] = [];
  for (let r = 0; r < rings; r++) {
    const r1 = (r + 1) % rings;
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      faces.push([r * sides + s, r * sides + s1, r1 * sides + s1, r1 * sides + s]);
    }
  }
  return { vertices, faces };
};

/**
 * Blender's mascot mesh — a coarse stand-in with the same silhouette
 * (head, ears, nostrils, jaw) so a scene can include one without shipping a
 * large asset.
 */
export const createSuzanne = (size = 1): MeshData => {
  const s = size / 2;
  const vertices: Vec3[] = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
    [-s * 1.35, s * 1.45, s * 0.9], [0, s * 1.5, s * 0.4], [s * 1.35, s * 1.45, s * 0.9],
    [-s * 1.35, s * 1.1, s * 1.1], [s * 1.35, s * 1.1, s * 1.1],
    [-s * 0.5, -s * 1.6, s * 0.2], [s * 0.5, -s * 1.6, s * 0.2],
  ];
  const faces: number[][] = [
    [0, 1, 2, 3], [4, 5, 6, 7],
    [0, 4, 12, 8], [8, 12, 7, 11], [7, 6, 13, 11], [11, 13, 4, 0],
    [1, 5, 13, 6], [2, 3, 9, 8], [8, 9, 14, 12],
    [1, 2, 14, 13], [5, 6, 13, 4],
    [12, 14, 9, 7], [3, 0, 8, 9], [2, 1, 13, 14],
    [14, 13, 5, 4], [9, 7, 11, 12],
  ];
  return { vertices, faces };
};

// --------------------------------------------------------------- mesh transforms

/** Applies an object transform, returning vertices in world space. */
export function toWorld(vertices: Vec3[], t: Transform): Vec3[] {
  return vertices.map((v) => {
    const scaled: Vec3 = [v[0] * t.scale[0], v[1] * t.scale[1], v[2] * t.scale[2]];
    const rotated = rotateEuler(scaled, t.rotation);
    return add(rotated, t.position);
  });
}

/** World-space vertices of an object's mesh (empty for non-mesh objects). */
export function worldVertices(obj: SceneObject): Vec3[] {
  return obj.mesh ? toWorld(obj.mesh.vertices, obj.transform) : [];
}

/** Unit normal of a polygon, using the first three distinct vertices. */
export function faceNormal(world: Vec3[], face: number[]): Vec3 {
  if (face.length < 3) return v3(0, 1, 0);
  const a = world[face[0]];
  const b = world[face[1]];
  const c = world[face[2]];
  return normalize(cross(sub(b, a), sub(c, a)));
}

/** Vertex normals, averaged from the faces that touch each vertex. */
export function meshVertexNormals(vertices: Vec3[], faces: number[][]): Vec3[] {
  const normals: Vec3[] = vertices.map(() => v3(0, 0, 0));
  for (const face of faces) {
    const n = faceNormal(vertices, face);
    for (const i of face) {
      normals[i] = add(normals[i], n);
    }
  }
  return normals.map(normalize);
}

/** Axis-aligned bounds of a set of vertices. */
export function boundsOf(vertices: Vec3[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of vertices) {
    if (v[0] < min[0]) min[0] = v[0];
    if (v[1] < min[1]) min[1] = v[1];
    if (v[2] < min[2]) min[2] = v[2];
    if (v[0] > max[0]) max[0] = v[0];
    if (v[1] > max[1]) max[1] = v[1];
    if (v[2] > max[2]) max[2] = v[2];
  }
  return { min, max };
}

/** Bounds of a whole object (falls back to a small box at its origin). */
export function objectBounds(obj: SceneObject): { min: Vec3; max: Vec3 } {
  const world = worldVertices(obj);
  if (world.length === 0) {
    const { position } = obj.transform;
    return { min: [...position] as Vec3, max: [...position] as Vec3 };
  }
  return boundsOf(world);
}

/** Bounds covering a list of objects; empty bounds when nothing is pickable. */
export function sceneBounds(objects: SceneObject[]): { min: Vec3; max: Vec3 } {
  const visible: Vec3[] = [];
  for (const obj of objects) {
    if (!obj.visible) continue;
    const world = worldVertices(obj);
    if (world.length === 0) {
      const { position } = obj.transform;
      visible.push([...position] as Vec3);
    } else {
      visible.push(...world);
    }
  }
  if (visible.length === 0) return { min: v3(-4, 0, -4), max: v3(4, 2, 4) };
  return boundsOf(visible);
}

/** The centre and radius of the sphere enclosing a bounds box. */
export function boundsSphere(b: { min: Vec3; max: Vec3 }): { center: Vec3; radius: number } {
  const center = lerp(b.min, b.max, 0.5);
  const half = scale(sub(b.max, b.min), 0.5);
  return { center, radius: Math.max(0.001, length(half)) };
}

// -------------------------------------------------------------------- ray casts

export interface Ray {
  origin: Vec3;
  dir: Vec3;
}

export interface MeshHit {
  /** Distance along the ray. */
  t: number;
  /** Face index that was hit, or -1 for a sphere fallback. */
  face: number;
  point: Vec3;
}

/**
 * Moller–Trumbore ray/triangle intersection. Returns the nearest triangle hit
 * in front of the ray, or null.
 */
export function intersectTriangles(ray: Ray, vertices: Vec3[], faces: number[][]): MeshHit | null {
  let best: MeshHit | null = null;
  for (const face of faces) {
    if (face.length < 3) continue;
    // Fan-triangulate polygons so quads are supported too.
    for (let k = 1; k < face.length - 1; k++) {
      const a = vertices[face[0]];
      const b = vertices[face[k]];
      const c = vertices[face[k + 1]];
      const t = intersectTriangle(ray, a, b, c);
      if (t === null) continue;
      if (best && t >= best.t) continue;
      best = { t, face: faces.indexOf(face), point: add(ray.origin, scale(ray.dir, t)) };
    }
  }
  return best;
}

function intersectTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
  const EPS = 1e-9;
  const edge1 = sub(b, a);
  const edge2 = sub(c, a);
  const h = cross(ray.dir, edge2);
  const det = dot(edge1, h);
  if (det > -EPS && det < EPS) return null;
  const inv = 1 / det;
  const s = sub(ray.origin, a);
  const u = inv * dot(s, h);
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  const q = cross(s, edge1);
  const v = inv * dot(ray.dir, q);
  if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  const t = inv * dot(edge2, q);
  return t > EPS ? t : null;
}

/** The nearest world-space object hit by a ray, if any. */
export function pickObject(
  ray: Ray,
  objects: SceneObject[],
): { object: SceneObject; hit: MeshHit } | null {
  let best: { object: SceneObject; hit: MeshHit } | null = null;
  for (const obj of objects) {
    if (!obj.visible) continue;
    const world = worldVertices(obj);
    // Cameras and lights have no mesh; fall back to a small pick sphere so
    // they stay selectable by clicking them in the viewport.
    if (world.length === 0 || !obj.mesh) {
      const { position } = obj.transform;
      const hit = raySphere(ray, position, 0.45);
      if (hit !== null && (!best || hit.t < best.hit.t)) {
        best = { object: obj, hit: { t: hit.t, face: -1, point: add(ray.origin, scale(ray.dir, hit.t)) } };
      }
      continue;
    }
    const hit = intersectTriangles(ray, world, obj.mesh.faces);
    if (hit && (!best || hit.t < best.hit.t)) best = { object: obj, hit };
  }
  return best;
}

/** Ray/sphere intersection distance, or null when there is no forward hit. */
export function raySphere(ray: Ray, center: Vec3, radius: number): { t: number } | null {
  const oc = sub(ray.origin, center);
  const b = dot(oc, ray.dir);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const t1 = -b - sqrt;
  const t2 = -b + sqrt;
  if (t1 > 1e-6) return { t: t1 };
  if (t2 > 1e-6) return { t: t2 };
  return null;
}

// --------------------------------------------------------------- edit mode

/** Select vertices near a projected screen position. */
export function selectNear(
  projected: { x: number; y: number }[],
  x: number,
  y: number,
  radius = 14,
): number[] {
  const picked: number[] = [];
  for (let i = 0; i < projected.length; i++) {
    const p = projected[i];
    if (Math.hypot(p.x - x, p.y - y) <= radius) picked.push(i);
  }
  return picked;
}

/** Moves selected vertices in object-local space. */
export function moveVertices(obj: SceneObject, indices: number[], delta: Vec3): SceneObject {
  if (!obj.mesh) return obj;
  const vertices = obj.mesh.vertices.map((v, i) =>
    indices.includes(i) ? add(v, delta) : v,
  );
  return { ...obj, mesh: { ...obj.mesh, vertices } };
}

/** Scales selected vertices about their shared centre. */
export function scaleSelection(obj: SceneObject, indices: number[], factor: number): SceneObject {
  if (!obj.mesh || indices.length === 0) return obj;
  const points = indices.map((i) => obj.mesh!.vertices[i]);
  const { center } = boundsSphere(boundsOf(points));
  const vertices = obj.mesh.vertices.map((v, i) =>
    indices.includes(i) ? add(center, scale(sub(v, center), factor)) : v,
  );
  return { ...obj, mesh: { ...obj.mesh, vertices } };
}

/** Deletes vertices and rewrites the faces so no index dangles. */
export function deleteVertices(obj: SceneObject, indices: number[]): SceneObject {
  if (!obj.mesh || indices.length === 0) return obj;
  const doomed = new Set(indices);
  const kept: Vec3[] = [];
  const remap = new Map<number, number>();
  obj.mesh.vertices.forEach((v, i) => {
    if (doomed.has(i)) return;
    remap.set(i, kept.length);
    kept.push(v);
  });
  const faces = obj.mesh.faces
    .filter((face) => !face.some((i) => doomed.has(i)))
    .map((face) => face.map((i) => remap.get(i)!));
  return { ...obj, mesh: { vertices: kept, faces } };
}

/** Duplicates the selected vertices into a shell of fresh geometry. */
export function duplicateSelection(obj: SceneObject, indices: number[], offset: Vec3): SceneObject {
  if (!obj.mesh || indices.length === 0) return obj;
  const vertices = [...obj.mesh.vertices];
  const base = vertices.length;
  for (const i of indices) vertices.push(add(obj.mesh.vertices[i], offset));
  const faces = obj.mesh.faces.map((face) => {
    const all = face.every((i) => indices.includes(i));
    return all ? face.map((i) => base + indices.indexOf(i)) : face;
  });
  return { ...obj, mesh: { vertices, faces } };
}

/** Splits selected vertices per face so their edges shade sharp. */
export function sharpEdges(obj: SceneObject, indices: number[]): SceneObject {
  if (!obj.mesh || indices.length === 0) return obj;
  const chosen = new Set(indices);
  const vertices = [...obj.mesh.vertices];
  // Faces that already claimed a vertex; later ones get a clone.
  const claimed = new Set<number>();
  const faces = obj.mesh.faces.map((face) =>
    face.map((i) => {
      if (!chosen.has(i)) return i;
      if (claimed.has(i)) {
        vertices.push([...obj.mesh!.vertices[i]] as Vec3);
        return vertices.length - 1;
      }
      claimed.add(i);
      return i;
    }),
  );
  return { ...obj, mesh: { vertices, faces } };
}

// ------------------------------------------------------------------- sculpting

export const BRUSH_KINDS: BrushKind[] = ["draw", "smooth", "grab", "inflate", "flatten"];

export interface BrushHit {
  /** Vertex index nearest the brush centre. */
  center: number;
  /** Point on the surface, in object-local space. */
  point: Vec3;
  /** Face normal at the hit. */
  normal: Vec3;
}

/** Finds the brush centre: the mesh vertex closest to a world-space point. */
export function brushCenter(world: Vec3[], faces: number[][], point: Vec3): BrushHit | null {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < world.length; i++) {
    const d = length(sub(world[i], point));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best < 0) return null;
  const on: number[][] = [];
  faces.forEach((face, fi) => {
    if (face.includes(best)) on.push([fi, ...face]);
  });
  const normal = on.length
    ? faceNormal(world, on[0].slice(1))
    : v3(0, 1, 0);
  return { center: best, point: world[best], normal };
}

export interface SculptOptions {
  brush: BrushKind;
  /** Brush radius in world units. */
  radius: number;
  /** -1..1; negative inverts (subtract). */
  strength: number;
}

/**
 * Applies one sculpt stroke step to the object-local vertices. `delta` is the
 * movement of the brush in local space; the brush direction follows the
 * surface normal at the hit.
 */
export function sculpt(
  obj: SceneObject,
  localPoint: Vec3,
  delta: Vec3,
  opts: SculptOptions,
  normals?: Vec3[],
): SceneObject {
  if (!obj.mesh) return obj;
  const { radius, strength, brush } = opts;
  if (radius <= 0) return obj;
  const sn = normals ?? meshVertexNormals(obj.mesh.vertices, obj.mesh.faces);

  const vertices = obj.mesh.vertices.map((v, i) => {
    const dist = length(sub(v, localPoint));
    if (dist > radius) return v;
    // Smooth falloff keeps the surface continuous at the brush edge.
    const t = 1 - dist / radius;
    const weight = t * t * (3 - 2 * t) * Math.abs(strength);
    if (weight === 0) return v;

    switch (brush) {
      case "draw":
        return add(v, scale(add(delta, scale(sn[i], dot(delta, sn[i]))), weight));
      case "grab":
        return add(v, scale(delta, weight));
      case "inflate":
        return add(v, scale(sn[i], strength * weight));
      case "flatten": {
        // Pull towards the brush's entry plane (along the surface normal).
        return add(v, scale(sn[i], -dot(sub(v, localPoint), sn[i]) * weight));
      }
      case "smooth": {
        const neighbours = obj.mesh!.faces
          .filter((f) => f.includes(i))
          .flatMap((f) => f.filter((j) => j !== i))
          .map((j) => obj.mesh!.vertices[j]);
        if (neighbours.length === 0) return v;
        const avg = neighbours
          .reduce((acc, p) => add(acc, p), v3(0, 0, 0));
        const target = scale(avg, 1 / (neighbours.length + 1));
        return lerp(v, target, weight);
      }
      default:
        return v;
    }
  });
  return { ...obj, mesh: { ...obj.mesh, vertices } };
}

// ------------------------------------------------------------------ scene setup

const DEG = Math.PI / 180;

export const PRIMITIVE_LABELS: Record<PrimitiveKind, string> = {
  cube: "Cube",
  uv_sphere: "UV Sphere",
  ico_sphere: "Ico Sphere",
  cylinder: "Cylinder",
  cone: "Cone",
  plane: "Plane",
  torus: "Torus",
  suzanne: "Suzanne",
};

/** Builds the mesh for a primitive kind at its default size. */
export function primitiveMesh(kind: PrimitiveKind): MeshData {
  switch (kind) {
    case "cube": return createCube(1.6);
    case "uv_sphere": return createUvSphere(0.9, 24, 16);
    case "ico_sphere": return createIcoSphere(0.9, 1);
    case "cylinder": return createCylinder(0.6, 1.8, null, null, 24);
    case "cone": return createCone(0.65, 1.8, 24);
    case "plane": return createPlane(4, 2);
    case "torus": return createTorus(0.7, 0.25, 32, 16);
    case "suzanne": return createSuzanne(1.2);
  }
}

const PALETTE = ["#e0e0e0", "#4772b3", "#c98b4b", "#8fc07f", "#b36bb0", "#c05b5b"];

let idCounter = 0;
export function nextId(prefix = "obj"): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Test seam for deterministic ids. */
export function resetIdCounter(): void {
  idCounter = 0;
}

export function defaultTransform(): Transform {
  return { position: v3(0, 0, 0), rotation: v3(0, 0, 0), scale: v3(1, 1, 1) };
}

/** Creates a mesh object for a primitive kind. */
export function createMeshObject(
  kind: PrimitiveKind,
  name: string,
  position: Vec3 = v3(0, 0.9, 0),
): SceneObject {
  return {
    id: nextId("mesh"),
    name,
    kind: "mesh",
    primitive: kind,
    mesh: primitiveMesh(kind),
    transform: { ...defaultTransform(), position },
    color: PALETTE[idCounter % PALETTE.length],
    visible: true,
  };
}

/** Creates a camera facing -Z from `position`, at an optional roll. */
export function createCamera(position: Vec3 = v3(7, 5, 9), rotation: Vec3 = v3(-55, 0, -18)): SceneObject {
  return {
    id: nextId("cam"),
    name: "Camera",
    kind: "camera",
    transform: { position, rotation, scale: v3(1, 1, 1) },
    color: "#2a2a2a",
    visible: true,
    camera: { fov: 50, isActive: false },
  };
}

/** Creates a light source; suns point straight down, spots point forward. */
export function createLight(
  type: LightKind = "point",
  position: Vec3 = v3(4, 6, 3),
  energy = 800,
): SceneObject {
  const rotation =
    type === "sun"
      ? [45 * DEG, 40 * DEG, 0]
      : [35 * DEG, -20 * DEG, 0];
  return {
    id: nextId("light"),
    name: type === "sun" ? "Sun" : type === "spot" ? "Spot" : "Point",
    kind: "light",
    transform: { ...defaultTransform(), position, rotation: rotation as Vec3 },
    color: "#fff2d6",
    visible: true,
    light: { type, energy, color: "#fff2d6" },
  };
}

/** A fresh studio scene: a camera, a sun light and the starter cube. */
export function createDemoScene(): Scene {
  const cube = createMeshObject("cube", "Cube", v3(0, 1, 0));
  const camera = createCamera();
  const sun = createLight("sun", v3(3, 7, 2));
  // The starter camera is the one you look through.
  camera.camera!.isActive = true;
  return { objects: [cube, camera, sun], activeCameraId: camera.id };
}

/** Gives an object a unique name inside the scene. */
export function uniqueName(scene: Scene, base: string): string {
  const taken = new Set(scene.objects.map((o) => o.name));
  let n = 1;
  let name = base;
  while (taken.has(name)) {
    n += 1;
    name = `${base}.${String(n).padStart(3, "0")}`;
  }
  return name;
}

/** Adds an object to the scene with a collision-free name. */
export function addObject(scene: Scene, obj: SceneObject): Scene {
  const named = { ...obj, name: uniqueName(scene, obj.name) };
  return { ...scene, objects: [...scene.objects, named] };
}

/** Removes an object; replaces the active camera when it goes away. */
export function removeObject(scene: Scene, id: string): Scene {
  const objects = scene.objects.filter((o) => o.id !== id);
  const activeCameraId =
    scene.activeCameraId === id
      ? objects.find((o) => o.kind === "camera" && o.camera?.isActive)?.id ??
        objects.find((o) => o.kind === "camera")?.id ??
        ""
      : scene.activeCameraId;
  return { objects, activeCameraId };
}

/** Finds an object by id. */
export const findObject = (scene: Scene, id: string | null): SceneObject | undefined =>
  id ? scene.objects.find((o) => o.id === id) : undefined;

/** The camera currently marked active. */
export function activeCamera(scene: Scene): SceneObject | undefined {
  return findObject(scene, scene.activeCameraId);
}

/** Applies a patch to one object, returning a new scene. */
export function patchObject(scene: Scene, id: string, patch: Partial<SceneObject>): Scene {
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
}

/** Sets which camera is active; only one may be at a time. */
export function setActiveCamera(scene: Scene, id: string): Scene {
  return {
    ...scene,
    activeCameraId: id,
    objects: scene.objects.map((o) =>
      o.kind === "camera"
        ? { ...o, camera: { ...o.camera!, isActive: o.id === id } }
        : o,
    ),
  };
}

// --------------------------------------------------------------- serialization

/** Safe, versioned serialization for saving a scene into a game record. */
export function serializeScene(scene: Scene): string {
  return JSON.stringify({
    version: 1,
    activeCameraId: scene.activeCameraId,
    objects: scene.objects,
  });
}

/** Reads a serialized scene back, falling back to the demo when unusable. */
export function deserializeScene(json: string | null | undefined): Scene {
  if (!json) return createDemoScene();
  try {
    const parsed = JSON.parse(json) as Partial<Scene>;
    if (!parsed || !Array.isArray(parsed.objects) || parsed.objects.length === 0) {
      return createDemoScene();
    }
    const objects = parsed.objects.map((o) => ({
      ...o,
      transform: o.transform ?? defaultTransform(),
      visible: o.visible ?? true,
    })) as SceneObject[];
    const cameras = objects.filter((o) => o.kind === "camera");
    const activeCameraId =
      (parsed.activeCameraId && cameras.some((c) => c.id === parsed.activeCameraId)
        ? parsed.activeCameraId
        : cameras.find((c) => c.camera?.isActive)?.id) ?? cameras[0]?.id ?? "";
    return { objects, activeCameraId };
  } catch {
    return createDemoScene();
  }
}
