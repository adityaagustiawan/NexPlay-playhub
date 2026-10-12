// Scratch: print the geometry/model/material/connections sections of the FBX.
import { createStarterScene3D } from "../src/lib/scene3d";
import { exportFbx } from "../src/lib/gltf";

const fbx = exportFbx(createStarterScene3D(), { name: "Diorama" });
const lines = fbx.split("\n");
const objStart = lines.findIndex((l) => l.startsWith("Objects:"));
const connStart = lines.findIndex((l) => l.startsWith("Connections:"));
console.log(lines.slice(objStart, objStart + 95).join("\n"));
console.log("\n---- CONNECTIONS ----");
console.log(lines.slice(connStart, connStart + 30).join("\n"));