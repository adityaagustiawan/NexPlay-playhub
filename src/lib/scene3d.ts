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
  let vertices: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((p) => normalize(p)) as Vec3[];
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
    vertices = vertices.map((p) => normalize(scale(p, radius))) as Vec3[];
    faces = next;
  }
  return { vertices: vertices.map((p) => scale(p, radius)), faces };
};

/** Shared cache of midpoint vertices while subdividing an icosphere. */
function midpointVert(vertices: Vec3[], a: number, b: number): number {
  const mid = scale(normalize(add(vertices[a], vertices[b])), 1);
  vertices.push(mid);
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
