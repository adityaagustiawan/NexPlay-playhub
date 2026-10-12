// gltf.test.ts — model interchange formats for NexStudio.
// The 3D scene can leave the studio: GLB (glTF-Binary 2.0), OBJ and STL must
// round-trip against our own parser, and a hand-built GLB fixture proves the
// binary decoder without any network.
import { describe, expect, it } from "vitest";
import {
  createDemoScene,
  createMeshObjectFromData,
  createStarterScene3D,
  v3,
} from "@/lib/scene3d";
import {
  exportFbx,
  exportGlb,
  exportObj,
  exportStl,
  faceNormal,
  importGlb,
  importObj,
  triangulate,
} from "@/lib/gltf";

/** Extracts the JSON chunk of a GLB byte array (for structural assertions). */
function glbJson(bytes: Uint8Array): any {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jlen = dv.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jlen)));
}

const hexToRgb = (hex: string): [number, number, number, number] => {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

/** Builds a minimal GLB with a single triangle (positions + indices). */
function makeTriangleGlb(): ArrayBuffer {
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ byteLength: 42 }],
  };
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2]);
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const binBytes = new Uint8Array(42);
  binBytes.set(new Uint8Array(positions.buffer), 0);
  binBytes.set(new Uint8Array(indices.buffer), 36);
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  const bpad = 42 % 4 === 0 ? 0 : 4 - (42 % 4);
  const total = 12 + 8 + jsonBytes.length + jpad + 8 + 42 + bpad;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  let o = 12;
  dv.setUint32(o, jsonBytes.length + jpad, true);
  dv.setUint32(o + 4, 0x4e4f534a, true);
  out.set(jsonBytes, o + 8);
  if (jpad > 0) out.fill(0x20, o + 8 + jsonBytes.length, o + 8 + jsonBytes.length + jpad);
  o += 8 + jsonBytes.length + jpad;
  dv.setUint32(o, 42 + bpad, true);
  dv.setUint32(o + 4, 0x004e4942, true);
  out.set(binBytes, o + 8);
  return out.buffer as ArrayBuffer;
}

describe("triangulate", () => {
  it("splits quads into two triangles and fans n-gons", () => {
    expect(triangulate([[0, 1, 2]])).toEqual([[0, 1, 2]]);
    expect(triangulate([[0, 1, 2, 3]])).toEqual([
      [0, 1, 2],
      [0, 2, 3],
    ]);
    expect(triangulate([[0, 1, 2, 3, 4]])).toHaveLength(3);
    expect(triangulate([[0, 1]])).toEqual([]);
  });
});

describe("createMeshObjectFromData", () => {
  it("grounds arbitrary geometry on the studio floor", () => {
    const mesh = { vertices: [v3(0, -5, 0), v3(2, 9, 1)], faces: [[0, 1, 1]] };
    const obj = createMeshObjectFromData("Box", mesh);
    expect(obj.transform.position[1]).toBe(5); // min.y -5 lifts the bottom to y=0
    expect(obj.mesh).toBe(mesh);
  });
});

describe("GLB import", () => {
  it("decodes a hand-built triangle fixture", () => {
    const meshes = importGlb(makeTriangleGlb());
    expect(meshes).toHaveLength(1);
    expect(meshes[0].mesh.vertices).toHaveLength(3);
    expect(meshes[0].mesh.faces).toEqual([[0, 1, 2]]);
    expect(meshes[0].mesh.vertices[2]).toEqual([0, 1, 0]);
  });

  it("rejects non-GLB files", () => {
    expect(() => importGlb(new Uint8Array(64).buffer)).toThrow(/not a glTF binary/i);
  });
});

describe("GLB export → import round trip", () => {
  it("keeps mesh count, vertices and triangulated faces", () => {
    const scene = createDemoScene();
    const bytes = exportGlb(scene, { name: "Demo" });
    const inBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const meshes = importGlb(inBytes);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].name).toBe("Cube");
    expect(meshes[0].mesh.vertices).toHaveLength(8);
    // The demo cube has 6 quads → 12 triangles.
    expect(meshes[0].mesh.faces).toHaveLength(12);
    expect(meshes[0].mesh.faces.every((f) => f.length === 3)).toBe(true);
  });

  it("applies node TRS once — transform lives in the node matrix", () => {
    const scene = createDemoScene();
    // Move + scale the cube so double-application would be obvious.
    const cube = scene.objects.find((o) => o.name === "Cube")!;
    cube.transform.position = v3(3, 0.4, 0);
    cube.transform.scale = [2, 2, 2];
    const bytes = exportGlb(scene);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const imported = importGlb(buf)[0];
    const xs = imported.mesh.vertices.map((v) => v[0]);
    // 2x scale of a ±0.8 cube around x=+3 ⇒ x∈[1.4, 4.6].
    expect(Math.min(...xs)).toBeCloseTo(1.4, 1);
    expect(Math.max(...xs)).toBeCloseTo(4.6, 1);
  });
});

describe("OBJ / STL", () => {
  it("exports and re-imports OBJ", () => {
    const scene = createDemoScene();
    const obj = exportObj(scene, "demo");
    expect(obj).toContain("o Cube");
    expect(obj).toContain("f ");
    const meshes = importObj(obj);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].mesh.vertices).toHaveLength(8);
    expect(meshes[0].mesh.faces).toHaveLength(12);
  });

  it("reads an OBJ with v/vt/vn face syntax", () => {
    const obj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f 1/1 2/2 3/3"].join("\n");
    const meshes = importObj(obj);
    expect(meshes[0].mesh.faces).toEqual([[0, 1, 2]]);
  });

  it("exports an ASCII STL with facets", () => {
    const stl = exportStl(createDemoScene(), "demo");
    expect(stl.startsWith("solid demo")).toBe(true);
    expect(stl).toContain("facet normal");
    expect((stl.match(/facet normal/g) ?? []).length).toBe(12);
    expect(stl.trimEnd().endsWith("endsolid demo")).toBe(true);
  });
});

describe("createStarterScene3D", () => {
  it("stamps a lit diorama with a floor, primitives and active camera", () => {
    const scene = createStarterScene3D();
    const names = scene.objects.map((o) => o.name);
    expect(names).toContain("Floor");
    expect(names).toContain("Suzanne");
    expect(names).toContain("Cube");
    expect(scene.objects.filter((o) => o.kind === "camera")).toHaveLength(1);
    expect(scene.objects.filter((o) => o.kind === "light")).toHaveLength(2);
    const floor = scene.objects.find((o) => o.name === "Floor")!;
    expect(floor.transform.scale).toEqual([9, 1, 9]);
    expect(scene.activeCameraId).toBeTruthy();
  });

  it("keeps importable mesh objects for addMeshObject round trips", () => {
    // Every mesh in the starter scene can be turned into a custom-data object.
    const scene = createStarterScene3D();
    for (const o of scene.objects.filter((o) => o.kind === "mesh")) {
      expect(o.mesh?.faces.length ?? 0).toBeGreaterThan(0);
      const clone = createMeshObjectFromData(o.name, o.mesh!);
      expect(clone.kind).toBe("mesh");
    }
  });
});

describe("imported geometry via AssetLibrary path", () => {
  it("adds a parsed model through createMeshObjectFromData (grounded)", () => {
    const fixture = importGlb(makeTriangleGlb())[0];
    const obj = createMeshObjectFromData(fixture.name, fixture.mesh, fixture.color && v3(0, 0, 0));
    expect(obj.name).toBe("Imported model");
    expect(obj.transform.position[1]).toBe(0); // min.y === 0 already
  });
});