import { NavLink } from "@/components/NavLink";
import { PromptDemo } from "@/components/PromptDemo";
import { useAuth } from "@/hooks/useAuth";
import {
  Gamepad2,
  Sparkles,
  Code,
  Palette,
  Zap,
  ArrowRight,
  Users,
  Play,
  Bot,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Game Builder",
    description:
      "Type what you imagine in plain language. Jabali AI writes, art-directs and packages a playable game from your prompt.",
  },
  {
    icon: Code,
    title: "Visual Builder",
    description:
      "Prefer drag-and-drop? Assemble levels and logic visually with no coding required — like building with blocks.",
  },
  {
    icon: Palette,
    title: "Asset Studio",
    description:
      "Generate sprites, environments, music and UI instantly, so your game looks polished before you publish it.",
  },
  {
    icon: Zap,
    title: "Jabali Engine",
    description:
      "Physics, lighting and AI behaviour out of the box, served from the cloud — no installs, no servers to manage.",
  },
];

const steps = [
  { icon: Bot, title: "Describe", text: "Write one sentence about the game you want." },
  { icon: Sparkles, title: "Generate", text: "Jabali AI builds the logic, art and world." },
  { icon: Play, title: "Play", text: "Launch instantly, share the link, get feedback." },
];

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-4 md:px-8">
        <NavLink to="/" className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <span className="font-heading text-lg font-bold">
            <span className="text-primary">NEX</span>CONSOLE
          </span>
        </NavLink>

        <div className="ml-auto flex items-center gap-3">
          <NavLink
            to="/explore"
            className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Explore
          </NavLink>
          <NavLink
            to="/create"
            className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Create
          </NavLink>
          {user ? (
            <NavLink
              to="/library"
              className="bg-primary text-primary-foreground font-heading text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Open App
            </NavLink>
          ) : (
            <NavLink
              to="/login"
              className="bg-primary text-primary-foreground font-heading text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Sign In
            </NavLink>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 px-4 md:px-8">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[720px] rounded-full bg-primary/25 blur-[140px] glow-drift" />
        <div className="pointer-events-none absolute top-40 right-10 h-72 w-72 rounded-full bg-accent/15 blur-[120px] glow-drift" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="rise-in flex items-center justify-center gap-3 mb-6">
            <span className="font-body text-xs text-muted-foreground">
              Public testing — help us shape it
            </span>
          </div>

          <h1 className="rise-in font-heading text-4xl md:text-6xl font-bold leading-tight mb-6" style={{ animationDelay: "0.1s" }}>
            What is <span className="text-primary">NEX</span>CONSOLE?
          </h1>

          <p className="rise-in font-body text-base md:text-lg text-muted-foreground mb-4" style={{ animationDelay: "0.2s" }}>
            NEXCONSOLE is an AI game platform where anyone can{" "}
            <span className="text-foreground font-medium">create</span> games with a
            prompt, <span className="text-foreground font-medium">play</span> games
            made by the community, and{" "}
            <span className="text-foreground font-medium">connect</span> with friends
            — in one place, straight from your browser.
          </p>

          <p className="rise-in font-body text-sm text-muted-foreground mb-8 max-w-xl mx-auto" style={{ animationDelay: "0.3s" }}>
            Think Roblox, but your ideas become real games in seconds instead of
            years: describe the game, the AI builds it, and everyone can play it.
          </p>

          <div className="rise-in flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: "0.4s" }}>
            <NavLink
              to="/create"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Create Your First Game
              <ArrowRight className="h-4 w-4" />
            </NavLink>
            <NavLink
              to="/explore"
              className="inline-flex items-center gap-2 bg-secondary text-foreground font-heading text-sm font-semibold px-7 py-3.5 rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <Play className="h-4 w-4" />
              Explore Games
            </NavLink>
          </div>
        </div>
      </section>

      {/* Prompt → Game showcase */}
      <section className="px-4 md:px-8 pb-24 -mt-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2">
              From a sentence to a playable game
            </h2>
            <p className="font-body text-sm text-muted-foreground">
              This is how creation works on NEXCONSOLE — watch it happen
            </p>
          </div>
          <PromptDemo />
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 md:px-8 pb-24">
        <div className="max-w-5xl mx-auto grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors"
            >
              <div className="bg-primary/20 rounded-lg p-2.5 w-fit mb-4">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-base font-bold mb-1">{step.title}</h3>
              <p className="font-body text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 md:px-8 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2">
              Everything you need to build and play
            </h2>
            <p className="font-body text-sm text-muted-foreground">
              Powered by the Jabali Engine, backed by Supabase and Vercel
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-xl p-5 flex gap-4 hover:border-primary/40 transition-colors"
              >
                <div className="bg-secondary p-3 rounded-lg h-fit">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-heading text-sm font-bold">{feature.title}</h3>
                  </div>
                  <p className="font-body text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-4 md:px-8 pb-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-primary/25 via-card to-card border border-border rounded-2xl p-8 md:p-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <BetaBadge />
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-3">
            Be one of the first creators
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
            NEXCONSOLE is in beta. Early creators help decide what ships next — and
            get to claim the best names before anyone else.
          </p>
          <NavLink
            to={user ? "/create" : "/signup"}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {user ? "Start Creating" : "Create a Free Account"}
            <ArrowRight className="h-4 w-4" />
          </NavLink>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 md:px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm font-bold">
              <span className="text-primary">NEX</span>CONSOLE
            </span>
            <BetaBadge className="!py-0" />
          </div>
          <p className="font-body text-xs text-muted-foreground text-center">
            Beta · Play. Create. Connect. · Not affiliated with Roblox Corporation.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;