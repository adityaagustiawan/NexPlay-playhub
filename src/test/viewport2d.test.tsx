// viewport2d.test.tsx — mounts the 2D canvas editor and drives the real event
// handlers (jsdom has no 2D context, so this covers the interaction logic:
// picking, tools, snapping application, selection and keyboard).
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, cleanup } from "@testing-library/react";
import { Viewport2D } from "@/components/studio/Viewport2D";
import { createRect, createScene2D, serializeScene2D, RULER_WIDTH, type Scene2D, type Tool2D } from "@/lib/scene2d";

/** ResizeObserver is not in jsdom — the viewport keeps its initial 800x480. */
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
// jsdom has no PointerEvent: without it, fireEvent drops clientX/clientY.
if (typeof window.PointerEvent === "undefined") {
  // @ts-expect-error -- minimal polyfill so pointer events carry coordinates
  window.PointerEvent = class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: MouseEventInit & { pointerId?: number } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  };
}
// jsdom has no layout: give elements a real box so the viewport measures 800x480.
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 480 });

const W = 800;
const H = 480;

function mount(scene: Scene2D, tool: Tool2D = "select") {
  let live: Scene2D = scene;
  const onChange = vi.fn((patch: (s: Scene2D) => Scene2D) => {
    live = patch(live);
  });
  const onCommit = vi.fn((patch?: (s: Scene2D) => Scene2D) => {
    live = patch ? patch(live) : live;
  });
  const onSelect = vi.fn((id: string | null) => {
    live = { ...live, selectedId: id, selectedIds: id ? [id] : [] };
  });
  const onSelectMany = vi.fn((ids: string[]) => {
    live = { ...live, selectedId: ids[0] ?? null, selectedIds: ids };
  });
  const onToolChange = vi.fn();
  const onDelete = vi.fn();
  const handlers = { onChange, onCommit, onSelect, onSelectMany, onToolChange, onDelete };
  const element = (s: Scene2D, t: Tool2D) => (
    <Viewport2D
      scene={s}
      tool={t}
      onToolChange={onToolChange}
      onSelect={onSelect}
      onSelectMany={onSelectMany}
      onChange={onChange}
      onCommit={onCommit}
      onDeleteSelected={onDelete}
    />
  );
  const utils = render(element(live, tool));
  const canvas = () => utils.container.querySelector("canvas") as HTMLCanvasElement;
  // jsdom returns an all-zero rect; the viewport reads clientX/clientY relative
  // to it, so give the canvas a real box (800x480, ruler strip included).
  const stubRect = () => {
    const c = utils.container.querySelector("canvas");
    if (!c) return;
    c.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  };
  stubRect();
  /** Fire an event then re-render with the new scene (as the parent would). */
  const fire = (el: Element | null, type: string, init: MouseEventInit) =>
    act(() => {
      stubRect();
      fireEvent[type as "pointerDown"](el as Element, init);
      utils.rerender(element(live, tool));
    });
  const key = (init: KeyboardEventInit) =>
    act(() => {
      fireEvent.keyDown(canvas(), init);
      utils.rerender(element(live, tool));
    });
  return { ...utils, canvas, handlers, fire, key, get live() {
      return live;
    } };
}

/** A canvas-space point: ruler strip + the canvas-area centre + world offset. */
function point(wx: number, wy: number) {
  return {
    clientX: RULER_WIDTH + (W - RULER_WIDTH) / 2 + wx,
    clientY: RULER_WIDTH + (H - RULER_WIDTH) / 2 + wy,
    button: 0,
    bubbles: true,
  };
}

describe("Viewport2D mounting", () => {
  beforeEach(() => {
    // jsdom: getBoundingClientRect and getContext return usable defaults.
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  afterEach(cleanup);

  it("renders a canvas inside the 2D viewport wrapper", () => {
    const u = mount(createScene2D());
    expect(u.container.querySelector("[data-2d-viewport]")).toBeTruthy();
    expect(u.canvas()).toBeTruthy();
  });

  it("reports the tool status in the corner", () => {
    const u = mount(createScene2D(), "move");
    expect(u.container.textContent).toContain("Move Mode");
    expect(u.container.textContent).toContain("smart on");
  });
});

describe("Viewport2D interaction", () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  afterEach(cleanup);

  it("selects the node under the click and deselects on empty space", () => {
    const r = createRect("R", 100, 100, 200, 100);
    const u = mount({ ...createScene2D(), objects: [r] });
    const c = u.canvas();
    // world (100,100) -> screen (16 + 100 + 400, 16 + 100 + 240)
    u.fire(u.canvas(), "pointerDown", point(100, 100));
    expect(u.handlers.onSelect).toHaveBeenCalledWith(r.id);
    u.fire(u.canvas(), "pointerUp", point(100, 100));

    u.handlers.onSelect.mockClear();
    // far away from the rect
    u.fire(u.canvas(), "pointerDown", point(300, 300));
    expect(u.handlers.onSelect).toHaveBeenCalledWith(null);
  });

  it("moves the selected node by the drag delta and commits once on release", () => {
    const r = createRect("R", 100, 100, 200, 100);
    const scene: Scene2D = { ...createScene2D(), objects: [r], selectedId: r.id, selectedIds: [r.id] };
    const u = mount(scene);
    const c = u.canvas();

    u.fire(u.canvas(), "pointerDown", point(100, 100)); // grab the node centre
    u.fire(u.canvas(), "pointerMove", point(140, 130)); // drag +40, +30
    u.fire(u.canvas(), "pointerMove", point(150, 140));
    expect(u.handlers.onChange).toHaveBeenCalled();
    // live updates keep flowing (no undo entries yet)
    expect(u.handlers.onCommit).not.toHaveBeenCalled();
    // the pose is absolute, not cumulative, across mousemoves
    expect(u.live.objects[0].transform.position[0]).toBeCloseTo(150, 5);
    expect(u.live.objects[0].transform.position[1]).toBeCloseTo(140, 5);

    u.fire(u.canvas(), "pointerUp", point(150, 140));
    expect(u.handlers.onCommit).toHaveBeenCalledTimes(1);
    // exactly one undo step for the whole drag
    const moved = u.live.objects[0].transform.position;
    expect(moved[0]).toBeCloseTo(100 + 50, 5);
    expect(moved[1]).toBeCloseTo(100 + 40, 5);
  });

  it("pans the view with the middle button", () => {
    const u = mount(createScene2D());
    const c = u.canvas();
    const before = serializeScene2D(u.live);
    u.fire(u.canvas(), "pointerDown", { ...point(200, 200), button: 1 });
    u.fire(u.canvas(), "pointerMove", point(260, 200));
    expect(u.handlers.onChange).toHaveBeenCalled();
    expect(u.live.view.x).toBeCloseTo(60, 5);
    u.fire(u.canvas(), "pointerUp", point(260, 200));
    expect(serializeScene2D(u.live)).not.toBe(before);
  });

  it("box-selects every node inside the drag rectangle", () => {
    const a = createRect("A", 100, 100, 80, 80);
    const b = createRect("B", -100, -100, 80, 80);
    const u = mount({ ...createScene2D(), objects: [a, b] });
    const c = u.canvas();
    // drag a box that covers only A
    u.fire(u.canvas(), "pointerDown", point(40, 40));
    u.fire(u.canvas(), "pointerMove", point(220, 220));
    u.fire(u.canvas(), "pointerUp", point(220, 220));
    expect(u.handlers.onSelectMany).toHaveBeenCalledWith([a.id]);
  });

  it("switches tools with Q / W / E / S / R / G", () => {
    const u = mount(createScene2D());
    const c = u.canvas();
    const keys = ["q", "w", "e", "s", "r", "g"];
    const tools = ["select", "move", "rotate", "scale", "ruler", "pan"];
    keys.forEach((k, i) => {
      u.key({ key: k });
      expect(u.handlers.onToolChange).toHaveBeenNthCalledWith(i + 1, tools[i]);
    });
  });

  it("F frames the selection and changes the zoom", () => {
    const a = createRect("A", 200, 150, 100, 100);
    const u = mount({ ...createScene2D(), objects: [a], selectedId: a.id, selectedIds: [a.id] });
    const c = u.canvas();
    const zoomBefore = u.live.view.zoom;
    u.key({ key: "F" });
    expect(u.handlers.onChange).toHaveBeenCalled();
    // the view moved so the node is now centred
    expect(u.live.view.x).toBeCloseTo(-200, 5);
    expect(u.live.view.y).toBeCloseTo(-150, 5);
    expect(u.live.view.zoom).toBeGreaterThan(zoomBefore);
  });

  it("ctrl+= / ctrl+- zoom while ctrl+0 resets the view", () => {
    const u = mount({ ...createScene2D(), view: { x: 40, y: -20, zoom: 2 } });
    const c = u.canvas();
    u.key({ key: "=", ctrlKey: true });
    expect(u.live.view.zoom).toBeCloseTo(2.4, 5);
    u.key({ key: "-", ctrlKey: true });
    expect(u.live.view.zoom).toBeCloseTo(2, 5);
    u.key({ key: "0", ctrlKey: true });
    expect(u.live.view).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("numpad * and / change the grid step multiplier", () => {
    const u = mount(createScene2D());
    const c = u.canvas();
    u.key({ key: "*" });
    expect(u.live.grid.multiplier).toBe(-1);
    u.key({ key: "/" });
    u.key({ key: "/" });
    expect(u.live.grid.multiplier).toBe(1);
  });

  it("arrow keys nudge the selection by a pixel (shift = one grid step)", () => {
    const a = createRect("A", 100, 100, 40, 40);
    const u = mount({ ...createScene2D(), objects: [a], selectedId: a.id, selectedIds: [a.id] });
    const c = u.canvas();
    u.key({ key: "ArrowRight" });
    expect(u.live.objects[0].transform.position[0]).toBe(101);
    u.key({ key: "ArrowLeft", shiftKey: true });
    expect(u.live.objects[0].transform.position[0]).toBe(101 - 16);
    expect(u.handlers.onCommit).toHaveBeenCalledTimes(2);
  });

  it("delete asks the owner to remove the selected nodes", () => {
    const u = mount(createScene2D());
    const c = u.canvas();
    u.key({ key: "Delete" });
    expect(u.handlers.onDelete).toHaveBeenCalled();
  });

  it("Y clears guides and H toggles helpers", () => {
    const u = mount({ ...createScene2D(), guides: { v: [12], h: [] }, showHelpers: true });
    const c = u.canvas();
    u.key({ key: "y" });
    expect(u.live.guides).toEqual({ v: [], h: [] });
    u.key({ key: "h" });
    expect(u.live.showHelpers).toBe(false);
  });

  it("dragging out of the ruler creates a guide on release", () => {
    const u = mount(createScene2D());
    const c = u.canvas();
    u.fire(u.canvas(), "pointerDown", { ...point(300, 0), clientX: 8, clientY: 40 });
    u.fire(u.canvas(), "pointerMove", point(320, 60));
    u.fire(u.canvas(), "pointerUp", point(320, 60));
    expect(u.handlers.onCommit).toHaveBeenCalled();
    expect(u.live.guides.v.length).toBe(1);
  });

  it("snaps a dragged node to the grid when grid snapping is on", () => {
    const a = createRect("A", 100, 100, 40, 40);
    const scene: Scene2D = {
      ...createScene2D(),
      objects: [a],
      selectedId: a.id,
      selectedIds: [a.id],
      snap: { ...createScene2D().snap, grid: true, smart: false, snapPixel: false },
    };
    const u = mount(scene);
    const c = u.canvas();
    u.fire(u.canvas(), "pointerDown", point(100, 100));
    u.fire(u.canvas(), "pointerMove", point(111, 103)); // +11, +3
    u.fire(u.canvas(), "pointerUp", point(111, 103));
    // 111 -> 112 on x, 103 -> 96 on y (nearest 16px multiples)
    expect(u.live.objects[0].transform.position[0]).toBe(112);
    expect(u.live.objects[0].transform.position[1]).toBe(96);
  });

  it("scales the selected node in scale mode", () => {
    const a = createRect("A", 0, 0, 100, 100);
    const scene: Scene2D = { ...createScene2D(), objects: [a], selectedId: a.id, selectedIds: [a.id] };
    const u = mount(scene, "scale");
    const c = u.canvas();
    // the node centre is at world (0,0); drag the bottom-right handle outward
    u.fire(u.canvas(), "pointerDown", point(50, 50));
    u.fire(u.canvas(), "pointerMove", point(100, 100));
    u.fire(u.canvas(), "pointerUp", point(100, 100));
    expect(u.handlers.onChange).toHaveBeenCalled();
    expect(u.live.objects[0].transform.scale[0]).toBeGreaterThan(1);
  });

  it("rotates the selected node in rotate mode", () => {
    const a = createRect("A", 0, 0, 100, 40);
    const scene: Scene2D = { ...createScene2D(), objects: [a], selectedId: a.id, selectedIds: [a.id] };
    const u = mount(scene, "rotate");
    const c = u.canvas();
    // the rotate handle sits at the node's right edge
    u.fire(u.canvas(), "pointerDown", point(50, 0));
    u.fire(u.canvas(), "pointerMove", point(50, 50)); // swing a quarter turn
    u.fire(u.canvas(), "pointerUp", point(50, 50));
    expect(u.handlers.onChange).toHaveBeenCalled();
    expect(u.live.objects[0].transform.rotation).not.toBe(0);
  });

  it("shift-click adds to the selection", () => {
    const a = createRect("A", 100, 100, 80, 80);
    const b = createRect("B", -100, -100, 80, 80);
    const u = mount({ ...createScene2D(), objects: [a, b] });
    const c = u.canvas();
    u.fire(u.canvas(), "pointerDown", point(100, 100));
    u.fire(u.canvas(), "pointerUp", point(100, 100));
    u.fire(u.canvas(), "pointerDown", { ...point(-100, -100), shiftKey: true });
    u.fire(u.canvas(), "pointerUp", { ...point(-100, -100), shiftKey: true });
    expect(u.handlers.onSelectMany).toHaveBeenCalledWith([a.id, b.id]);
  });

  it("does not touch a locked node", () => {
    const a = { ...createRect("A", 100, 100, 80, 80), locked: true };
    const u = mount({ ...createScene2D(), objects: [a] });
    const c = u.canvas();
    u.fire(u.canvas(), "pointerDown", point(100, 100));
    u.fire(u.canvas(), "pointerUp", point(100, 100));
    expect(u.handlers.onSelect).toHaveBeenCalledWith(null);
  });

  it("right-click opens the add-node context menu", () => {
    const u = mount(createScene2D());
    const c = u.canvas();
    u.fire(u.canvas(), "pointerDown", { ...point(100, 100), button: 2 });
    expect(u.container.textContent).toContain("Add Rect Node");
    act(() => { fireEvent.click(u.getByText("Add Sprite Node")); });
    expect(u.handlers.onCommit).toHaveBeenCalled();
  });
});
