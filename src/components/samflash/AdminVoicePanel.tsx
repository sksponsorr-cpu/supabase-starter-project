import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic } from "lucide-react";
import { getVoiceProvider, setVoiceProvider, type VoiceProvider } from "@/lib/voice-provider.functions";
import { toast } from "@/lib/toast";

/** Choix du fournisseur de voix off (Motion AI) : KIE ou fal.ai. Le second sert de secours. */
export function AdminVoicePanel() {
  const fetchProvider = useServerFn(getVoiceProvider);
  const save = useServerFn(setVoiceProvider);
  const [provider, setProvider] = useState<VoiceProvider>("kie");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchProvider().then(setProvider).catch(() => undefined);
  }, [fetchProvider]);

  const choose = async (next: VoiceProvider) => {
    if (next === provider) return;
    setBusy(true);
    try {
      const res = await save({ data: { provider: next } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setProvider(next);
      toast.success(next === "kie" ? "Voix off : KIE activé." : "Voix off : fal.ai activé.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  const options: { id: VoiceProvider; label: string; hint: string }[] = [
    { id: "kie", label: "KIE (ElevenLabs)", hint: "Fournisseur principal. Repli automatique sur fal.ai si KIE échoue." },
    { id: "fal", label: "fal.ai", hint: "Fournisseur principal. Repli automatique sur KIE si fal.ai échoue." },
  ];

  return (
    <section className="pt-5">
      <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight">
        <Mic className="h-5 w-5" /> Voix off (Motion AI)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choisissez le fournisseur principal de la voix off. Le changement s'applique aux nouvelles demandes.
      </p>
      <div className="mt-4 grid gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={busy}
            onClick={() => choose(o.id)}
            className={`rounded-2xl border p-4 text-left ${
              provider === o.id ? "border-primary/50 bg-primary/10" : "border-border/70 bg-card/50"
            }`}
          >
            <span className="font-medium">{o.label}</span>
            {provider === o.id && <span className="ml-2 text-xs text-primary">● actif</span>}
            <p className="mt-1 text-sm text-muted-foreground">{o.hint}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
