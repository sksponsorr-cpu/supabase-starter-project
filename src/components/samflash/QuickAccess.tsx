import { toast } from "@/lib/toast";
import { ImageIcon, Video, Sparkles, TrendingUp, Mic, Scissors } from "lucide-react";

type Item = { label: string; icon: React.ElementType; action: "seller-image" | "seller-video" | "soon" | "voix" };

const ITEMS: Item[] = [
  { label: "Pub image", icon: ImageIcon, action: "seller-image" },
  { label: "Pub vidéo", icon: Video, action: "seller-video" },
  { label: "Motion design", icon: Sparkles, action: "soon" },
  { label: "Produits gagnants", icon: TrendingUp, action: "soon" },
  { label: "Voix off", icon: Mic, action: "voix" },
  { label: "Montage", icon: Scissors, action: "soon" },
];

/** Raccourcis de l'accueil. Les fonctions pas encore prêtes affichent « Bientôt disponible ». */
export function QuickAccess() {
  const go = (item: Item) => {
    if (item.action === "soon") {
      toast("Bientôt disponible.");
      return;
    }
    if (item.action === "voix") {
      window.location.href = "/voix-off";
      return;
    }
    window.location.assign("/vendeur");
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 pb-4">
      {ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => go(item)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-transform active:scale-95"
        >
          <item.icon className="h-4 w-4 text-primary" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
