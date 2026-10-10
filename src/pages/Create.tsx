import { AppLayout } from "@/components/AppLayout";
import { Sparkles, Code, Palette, Zap, ArrowRight, Wand2 } from "lucide-react";

const tools = [
  {
    icon: Wand2,
    title: "AI Game Builder",
    description: "Describe your game idea in natural language. Our AI generates a playable game from your prompt.",
    tag: "Powered by Jabali AI",
  },
  {
    icon: Code,
    title: "Visual Builder",
    description: "Drag-and-drop game creation with visual scripting. No coding required.",
    tag: null,
  },
  {
    icon: Palette,
    title: "Asset Studio",
    description: "AI-powered art generation. Create sprites, environments, and UI elements instantly.",
    tag: "AI Powered",
  },
  {
    icon: Zap,
    title: "Jabali Engine",
    description: "Physics, lighting, and AI behavior systems out of the box. Publish to NEXCONSOLE with one click.",
    tag: null,
  },
];

const Create = () => {
  return (
    <AppLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Create</h1>
      <p className="font-body text-muted-foreground mb-8 max-w-lg">
        Build your next game with AI. From concept to published game in minutes.
      </p>

      {/* AI Prompt Area */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">Describe your game</h3>
            <p className="font-body text-xs text-muted-foreground">Tell AI what you want to create</p>
          </div>
        </div>
        <textarea
          placeholder="e.g. A 2D platformer where you're a cat collecting fish in space..."
          className="w-full bg-secondary rounded-lg p-4 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-24 mb-4"
        />
        <button className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-6 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Sparkles className="h-4 w-4" />
          Generate Game
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tools Grid */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">Creation Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {tools.map((tool) => (
          <div
            key={tool.title}
            className="bg-card border border-border rounded-xl p-5 flex gap-4 hover:border-primary/40 transition-colors cursor-pointer"
          >
            <div className="bg-secondary p-3 rounded-lg h-fit">
              <tool.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {tool.title}
                </h3>
                {tool.tag && (
                  <span className="font-body text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {tool.tag}
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-muted-foreground">
                {tool.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Your Projects — empty */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">Your Projects</h2>
      <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
        <Code className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-body text-sm text-muted-foreground text-center">
          You haven't created any games yet. Start with an idea above!
        </p>
      </div>
    </AppLayout>
  );
};

export default Create;
