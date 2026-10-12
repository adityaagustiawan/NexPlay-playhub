// WorkspaceRenderer.tsx — swaps the editor area based on the active Blender
// workspace. Reuses the same Blender shell, but swaps lower/side areas to
// match Layout/Modeling/Shading/Animation/Rendering/Scripting.
import { Viewport3D, type Viewport3DHandle, type Viewport3DTheme, type TransformMode } from "@/components/studio/Viewport3D";
import { Outliner, type OutlinerKey } from "@/components/studio/Outliner";
import { PropertiesPanel, type PropTab } from "@/components/studio/PropertiesPanel";
import { ResizeGrip } from "@/components/studio/ResizeGrip";
import { Tip } from "@/components/studio/Tip";
import { Timeline } from "@/components/studio/Timeline";
import { DopeSheet } from "@/components/studio/DopeSheet";
import { GraphEditor } from "@/components/studio/GraphEditor";
import { NodeEditor } from "@/components/studio/NodeEditor";
import { ImageEditor } from "@/components/studio/ImageEditor";
import { ConsolePanel } from "@/components/studio/ConsolePanel";
import { ScriptingEditor } from "@/components/studio/ScriptingEditor";
import { GameLogicEditor } from "@/components/studio/GameLogicEditor";
import { GamePreview } from "@/components/GamePreview";
import { GameView, type GameStatus } from "@/components/studio/GameView";
import { Play } from "lucide-react";
import { StudioMenu, type StudioMenuEntry } from "@/components/studio/StudioMenu";
import type { GamePackage } from "@/engine/gameLoader";
import type { SceneObject } from "@/lib/scene3d";
import { useNavigate } from "react-router-dom";
import type { ReactNode, RefObject } from "react";

export type Workspace = "Layout" | "Modeling" | "Shading" | "Animation" | "Rendering" | "Scripting";

/** Everything the 3D viewport needs from the editor state. */
export interface ViewportSceneProps {
  scene: import("@/lib/scene3d").Scene;
  selectedId: string | null;
  selectedVertices: number[];
  editMode: string;
  brush: string;
  brushRadius: number;
  brushStrength: number;
  /** Gizmo implied by the active tool. */
  transformMode: TransformMode;
  /** 3D cursor the Add menu spawns objects on. */
  cursor: import("@/lib/scene3d").Vec3;
  cursorTool: boolean;
  cameraPov: boolean;
  onSelectObject: (id: string | null) => void;
  onSelectVertices: (indices: number[]) => void;
  onTransform: (delta: import("@/lib/scene3d").Vec3, mode: "move" | "rotate" | "scale") => void;
  onSculpt: (localPoint: import("@/lib/scene3d").Vec3, delta: import("@/lib/scene3d").Vec3) => void;
  onSetCursor: (point: import("@/lib/scene3d").Vec3) => void;
  setCameraPov: (on: boolean) => void;
  /** POV mode camera edits. */
  onCameraMove: (delta: import("@/lib/scene3d").Vec3) => void;
  onCameraOrbit: (dYawDeg: number, dPitchDeg: number) => void;
  onCameraZoom: (factor: number) => void;
  theme?: Viewport3DTheme;
}

interface LayoutProps {
  workspace: Workspace;
  config: any;
  pkg: GamePackage;
  record?: any | null;
  dimension: "2d" | "3d";
  nonce: number;
  selected: OutlinerKey;
  onSelect: (k: OutlinerKey) => void;
  propTab: string;
  setPropTab: (id: string) => void;
  propTabs: PropTab[];
  propertiesContent: () => React.ReactNode;
  showPanels: boolean;
  showToolbar: boolean;
  editMode: string;
  tool: string;
  setTool: (t: string) => void;
  shading: string;
  headerMenus: { label: string; items: any[] }[];
  headerMenusRender: () => ReactNode;
  tools: { icon: any; label: string; tip?: string; shortcut?: string; action?: () => void }[];
  viewportRef: RefObject<Viewport3DHandle>;
  viewportBodyRef: RefObject<HTMLDivElement>;
  /** Optional drag-&-drop import handlers attached to the 3D viewport body. */
  onViewportDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onViewportDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  setEditMode?: (m: string) => void;
  panelWidth: number;
  setPanelWidth: (n: number) => void;
  outlinerHeight: number;
  setOutlinerHeight: (n: number) => void;
  showTips: boolean;
  /** 3D scene state, only used when dimension === "3d". */
  viewport: ViewportSceneProps;
  /** 3D objects listed in the Outliner's Scene Collection. */
  outlinerObjects?: SceneObject[];
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onToggleObjectVisible?: (id: string, visible: boolean) => void;
  /** Mode-specific strip (brush settings / vertex tools) above the viewport. */
  modeBar?: ReactNode;
  /** Flyout opened by the toolbar's Add tool. */
  addMenu?: ReactNode;
  /** Unity-style Game view: set status to "playing"/"paused" to swap the
   * viewport for a live run of the game (Play mode). */
  game?: {
    status: GameStatus;
    pkg: GamePackage;
    title?: string;
    onStatusChange: (s: GameStatus) => void;
    maximized: boolean;
    onToggleMaximized: () => void;
  };
  /** Live game-script editing props (Scripting workspace + Animation area). */
  setConfig?: (cfg: unknown) => void;
  onApplyLogic?: () => void;
  onPlayLogic?: () => void;
  /** Animation playback state shared with the Timeline / Dope Sheet / viewport. */
  animFrame: number;
  animPlaying: boolean;
  animEnd: number;
  animKeyFrames: number[];
  dopeChannels: import("@/components/studio/DopeSheet").DopeChannel[];
  onAnimFrame: (f: number) => void;
  onAnimToggle: () => void;
  onInsertKeyframe: (channel: "pos" | "rot" | "scl") => void;
}

export function WorkspaceRenderer(props: LayoutProps) {
  const navigate = useNavigate();
  const {
    workspace,
    config,
    pkg,
    record,
    dimension,
    nonce,
    selected,
    onSelect,
    propTab,
    setPropTab,
    propTabs,
    propertiesContent,
    showPanels,
    showToolbar,
    editMode,
    tool,
    setTool,
    shading,
    headerMenusRender,
    tools,
    viewportRef,
    viewportBodyRef,
    onViewportDragOver,
    onViewportDrop,
    setEditMode,
    panelWidth,
    setPanelWidth,
    outlinerHeight,
    setOutlinerHeight,
    showTips,
    viewport,
    outlinerObjects,
    selectedObjectId,
    onSelectObject,
    onToggleObjectVisible,
    modeBar,
    addMenu,
    game,
    setConfig,
    onApplyLogic,
    onPlayLogic,
    animFrame,
    animPlaying,
    animEnd,
    animKeyFrames,
    dopeChannels,
    onAnimFrame,
    onAnimToggle,
    onInsertKeyframe,
  } = props;

  /** The Timeline at home in every workspace that shows a bottom strip. */
  const timelineFor = (key: string) => (
    <Timeline
      key={key}
      frame={animFrame}
      playing={animPlaying}
      endFrame={animEnd}
      keyFrames={animKeyFrames}
      onFrameChange={onAnimFrame}
      onTogglePlay={onAnimToggle}
      onInsertKeyframe={onInsertKeyframe}
    />
  );

  const RenderViewport = (key: string) => (
    <div key={key} className="h-full w-full">
      {dimension === "3d" ? (
        <Viewport3D ref={viewportRef} {...viewport} />
      ) : (
        <GamePreview fill pkg={pkg} title={config.title || "Untitled"} onOpenFull={record ? () => navigate(`/play/${record.game_key}`) : undefined} />
      )}
    </div>
  );

  const outlinerProps = {
    title: config.title,
    mode: config.mode,
    selected,
    objects: outlinerObjects,
    selectedObjectId,
    onToggleObjectVisible,
    onSelect: (k: OutlinerKey) => {
      onSelect(k as OutlinerKey);
      setPropTab("object");
    },
    onSelectObject: (id: string) => {
      onSelectObject?.(id);
      setPropTab("object");
    },
  };

  if (workspace === "Layout") {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[#1d1d1d] bg-[#303030] px-2">
            {headerMenusRender()}
          </div>
          {modeBar}
          <div ref={viewportBodyRef} className="relative min-h-0 flex-1 bg-[#2b2b2b]" onDragOver={onViewportDragOver} onDrop={onViewportDrop}>
            {game && game.status !== "stopped" ? (
              <GameView
                pkg={game.pkg}
                title={game.title}
                status={game.status}
                onChange={game.onStatusChange}
                maximized={game.maximized}
                onToggleMaximized={game.onToggleMaximized}
              />
            ) : (
              <>
                {showToolbar && (
                  <div className="absolute left-1 top-1 z-10 flex flex-col gap-0.5 rounded-[4px] bg-[#303030]/95 p-1 shadow-lg">
                    {tools.map((t) => {
                      const Icon = t.icon;
                      return (
                        <Tip key={t.label} label={t.label} description={t.tip} shortcut={t.shortcut} enabled={showTips} side="right">
                          <button
                            type="button"
                            title={t.label}
                            onClick={() => (t.action ? t.action() : setTool(t.label))}
                            className={`flex h-7 w-7 items-center justify-center rounded-[3px] ${tool === t.label ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        </Tip>
                      );
                    })}
                    {addMenu}
                  </div>
                )}
                <div className={`pointer-events-none absolute top-2 z-10 text-[11px] text-[#b0b0b0] ${showToolbar ? "left-11" : "left-2"}`}>
                  (1) Scene Collection | {editMode}
                </div>
                <div className={`pointer-events-none absolute bottom-2 z-10 text-[11px] text-[#8f8f8f] ${showToolbar ? "left-11" : "left-2"}`}>
                  {dimension === "3d"
                    ? "Drag: orbit · Right-drag/Shift-drag: pan · Wheel or pinch: zoom"
                    : `${config.mode} view · ${dimension.toUpperCase()}`}
                </div>
                {RenderViewport(`${dimension}-${nonce}`)}
                {game && (
                  <button
                    type="button"
                    title="Play the game in the viewport (Ctrl+P)"
                    onClick={() => game.onStatusChange("playing")}
                    className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-[4px] bg-[#4772b3] px-2.5 py-1 font-body text-[11px] font-medium text-white shadow-lg transition-opacity hover:opacity-90"
                  >
                    <Play className="h-3 w-3" fill="currentColor" />
                    Play
                  </button>
                )}
              </>
            )}
          </div>
          {timelineFor("timeline")}
        </div>
        {showPanels && (
          <>
            <ResizeGrip
              axis="x"
              invert
              size={panelWidth}
              min={220}
              max={640}
              onResize={setPanelWidth}
              onReset={() => setPanelWidth(320)}
              className="hidden md:flex"
            />
            <div className="hidden shrink-0 flex-col border-l border-black md:flex" style={{ width: panelWidth }}>
              <div className="min-h-0 shrink-0 overflow-hidden bg-[#303030]" style={{ height: outlinerHeight }}>
                <Outliner {...outlinerProps} />
              </div>
              <ResizeGrip
                axis="y"
                size={outlinerHeight}
                min={80}
                max={480}
                onResize={setOutlinerHeight}
                onReset={() => setOutlinerHeight(200)}
              />
              <PropertiesPanel tabs={propTabs} active={propTab} onChange={setPropTab}>
                {propertiesContent()}
              </PropertiesPanel>
            </div>
          </>
        )}
      </div>
    );
  }

  // Shared: split vertically or show editors
  const left = (
    <div className="flex min-h-0 flex-1 flex-col">
      {modeBar}
      <div ref={viewportBodyRef} className="relative min-h-0 flex-1 bg-[#2b2b2b]" onDragOver={onViewportDragOver} onDrop={onViewportDrop}>
        {game && game.status !== "stopped" ? (
          <GameView
            pkg={game.pkg}
            title={game.title}
            status={game.status}
            onChange={game.onStatusChange}
            maximized={game.maximized}
            onToggleMaximized={game.onToggleMaximized}
          />
        ) : (
          <>
            {showToolbar && (
              <div className="absolute left-1 top-1 z-10 flex flex-col gap-0.5 rounded-[4px] bg-[#303030]/95 p-1 shadow-lg">
                {tools.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Tip key={t.label} label={t.label} description={t.tip} shortcut={t.shortcut} enabled={showTips} side="right">
                      <button
                        type="button"
                        title={t.label}
                        onClick={() => (t.action ? t.action() : setTool(t.label))}
                        className={`flex h-7 w-7 items-center justify-center rounded-[3px] ${tool === t.label ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    </Tip>
                  );
                })}
                {addMenu}
              </div>
            )}
            {RenderViewport(`${dimension}-${nonce}`)}
            {game && (
              <button
                type="button"
                title="Play the game in the viewport (Ctrl+P)"
                onClick={() => game.onStatusChange("playing")}
                className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-[4px] bg-[#4772b3] px-2.5 py-1 font-body text-[11px] font-medium text-white shadow-lg transition-opacity hover:opacity-90"
              >
                <Play className="h-3 w-3" fill="currentColor" />
                Play
              </button>
            )}
          </>
        )}
      </div>
      {workspace === "Animation" ? (
        <div className="flex min-h-[160px] max-h-[300px] shrink-0 flex-col border-t border-black">
          <div className="flex h-1/2 min-h-0">
            <DopeSheet
              frame={animFrame}
              endFrame={animEnd}
              channels={dopeChannels}
              onFrameChange={onAnimFrame}
            />
          </div>
          <div className="flex h-1/2 min-h-0">
            {timelineFor("timeline-anim")}
          </div>
        </div>
      ) : workspace === "Rendering" ? (
        <div className="flex h-[180px] shrink-0 border-t border-black">
          <NodeEditor />
        </div>
      ) : workspace === "Scripting" ? (
        <div className="flex h-[264px] shrink-0 border-t border-black">
          <GameLogicEditor
            config={config}
            setConfig={setConfig}
            onApply={onApplyLogic}
            onPlay={onPlayLogic}
          />
          <div className="flex w-[38%] min-w-[280px] flex-col">
            <div className="flex min-h-0 flex-1">
              <ScriptingEditor config={config} setConfig={setConfig} onApply={onApplyLogic} />
            </div>
            <div className="flex h-1/2 min-h-[90px] border-t border-[#1d1f23]">
              <ConsolePanel />
            </div>
          </div>
        </div>
      ) : workspace === "Shading" ? (
        <div className="flex h-[200px] shrink-0 border-t border-black">
          <ImageEditor />
        </div>
      ) : (
        timelineFor("timeline-other")
      )}
    </div>
  );

  const right = showPanels ? (
    <>
      <ResizeGrip
        axis="x"
        invert
        size={panelWidth}
        min={220}
        max={640}
        onResize={setPanelWidth}
        onReset={() => setPanelWidth(320)}
        className="hidden md:flex"
      />
      <div className="hidden shrink-0 flex-col border-l border-black md:flex" style={{ width: panelWidth }}>
        <div className="min-h-[120px] shrink-0 overflow-hidden bg-[#303030]" style={{ height: outlinerHeight }}>
          <Outliner {...outlinerProps} />
        </div>
        <ResizeGrip
          axis="y"
          size={outlinerHeight}
          min={80}
          max={480}
          onResize={setOutlinerHeight}
          onReset={() => setOutlinerHeight(200)}
        />
        <PropertiesPanel tabs={propTabs} active={propTab} onChange={setPropTab}>
          {propertiesContent()}
        </PropertiesPanel>
      </div>
    </>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1">
      {left}
      {right}
    </div>
  );
}