// index.ts — Barrel export for the game engine.
// Public API: mountGame, loadGamePackage, submitScore, eventBus

export { mountGame } from "./runtime";
export type { GameInstance, GameState } from "./runtime";

export { loadGamePackage, loadGameRecord } from "./gameLoader";
export type { GamePackage, GameRecord } from "./gameLoader";

export { submitScore, resetSubmitScore } from "./submitScore";

export { eventBus, EngineEvents } from "./eventBus";
export type { EventHandler } from "./eventBus";
