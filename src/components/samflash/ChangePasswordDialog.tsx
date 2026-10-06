import { useState } from "react";
import { ChevronRight, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/toast";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-2xl border border-border bg-background/60 py-3 pl-4 pr-12 text-[15px] outline-none focus:border-primary/60"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

/** Permet à l'utilisateur de changer son mot de passe depuis les réglages. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  // Les comptes créés avec Google n'ont pas de mot de passe actuel à confirmer.
  const providers = (user?.app_metadata?.["providers"] as string[] | undefined) ?? [];
  const needsCurrent = providers.length === 0 || providers.includes("email");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (needsCurrent && !current) return setError("Saisissez votre mot de passe actuel.");
    if (next.length < 8) return setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    if (next.length > 72) return setError("Le mot de passe est trop long (72 caractères maximum).");
    if (next !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    if (needsCurrent && next === current) return setError("Choisissez un mot de passe différent de l'actuel.");

    setBusy(true);
    try {
      if (needsCurrent) {
        const email = user?.email;
        if (!email) return setError("Session invalide. Reconnectez-vous puis réessayez.");
        const check = await supabase.auth.signInWithPassword({ email, password: current });
        if (check.error) return setError("Mot de passe actuel incorrect.");
      }
      const { error: upErr } = await supabase.auth.updateUser({ password: next });
      if (upErr) {
        const m = upErr.message.toLowerCase();
        if (m.includes("same")) return setError("Choisissez un mot de passe différent de l'actuel.");
        if (m.includes("weak") || m.includes("least")) return setError("Mot de passe trop faible : ajoutez des chiffres ou des symboles.");
        return setError("Modification impossible pour le moment. Réessayez.");
      }
      toast.success("Mot de passe modifié.");
      onClose();
    } catch {
      setError("Une erreur est survenue. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Modifier le mot de passe"
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 animate-fade-in"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold">Modifier le mot de passe</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {needsCurrent && (
            <PasswordField
              id="pwd-current"
              label="Mot de passe actuel"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
          )}
          <PasswordField
            id="pwd-new"
            label="Nouveau mot de passe (8 caractères minimum)"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
          <PasswordField
            id="pwd-confirm"
            label="Confirmer le nouveau mot de passe"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-secondary py-3 font-medium">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bloc « Sécurité » des réglages : bouton + fenêtre de changement de mot de passe. */
export function PasswordRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h2 className="px-4 pb-2 pt-6 text-xs font-semibold tracking-widest text-muted-foreground">
        Sécurité
      </h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/50 px-4 py-3.5 text-left text-[17px] text-foreground backdrop-blur-xl transition-all hover:bg-card/80 active:scale-[0.98]"
      >
        <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span>Mot de passe</span>
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          <span className="text-[15px]">Modifier</span>
          <ChevronRight className="h-5 w-5" />
        </span>
      </button>
      {open && <ChangePasswordDialog onClose={() => setOpen(false)} />}
    </>
  );
}
