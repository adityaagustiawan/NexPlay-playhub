// Scratch: print the first ~60 lines of an exported FBX for visual inspection.
import { createStarterScene3D } from "../src/lib/scene3d";
import { exportFbx } from "../src/lib/gltf";

const fbx = exportFbx(createStarterScene3D(), { name: "Diorama" });
console.log(fbx.split("\n").slice(0, 60).join("\n"));
console.log("...\n[total lines:", fbx.split("\n").length, "]");