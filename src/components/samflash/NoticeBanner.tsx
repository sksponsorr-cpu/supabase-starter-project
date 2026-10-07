import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

export type NoticeKind = "warning" | "success" | "progress";

/** Déduit le type de bandeau à partir du texte (erreur / succès / génération en cours). */
export function noticeKind(message: string): NoticeKind {
  if (/[…]$|\.\.\.$/.test(message.trim())) return "progress";
  if (/(désolé|saturé|erreur|quota|expir|épuis|pause|trop de temps|impossible|indisponible|refus|réessay|non disponible)/i.test(message))
    return "warning";
  return "success";
}

const STYLES: Record<NoticeKind, { box: string; icon: string; bar: string }> = {
  warning: {
    box: "border-amber-500/50 bg-amber-500/10 notice-blink-box",
    icon: "bg-amber-500/20 text-amber-500",
    bar: "notice-sweep-amber",
  },
  success: {
    box: "border-emerald-500/40 bg-emerald-500/10",
    icon: "bg-emerald-500/20 text-emerald-500",
    bar: "notice-sweep-green",
  },
  progress: {
    box: "border-primary/40 bg-primary/10",
    icon: "bg-primary/20 text-primary",
    bar: "notice-sweep",
  },
};

/**
 * Bandeau de notification animé : entrée en glissement, icône clignotante,
 * liseré lumineux qui défile. Remplace l'ancienne pastille de texte brut.
 */
export function NoticeBanner({
  message,
  kind,
  onClose,
  action,
}: {
  message: string;
  kind?: NoticeKind;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const k = kind ?? noticeKind(message);
  const s = STYLES[k];
  // 1er paragraphe = titre ; le reste = détails (lignes nettoyées des retours à la ligne multiples).
  const parts = message.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const title = parts[0] ?? message;
  const details = parts.slice(1);
  const Icon = k === "warning" ? AlertTriangle : k === "success" ? CheckCircle2 : Loader2;

  return (
    <div
      data-notice
      role="status"
      aria-live="polite"
      className={`notice-enter relative mx-auto mb-4 w-full max-w-xl overflow-hidden rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-xl ${s.box}`}
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${s.bar}`} />
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.icon} ${
            k === "warning" ? "notice-blink" : ""
          }`}
        >
          <Icon className={`h-4 w-4 ${k === "progress" ? "animate-spin" : ""}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{title}</p>
          {details.map((d, i) => (
            <p key={i} className="mt-1 whitespace-pre-line text-[13px] leading-snug text-muted-foreground">
              {d}
            </p>
          ))}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-3 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              {action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
