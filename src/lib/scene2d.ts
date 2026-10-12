// scene2d.ts — minimal 2D scene editor model (like scene3d but for sprites/shapes).
export type Vec2 = [number, number];
export type Object2DKind = "rect" | "sprite" | "text";

export interface Transform2D {
  position: Vec2;
  rotation: number; // degrees
  scale: Vec2;
}

export interface SceneObject2D {
  id: string;
  name: string;
  kind: Object2DKind;
  transform: Transform2D;
  color: string;
  visible: boolean;
  width: number;
  height: number;
  text?: string;
  src?: string;
}

export interface Scene2D {
  objects: SceneObject2D[];
  selectedId?: string | null;
}

let idCounter = 0;
const nextId = (p = "obj2d") => `${p}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export function createScene2D(): Scene2D {
  return { objects: [], selectedId: null };
}

export function createRect(name = "Rect", x = 0, y = 0, w = 80, h = 40): SceneObject2D {
  return {
    id: nextId("rect"),
    name,
    kind: "rect",
    transform: { position: [x, y], rotation: 0, scale: [1, 1] },
    color: "#4f8cff",
    visible: true,
    width: w,
    height: h,
  };
}

export function createSprite(name = "Sprite", src = "", x = 0, y = 0, w = 64, h = 64): SceneObject2D {
  return {
    id: nextId("sprite"),
    name,
    kind: "sprite",
    transform: { position: [x, y], rotation: 0, scale: [1, 1] },
    color: "transparent",
    visible: true,
    width: w,
    height: h,
    src,
  };
}

export function addObject(s: Scene2D, o: SceneObject2D): Scene2D {
  return { ...s, objects: [...s.objects, o] };
}

export function patchObject(s: Scene2D, id: string, patch: Partial<SceneObject2D>): Scene2D {
  return {
    ...s,
    objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
}

export function removeObject(s: Scene2D, id: string): Scene2D {
  return { ...s, objects: s.objects.filter((o) => o.id !== id) };
}

export function findObject(s: Scene2D, id?: string | null): SceneObject2D | undefined {
  if (!id) return undefined;
  return s.objects.find((o) => o.id === id);
}

export function serializeScene2D(s: Scene2D): string {
  return JSON.stringify({ version: 1, objects: s.objects });
}

export function deserializeScene2D(json: string): Scene2D {
  try {
    const d = JSON.parse(json) as { objects?: SceneObject2D[] };
    return { objects: Array.isArray(d.objects) ? d.objects : [], selectedId: null };
  } catch {
    return createScene2D();
  }
}
