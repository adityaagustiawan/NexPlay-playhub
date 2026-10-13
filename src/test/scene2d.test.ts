// scene2d.test.ts — Godot-parity tests for the 2D editor model + snapping.
import { describe, expect, it } from "vitest";
import {
  createRect,
  createScene2D,
  createSprite,
  createText,
  deserializeScene2D,
  gridStepPx,
  normalizeScene2D,
  objectBounds,
  selIdsOf,
  serializeScene2D,
  snapAngle2D,
  snapPoint2D,
  snapScale2D,
  stepify,
  TOOL_KEYS,
  TOOL_LABELS,
  toggleSelected,
  removeObject,
  patchTransform,
  type Scene2D,
} from "@/lib/scene2d";
import { localToWorld, makeXform, tickInterval, worldToLocal, zoomAtPoint } from "@/lib/viewport2dDraw";

const base = (): Scene2D => ({ ...createScene2D(), snap: { ...createScene2D().snap, grid: false } });

const withRect = (s: Scene2D, x: number, y: number, w = 100, h = 100) => {
  const r = createRect("R", x, y, w, h);
  return { scene: { ...s, objects: [r] }, r };
};

describe("stepify (Godot Math::stepify)", () => {
  it("snaps to multiples of the step", () => {
    expect(stepify(23, 16)).toBe(16);
    expect(stepify(25, 16)).toBe(32);
    expect(stepify(-23, 16)).toBe(-16);
    expect(stepify(1.2, 0.5)).toBe(1);
  });

  it("is a no-op for a non-positive step", () => {
    expect(stepify(23, 0)).toBe(23);
    expect(stepify(23, -4)).toBe(23);
  });
});

describe("gridStepPx", () => {
  it("applies the 2^n multiplier and clamps it", () => {
    const g = { offset: [0, 0] as [number, number], step: [16, 16] as [number, number], primary: 8, multiplier: 0 };
    expect(gridStepPx(g)).toEqual([16, 16]);
    expect(gridStepPx({ ...g, multiplier: 1 })).toEqual([32, 32]);
    expect(gridStepPx({ ...g, multiplier: 9 })).toEqual([256, 256]);
    expect(gridStepPx({ ...g, multiplier: -9 })).toEqual([1, 1]);
  });
});

describe("objectBounds", () => {
  it("is the AABB for an unrotated node", () => {
    const { r } = withRect(base(), 0, 0, 100, 50);
    expect(objectBounds(r)).toEqual([[-50, -25], [50, 25]]);
  });

  it("grows for a rotated node", () => {
    const { scene, r } = withRect(base(), 0, 0, 100, 100);
    const rotated = patchTransform(scene, r.id, { rotation: 45 }).objects[0];
    const [, [x1, y1]] = objectBounds(rotated);
    // a 100x100 square rotated 45deg spans ~141 units
    expect(x1).toBeCloseTo(70.71, 1);
    expect(y1).toBeCloseTo(70.71, 1);
  });
});

describe("snapPoint2D", () => {
  it("snaps to other nodes' sides and centers when smart snapping", () => {
    const { scene } = withRect(base(), 200, 200);
    const { point } = snapPoint2D(scene, [205, 198], { selfId: "other", zoom: 1 });
    // 205 is within the 10px radius of the rect's left edge (150) / center (200)
    expect(point[0]).toBe(200);
    // 198 is within the radius of the center (200) too
    expect(point[1]).toBe(200);
  });

  it("does not snap to other nodes when smart snapping is off", () => {
    const { scene } = withRect(base(), 200, 200);
    const off: Scene2D = { ...scene, snap: { ...scene.snap, smart: false } };
    const { point } = snapPoint2D(off, [205, 198], { selfId: "other", zoom: 1 });
    expect(point).toEqual([205, 198]);
  });

  it("inverts smart snapping while Ctrl is held (xor)", () => {
    const { scene } = withRect(base(), 200, 200);
    const on = snapPoint2D(scene, [205, 205], { selfId: "other", zoom: 1 });
    const off: Scene2D = { ...scene, snap: { ...scene.snap, smart: false } };
    const offSnap = snapPoint2D(off, [205, 205], { selfId: "other", zoom: 1, invertSmart: true });
    expect(on.point).toEqual(offSnap.point);
  });

  it("ignores invisible and locked nodes", () => {
    const a = createRect("A", 100, 100, 40, 40);
    const hidden = { ...createRect("B", 200, 200, 40, 40), visible: false };
    const scene: Scene2D = { ...base(), objects: [a, hidden] };
    const { point } = snapPoint2D(scene, [203, 203], { selfId: "x", zoom: 1 });
    // nothing snap-able near (203,203) -> unchanged
    expect(point).toEqual([203, 203]);
  });

  it("grid snapping is a forced snap (always applies)", () => {
    const s: Scene2D = { ...base(), snap: { ...base().snap, grid: true } };
    const { point } = snapPoint2D(s, [1000, 1001], { selfId: null, zoom: 1 });
    expect(point).toEqual([1008, 1008]);
    expect(point[0] % 16).toBe(0);
  });

  it("grid offset shifts the grid", () => {
    const s: Scene2D = {
      ...base(),
      snap: { ...base().snap, grid: true },
      grid: { ...base().grid, offset: [8, 8] },
    };
    const { point } = snapPoint2D(s, [0, 0], { selfId: null, zoom: 1 });
    expect(point).toEqual([8, 8]);
  });

  it("snap relative shifts the grid to the node's own origin", () => {
    const { scene, r } = withRect(base(), 3, 3);
    const s: Scene2D = {
      ...scene,
      snap: { ...scene.snap, grid: true, snapRelative: true },
    };
    const { point } = snapPoint2D(s, [0, 0], { selfId: r.id, zoom: 1 });
    expect(point).toEqual([3, 3]);
  });

  it("pixel snap rounds to whole pixels", () => {
    const s: Scene2D = { ...base(), snap: { ...base().snap, snapPixel: true } };
    const { point } = snapPoint2D(s, [12.4, -3.6], { selfId: null, zoom: 1 });
    expect(point).toEqual([12, -4]);
  });

  it("snaps to ruler guides", () => {
    const s: Scene2D = { ...base(), guides: { v: [500], h: [300] } };
    const { point, hints } = snapPoint2D(s, [497, 298], { selfId: null, zoom: 1 });
    expect(point).toEqual([500, 300]);
    // guides first, then pixel snap confirms the same integer values
    expect(hints.slice(0, 2)).toEqual([
      { axis: "x", at: 500, kind: "guide", span: undefined },
      { axis: "y", at: 300, kind: "guide", span: undefined },
    ]);
    expect(hints.filter((h) => h.kind === "pixel")).toHaveLength(2);
  });

  it("the zoom value scales the snap radius", () => {
    const { scene } = withRect(base(), 200, 200);
    // 20 world units away: within the 10px radius at zoom 1... no, 20 > 10
    expect(snapPoint2D(scene, [217, 200], { selfId: "x", zoom: 1 }).point[0]).toBe(217);
    // ...but in range when zoomed out (smaller world radius)
    expect(snapPoint2D(scene, [210, 200], { selfId: "x", zoom: 0.1 }).point[0]).toBe(200);
  });
});

describe("snapAngle2D / snapScale2D", () => {
  it("snaps the angle to the rotation step", () => {
    const s: Scene2D = { ...base(), snap: { ...base().snap, rotationSnap: true, rotationStep: 15 } };
    expect(snapAngle2D(s, 7)).toBe(0);
    expect(snapAngle2D(s, 11)).toBe(15);
    expect(snapAngle2D(s, -8)).toBe(-15);
  });

  it("honours the rotation offset", () => {
    const s: Scene2D = { ...base(), snap: { ...base().snap, rotationSnap: true, rotationStep: 15, rotationOffset: 5 } };
    expect(snapAngle2D(s, 12)).toBe(5);
    expect(snapAngle2D(s, 14)).toBe(20);
  });

  it("leaves the angle alone when rotation snapping is off", () => {
    const s: Scene2D = { ...base(), snap: { ...base().snap, rotationSnap: false } };
    expect(snapAngle2D(s, 7.3)).toBe(7.3);
  });

  it("snaps scale to the scale step", () => {
    const s: Scene2D = { ...base(), snap: { ...base().snap, scaleSnap: true, scaleStep: 0.25 } };
    expect(snapScale2D(s, [1.1, 1.2])).toEqual([1, 1.25]);
  });
});

  describe("view transform", () => {
  it("round-trips world <-> screen through the origin", () => {
    const xf = makeXform({ x: 0, y: 0, zoom: 1 }, 400, 300);
    expect([xf.wx(xf.sx(12)), xf.wy(xf.sy(-7))]).toEqual([12, -7]);
  });

  it("applies pan and zoom", () => {
    const xf = makeXform({ x: 10, y: -5, zoom: 2 }, 400, 300);
    // screen = center + (world + pan) * zoom
    expect(xf.sx(10)).toBe(200 + (10 + 10) * 2);
    expect(xf.sy(-5)).toBe(150 + (-5 + -5) * 2);
    expect(xf.wx(xf.sx(33.5))).toBeCloseTo(33.5, 6);
  });

  it("tickInterval widens so ruler labels stay readable", () => {
    // 16px grid at 100% zoom would be too dense -> step up to 64
    expect(tickInterval(16, 1, 46)).toBe(64);
    expect(tickInterval(64, 1, 46)).toBe(64);
    expect(tickInterval(16, 8, 46)).toBe(16);
  });

  it("zoomAtPoint keeps the world point under the cursor pinned", () => {
    for (const [x, y, zoom] of [
      [0, 0, 1],
      [120, -40, 0.5],
      [-300, 90, 2.5],
    ] as Array<[number, number, number]>) {
      for (const factor of [0.8, 1.2, 3]) {
        const w = 800;
        const h = 600;
        for (const [px, py] of [
          [12, 40],
          [400, 300],
          [790, 590],
        ]) {
          const view = { x, y, zoom };
          const before = makeXform(view, w, h);
          const worldAfter = [before.wx(px), before.wy(py)];
          const next = zoomAtPoint(view, factor, px, py, w, h);
          const after = makeXform(next, w, h);
          expect(after.sx(worldAfter[0])).toBeCloseTo(px, 6);
          expect(after.sy(worldAfter[1])).toBeCloseTo(py, 6);
          expect(next.zoom).toBeCloseTo(zoom * factor, 6);
        }
      }
    }
  });

  it("zoomAtPoint clamps the zoom", () => {
    expect(zoomAtPoint({ x: 0, y: 0, zoom: 60 }, 10, 0, 0, 800, 600).zoom).toBe(64);
    expect(zoomAtPoint({ x: 0, y: 0, zoom: 0.06 }, 0.1, 0, 0, 800, 600).zoom).toBe(0.05);
  });
});

describe("node local <-> world (pivot aware)", () => {
  it("round-trips with no pivot and no rotation", () => {
    const o = createRect("R", 40, 20, 100, 50);
    const w = localToWorld(o, 10, -5);
    expect(w).toEqual([50, 15]);
    expect(worldToLocal(o, w[0], w[1])).toEqual([10, -5]);
  });

  it("round-trips with a pivot offset", () => {
    const o = { ...createRect("R", 0, 0, 100, 100), pivot: [20, -10] as [number, number] };
    const w = localToWorld(o, 30, 40);
    expect(worldToLocal(o, w[0], w[1])).toEqual([30, 40]);
  });

  it("round-trips with rotation + scale + pivot", () => {
    const o = {
      ...createRect("R", 15, -25, 80, 40),
      transform: { position: [15, -25] as [number, number], rotation: 37, scale: [1.5, 0.5] as [number, number] },
      pivot: [-6, 9] as [number, number],
    };
    const w = localToWorld(o, 12, -7);
    const back = worldToLocal(o, w[0], w[1]);
    expect(back[0]).toBeCloseTo(12, 9);
    expect(back[1]).toBeCloseTo(-7, 9);
  });

  it("rotates the node around its pivot", () => {
    const o = { ...createRect("R", 0, 0, 20, 20), pivot: [50, 0] as [number, number] };
    const rotated = { ...o, transform: { ...o.transform, rotation: 90 } };
    // the pivot itself never moves
    expect(localToWorld(rotated, 50, 0)).toEqual([50, 0]);
    // a point 10 above the pivot swings to the +x side
    const p = localToWorld(rotated, 50, -10);
    expect(p[0]).toBeCloseTo(60, 6);
    expect(p[1]).toBeCloseTo(0, 6);
  });
});

describe("selection helpers", () => {
  it("toggleSelected adds then removes", () => {
    const a = createRect("A", 0, 0);
    const b = createRect("B", 10, 10);
    let s: Scene2D = { ...base(), objects: [a, b] };
    s = toggleSelected(s, a.id);
    expect(selIdsOf(s)).toEqual([a.id]);
    s = toggleSelected(s, b.id);
    expect(selIdsOf(s)).toEqual([a.id, b.id]);
    s = toggleSelected(s, a.id);
    expect(selIdsOf(s)).toEqual([b.id]);
  });

  it("toggleSelected refuses locked nodes", () => {
    const a = { ...createRect("A", 0, 0), locked: true };
    const s: Scene2D = { ...base(), objects: [a] };
    expect(toggleSelected(s, a.id).selectedIds ?? []).toEqual([]);
  });

  it("removeObject drops the id from the selection and keeps the rest", () => {
    const a = createRect("A", 0, 0);
    const b = createRect("B", 5, 5);
    let s: Scene2D = { ...base(), objects: [a, b], selectedId: a.id, selectedIds: [a.id, b.id] };
    s = removeObject(s, a.id);
    expect(s.selectedId).toBe(b.id);
    expect(s.selectedIds).toEqual([b.id]);
  });
});

describe("serialize / normalize", () => {
  it("round-trips through JSON", () => {
    const s: Scene2D = { ...base(), objects: [createRect("R", 1, 2)], guides: { v: [10], h: [20] } };
    const back = deserializeScene2D(serializeScene2D(s));
    expect(back.objects).toHaveLength(1);
    expect(back.guides).toEqual({ v: [10], h: [20] });
    expect(back.snap).toEqual(s.snap);
  });

  it("upgrades a v1 payload with no grid/snap data", () => {
    const s = normalizeScene2D({ objects: [{ id: "a", name: "A", kind: "rect", transform: { position: [1, 2], rotation: 0, scale: [1, 1] }, color: "#fff", visible: true, width: 10, height: 10 }] });
    expect(s.grid.step).toEqual([16, 16]);
    expect(s.snap.smart).toBe(true);
    expect(s.snap.snapPixel).toBe(true);
    expect(s.view).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(s.objects[0].pivot).toEqual([0, 0]);
    expect(s.objects[0].zIndex).toBe(0);
  });

  it("repairs garbage instead of throwing", () => {
    const s = normalizeScene2D({
      objects: [null, 5, "x", { kind: "nope" }, { kind: "sprite" }, { kind: "text" }],
      view: { zoom: 9999, x: "no" },
      grid: { step: [0, -5] },
      windowSize: { width: 0 },
    });
    expect(s.objects).toHaveLength(2);
    expect(s.view.zoom).toBe(64);
    expect(s.view.x).toBe(0);
    expect(s.grid.step).toEqual([1, 1]);
    expect(s.windowSize.width).toBe(1);
  });

  it("falls back to an empty scene on broken JSON", () => {
    const s = deserializeScene2D("{not json");
    expect(s.objects).toEqual([]);
    expect(s.snap).toBeDefined();
  });

  it("drops a zero scale (Godot's Transform2D has no zero scale)", () => {
    const s = normalizeScene2D({ objects: [{ kind: "rect", transform: { position: [0, 0], rotation: 0, scale: [0, 2] } }] });
    expect(s.objects[0].transform.scale).toEqual([1, 2]);
  });
});

describe("node kinds", () => {
  it("creates every Godot-ish node type", () => {
    const r = createRect();
    const sp = createSprite();
    const t = createText("Label", "Hello");
    expect(r.kind).toBe("rect");
    expect(sp.kind).toBe("sprite");
    expect(t.kind).toBe("text");
    expect(t.text).toBe("Hello");
    expect(t.width).toBeGreaterThan(24);
    for (const o of [r, sp, t]) {
      expect(o.pivot).toEqual([0, 0]);
      expect(o.zIndex).toBe(0);
      expect(o.locked).toBe(false);
      expect(o.visible).toBe(true);
    }
  });
});

describe("tool registry", () => {
  it("maps Godot's 2D shortcut keys", () => {
    expect(TOOL_KEYS.q).toBe("select");
    expect(TOOL_KEYS.w).toBe("move");
    expect(TOOL_KEYS.e).toBe("rotate");
    expect(TOOL_KEYS.s).toBe("scale");
    expect(TOOL_KEYS.r).toBe("ruler");
    expect(TOOL_KEYS.g).toBe("pan");
  });

  it("labels every tool with its shortcut", () => {
    for (const [t, meta] of Object.entries(TOOL_LABELS)) {
      expect(meta.label).toMatch(/Mode$/);
      expect(meta.key).toHaveLength(1);
      expect(TOOL_KEYS[meta.key.toLowerCase()]).toBe(t);
    }
  });
});
