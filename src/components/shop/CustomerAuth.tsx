import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Création de compte ou connexion d'un client, pour commander et suivre sa livraison. */
export function CustomerAuth({ onReady, title = "Crée ton compte pour commander" }: { onReady: () => void; title?: string }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim(), role: "customer" } },
        });
        if (err) throw err;
        if (!data.session) {
          setNotice("Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.");
          setMode("login");
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      }
      onReady();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /invalid login/i.test(msg)
          ? "Email ou mot de passe incorrect."
          : /already registered/i.test(msg)
            ? "Un compte existe déjà avec cet email. Connecte-toi."
            : msg && /password/i.test(msg)
              ? "Le mot de passe doit contenir au moins 6 caractères."
              : "Impossible de continuer. Réessaie.",
      );
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-600";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">Ton compte te permet de suivre ta commande en temps réel.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
        <button type="button" onClick={() => setMode("signup")} className={`rounded-full py-2 ${mode === "signup" ? "bg-white shadow" : "text-slate-500"}`}>Créer un compte</button>
        <button type="button" onClick={() => setMode("login")} className={`rounded-full py-2 ${mode === "login" ? "bg-white shadow" : "text-slate-500"}`}>Me connecter</button>
      </div>
      {mode === "signup" && (
        <input className={input} placeholder="Ton nom" value={name} onChange={(e) => setName(e.target.value)} />
      )}
      <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
      {notice && <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || !email || password.length < 6 || (mode === "signup" && name.trim().length < 2)}
        onClick={submit}
        className="w-full rounded-full bg-blue-700 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Un instant…" : mode === "signup" ? "Créer mon compte" : "Me connecter"}
      </button>
    </div>
  );
}
