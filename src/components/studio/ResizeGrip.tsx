// ResizeGrip.tsx — a draggable "3 dots" handle used to resize studio panels.
// Hold and swipe: a vertical grip (axis "x") changes a panel's width, a
// horizontal grip (axis "y") changes its height. Double-click resets to default.
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { resizeValue } from "@/lib/resize";

type Axis = "x" | "y";

interface Props {
  axis: Axis;
  /** True when dragging toward the negative direction grows the panel (a grip
   *  on the LEFT edge of a right-hand panel, or above a bottom panel). */
  invert?: boolean;
  size: number;
  min: number;
  max: number;
  onResize: (size: number) => void;
  onReset?: () => void;
  title?: string;
  className?: string;
}

export function ResizeGrip({ axis, invert, size, min, max, onResize, onReset, title, className }: Props) {
  const drag = useRef(false);
  const start = useRef({ pos: 0, size: 0 });
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      drag.current = true;
      setActive(true);
      start.current = { pos: axis === "x" ? e.clientX : e.clientY, size };
      document.body.style.userSelect = "none";
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    },
    [axis, size],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      const cur = axis === "x" ? e.clientX : e.clientY;
      onResize(resizeValue(start.current.size, cur - start.current.pos, { min, max, invert }));
    },
    [axis, invert, max, min, onResize],
  );

  const end = useCallback(() => {
    if (!drag.current) return;
    drag.current = false;
    setActive(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      title={title ?? "Drag to resize · double-click to reset"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      className={`group relative z-20 flex shrink-0 touch-none items-center justify-center bg-[#1d1d1d] ${
        axis === "x" ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
      } ${active ? "bg-[#4772b3]" : "hover:bg-[#3f3f3f]"} ${className ?? ""}`}
    >
      <div className={`pointer-events-none flex items-center justify-center gap-[2px] ${axis === "x" ? "flex-col" : "flex-row"}`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`block h-[3px] w-[3px] rounded-full transition-colors ${
              active ? "bg-white" : "bg-[#6a6a6a] group-hover:bg-[#c8c8c8]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
