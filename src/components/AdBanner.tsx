import { useEffect, useState } from "react";
import { X, Sparkles, Leaf, Gift } from "lucide-react";

interface Ad {
  id: string;
  title: string;
  description: string;
  link: string;
  icon: typeof Sparkles;
  color: string;
}

const ads: Ad[] = [
  {
    id: "autumn",
    title: "Autumn Event",
    description: "Maple skies & pumpkin vibes - limited time!",
    link: "/autumn",
    icon: Leaf,
    color: "from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-300",
  },
  {
    id: "create",
    title: "Create Your Game",
    description: "Build games with AI in seconds",
    link: "/create",
    icon: Sparkles,
    color: "from-primary/20 to-accent/20 border-primary/30 text-primary",
  },
  {
    id: "devcoins",
    title: "Get DevCoins",
    description: "Power up your creations",
    link: "/devcoins",
    icon: Gift,
    color: "from-accent/20 to-yellow-500/20 border-accent/30 text-accent",
  },
];

export function AdBanner() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Pick random ad on mount
    const randomAd = ads[Math.floor(Math.random() * ads.length)];
    setAd(randomAd);

    // Check if dismissed
    try {
      const dismissedId = localStorage.getItem("nexconsole:ad-banner-dismissed");
      if (dismissedId === randomAd.id) {
        setDismissed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleDismiss = () => {
    if (ad) {
      try {
        localStorage.setItem("nexconsole:ad-banner-dismissed", ad.id);
      } catch {
        // Ignore
      }
      setDismissed(true);
    }
  };

  if (!ad || dismissed) return null;

  const Icon = ad.icon;

  return (
    <div className="mb-6 relative overflow-hidden rounded-xl border bg-gradient-to-r p-4 transition-all hover:shadow-lg">
      <div className={`absolute inset-0 ${ad.color} opacity-10`} />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${ad.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-sm font-semibold text-foreground mb-1">{ad.title}</h3>
            <p className="font-body text-xs text-muted-foreground truncate">{ad.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={ad.link}
            className="inline-flex items-center gap-1.5 bg-primary/90 text-primary-foreground font-heading text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-primary transition-colors whitespace-nowrap"
          >
            Learn More
          </a>
          <button
            onClick={handleDismiss}
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
            aria-label="Dismiss ad"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
