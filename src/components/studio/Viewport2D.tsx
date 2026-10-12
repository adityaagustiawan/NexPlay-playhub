// Viewport2D.tsx — 2D asset editor (like Blender's 2D/Image editor but for game assets).
// Non-freezing, editable: pan, zoom, select, move/scale/rotate (basic), add rect/sprite.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createRect, createSprite, patchObject, findObject, type Scene2D, type SceneObject2D, type Vec2 } from "@/lib/scene2d";

export type Viewport2DHandle = {
  zoom(f: number): void;
  pan(dx: number, dy: number): void;
  reset(): void;
};

interface Props {
  scene: Scene2D;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (patch: (s: Scene2D) => Scene2D) => void;
}

export const Viewport2D = forwardRef<Viewport2DHandle, Props>(({ scene, selectedId, onSelect, onChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<{ type: "pan" | "move"; start: [number, number]; obj?: SceneObject2D } | null>(null);
  const last = useRef({ x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    zoom(f) { setScale((s) => Math.max(0.1, Math.min(10, s * f))); },
    pan(dx, dy) { setTx((t) => t + dx / scale); setTy((t) => t + dy / scale); },
    reset() { setTx(0); setTy(0); setScale(1); },
  }), [scale]);

  const toScreen = useCallback((x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return [x, y] as Vec2;
    return [c.width/2 + (x + tx) * scale, c.height/2 + (y + ty) * scale] as Vec2;
  }, [tx, ty, scale]);

  const toWorld = useCallback((sx: number, sy: number) => {
    const c = canvasRef.current;
    if (!c) return [sx, sy] as Vec2;
    return [(sx - c.width/2) / scale - tx, (sy - c.height/2) / scale - ty] as Vec2;
  }, [tx, ty, scale]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = c.clientWidth * devicePixelRatio;
    c.height = c.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.clientWidth/2, c.clientHeight/2);
    ctx.scale(scale, scale);
    ctx.translate(tx, ty);
    const grid = 40;
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 1/scale;
    const start = -Math.ceil(c.clientWidth/(scale*grid))*2;
    for (let x = start; x < -start; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, -start*grid); ctx.lineTo(x, start*grid); ctx.stroke();
    }
    for (let y = start; y < -start; y += grid) {
      ctx.beginPath(); ctx.moveTo(-start*grid, y); ctx.lineTo(start*grid, y); ctx.stroke();
    }
    for (const o of scene.objects) {
      if (!o.visible) continue;
      ctx.save();
      ctx.translate(o.transform.position[0], o.transform.position[1]);
      ctx.rotate((o.transform.rotation * Math.PI)/180);
      ctx.scale(o.transform.scale[0], o.transform.scale[1]);
      const sel = selectedId === o.id;
      if (o.kind === "rect") {
        ctx.fillStyle = o.color || "#4f8cff";
        ctx.fillRect(-o.width/2, -o.height/2, o.width, o.height);
        if (sel) { ctx.strokeStyle = "#ffa028"; ctx.lineWidth = 2/scale; ctx.strokeRect(-o.width/2, -o.height/2, o.width, o.height); }
      } else if (o.kind === "sprite") {
        if (o.src) {
          const img = new Image();
          img.src = o.src;
          ctx.drawImage(img, -o.width/2, -o.height/2, o.width, o.height);
        } else {
          ctx.fillStyle = "#6b7280"; ctx.fillRect(-o.width/2, -o.height/2, o.width, o.height);
        }
        if (sel) { ctx.strokeStyle = "#ffa028"; ctx.lineWidth = 2/scale; ctx.strokeRect(-o.width/2, -o.height/2, o.width, o.height); }
      } else if (o.kind === "text") {
        ctx.font = `${o.height}px system-ui`;
        ctx.fillStyle = o.color || "#fff";
        ctx.fillText(o.text || "Text", 0, 0);
        if (sel) { ctx.strokeStyle = "#ffa028"; ctx.lineWidth = 2/scale; ctx.strokeRect(-o.width/2, -o.height/2, o.width, o.height); }
      }
      ctx.restore();
    }
    ctx.restore();
  }, [scene, selectedId, tx, ty, scale]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { const c = canvasRef.current; if (!c) return; const onR = () => draw(); window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR); }, [draw]);

  const onMouseDown = (e: React.MouseEvent) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const [wx, wy] = toWorld(sx, sy);
    last.current = { x: sx, y: sy };
    let hit: SceneObject2D | undefined;
    for (const o of [...scene.objects].reverse()) {
      if (!o.visible) continue;
      if (wx >= o.transform.position[0]-o.width/2 && wx <= o.transform.position[0]+o.width/2 && wy >= o.transform.position[1]-o.height/2 && wy <= o.transform.position[1]+o.height/2) { hit = o; break; }
    }
    if (e.button === 1 || e.ctrlKey) { setDrag({ type: "pan", start: [sx, sy] }); onSelect(null); return; }
    if (hit) { onSelect(hit.id); setDrag({ type: "move", start: [sx, sy], obj: hit }); }
    else { onSelect(null); }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (!drag) { draw(); return; }
    if (drag.type === "pan") { setTx(t => t + (sx - last.current.x)/(scale)); setTy(tt => tt + (sy - last.current.y)/(scale)); last.current = { x: sx, y: sy }; return; }
    if (drag.type === "move" && drag.obj) {
      const [wx0, wy0] = toWorld(last.current.x, last.current.y);
      const [wx1, wy1] = toWorld(sx, sy);
      onChange(s => patchObject(s, drag.obj!.id, { transform: { ...drag.obj!.transform, position: [drag.obj!.transform.position[0] + (wx1-wx0), drag.obj!.transform.position[1] + (wy1-wy0)] } }));
      last.current = { x: sx, y: sy };
    }
  };
  const onMouseUp = () => setDrag(null);
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); setScale(s => Math.max(0.1, Math.min(10, s * (e.deltaY < 0 ? 1.1 : 0.9)))); };

  const add = (k: "rect"|"sprite") => { onChange(s => addObject(s, k==="rect" ? createRect("Game Rect",0,0,80,40) : createSprite("Game Sprite","",0,0,64,64))); };

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block bg-[#1a1a1a]" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel} />
      <div className="absolute top-2 right-2 flex gap-1 bg-[#303030]/95 p-1 rounded">
        <button className="px-2 h-6 text-xs text-[#b0b0b0] hover:bg-[#3a3a3a]" onClick={() => add("rect")}>+Rect</button>
        <button className="px-2 h-6 text-xs text-[#b0b0b0] hover:bg-[#3a3a3a]" onClick={() => add("sprite")}>+Sprite</button>
        <button className="px-2 h-6 text-xs text-[#b0b0b0] hover:bg-[#3a3a3a]" onClick={() => ref && (ref as any).current?.reset()}>Reset View</button>
      </div>
    </div>
  );
});
Viewport2D.displayName = "Viewport2D";
