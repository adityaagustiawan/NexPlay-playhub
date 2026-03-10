import { AppLayout } from "@/components/AppLayout";
import { Sparkles, Code, Palette, Zap, ArrowRight } from "lucide-react";

const tools = [
  {
    icon: Code,
    title: "GAME BUILDER",
    description: "Drag-and-drop game creation with visual scripting. No coding required.",
  },
  {
    icon: Palette,
    title: "ASSET STUDIO",
    description: "AI-powered art generation. Create sprites, environments, and UI elements instantly.",
  },
  {
    icon: Zap,
    title: "JABALI ENGINE",
    description: "Built on Jabali AI — physics, lighting, and AI behavior systems out of the box.",
  },
  {
    icon: Sparkles,
    title: "AI CO-PILOT",
    description: "Describe your game idea in natural language. Astrocade.ai generates the foundation.",
  },
];

const Create = () => {
  return (
    <AppLayout>
      <h1 className="font-heading text-3xl font-bold text-foreground mb-2">CREATE</h1>
      <p className="font-body text-muted-foreground mb-10 max-w-lg">
        Build your next game with Astrocade.ai and the Jabali AI engine. From concept to publish in minutes.
      </p>

      {/* New Project CTA */}
      <button className="bg-primary text-primary-foreground font-heading text-sm px-8 py-4 flex items-center gap-3 mb-12">
        <Sparkles className="h-5 w-5" />
        START NEW PROJECT
        <ArrowRight className="h-4 w-4" />
      </button>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {tools.map((tool) => (
          <div
            key={tool.title}
            className="bg-card border border-border p-6 flex gap-4"
          >
            <div className="bg-secondary p-3 h-fit">
              <tool.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground mb-2">
                {tool.title}
              </h3>
              <p className="font-body text-xs text-muted-foreground">
                {tool.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">RECENT PROJECTS</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["MY FIRST GAME", "SPACE SHOOTER V2", "PUZZLE QUEST"].map((name) => (
          <div key={name} className="bg-card border border-border p-5">
            <div className="w-full h-24 bg-secondary mb-4 flex items-center justify-center">
              <Code className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-xs font-bold text-foreground mb-1">{name}</h3>
            <p className="font-body text-[11px] text-muted-foreground">Last edited 2 days ago</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Create;
