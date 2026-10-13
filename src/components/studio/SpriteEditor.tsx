// SpriteEditor.tsx — the 2D workspace, styled like Godot's 2D canvas editor:
// a tool + snap bar above the viewport, zoom controls, and node creation.
import { useState } from "react";
import {
  ArrowLeftRight,
  Box,
  Cloud,
  Crop,
  FileDown,
  FileUp,
  Grid3x3,
  MousePointer2,
  Move,
  Redo2,
  RotateCw,
  Ruler,
  Scaling,
  Undo2,
} from "lucide-react";
import { Viewport2D } from "./Viewport2D";
import { TOOL_LABELS, gridStepPx, serializeScene2D, deserializeScene2D, type Scene2D, type Tool2D } from "@/lib/scene2d";

interface Props {
  scene: Scene2D;
  tool: Tool2D;
  onToolChange: (t: Tool2D) => void;
  localSpace: boolean;
  onLocalSpaceChange: (v: boolean) => void;
  /** Live view/scene update — no undo step. */
  onChange: (patch: (s: Scene2D) => Scene2D) => void;
  /** Structural change — creates one undo step. */
  onCommit: (patch?: (s: Scene2D) => Scene2D) => void;
  onSelect: (id: string | null) => void;
  onSelectMany: (ids: string[]) => void;
  onDeleteSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const TOOLS: Array<{ tool: Tool2D; icon: typeof Move }> = [
  { tool: "select", icon: MousePointer2 },
  { tool: "move", icon: Move },
  { tool: "rotate", icon: RotateCw },
  { tool: "scale", icon: Scaling },
  { tool: "ruler", icon: Ruler },
  { tool: "pan", icon: Box },
];

const btn =
  "flex h-6 items-center gap-1 rounded-[3px] px-2 text-[11px] text-[#b0b0b0] hover:bg-[#3a3a3a] disabled:opacity-40";
const btnOn = "bg-[#4772b3] text-white hover:bg-[#4f7cc0]";

export function SpriteEditor({
  scene,
  tool,
  onToolChange,
  localSpace,
  onLocalSpaceChange,
  onChange,
  onCommit,
  onSelect,
  onSelectMany,
  onDeleteSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const [snapOpen, setSnapOpen] = useState(false);

  const exportJSON = () => {
    const blob = new Blob([serializeScene2D(scene)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sprite-scene.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = async (f: File) => {
    const txt = await f.text();
    const ds = deserializeScene2D(txt);
    onCommit(() => ds);
  };

  const step = gridStepPx(scene.grid)[0];
  const selCount = (scene.selectedIds ?? []).length || (scene.selectedId ? 1 : 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1f1f1f] text-[11px] text-[#d0d0d0] select-none">
      {/* Godot 2D toolbar: tools, space, snapping, view, undo */}
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[#141414] bg-[#303030] px-2">
        {TOOLS.map(({ tool: t, icon: Icon }) => (
          <button
            key={t}
            type="button"
            title={`${TOOL_LABELS[t].label} (${TOOL_LABELS[t].key}) — ${TOOL_LABELS[t].hint}`}
            onClick={() => onToolChange(t)}
            className={`flex h-6 w-6 items-center justify-center rounded-[3px] ${tool === t ? btnOn : "text-[#b0b0b0] hover:bg-[#3a3a3a]"}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-[#1d1d1d]" />

        <button
          type="button"
          title="Local / global space for move gizmos (Godot's local space toggle)"
          onClick={() => onLocalSpaceChange(!localSpace)}
          className={`${btn} ${localSpace ? "text-[#8fc0ff]" : ""}`}
        >
          <ArrowLeftRight className="h-3 w-3" />
          {localSpace ? "Local" : "Global"}
        </button>

        <span className="mx-1 h-4 w-px bg-[#1d1d1d]" />

        <button
          type="button"
          title="Use Smart Snap (Shift+S)"
          onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, smart: !s.snap.smart } }))}
          className={`${btn} ${scene.snap.smart ? "text-[#8ff0d0]" : ""}`}
        >
          <Crop className="h-3 w-3" /> Snap
        </button>
        <button
          type="button"
          title="Use Grid Snap (Shift+G)"
          onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, grid: !s.snap.grid } }))}
          className={`${btn} ${scene.snap.grid ? "text-[#8ff0d0]" : ""}`}
        >
          <Grid3x3 className="h-3 w-3" /> {step}px
        </button>
        <div className="relative">
          <button type="button" title="Snap settings" onClick={() => setSnapOpen((v) => !v)} className={btn}>
            <Cloud className="h-3 w-3" /> ⋯
          </button>
          {snapOpen && (
            <div className="absolute left-0 top-7 z-30 w-[230px] rounded-[3px] border border-black bg-[#303030] p-2 text-[11px] shadow-xl">
              <div className="mb-1 font-heading uppercase tracking-wide text-[#9a9a9a]">Configure Snap</div>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Grid step X
                <input
                  type="number"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.grid.step[0]}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, grid: { ...s.grid, step: [Math.max(1, +e.target.value || 1), s.grid.step[1]] } }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Grid step Y
                <input
                  type="number"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.grid.step[1]}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, grid: { ...s.grid, step: [s.grid.step[0], Math.max(1, +e.target.value || 1)] } }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Offset X
                <input
                  type="number"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.grid.offset[0]}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, grid: { ...s.grid, offset: [+e.target.value || 0, s.grid.offset[1]] } }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Offset Y
                <input
                  type="number"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.grid.offset[1]}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, grid: { ...s.grid, offset: [s.grid.offset[0], +e.target.value || 0] } }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Primary line every
                <input
                  type="number"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.grid.primary}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, grid: { ...s.grid, primary: Math.max(1, +e.target.value || 1) } }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Rotation step °
                <input
                  type="number"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.snap.rotationStep}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, snap: { ...s.snap, rotationStep: Math.max(1, +e.target.value || 1) } }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2 py-0.5">
                Scale step
                <input
                  type="number"
                  step="0.05"
                  className="w-16 rounded border border-[#1d1d1d] bg-[#232323] px-1 text-right"
                  value={scene.snap.scaleStep}
                  onChange={(e) =>
                    onCommit((s) => ({ ...s, snap: { ...s.snap, scaleStep: Math.max(0.01, +e.target.value || 0.1) } }))
                  }
                />
              </label>
              <div className="my-1 h-px bg-[#1d1d1d]" />
              <Toggle
                label="Snap to other nodes"
                on={scene.snap.otherNodes}
                onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, otherNodes: !s.snap.otherNodes } }))}
              />
              <Toggle
                label="Snap to guides"
                on={scene.snap.guides}
                onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, guides: !s.snap.guides } }))}
              />
              <Toggle
                label="Snap relative"
                on={scene.snap.snapRelative}
                onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, snapRelative: !s.snap.snapRelative } }))}
              />
              <Toggle
                label="Rotation snap"
                on={scene.snap.rotationSnap}
                onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, rotationSnap: !s.snap.rotationSnap } }))}
              />
              <Toggle
                label="Scale snap"
                on={scene.snap.scaleSnap}
                onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, scaleSnap: !s.snap.scaleSnap } }))}
              />
              <Toggle
                label="Pixel snap"
                on={scene.snap.snapPixel}
                onClick={() => onCommit((s) => ({ ...s, snap: { ...s.snap, snapPixel: !s.snap.snapPixel } }))}
              />
              <div className="my-1 h-px bg-[#1d1d1d]" />
              <div className="mb-1 font-heading uppercase tracking-wide text-[#9a9a9a]">Grid</div>
              <Toggle
                label="Always show grid"
                on={scene.gridVisibility === "always"}
                onClick={() => onCommit((s) => ({ ...s, gridVisibility: "always" }))}
              />
              <Toggle
                label="Show when snapping"
                on={scene.gridVisibility === "snapping"}
                onClick={() => onCommit((s) => ({ ...s, gridVisibility: "snapping" }))}
              />
              <Toggle
                label="Hide grid"
                on={scene.gridVisibility === "never"}
                onClick={() => onCommit((s) => ({ ...s, gridVisibility: "never" }))}
              />
              <Toggle label="Show rulers" on={scene.showRulers} onClick={() => onCommit((s) => ({ ...s, showRulers: !s.showRulers }))} />
              <Toggle label="Show helpers (H)" on={scene.showHelpers} onClick={() => onCommit((s) => ({ ...s, showHelpers: !s.showHelpers }))} />
            </div>
          )}
        </div>

        <span className="mx-1 h-4 w-px bg-[#1d1d1d]" />

        {/* Undo / redo */}
        <button type="button" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} className={btn}>
          <Undo2 className="h-3 w-3" />
        </button>
        <button type="button" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo} className={btn}>
          <Redo2 className="h-3 w-3" />
        </button>

        <span className="mx-1 h-4 w-px bg-[#1d1d1d]" />

        <label className="flex cursor-pointer items-center gap-1 hover:text-[#e6cd5b]" title="Import a 2D scene (.json)">
          <FileUp className="h-3 w-3" /> Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
          />
        </label>
        <button type="button" onClick={exportJSON} className={btn} title="Export the 2D scene (.json)">
          <FileDown className="h-3 w-3" /> Export
        </button>

        <div className="ml-auto flex items-center gap-2 pr-1 text-[10px] text-[#8f8f8f]">
          <span>
            {scene.objects.length} node{scene.objects.length === 1 ? "" : "s"}
            {selCount > 0 ? ` · ${selCount} selected` : ""}
          </span>
          <span>2D Canvas</span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Viewport2D
          scene={scene}
          tool={tool}
          onToolChange={onToolChange}
          onSelect={onSelect}
          onSelectMany={onSelectMany}
          onChange={onChange}
          onCommit={onCommit}
          onDeleteSelected={onDeleteSelected}
          localSpace={localSpace}
        />
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-[2px] px-1 py-0.5 text-left hover:bg-[#3a3a3a]"
    >
      <span>{label}</span>
      <span className={`h-2.5 w-2.5 rounded-[2px] ${on ? "bg-[#4772b3]" : "bg-[#232323]"}`} />
    </button>
  );
}
