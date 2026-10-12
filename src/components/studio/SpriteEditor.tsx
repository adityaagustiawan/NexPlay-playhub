// SpriteEditor.tsx — lightweight 2D asset editor (replaces GamePreview in 2D mode).
import { useState } from "react";
import { Viewport2D } from "./Viewport2D";
import { createScene2D, serializeScene2D, deserializeScene2D, type Scene2D } from "@/lib/scene2d";
import { FileDown, FileUp } from "lucide-react";

export function SpriteEditor() {
  const [scene, setScene] = useState<Scene2D>(() => createScene2D());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const exportJSON = () => {
    const blob = new Blob([serializeScene2D(scene)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sprite-scene.json"; a.click(); URL.revokeObjectURL(url);
  };
  const importJSON = async (f: File) => {
    const txt = await f.text();
    setScene(deserializeScene2D(txt));
    setSelectedId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0] select-none">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading uppercase tracking-wide text-[#b8b8b8]">
        2D Asset Editor — pan/zoom/select/move · like Blender but for game sprites
        <div className="ml-auto flex gap-1">
          <label className="flex items-center gap-1 cursor-pointer hover:text-[#e6cd5b]">
            <FileUp size={11} /> Import <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </label>
          <button onClick={exportJSON} className="flex items-center gap-1 hover:text-[#e6cd5b]"><FileDown size={11} /> Export</button>
        </div>
      </div>
      <Viewport2D scene={scene} selectedId={selectedId} onSelect={setSelectedId} onChange={setScene} />
    </div>
  );
}
