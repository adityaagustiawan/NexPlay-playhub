// buildSteps.ts — the fake "asset import / compile" steps shown while a game is
// built. Mirrors Unity's asset-import / script-compile progress window: a few
// named stages with a log-style detail line, then a final "done".

export interface BuildStep {
  label: string;
  detail: string;
}

export type BuildMode = "save" | "publish";

/** Ordered build stages for a draft save or a publish. */
export function buildSteps(mode: BuildMode): BuildStep[] {
  if (mode === "publish") {
    return [
      { label: "Importing assets", detail: "Assets/NexPlay/…" },
      { label: "Compiling gameplay scripts", detail: "Baking gameplay graph" },
      { label: "Optimizing meshes & materials", detail: "Mesh.CombineMeshes()" },
      { label: "Baking lighting", detail: "Lightmapper: 64 samples" },
      { label: "Packaging build", detail: "Writing nexplay.pkg" },
      { label: "Uploading to NexConsole", detail: "AssetDatabase.Refresh()" },
    ];
  }
  return [
    { label: "Importing assets", detail: "Assets/NexPlay/…" },
    { label: "Compiling gameplay scripts", detail: "Baking gameplay graph" },
    { label: "Optimizing meshes & materials", detail: "Mesh.CombineMeshes()" },
    { label: "Baking lighting", detail: "Lightmapper: 32 samples" },
    { label: "Building game package", detail: "Writing nexplay.dkg" },
    { label: "Finalizing draft", detail: "AssetDatabase.Refresh()" },
  ];
}

/** Title shown while the build runs / finishes. */
export function buildTitle(mode: BuildMode): string {
  return mode === "publish" ? "Building & uploading…" : "Building draft…";
}

/** Result line shown when the build completes. */
export function buildDone(mode: BuildMode): string {
  return mode === "publish" ? "Submitted for review" : "Draft saved";
}
