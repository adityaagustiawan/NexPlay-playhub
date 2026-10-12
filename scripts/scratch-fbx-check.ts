// Scratch: confirm the floor's exported normals now point +Y.
import { createStarterScene3D } from "../src/lib/scene3d";
import { exportFbx } from "../src/lib/gltf";

const fbx = exportFbx(createStarterScene3D(), { name: "Diorama" });
const lines = fbx.split("\n");
const start = lines.findIndex((l) => l.includes("Geometry::Floor"));
const normals = lines.slice(start).find((l) => l.startsWith("\t\t\t\tNormals:"));
console.log("Normals header:", normals);
const nLine = lines[lines.findIndex((l) => l.includes("Geometry::Floor")) + 5]?.trim();
console.log("first normal triplet:", nLine?.slice(0, 40));
// pull the first 3 normal floats from the Normals array block
const ni = lines.findIndex((l, i) => i > start && l.includes("Normals: *"));
for (let i = ni + 1; i < ni + 2; i++) {
  const vals = lines[i].trim().replace(/^a:\s*/, "").split(",").map(Number);
  console.log("first face normal:", vals.slice(0, 3));
}