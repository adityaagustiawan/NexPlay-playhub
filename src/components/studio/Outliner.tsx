// Outliner.tsx — Blender-style scene hierarchy for the game being edited.
// Selecting a node drives the Properties editor on the right.
import { Box, Bomb, ChevronDown, Globe, Palette, Target, User } from "lucide-react";
import type { ComponentType } from "react";
import { GOOD_LABEL, BAD_LABEL, type Mode } from "@/lib/studioConfig";

export type OutlinerKey = "game" | "player" | "good" | "bad" | "environment" | "world";

interface Props {
  title: string;
  mode: Mode;
  selected: OutlinerKey;
  onSelect: (key: OutlinerKey) => void;
}

interface NodeDef {
  key: OutlinerKey;
  icon: ComponentType<{ className?: string }>;
}

export function Outliner({ title, mode, selected, onSelect }: Props) {
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
        <Row node="world" label="World" indent={2} />
      </div>
    </div>
  );
}
