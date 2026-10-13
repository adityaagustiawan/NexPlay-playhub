import { useEffect, useState } from "react";
import { X, Sparkles, Leaf, Gift } from "lucide-react";

interface Promo {
  id: string;
  title: string;
  description: string;
  link: string;
  icon: typeof Sparkles;
  bgColor: string;
  textColor: string;
  buttonColor: string;
}

const promos: Promo[] = [
  {
    id: "autumn",
    title: "Autumn Event",
    description: "Maple skies & pumpkin vibes - limited time!",
    link: "/autumn",
    icon: Leaf,
    bgColor: "bg-gradient-to-r from-orange-600/20 via-amber-600/20 to-orange-600/20",
    textColor: "text-orange-300",
    buttonColor: "bg-orange-600 hover:bg-orange-700",
  },
  {
    id: "create",
    title: "Create Your Game",
    description: "Build games with AI in seconds",
    link: "/create",
    icon: Sparkles,
    bgColor: "bg-gradient-to-r from-violet-600/20 via-primary/20 to-violet-600/20",
    textColor: "text-primary",
    buttonColor: "bg-primary hover:bg-primary/90",
  },
  {
    id: "devcoins",
    title: "Get DevCoins",
    description: "Power up your creations",
    link: "/devcoins",
    icon: Gift,
    bgColor: "bg-gradient-to-r from-amber-600/20 via-accent/20 to-amber-600/20",
    textColor: "text-accent",
    buttonColor: "bg-accent hover:bg-accent/90 text-accent-foreground",
  },
];

export function PromoBanner() {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const randomPromo = promos[Math.floor(Math.random() * promos.length)];
    setPromo(randomPromo);

    try {
      const dismissedId = localStorage.getItem("nexconsole:promo-banner-dismissed");
      if (dismissedId === randomPromo.id) {
        setDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = () => {
    if (promo) {
      try {
        localStorage.setItem("nexconsole:promo-banner-dismissed", promo.id);
      } catch {
        // ignore
      }
      setDismissed(true);
    }
  };

  if (!promo || dismissed) return null;

  const Icon = promo.icon;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border ${promo.bgColor} p-5 mb-6 transition-all`}>
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`rounded-full p-3 ${promo.textColor} bg-background/50`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground mb-1">{promo.title}</h2>
            <p className="font-body text-sm text-muted-foreground">{promo.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <a
            href={promo.link}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 ${promo.buttonColor} text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap`}
          >
            Learn More
          </a>
          <button
            onClick={handleDismiss}
            className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
