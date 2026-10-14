import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Cpu } from "lucide-react";
import {
  getVoiceProvider,
  setVoiceProvider,
  getCodeProvider,
  setCodeProvider,
  type VoiceProvider,
  type CodeProvider,
} from "@/lib/voice-provider.functions";
import { toast } from "@/lib/toast";

/** Bureau admin : fournisseur de la voix off et fournisseur des modèles (Claude / GPT). */
export function AdminVoicePanel() {
  const fetchVoice = useServerFn(getVoiceProvider);
  const fetchCode = useServerFn(getCodeProvider);
  const saveVoice = useServerFn(setVoiceProvider);
  const saveCode = useServerFn(setCodeProvider);
  const [voice, setVoice] = useState<VoiceProvider>("kie");
  const [code, setCode] = useState<CodeProvider>("kie");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchVoice().then(setVoice).catch(() => undefined);
    void fetchCode().then(setCode).catch(() => undefined);
  }, [fetchVoice, fetchCode]);

  const chooseVoice = async (next: VoiceProvider) => {
    if (next === voice) return;
    setBusy(true);
    try {
      const res = await saveVoice({ data: { provider: next } });
      if (!res.ok) return toast.error(res.message);
      setVoice(next);
      toast.success("Fournisseur de voix mis à jour.");
    } finally {
      setBusy(false);
    }
  };

  const chooseCode = async (next: CodeProvider) => {
    if (next === code) return;
    setBusy(true);
    try {
      const res = await saveCode({ data: { provider: next } });
      if (!res.ok) return toast.error(res.message);
      setCode(next);
      toast.success("Fournisseur des modèles mis à jour.");
    } finally {
      setBusy(false);
    }
  };

  const Option = ({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left ${active ? "border-primary/50 bg-primary/10" : "border-border/70 bg-card/50"}`}
    >
      <span className="font-medium">{label}</span>
      {active && <span className="ml-2 text-xs text-primary">● actif</span>}
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </button>
  );

  return (
    <section className="pt-5">
      <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight">
        <Mic className="h-5 w-5" /> Voix off (Motion AI)
      </h2>
      <div className="mt-4 grid gap-3">
        <Option active={voice === "kie"} onClick={() => chooseVoice("kie")} label="KIE (ElevenLabs)" hint="Fournisseur principal de la voix. Repli sur fal.ai." />
        <Option active={voice === "fal"} onClick={() => chooseVoice("fal")} label="fal.ai (ElevenLabs)" hint="Fournisseur principal de la voix. Repli sur KIE." />
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-[22px] font-semibold tracking-tight">
        <Cpu className="h-5 w-5" /> Modèles Claude et GPT (Motion AI)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Choisissez qui fournit les modèles de création.</p>
      <div className="mt-4 grid gap-3">
        <Option active={code === "kie"} onClick={() => chooseCode("kie")} label="KIE" hint="Claude et GPT via KIE. Repli sur fal.ai." />
        <Option active={code === "fal"} onClick={() => chooseCode("fal")} label="fal.ai (OpenRouter)" hint="Claude et GPT via fal.ai. Repli sur KIE." />
      </div>
    </section>
  );
}
