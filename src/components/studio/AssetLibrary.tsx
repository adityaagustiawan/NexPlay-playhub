// AssetLibrary.tsx — free 3D assets you can drop straight into the scene.
//
// Mirrors the "import assets" idea from Unity/Blender: a browser of CC0 models
// from Poly Haven (api.polyhaven.com) plus the Khronos glTF-Sample-Models repo
// on GitHub. "Add" downloads the .glb, parses it (importGlb) and hands the
// meshes to the scene as grounded objects.
import { useCallback, useEffect, useState } from "react";
import { Download, FileDown, Loader2, PackagePlus, RefreshCw, FolderOpen } from "lucide-react";
import { downloadBlob, importGlb, type ImportedMesh } from "@/lib/gltf";

interface RemoteAsset {
  id: string;
  name: string;
  credit: string;
  license: string;
  url: string;
  thumb?: string;
}

// Khronos glTF-Sample-Models — openly licensed test models, fetched straight
// from the GitHub repo (raw.githubusercontent.com).
const KH_BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";
const KH_NAMES = [
  "Avocado",
  "Box",
  "Duck",
  "DamagedHelmet",
  "Lantern",
  "CesiumMilkTruck",
  "Fox",
  "BrainStem",
  "BarramundiFish",
  "BoomBox",
];
const CURATED: RemoteAsset[] = KH_NAMES.map((name) => ({
  id: `kh-${name.toLowerCase()}`,
  name,
  credit: "Khronos glTF-Sample-Models (GitHub)",
  license: "Sample",
  url: `${KH_BASE}/${name}/glTF-Binary/${name}.glb`,
  thumb: `${KH_BASE}/${name}/screenshot/screenshot.png`,
}));

interface PolyHavenItem {
  id: string;
  name: string;
  category: string;
  url: string;
  thumb: string;
}

interface Props {
  /** Add a parsed model to the scene (updates state + notices in Studio). */
  onAddMesh: (mesh: ImportedMesh) => void;
  /** Let the user pick a .glb/.obj file from disk (Studio owns the input). */
  onImportFile: () => void;
}

const badge = (license: string) =>
  `rounded-[3px] px-1.5 py-0.5 font-body text-[9px] uppercase tracking-wide ${
    license === "CC0" ? "bg-[#2d4b33] text-[#8fd39b]" : "bg-[#3a3a3a] text-[#b0b0b0]"
  }`;

export function AssetLibrary({ onAddMesh, onImportFile }: Props) {
  const [poly, setPoly] = useState<PolyHavenItem[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [fail, setFail] = useState<Record<string, string>>({});

  const loadPolyHaven = useCallback(async () => {
    setLoadErr(null);
    setPoly(null);
    try {
      const res = await fetch("https://api.polyhaven.com/assets?t=models", { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const map = (await res.json()) as Record<string, any>;
      const items: PolyHavenItem[] = [];
      for (const [id, info] of Object.entries(map)) {
        const cat = (info.categories as string[])?.[0];
        if (!cat) continue;
        items.push({
          id,
          name: info.name ?? id,
          category: cat,
          url: `https://dl.polyhaven.org/file/ph-assets/Models/${cat}/${id}/${id}.glb`,
          thumb: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
        });
        if (items.length >= 30) break;
      }
      setPoly(items);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not reach Poly Haven.");
    }
  }, []);

  useEffect(() => {
    void loadPolyHaven();
  }, [loadPolyHaven]);

  /** Downloads a .glb, parses it and adds every mesh to the scene. */
  const addAsset = useCallback(
    async (a: { id: string; url: string; label?: string }) => {
      setAdding((s) => ({ ...s, [a.id]: true }));
      setFail((s) => ({ ...s, [a.id]: "" }));
      try {
        const res = await fetch(a.url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const meshes = importGlb(buf);
        meshes.forEach((m) => onAddMesh(m));
      } catch (e) {
        setFail((s) => ({ ...s, [a.id]: e instanceof Error ? e.message : "Import failed" }));
      } finally {
        setAdding((s) => ({ ...s, [a.id]: false }));
      }
    },
    [onAddMesh],
  );

  /** Downloads just the raw .glb, so engines can import it directly. */
  const downloadAsset = useCallback(async (a: { id: string; url: string; name?: string }) => {
    setAdding((s) => ({ ...s, [a.id]: true }));
    setFail((s) => ({ ...s, [a.id]: "" }));
    try {
      const res = await fetch(a.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const slug = (a.name ?? a.id).replace(/\W+/g, "-").toLowerCase();
      downloadBlob(new Blob([buf], { type: "model/gltf-binary" }), `${slug}.glb`);
    } catch (e) {
      setFail((s) => ({ ...s, [a.id]: e instanceof Error ? e.message : "Download failed" }));
    } finally {
      setAdding((s) => ({ ...s, [a.id]: false }));
    }
  }, []);

  const card = (a: { id: string; name: string; credit: string; license: string; url: string; thumb?: string; label?: string }) => (
    <div key={a.id} className="flex flex-col overflow-hidden rounded-[4px] border border-[#3d3d3d] bg-[#282828]">
      <div className="relative h-16 w-full bg-[#1d1d1d]">
        {a.thumb ? (
          <img
            src={a.thumb}
            alt={a.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : null}
        <span className="absolute right-1 top-1">
          <span className={badge(a.license)}>{a.license}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="truncate text-[11px] font-medium capitalize text-[#e0e0e0]">{a.label ?? a.name}</span>
        <span className="truncate text-[9px] text-[#8f8f8f]">{a.credit}</span>
        {fail[a.id] && <span className="text-[9px] leading-tight text-[#ff8a8a]">{fail[a.id]}</span>}
        <button
          type="button"
          onClick={() => addAsset(a)}
          disabled={adding[a.id]}
          className="mt-0.5 flex h-6 items-center justify-center gap-1 rounded-[3px] bg-[#4772b3] px-2 text-[10px] text-white hover:bg-[#5a85c6] disabled:opacity-50"
        >
          {adding[a.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {adding[a.id] ? "Adding…" : "Add to scene"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-[3px] border border-[#3d3d3d] bg-[#282828] p-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#c8c8c8]">
          <PackagePlus className="h-3.5 w-3.5 text-[#4772b3]" />
          Free 3D models — add straight into the scene
        </div>
        <p className="mt-1 text-[10px] leading-snug text-[#8f8f8f]">
          CC0 content from <span className="text-[#b0b0b0]">Poly Haven</span> and the{" "}
          <span className="text-[#b0b0b0]">Khronos glTF-Sample-Models</span> repo on GitHub. Added models are
          grounded on the studio floor; then use File ▸ Export As (GLB / OBJ / STL) to take them to Blender, Unity, or
          a 3D printer.
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={onImportFile}
            className="flex h-6 items-center gap-1.5 rounded-[3px] border border-[#4a4a4a] px-2 text-[10px] text-[#d0d0d0] hover:bg-[#3a3a3a]"
          >
            <FolderOpen className="h-3 w-3" />
            Open model file (.glb / .obj)…
          </button>
          <button
            type="button"
            onClick={() => void loadPolyHaven()}
            title="Refresh the Poly Haven model list"
            className="flex h-6 items-center gap-1 rounded-[3px] border border-[#4a4a4a] px-2 text-[10px] text-[#d0d0d0] hover:bg-[#3a3a3a]"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-[10px] font-medium uppercase tracking-wide text-[#8f8f8f]">Poly Haven (CC0)</p>
      {loadErr && <p className="rounded-[3px] bg-[#3a2626] p-2 text-[10px] text-[#ff9b9b]">Poly Haven: {loadErr}</p>}
      {!poly && !loadErr && (
        <div className="flex items-center gap-2 rounded-[3px] bg-[#282828] p-3 text-[10px] text-[#8f8f8f]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading model list…
        </div>
      )}
      {poly && (
        <div className="grid grid-cols-2 gap-1.5">
          {poly.map((p) =>
            card({ id: p.id, name: p.name, label: p.name, credit: `Poly Haven · ${p.category}`, license: "CC0", url: p.url, thumb: p.thumb }),
          )}
        </div>
      )}

      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#8f8f8f]">Khronos samples (GitHub)</p>
      <div className="grid grid-cols-2 gap-1.5">
        {CURATED.map((c) => card(c))}
      </div>
    </div>
  );
}