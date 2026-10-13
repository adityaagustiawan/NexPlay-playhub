import { Leaf, Sparkles, ArrowRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const AutumnEvent = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: Leaf,
      title: "Autumn Atmosphere",
      description: "Immerse yourself in warm maple hues, falling leaves, and cozy vibes across the entire platform.",
    },
    {
      icon: Sparkles,
      title: "Seasonal Games",
      description: "Discover limited-time autumn-themed games and experiences handpicked for the season.",
    },
    {
      icon: ArrowRight,
      title: "Limited Time",
      description: "The Autumn Event only runs for a short time - don't miss out on the seasonal fun!",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-4 md:px-8">
        <NavLink to="/" className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-primary" />
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
          <div className="rise-in flex items-center justify-center gap-3 mb-6">
            <span className="autumn-banner-glow inline-flex items-center gap-2 rounded-full border border-[hsl(38_96%_56%/0.35)] bg-[hsl(24_92%_54%/0.18)] px-3 py-1 backdrop-blur-md">
              <Leaf className="h-3.5 w-3.5 text-[hsl(38_96%_56%)]" />
              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-[hsl(38_96%_66%)]">
                Autumn Event
              </span>
              <Sparkles className="h-3.5 w-3.5 text-[hsl(38_96%_56%)]" />
            </span>
          </div>

          <h1 className="rise-in font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
            <span className="bg-gradient-to-b from-[hsl(38_96%_66%)] to-[hsl(24_92%_54%)] bg-clip-text text-transparent">
              Maple Skies
            </span>{" "}
            & Pumpkin Vibes
          </h1>

          <p className="rise-in font-body text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 opacity-90">
            Celebrate the season with autumn-themed games, cozy visuals, and falling leaves throughout NEXCONSOLE.
          </p>

          <div className="rise-in flex flex-wrap items-center justify-center gap-3">
            <NavLink to="/explore">
              <Button size="lg" className="gap-2">
                Explore Autumn Games
                <ArrowRight className="h-4 w-4" />
              </Button>
            </NavLink>
            <NavLink to="/create">
              <Button size="lg" variant="outline" className="gap-2">
                Create Something Cozy
              </Button>
            </NavLink>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-3">Autumn Event Highlights</h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Everything you love about fall, baked right into your game platform.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, i) => (
              <Card key={i} className="border-border/60 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(24_92%_54%/0.18)] text-[hsl(38_96%_56%)]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-heading">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm font-bold">
              <span className="text-primary">NEX</span>CONSOLE
            </span>
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} All rights reserved</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <NavLink to="/" className="hover:text-foreground transition-colors">
              Home
            </NavLink>
            <NavLink to="/explore" className="hover:text-foreground transition-colors">
              Explore
            </NavLink>
            <NavLink to="/create" className="hover:text-foreground transition-colors">
              Create
            </NavLink>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AutumnEvent;
