// gltf.ts — real 3D interchange formats for NexPlay Studio.
//
// The studio's scene can leave the app: export to glTF-Binary (.glb), Wavefront
// OBJ (.obj) or ASCII STL (.stl) for Blender / Unity / MS 3D Viewer / printing,
// and import .glb / .obj back in. 3D is "different from 2D": these exporters do
// NOT paint the procedural 2D game — they transport actual mesh geometry.
//
// Conventions: both scene3d and glTF are right-handed, +Y up. On import we bake
// each node's world matrix into the vertices (the studio then owns the object);
// on export we write per-object mesh primitives + TRS node matrices so the file
// opens with the same hierarchy the artist sees.
import type { MeshData, Scene, SceneObject, Vec3 } from "./scene3d";

export interface ImportedMesh {
  name: string;
  mesh: MeshData;
  /** Optional material colour from the source file (base color). */
  color?: string;
}

// ------------------------------------------------------------------ utilities

/** Triangulates a mix of quads/n-gons into triangles (fan for n > 3). */
export function triangulate(faces: number[][]): number[][] {
  const out: number[][] = [];
  for (const f of faces) {
    if (f.length === 3) {
      out.push([f[0], f[1], f[2]]);
    } else if (f.length === 4) {
      out.push([f[0], f[1], f[2]], [f[0], f[2], f[3]]);
    } else if (f.length > 3) {
      for (let k = 1; k < f.length - 1; k++) out.push([f[0], f[k], f[k + 1]]);
    }
  }
  return out;
}

/** Unit-length face normal (area-weighted cross product). */
export function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]);
  return len > 1e-12 ? [n[0] / len, n[1] / len, n[2] / len] : [0, 0, 1];
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.88, 0.88, 0.88];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

const IDENTITY: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function isIdentity(m: number[]): boolean {
  for (let i = 0; i < 16; i++) if (Math.abs(m[i] - IDENTITY[i]) > 1e-9) return false;
  return true;
}

/** Column-major 4x4 multiply: a * b. */
function matMul(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

function quatToMat(q: number[]): number[] {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

/** TRS → column-major matrix (glTF default component order: rotation, translation, scale). */
export function composeMatrix(t?: number[], q?: number[], s?: number[]): number[] {
  let m = IDENTITY;
  if (q && q.length === 4) m = matMul(m, quatToMat(q));
  if (s && s.length === 3) m = matMul(m, [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1]);
  if (t && t.length === 3) m[12] = t[0], m[13] = t[1], m[14] = t[2];
  return m;
}

/** Scene-object TRS → matrix, matching scene3d's X→Y→Z Euler application. */
function sceneObjectMatrix(obj: SceneObject): number[] {
  const { position, rotation, scale } = obj.transform;
  const rx = rotate(rotation, [1, 0, 0]);
  const ry = rotate(rotation, [0, 1, 0]);
  const rz = rotate(rotation, [0, 0, 1]);
  return [
    rx[0] * scale[0], rx[1] * scale[0], rx[2] * scale[0], 0,
    ry[0] * scale[1], ry[1] * scale[1], ry[2] * scale[1], 0,
    rz[0] * scale[2], rz[1] * scale[2], rz[2] * scale[2], 0,
    position[0], position[1], position[2], 1,
  ];
}

/** Rotates a vector by scene3d Euler degrees (mirrors rotateEuler semantics). */
function rotate(deg: Vec3, p: Vec3): Vec3 {
  let [x, y, z] = p;
  const rz = (deg[2] * Math.PI) / 180;
  const rx = (deg[0] * Math.PI) / 180;
  const ry = (deg[1] * Math.PI) / 180;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x, y, z];
}

function applyMatrix(m: number[], v: Vec3): Vec3 {
  if (isIdentity(m)) return v;
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

/** Objects that carry drawable geometry (meshes with faces). */
export function sceneMeshObjects(scene: Scene): SceneObject[] {
  return scene.objects.filter((o) => o.kind === "mesh" && o.mesh && o.mesh.faces.length > 0);
}

// ----------------------------------------------------------------- import GLB

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
}
interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}
interface GltfNode {
  name?: string;
  mesh?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  children?: number[];
}
interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const COMPONENT_SIZE: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
};
const TYPE_SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readAccessor(
  bin: Uint8Array,
  bufferViews: GltfBufferView[],
  acc: GltfAccessor,
): Float32Array | Uint16Array | Uint32Array {
  const bv = bufferViews[acc.bufferView ?? 0];
  const base = (bv?.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const compSize = COMPONENT_SIZE[acc.componentType];
  const count = acc.count;
  const comps = TYPE_SIZE[acc.type] ?? 1;
  const stride = bv?.byteStride ? (bv.byteStride >> 2) * 4 : compSize * comps;
  const strideBytes = bv?.byteStride ?? compSize * comps;
  const layout: "f32" | "u16" | "u32" =
    acc.componentType === 5126 ? "f32" : acc.componentType === 5123 ? "u16" : "u32";
  const out =
    layout === "f32"
      ? new Float32Array(count * comps)
      : layout === "u16"
        ? new Uint16Array(count * comps)
        : new Uint32Array(count * comps);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < comps; c++) {
      const off = base + i * strideBytes + c * compSize;
      if (layout === "f32") out[i * comps + c] = dv.getFloat32(off, true);
      else if (layout === "u16") out[i * comps + c] = dv.getUint16(off, true);
      else out[i * comps + c] = dv.getUint32(off, true);
    }
  }
  return out as Float32Array;
}

/** Parses a glTF-Binary (.glb) file into importable meshes (world-space baked). */
export function importGlb(data: ArrayBuffer): ImportedMesh[] {
  const bytes = new Uint8Array(data);
  if (bytes.length < 20) throw new Error("File is too small to be a GLB.");
  const dv = new DataView(data);
  const magic = dv.getUint32(0, true);
  const version = dv.getUint32(4, true);
  if (magic !== 0x46546c67) throw new Error("Not a glTF binary (.glb) file.");
  if (version !== 2) throw new Error(`Unsupported glTF version ${version}.`);

  let jsonText = "";
  let bin: Uint8Array = new Uint8Array(0);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + len);
    if (type === 0x4e4f534a) jsonText = new TextDecoder().decode(chunk);
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + len + (len % 4);
  }
  // Defensive: zero-padded JSON chunks exist in the wild; spaces are whitespace.
  const json = JSON.parse(jsonText.replace(/\0/g, " ").trim()) as any;
  const buffers = json.buffers ?? [];
  const bufferViews: GltfBufferView[] = json.bufferViews ?? [];
  const accessors: GltfAccessor[] = json.accessors ?? [];
  const meshes: any[] = json.meshes ?? [];
  const nodes: GltfNode[] = json.nodes ?? [];
  const materials: any[] = json.materials ?? [];

  const colorForMaterial = (mi?: number): string | undefined => {
    const m = mi == null ? undefined : materials[mi];
    const fac = m?.pbrMetallicRoughness?.baseColorFactor as number[] | undefined;
    if (Array.isArray(fac) && fac.length >= 3) return rgbToHex([fac[0], fac[1], fac[2]]);
    return undefined;
  };

  const results: ImportedMesh[] = [];
  const visited = new Set<number>();

  const walk = (nodeId: number, parentWorld: number[]) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodes[nodeId];
    if (!node) return;
    const local = node.matrix ?? composeMatrix(node.translation, node.rotation, node.scale);
    const world = isIdentity(parentWorld) ? local : matMul(parentWorld, local);
    if (node.mesh != null) {
      const mesh = meshes[node.mesh];
      if (mesh) {
        mesh.primitives.forEach((prim: GltfPrimitive, pi: number) => {
          if (prim.mode != null && prim.mode !== 4) return; // triangles only
          const posAcc = accessors[prim.attributes.POSITION];
          if (!posAcc) return;
          const raw = readAccessor(bin, bufferViews, posAcc);
          const vertCount = posAcc.count;
          const vertices: Vec3[] = [];
          for (let i = 0; i < vertCount; i++) {
            const v: Vec3 = [raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]];
            vertices.push(applyMatrix(world, v));
          }
          let faces: number[][] = [];
          if (prim.indices != null) {
            const idx = readAccessor(bin, bufferViews, accessors[prim.indices!]);
            for (let i = 0; i + 2 < idx.length; i += 3) faces.push([idx[i], idx[i + 1], idx[i + 2]]);
          } else {
            for (let i = 0; i + 2 < vertCount; i += 3) faces.push([i, i + 1, i + 2]);
          }
          const baseName = node.name || mesh.name || "Imported model";
          const name = mesh.primitives.length > 1 ? `${baseName} ${pi + 1}` : baseName;
          results.push({ name, mesh: { vertices, faces }, color: colorForMaterial(prim.material) });
        });
      }
    }
    for (const child of node.children ?? []) walk(child, world);
  };

  const roots = json.scenes?.[0]?.nodes ?? nodes.map((_, i) => i);
  for (const r of roots) walk(r, IDENTITY);

  if (results.length === 0) throw new Error("No triangle meshes found in the file.");
  return results;
}

// ------------------------------------------------------------------ import OBJ

/** Parses a Wavefront OBJ file into a single mesh (world-space, Y-up). */
export function importObj(text: string): ImportedMesh[] {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("v ")) {
      const [x, y, z] = t.split(/\s+/).slice(1).map(Number);
      if ([x, y, z].some((n) => Number.isNaN(n))) continue;
      vertices.push([x, y, z]);
    } else if (t.startsWith("f ")) {
      const idxs = t.split(/\s+/).slice(1).map((part) => {
        const i = parseInt(part.split("/")[0], 10);
        return i < 0 ? vertices.length + i : i - 1;
      });
      if (idxs.length >= 3 && idxs.every((i) => i >= 0 && i < vertices.length)) faces.push(idxs);
    }
  }
  if (vertices.length === 0 || faces.length === 0) throw new Error("OBJ has no usable vertices or faces.");
  return [{ name: "Imported OBJ", mesh: { vertices, faces } }];
}

// ----------------------------------------------------------------- export GLB

export interface GlbOptions {
  /** Scene name written into the glTF (default "Scene"). */
  name?: string;
}

/** Serialises the scene to a glTF-Binary 2.0 (.glb) file.
 *
 * Godot imports GLB natively; Unreal 5 (Interchange) and Blender/Unity read it
 * too. Geometry is written as triangle-corner vertices with flat NORMAL
 * attributes (matching the studio's flat-shaded look) plus one PBR material per
 * object carrying its colour, so engines shade it correctly without textures. */
export function exportGlb(scene: Scene, opts: GlbOptions = {}): Uint8Array {
  const objects = sceneMeshObjects(scene);
  if (objects.length === 0) throw new Error("Nothing to export — the scene has no mesh objects.");

  const accessors: any[] = [];
  const bufferViews: any[] = [];
  const nodes: any[] = [];
  const meshDefs: any[] = [];
  const materials: any[] = [];
  const nodeOrder: number[] = [];

  const align4 = (n: number) => (n % 4 === 0 ? n : n + (4 - (n % 4)));

  // --- Concatenate every object's LOCAL geometry into one BIN chunk. The node's
  //     TRS matrix carries the object transform (glTF-idiomatic), so the file
  //     re-opens with the same hierarchy instead of double-transforming.
  const binParts: Uint8Array[] = [];
  let cursor = 0;
  const pushView = (bytes: Uint8Array) => {
    const view = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: bytes.length });
    binParts.push(bytes);
    cursor = align4(cursor + bytes.length);
    return view;
  };

  objects.forEach((obj) => {
    const tris = triangulate(obj.mesh!.faces);
    if (tris.length === 0) return;
    const src = obj.mesh!.vertices;

    // One vertex per triangle corner: position + flat normal (hard edges), which
    // is exactly how the viewport shades the scene.
    const pos: number[] = [];
    const nrm: number[] = [];
    for (const f of tris) {
      const a = src[f[0]];
      const b = src[f[1]];
      const c = src[f[2]];
      const n = faceNormal(a, b, c);
      pos.push(...a, ...b, ...c);
      nrm.push(...n, ...n, ...n);
    }
    const vertCount = pos.length / 3;
    const idx: number[] = [];
    for (let i = 0; i < vertCount; i++) idx.push(i);

    const posBytes = new Uint8Array(new Float32Array(pos).buffer);
    const nrmBytes = new Uint8Array(new Float32Array(nrm).buffer);
    const idxBytes = new Uint8Array(new Uint16Array(idx).buffer);

    const posView = pushView(posBytes);
    const nrmView = pushView(nrmBytes);
    const idxView = pushView(idxBytes);

    const xs = [], ys = [], zs = [];
    for (let i = 0; i < pos.length; i += 3) {
      xs.push(pos[i]);
      ys.push(pos[i + 1]);
      zs.push(pos[i + 2]);
    }
    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: vertCount,
      type: "VEC3",
      min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    });
    const nrmAcc = accessors.length;
    accessors.push({ bufferView: nrmView, componentType: 5126, count: vertCount, type: "VEC3" });
    const idxAcc = accessors.length;
    accessors.push({ bufferView: idxView, componentType: 5123, count: idx.length, type: "SCALAR" });

    const matId = materials.length;
    materials.push({
      name: `${obj.name}_mat`,
      pbrMetallicRoughness: {
        baseColorFactor: [...hexToRgb(obj.color ?? "#e0e0e0"), 1],
        metallicFactor: 0.0,
        roughnessFactor: 1.0,
      },
    });

    const meshId = meshDefs.length;
    const nodeId = nodes.length;
    meshDefs.push({
      name: obj.name,
      primitives: [
        {
          attributes: { POSITION: posAcc, NORMAL: nrmAcc },
          indices: idxAcc,
          mode: 4,
          material: matId,
        },
      ],
    });
    nodes.push({ name: obj.name, mesh: meshId, matrix: sceneObjectMatrix(obj) });
    nodeOrder.push(nodeId);
  });

  const bin = new Uint8Array(cursor);
  let p = 0;
  for (const part of binParts) {
    bin.set(part, p);
    p += part.length;
  }

  const json = {
    asset: { version: "2.0", generator: "NexPlay Studio" },
    scene: 0,
    scenes: [{ name: opts.name ?? "Scene", nodes: nodeOrder }],
    nodes,
    meshes: meshDefs,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    materials,
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = align4(jsonBytes.length) - jsonBytes.length;
  const binPad = align4(bin.length) - bin.length;

  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + bin.length + binPad;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  o = 12;
  dv.setUint32(o, jsonBytes.length + jsonPad, true);
  dv.setUint32(o + 4, 0x4e4f534a, true);
  out.set(jsonBytes, o + 8);
  // The glTF spec pads the JSON chunk with spaces (0x20), not zeros.
  if (jsonPad > 0) out.fill(0x20, o + 8 + jsonBytes.length, o + 8 + jsonBytes.length + jsonPad);
  o += 8 + jsonBytes.length + jsonPad;
  dv.setUint32(o, bin.length + binPad, true);
  dv.setUint32(o + 4, 0x004e4942, true);
  out.set(bin, o + 8);
  return out;
}

// ------------------------------------------------------------ export OBJ / STL

/** Serialises the scene to a Wavefront OBJ file (world-space, group per object). */
export function exportObj(scene: Scene, name = "scene"): string {
  const objects = sceneMeshObjects(scene);
  if (objects.length === 0) throw new Error("Nothing to export — the scene has no mesh objects.");
  const lines: string[] = [];
  lines.push(`# NexPlay Studio — Wavefront OBJ export (${name})`);
  let base = 1;
  for (const obj of objects) {
    const tris = triangulate(obj.mesh!.faces);
    if (tris.length === 0) continue;
    lines.push(`o ${obj.name.replace(/\s+/g, "_")}`);
    const worldVerts = obj.mesh!.vertices.map((v) => {
      const scaled: Vec3 = [
        v[0] * obj.transform.scale[0],
        v[1] * obj.transform.scale[1],
        v[2] * obj.transform.scale[2],
      ];
      const r = rotate(obj.transform.rotation, scaled);
      return [r[0] + obj.transform.position[0], r[1] + obj.transform.position[1], r[2] + obj.transform.position[2]] as Vec3;
    });
    for (const v of worldVerts) lines.push(`v ${v[0].toFixed(5)} ${v[1].toFixed(5)} ${v[2].toFixed(5)}`);
    for (const f of tris) lines.push(`f ${f.map((i) => i + base).join(" ")}`);
    base += worldVerts.length;
  }
  return lines.join("\n") + "\n";
}

/** Serialises the scene to an ASCII STL file (triangulated, world-space). */
export function exportStl(scene: Scene, name = "scene"): string {
  const objects = sceneMeshObjects(scene);
  if (objects.length === 0) throw new Error("Nothing to export — the scene has no mesh objects.");
  const tris: Vec3[][] = [];
  for (const obj of objects) {
    const t = triangulate(obj.mesh!.faces);
    if (t.length === 0) continue;
    const worldVerts = obj.mesh!.vertices.map((v) => {
      const scaled: Vec3 = [
        v[0] * obj.transform.scale[0],
        v[1] * obj.transform.scale[1],
        v[2] * obj.transform.scale[2],
      ];
      const r = rotate(obj.transform.rotation, scaled);
      return [r[0] + obj.transform.position[0], r[1] + obj.transform.position[1], r[2] + obj.transform.position[2]] as Vec3;
    });
    for (const f of t) tris.push([worldVerts[f[0]], worldVerts[f[1]], worldVerts[f[2]]]);
  }
  const lines = [`solid ${name.replace(/\s+/g, "_")}`];
  for (const [a, b, c] of tris) {
    const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: Vec3 = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(n[0], n[1], n[2]);
    n = len > 1e-9 ? [n[0] / len, n[1] / len, n[2] / len] : [0, 0, 1];
    lines.push("  facet normal " + n.map((x) => x.toFixed(6)).join(" "));
    lines.push("    outer loop");
    for (const p of [a, b, c]) lines.push(`      vertex ${p[0].toFixed(6)} ${p[1].toFixed(6)} ${p[2].toFixed(6)}`);
    lines.push("    endloop");
    lines.push("  endfacet");
  }
  lines.push(`endsolid ${name.replace(/\s+/g, "_")}`);
  return lines.join("\n") + "\n";
}

/** Triggers a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}