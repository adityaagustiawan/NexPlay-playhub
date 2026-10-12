// OperatorSearch.tsx — Blender-style "Operator Search" (F3): a filterable list
// of every action in the editor. Type to filter, ↑/↓ to move, Enter to run.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export interface StudioOperator {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  operators: StudioOperator[];
  onClose: () => void;
}

export function OperatorSearch({ open, operators, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((o) => o.label.toLowerCase().includes(q) || o.id.includes(q));
  }, [query, operators]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const run = (i: number) => {
    const op = filtered[i];
    if (!op) return;
    op.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/50 px-4 pt-24" onMouseDown={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-[6px] border border-[#4a4a4a] bg-[#2b2b2b] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#3d3d3d] px-3 py-2">
          <Search className="h-4 w-4 text-[#8f8f8f]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(index);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Operator Search (F3)"
            className="h-6 flex-1 bg-transparent font-body text-[12px] text-[#e0e0e0] outline-none placeholder:text-[#7a7a7a]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-[11px] text-[#8f8f8f]">No matching operators.</p>
          )}
          {filtered.map((op, i) => (
            <button
              key={op.id}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] ${
                i === index ? "bg-[#4772b3] text-white" : "text-[#c8c8c8] hover:bg-[#3a3a3a]"
              }`}
            >
              <span className="flex-1 truncate">{op.label}</span>
              {op.hint ? <span className="text-[10px] opacity-70">{op.hint}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
