// templates.ts — New Game From Template.
//
// Unity ships "2D Core / 3D Core / 3D (URP)" project templates and Blender
// opens the Blank / General start file; this brings the same idea to NexStudio:
// pick a starter (2D arcade modes or a 3D world) and start editing instead of
// staring at an empty config. 3D templates also stamp a starter scene into the
// viewport (a lit Blender-style diorama), so the first thing you see is a world.
import { DEFAULT_CONFIG, type StudioConfig } from "./studioConfig";
import { createDemoScene, createStarterScene3D, type Scene } from "./scene3d";

export interface StudioTemplate {
  id: string;
  label: string;
  blurb: string;
  badge: "2D" | "3D";
  /** Applies over the current config (keeps description etc. sensible). */
  config: () => StudioConfig;
  /** Optional starter scene to stamp into the 3D viewport. */
  scene?: () => Scene;
}

export const TEMPLATES: StudioTemplate[] = [
  {
    id: "catch",
    label: "Catch 'em Up",
    blurb: "Catch falling collectibles and dodge the hazards — the classic starter.",
    badge: "2D",
    config: () => ({
      ...DEFAULT_CONFIG,
      title: "Catch the Points",
      description: "Catch every collectible, avoid the hazards.",
      mode: "catch",
      dimension: "2d",
      theme: { ...DEFAULT_CONFIG.theme },
      names: { player: "You", good: "Points", bad: "Hazards" },
    }),
  },
  {
    id: "runner",
    label: "Endless Runner",
    blurb: "Jump and dash through an endless course — the harder, faster mode.",
    badge: "2D",
    config: () => ({
      ...DEFAULT_CONFIG,
      title: "Sky Runner",
      description: "Run forever, jump the obstacles, grab the pickups.",
      mode: "runner",
      dimension: "2d",
      speed: 4.6,
      difficulty: "medium",
      theme: {
        bg: "#0c1b2a",
        player: "#4cc9f0",
        good: "#f9c74f",
        bad: "#f94144",
        accent: "#f9844a",
        text: "#fdfffc",
      },
      names: { player: "Runner", good: "Coins", bad: "Obstacles" },
    }),
  },
  {
    id: "shooter",
    label: "Space Shooter",
    blurb: "Blast the enemies and rack up combos — twin-stick arcade shooting.",
    badge: "2D",
    config: () => ({
      ...DEFAULT_CONFIG,
      title: "Nova Striker",
      description: "Blast the incoming targets before they get you.",
      mode: "shooter",
      dimension: "2d",
      difficulty: "hard",
      theme: {
        bg: "#0d0a1e",
        player: "#7c6cff",
        good: "#48bfe3",
        bad: "#ef476f",
        accent: "#f9c74f",
        text: "#f1faff",
      },
      names: { player: "Striker", good: "Targets", bad: "Enemies" },
    }),
  },
  {
    id: "starter3d",
    label: "3D Starter World",
    blurb: "A lit Blender/Unity-style diorama: floor, primitives and two lights to edit.",
    badge: "3D",
    config: () => ({
      ...DEFAULT_CONFIG,
      title: "My 3D World",
      description: "A 3D scene built in NexStudio.",
      mode: "catch",
      dimension: "3d",
      theme: { ...DEFAULT_CONFIG.theme },
      names: { player: "You", good: "Points", bad: "Hazards" },
    }),
    scene: createStarterScene3D,
  },
  {
    id: "blank3d",
    label: "3D Blank",
    blurb: "Just a camera, sun light and a cube — Unity-style '3D Core' emptiness.",
    badge: "3D",
    config: () => ({
      ...DEFAULT_CONFIG,
      title: "Untitled 3D",
      description: "A 3D scene built in NexStudio.",
      mode: "catch",
      dimension: "3d",
    }),
    scene: createDemoScene,
  },
];