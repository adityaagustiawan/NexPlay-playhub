// gltf.test.ts — model interchange formats for NexStudio.
// The 3D scene can leave the studio: GLB (glTF-Binary 2.0), OBJ and STL must
// round-trip against our own parser, and a hand-built GLB fixture proves the
// binary decoder without any network.
import { describe, expect, it } from "vitest";
import {
  createDemoScene,
  createMeshObjectFromData,
  createPlane,
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

describe("faceNormal", () => {
  it("returns the unit normal of a triangle", () => {
    const n = faceNormal([0, 0, 0], [1, 0, 0], [0, 1, 0]);
    expect(n[2]).toBeCloseTo(1, 5);
    expect(n[0]).toBeCloseTo(0, 5);
    // degenerate triangle falls back to +Z
    expect(faceNormal([0, 0, 0], [1, 0, 0], [2, 0, 0])).toEqual([0, 0, 1]);
  });

  it("plane primitives face up (+Y) so engines cull the floor correctly", () => {
    const mesh = createPlane(4, 2);
    const a = mesh.vertices[0];
    const d = mesh.vertices[3];
    const c = mesh.vertices[4];
    const u = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const y = u[0] * v[2] - u[2] * v[0];
    expect(y).toBeGreaterThan(0);
  });
});

describe("GLB export → import round trip", () => {
  it("keeps mesh count, corner-split vertices and triangulated faces", () => {
    const scene = createDemoScene();
    const bytes = exportGlb(scene, { name: "Demo" });
    const inBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const meshes = importGlb(inBytes);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].name).toBe("Cube");
    // The demo cube has 6 quads → 12 triangles → 36 triangle-corner vertices
    // (one vertex per corner, needed so each triangle carries a flat normal).
    expect(meshes[0].mesh.vertices).toHaveLength(36);
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

describe("GLB export details (engine readiness)", () => {
  it("writes NORMAL attributes and per-object coloured materials", () => {
    const scene = createDemoScene();
    const json = glbJson(exportGlb(scene, { name: "Demo" }));
    expect(json.asset.version).toBe("2.0");
    expect(json.meshes).toHaveLength(1);
    const prim = json.meshes[0].primitives[0];
    expect(prim.attributes.POSITION).toBeDefined();
    expect(prim.attributes.NORMAL).toBeDefined();
    // 2 accessors per object: POSITION + NORMAL (indices are SCALAR accessor #2)
    expect(json.accessors).toHaveLength(3);
    // corner-split cube → 36 positions
    expect(json.accessors[0].count).toBe(36);
    expect(json.accessors[0].type).toBe("VEC3");
    expect(json.accessors[1].type).toBe("VEC3");
    expect(json.accessors[2].componentType).toBe(5123);
    // material carries the object colour through to the engine
    const cube = scene.objects.find((o) => o.name === "Cube")!;
    expect(json.materials).toHaveLength(1);
    expect(json.materials[0].name).toContain(cube.name);
    const col = hexToRgb(cube.color ?? "#000000");
    json.materials[0].pbrMetallicRoughness.baseColorFactor.forEach((v: number, i: number) =>
      expect(v).toBeCloseTo(col[i], 2),
    );
  });

  it("uses u32 indices when corner-split vertices exceed 65,535", () => {
    // A big-ish quad grid: 300×70 quads → 42,000 triangles → 126,000 corners.
    const verts = Array.from({ length: 301 }, (_, x) =>
      Array.from({ length: 71 }, (_, y) => [x / 10, 0, y / 10]),
    ).flat();
    const faces: number[][] = [];
    for (let x = 0; x < 300; x++)
      for (let y = 0; y < 70; y++) {
        const a = x * 71 + y;
        faces.push([a, a + 71, a + 72, a + 1]);
      }
    const scene = createDemoScene();
    scene.objects = [
      ...scene.objects.filter((o) => o.kind !== "mesh"),
      createMeshObjectFromData("Grid", { vertices: verts, faces }),
    ];
    const json = glbJson(exportGlb(scene));
    const idxAcc = json.accessors.find((a: any) => a.type === "SCALAR");
    expect(idxAcc.componentType).toBe(5125); // UNsigned int
    expect(idxAcc.count).toBe(126000);
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

describe("FBX export (Unreal Engine import)", () => {
  it("emits a structurally balanced ASCII FBX 7.4 document", () => {
    const fbx = exportFbx(createStarterScene3D(), { name: "Diorama" });
    expect(fbx.startsWith("; FBX 7.4.0 project file")).toBe(true);
    for (const token of [
      "FBXHeaderExtension:",
      "GlobalSettings:",
      "Documents:",
      "Definitions:",
      "Objects:",
      "Connections:",
      "Takes:",
      "FBXHeaderVersion: 1003",
      "FBXVersion: 7400",
    ]) {
      expect(fbx).toContain(token);
    }
    const open = (fbx.match(/\{/g) ?? []).length;
    const close = (fbx.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
    expect(open).toBeGreaterThan(5);
  });

  it("encodes one Geometry/Model/Material per mesh with correct counts", () => {
    const fbx = exportFbx(createDemoScene()); // 1 cube
    expect(fbx.match(/^\tGeometry:/gm)).toHaveLength(1);
    expect(fbx.match(/^\tModel:/gm)).toHaveLength(1);
    expect(fbx.match(/^\tMaterial:/gm)).toHaveLength(1);
    expect(fbx).toContain('MappingInformationType: "ByPolygonVertex"');
    // 12 triangles → 36 polygon-corner indices, last one negated per triangle
    const poly = /PolygonVertexIndex: \*(\d+)/.exec(fbx);
    expect(Number(poly![1])).toBe(36);
    // 36 corner vertices × 3 floats
    const verts = /Vertices: \*(\d+)/.exec(fbx);
    expect(Number(verts![1])).toBe(108);
    // read the actual polygon indices after the PolygonVertexIndex header and
    // check FBX's "last vertex negated − 1" encoding on every triangle
    const lines = fbx.split("\n").map((l) => l.replace(/\r$/, ""));
    const pi = lines.findIndex((l) => l.includes("PolygonVertexIndex:"));
    const flat: number[] = [];
    for (let i = pi + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t.startsWith("a:")) break;
      flat.push(...t.slice(2).split(",").map(Number).filter((n) => !Number.isNaN(n)));
    }
    expect(flat).toHaveLength(36);
    expect(flat[35]).toBeLessThan(0);
    for (let t = 0; t < 12; t++) expect(flat[t * 3 + 2]).toBeLessThan(0);
  });

  it("keeps definitions, connections, Y-up and object transforms consistent", () => {
    const scene = createStarterScene3D();
    const meshCount = scene.objects.filter((o) => o.kind === "mesh").length;
    const fbx = exportFbx(scene);
    // counts at section level
    expect(fbx).toContain(`ObjectType: "Model" `);
    expect(fbx).toContain(`Count: ${meshCount * 3 + 1}`);
    // one model→root, geometry→model and material→model connection per part, plus the root link
    const conns = (fbx.match(/^\tC: "OO",/gm) ?? []).length;
    expect(conns).toBe(1 + meshCount * 3);
    // Y-up is declared so Unreal converts to Z-up on import
    expect(fbx).toContain('P: "UpAxis", "int", "Integer", "",1');
    // transforms are written onto the model node (Lcl Translation / Rotation / Scaling)
    expect(fbx).toContain('"Lcl Translation"');
    expect(fbx).toContain('"Lcl Scaling"');
  });

  it("throws when the scene has no mesh objects", () => {
    const scene = createDemoScene();
    scene.objects = scene.objects.filter((o) => o.kind !== "mesh");
    expect(() => exportFbx(scene)).toThrow(/no mesh objects/i);
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