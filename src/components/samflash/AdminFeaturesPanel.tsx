import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Eye, Globe } from "lucide-react";
import { getFeatureFlags, setFeatureFlag } from "@/lib/feature-flags.functions";
import { FEATURE_KEYS, type FeatureFlags, type FeatureKey } from "@/lib/feature-flags";
import { toast } from "@/lib/toast";

const LABELS: Record<FeatureKey, { title: string; desc: string }> = {
  creator_studio: {
    title: "Espace créateur",
    desc: "Choix du modèle, type de vidéo et durée sur /app.",
  },
  seller_studio: {
    title: "Espace vendeur",
    desc: "Influenceurs IA, produits et voix off.",
  },
  voice_library: {
    title: "Bibliothèque de voix",
    desc: "Voix clonées ajoutées depuis le bureau admin.",
  },
  creator_dashboard: {
    title: "Tableau de bord créateur",
    desc: "Profil, vidéos et revenus du créateur.",
  },
  monetization_requests: {
    title: "Demandes de monétisation",
    desc: "Demandes de participation à la monétisation.",
  },
};

/** Publication des nouvelles fonctionnalités : vous voyez tout, les utilisateurs seulement ce qui est publié. */
export function AdminFeaturesPanel() {
  const fetchFlags = useServerFn(getFeatureFlags);
  const save = useServerFn(setFeatureFlag);
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<FeatureKey | null>(null);

  useEffect(() => {
    void fetchFlags()
      .then((f) => setFlags(f))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [fetchFlags]);

  const toggle = async (key: FeatureKey, next: boolean) => {
    setBusy(key);
    try {
      const res = await save({ data: { key, enabled: next } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setFlags(res.flags);
      toast.success(next ? "Publié pour tous les utilisateurs." : "Masqué pour les utilisateurs.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Publication</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vous voyez toujours les nouveautés. Les utilisateurs ne les voient qu'une fois publiées ici.
      </p>

      <div className="mt-4 space-y-3">
        {FEATURE_KEYS.map((key) => {
          const on = flags[key] === true;
          const label = LABELS[key] ?? { title: key, desc: "" };
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-3xl border border-border/70 bg-card/50 p-5"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{label.title}</p>
                <p className="text-sm text-muted-foreground">{label.desc}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {on ? <Globe className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {loading ? "Chargement…" : on ? "Publié pour tous" : "Aperçu administrateur uniquement"}
                </p>
              </div>
              <button
                type="button"
                disabled={loading || busy !== null}
                onClick={() => void toggle(key, !on)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold disabled:opacity-60 ${
                  on ? "bg-secondary" : "bg-primary text-primary-foreground"
                }`}
              >
                {busy === key && <Loader2 className="h-4 w-4 animate-spin" />}
                {on ? "Retirer" : "Publier"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
