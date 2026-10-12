// Temporary real-world fixture check (deleted before commit).
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importGlb, exportGlb } from "@/lib/gltf";
import { createMeshObjectFromData } from "@/lib/scene3d";

const FIXTURES = ["Duck", "Avocado", "DamagedHelmet", "Lantern"];
const FILES: Record<string, string> = {};
for (const f of FIXTURES) {
  const p = `/tmp/glbfix/${f}.glb`;
  if (existsSync(p)) FILES[f] = p;
}

describe.skipIf(Object.keys(FILES).length === 0)("real glTF-Sample-Models", () => {
  for (const [name, path] of Object.entries(FILES)) {
    it(`${name}: parses real Khronos GLB`, () => {
      const buf = readFileSync(path).buffer as ArrayBuffer;
      const meshes = importGlb(buf);
      expect(meshes.length).toBeGreaterThan(0);
      for (const m of meshes) {
        expect(m.mesh.vertices.length).toBeGreaterThan(0);
        expect(m.mesh.faces.length).toBeGreaterThan(0);
      }
    });
  }

  it("imports from a node with a parenting chain (baked world matrix)", () => {
    const buf = readFileSync(FILES.Lantern).buffer as ArrayBuffer;
    const meshes = importGlb(buf);
    expect(meshes.length).toBeGreaterThan(0);
    // Vertices must not be piling up at the origin (world matrix applied).
    const flat = meshes.flatMap((m) => m.mesh.vertices);
    expect(Math.max(...flat.map((v) => Math.max(...v)))).toBeGreaterThan(0.01);
  });

  it("imported meshes re-export to a parseable GLB", () => {
    const meshes = importGlb(readFileSync(FILES.Duck).buffer as ArrayBuffer);
    const scene = { objects: meshes.map((m) => createMeshObjectFromData(m.name, m.mesh)), activeCameraId: null as string | null };
    const bytes = exportGlb(scene as never);
    expect(bytes.length).toBeGreaterThan(100);
    const back = importGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(back.length).toBe(meshes.length);
  });
});