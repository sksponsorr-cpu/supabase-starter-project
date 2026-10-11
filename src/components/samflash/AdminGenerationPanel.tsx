import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Video } from "lucide-react";
import { getGenerationProvider, setGenerationProvider, type GenerationProvider } from "@/lib/maintenance.functions";
import { toast } from "@/lib/toast";

/** Bascule du moteur de génération vidéo : KIE (activé) ou Fal (désactivé). Effet immédiat. */
export function AdminGenerationPanel() {
  const fetchProvider = useServerFn(getGenerationProvider);
  const save = useServerFn(setGenerationProvider);
  const [provider, setProvider] = useState<GenerationProvider>("fal");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchProvider()
      .then((p) => setProvider(p))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [fetchProvider]);

  const useKie = provider === "kie";

  const toggle = async () => {
    const next: GenerationProvider = useKie ? "fal" : "kie";
    setBusy(true);
    try {
      const res = await save({ data: { provider: next } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setProvider(next);
      toast.success(next === "kie" ? "Génération vidéo : KIE activé." : "Génération vidéo : Fal activé.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Moteur de génération</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choisissez où partent les demandes de génération vidéo. Le changement s'applique aux nouvelles demandes.
      </p>

      <div
        className={`mt-4 flex items-center gap-4 rounded-3xl border p-5 backdrop-blur-xl ${
          useKie ? "border-primary/50 bg-primary/10" : "border-border/70 bg-card/50"
        }`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            useKie ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Video className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{loading ? "Chargement…" : useKie ? "KIE" : "Fal"}</p>
          <p className="text-sm text-muted-foreground">
            {useKie
              ? "Les vidéos sont générées par KIE (Grok Imagine)."
              : "Les vidéos sont générées par Fal.ai."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={useKie}
          aria-label={`Utiliser KIE pour les vidéos : ${useKie ? "activé" : "désactivé"}`}
          disabled={loading || busy}
          onClick={() => void toggle()}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            useKie ? "bg-primary" : "bg-muted"
          }`}
        >
          {busy ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" />
          ) : (
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                useKie ? "translate-x-6" : "translate-x-1"
              }`}
            />
          )}
        </button>
      </div>

      <p className="mt-3 px-1 text-xs text-muted-foreground">
        Les images restent générées par Fal.ai pour l'instant : le moteur KIE image n'est pas encore branché.
      </p>
    </section>
  );
}
