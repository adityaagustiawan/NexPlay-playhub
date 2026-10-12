// Outliner.tsx — Blender-style scene hierarchy for the game being edited.
<<<<<<< HEAD
// Selecting a node drives the Properties editor on the right. When a 3D scene
// is present, its objects are listed under "Scene Collection" so cameras,
// lights and meshes can be clicked like in Blender.
import { Box, Bomb, Camera, ChevronDown, Eye, EyeOff, Globe, Lightbulb, Palette, Target, User } from "lucide-react";
import type { ComponentType } from "react";
import { GOOD_LABEL, BAD_LABEL, type Mode } from "@/lib/studioConfig";
import type { SceneObject } from "@/lib/scene3d";
=======
// Selecting a node drives the Properties editor on the right.
import { Box, Bomb, ChevronDown, Globe, Palette, Target, User } from "lucide-react";
import type { ComponentType } from "react";
import { GOOD_LABEL, BAD_LABEL, type Mode } from "@/lib/studioConfig";
>>>>>>> origin/main

export type OutlinerKey = "game" | "player" | "good" | "bad" | "environment" | "world";

interface Props {
  title: string;
  mode: Mode;
  selected: OutlinerKey;
  onSelect: (key: OutlinerKey) => void;
<<<<<<< HEAD
  /** 3D scene objects to list under the scene collection. */
  objects?: SceneObject[];
  /** Selected 3D object id. */
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onToggleObjectVisible?: (id: string, visible: boolean) => void;
=======
>>>>>>> origin/main
}

interface NodeDef {
  key: OutlinerKey;
  icon: ComponentType<{ className?: string }>;
}

<<<<<<< HEAD
/** Icon per object kind, Blender-style: box for meshes, camera, lamp. */
const OBJECT_ICONS: Record<SceneObject["kind"], ComponentType<{ className?: string }>> = {
  mesh: Box,
  camera: Camera,
  light: Lightbulb,
  empty: Camera,
};

export function Outliner({
  title,
  mode,
  selected,
  onSelect,
  objects,
  selectedObjectId,
  onSelectObject,
  onToggleObjectVisible,
}: Props) {
=======
export function Outliner({ title, mode, selected, onSelect }: Props) {
>>>>>>> origin/main
  const children: NodeDef[] = [
    { key: "player", icon: User },
    { key: "good", icon: Target },
    { key: "bad", icon: Bomb },
    { key: "environment", icon: Palette },
  ];

  const Row = ({
    node,
    label,
    indent,
    hasChildren,
  }: {
    node: OutlinerKey;
    label: string;
    indent: number;
    hasChildren?: boolean;
  }) => {
    const Icon = (node === "game" ? Box : node === "world" ? Globe : children.find((c) => c.key === node)?.icon) ?? Box;
    const active = selected === node;
    return (
      <button
        type="button"
        onClick={() => onSelect(node)}
        style={{ paddingLeft: `${indent}px` }}
        className={`flex w-full items-center gap-1.5 rounded-[3px] py-[3px] pr-1 text-left text-[11px] ${
          active ? "bg-[#4772b3] text-white" : "text-[#c8c8c8] hover:bg-[#3a3a3a]"
        }`}
      >
        <span className="flex w-3 justify-center">
          {hasChildren ? <ChevronDown className="h-3 w-3 opacity-70" /> : null}
        </span>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading text-[11px] uppercase tracking-wide text-[#b8b8b8]">
        Outliner
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <Row node="game" label={title || "Untitled"} indent={2} hasChildren />
        {children.map((c) => (
          <Row
            key={c.key}
            node={c.key}
            label={c.key === "good" ? GOOD_LABEL[mode] : c.key === "bad" ? BAD_LABEL[mode] : c.key}
            indent={20}
          />
        ))}
<<<<<<< HEAD
        {objects && objects.length > 0 && (
          <div className="mt-1.5 border-t border-[#3d3d3d] pt-1.5">
            <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-[#8a8a8a]">Scene Collection</div>
            {objects.map((obj) => {
              const Icon = OBJECT_ICONS[obj.kind] ?? Box;
              const active = selectedObjectId === obj.id;
              return (
                <div
                  key={obj.id}
                  className={`flex items-center gap-1.5 rounded-[3px] py-[3px] pr-1 ${
                    active ? "bg-[#4772b3] text-white" : "text-[#c8c8c8] hover:bg-[#3a3a3a]"
                  }`}
                  style={{ paddingLeft: "20px" }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectObject?.(obj.id)}
                    title={`Select ${obj.name}`}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                    <span className="truncate">{obj.name}</span>
                  </button>
                  <button
                    type="button"
                    title={obj.visible ? "Hide object" : "Show object"}
                    aria-label={obj.visible ? `Hide ${obj.name}` : `Show ${obj.name}`}
                    onClick={() => onToggleObjectVisible?.(obj.id, !obj.visible)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] ${
                      obj.visible ? "text-[#9a9a9a] hover:text-white" : "text-[#e0b341]"
                    }`}
                  >
                    {obj.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
=======
>>>>>>> origin/main
        <Row node="world" label="World" indent={2} />
      </div>
    </div>
  );
}
