import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { AUTUMN_EVENT } from "@/lib/seasonalEvents";
import {
  Gamepad2,
  Sparkles,
  Leaf,
  ArrowRight,
  Play,
  Star,
  Timer,
} from "lucide-react";

const Autumn = () => {
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

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="rise-in flex items-center justify-center gap-2 mb-6">
            <Leaf className="h-5 w-5 text-accent" />
            <span className="font-body text-xs uppercase tracking-widest text-accent">
              {AUTUMN_EVENT.badge || AUTUMN_EVENT.name}
            </span>
          </div>

          <h1
            className="rise-in font-heading text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
            style={{ animationDelay: "0.1s" }}
          >
            Maple Skies & Pumpkin{" "}
            <span className="text-primary">Adventures</span>
          </h1>

          <p
            className="rise-in font-body text-base md:text-lg text-muted-foreground mb-4 max-w-2xl mx-auto"
            style={{ animationDelay: "0.2s" }}
          >
            {AUTUMN_EVENT.tagline}
          </p>

          <p
            className="rise-in font-body text-sm text-muted-foreground mb-8 max-w-xl mx-auto"
            style={{ animationDelay: "0.3s" }}
          >
            Cozy vibes, crisp air, and limited-time autumn games. Create your
            own autumn masterpiece or explore games crafted by the community.
          </p>

          <div
            className="rise-in flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "0.4s" }}
          >
            <NavLink
              to="/create"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Create Autumn Game
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

      {/* Features */}
      <section className="px-4 md:px-8 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rise-in bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Leaf className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">
                Autumn Aesthetics
              </h3>
              <p className="font-body text-sm text-muted-foreground">
                Warm oranges, golden ambers, and falling maple leaves set the
                perfect cozy autumn atmosphere across the entire site.
              </p>
            </div>

            <div
              className="rise-in bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Timer className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">
                Limited Time
              </h3>
              <p className="font-body text-sm text-muted-foreground">
                The Autumn Event runs for a limited window. Catch it while the
                leaves are falling and the vibes are crisp!
              </p>
            </div>

            <div
              className="rise-in bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">
                Community Creations
              </h3>
              <p className="font-body text-sm text-muted-foreground">
                Explore autumn-themed games from creators worldwide. From cozy
                farming sims to pumpkin platformers, there's something for
                everyone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 md:px-8 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="rise-in bg-card border border-border rounded-2xl p-8 md:p-10 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 rounded-full bg-primary/20 blur-[80px]" />
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4 relative">
              Ready to Fall Into Creation?
            </h2>
            <p className="font-body text-base text-muted-foreground mb-6 max-w-xl mx-auto relative">
              Let the autumn breeze inspire your next game. Build it in seconds
              with AI and share it with the world.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 relative">
              <NavLink
                to="/create"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-4 w-4" />
                Start Creating
                <ArrowRight className="h-4 w-4" />
              </NavLink>
              <NavLink
                to="/explore"
                className="inline-flex items-center gap-2 bg-secondary text-foreground font-heading text-sm font-semibold px-7 py-3.5 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                Browse Autumn Games
              </NavLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Autumn;
