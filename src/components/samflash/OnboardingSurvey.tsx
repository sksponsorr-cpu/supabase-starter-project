import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { getMyOnboarding, submitOnboarding, type OnboardingSource } from "@/lib/onboarding.functions";
import { toast } from "@/lib/toast";

export const SOURCE_LABELS: Record<OnboardingSource, { label: string; emoji: string }> = {
  youtube: { label: "YouTube", emoji: "▶️" },
  tiktok: { label: "TikTok", emoji: "🎵" },
  facebook: { label: "Publicité Facebook", emoji: "📣" },
  google: { label: "Google", emoji: "🔎" },
  gemini: { label: "Gemini", emoji: "✨" },
  other: { label: "Autre", emoji: "💬" },
  ignore: { label: "Sans réponse", emoji: "—" },
};

const CHOICES: OnboardingSource[] = ["youtube", "tiktok", "facebook", "google", "gemini", "other"];

/** Notification animée affichée une seule fois par compte (1re connexion / inscription). */
export function OnboardingSurvey({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<OnboardingSource | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const check = useServerFn(getMyOnboarding);
  const submit = useServerFn(submitOnboarding);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    check()
      .then((r) => {
        if (cancelled || r.answered) return;
        // Léger délai : la notification « arrive » une fois le studio affiché.
        window.setTimeout(() => !cancelled && setVisible(true), 1200);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, check]);

  if (!visible) return null;

  const send = async (source: OnboardingSource, otherText?: string) => {
    setBusy(true);
    try {
      const res = await submit({ data: { source, otherText } });
      if (res.ok) {
        if (source === "ignore") {
          setVisible(false);
        } else {
          setDone(true);
          window.setTimeout(() => setVisible(false), 1600);
        }
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Envoi impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3 sm:pt-5">
      <div
        role="dialog"
        aria-label="Comment avez-vous découvert Sam flash ?"
        className="notice-enter notice-ring pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/40 bg-card/95 p-4 shadow-2xl backdrop-blur-2xl"
      >
        <span aria-hidden className="notice-sweep absolute inset-x-0 top-0 h-[3px]" />

        {done ? (
          <div className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium">Merci, c'est noté !</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="notice-blink mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">
                  Comment avez-vous découvert Sam flash 10.0 ?
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Une seule question, 5 secondes.</p>
              </div>
              <button
                type="button"
                aria-label="Plus tard"
                disabled={busy}
                onClick={() => void send("ignore")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChoice(c)}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition-all active:scale-95 ${
                    choice === c
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {SOURCE_LABELS[c].label}
                </button>
              ))}
            </div>

            {choice === "other" && (
              <input
                autoFocus
                value={other}
                maxLength={200}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Précisez (ami, Instagram, blog…)"
                className="mt-3 w-full rounded-2xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary/60"
              />
            )}

            <button
              type="button"
              disabled={!choice || busy || (choice === "other" && other.trim().length < 2)}
              onClick={() => choice && void send(choice, other.trim() || undefined)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
