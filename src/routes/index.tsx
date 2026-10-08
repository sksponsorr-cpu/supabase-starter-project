import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Loader2, ChevronLeft } from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import logoAsset from "@/assets/sam-flash-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import { LandingSection } from "@/components/samflash/LandingSection";

const credentialsSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72),
  fullName: z.string().trim().max(80).optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s['next'] === "string" && s['next'].startsWith("/") ? { next: s['next'] } : {},

  head: () => ({
    meta: [
      { title: "Sam flash 2.0 — Créez images et vidéos IA" },
      {
        name: "description",
        content:
          "Sam flash 2.0 — Générez des vidéos et images IA en quelques secondes depuis votre mobile.",
      },
      { property: "og:title", content: "Sam flash 2.0 — Créez images et vidéos IA" },
      {
        property: "og:description",
        content: "Générez des vidéos et images IA en quelques secondes avec Sam flash 2.0.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { session, loading } = useAuth();

  const goNext = () => {
    if (next) window.location.href = next;
    else void navigate({ to: "/app" });
  };
  const [mode, setMode] = useState<"providers" | "email">("providers");
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [captchaSlow, setCaptchaSlow] = useState(false);

  useEffect(() => {
    if (!loading && session) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, next]);

  // Facebook, TikTok, Instagram… : Google refuse la connexion dans ces navigateurs intégrés.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/FBAN|FBAV|FB_IAB|Instagram|musical_ly|TikTok|BytedanceWebview|Snapchat|; wv\)/i.test(ua)) setInApp(true);
  }, []);

  // Si la vérification anti-robot n'apparaît pas au bout de 8 s, propose de la relancer.
  useEffect(() => {
    if (mode !== "email" || !TURNSTILE_SITE_KEY || captchaToken) {
      setCaptchaSlow(false);
      return;
    }
    const id = window.setTimeout(() => setCaptchaSlow(true), 8000);
    return () => window.clearTimeout(id);
  }, [mode, captchaToken, captchaReset]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setMessage("Copiez l'adresse sam-flash.lat et ouvrez-la dans Chrome.");
    }
  };

  const google = async () => {
    setBusy(true);
    setMessage(null);
    // Le projet utilise un Supabase personnel : on passe par l'OAuth Supabase
    // directement (le broker Lovable n'est disponible qu'avec Lovable Cloud).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: next
          ? `${window.location.origin}/?next=${encodeURIComponent(next)}`
          : window.location.origin,
      },
    });
    if (error) {
      setMessage("Connexion Google impossible pour le moment.");
      setBusy(false);
    }
    // En cas de succès, le navigateur est redirigé vers Google.
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Informations invalides.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setMessage("Validez d'abord la vérification anti-robot.");
      return;
    }
    setBusy(true);
    setMessage(null);
    if (signUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
          captchaToken: captchaToken ?? undefined,
        },
      });
      setBusy(false);
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const msg = error.message.toLowerCase();
        if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) {
          setMessage("Cet e-mail a déjà un compte. Appuyez sur « J'ai déjà un compte » pour vous connecter.");
        } else if (code === "weak_password" || msg.includes("password should be")) {
          setMessage("Mot de passe trop faible. Utilisez au moins 8 caractères avec des lettres et des chiffres.");
        } else if (code.includes("captcha") || msg.includes("captcha")) {
          setMessage("La vérification de sécurité a échoué. Réessayez.");
        } else if (error.status === 429 || code.includes("rate_limit")) {
          setMessage("Trop de tentatives. Patientez quelques minutes puis réessayez.");
        } else if (code === "email_address_invalid" || code === "validation_failed") {
          setMessage("Cette adresse e-mail n'est pas valide.");
        } else if (code === "signup_disabled") {
          setMessage("Les inscriptions sont momentanément fermées.");
        } else {
          setMessage("Inscription impossible pour le moment. Réessayez dans un instant.");
        }
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // Supabase renvoie un faux succès quand l'e-mail existe déjà.
        setMessage("Cet e-mail a déjà un compte. Appuyez sur « J'ai déjà un compte » pour vous connecter.");
      } else if (data.session) {
        goNext();
      } else {
        setMessage("Compte créé. Vérifiez votre e-mail (et les spams) pour confirmer votre inscription.");
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken ?? undefined },
    });
    setBusy(false);
    setCaptchaToken(null);
    setCaptchaReset((n) => n + 1);
    if (error) {
      setMessage(
        error.message.toLowerCase().includes("not confirmed")
          ? "Confirmez d'abord votre e-mail (vérifiez aussi les spams)."
          : "E-mail ou mot de passe incorrect. Pas encore de compte ? Appuyez sur « Créer un nouveau compte ».",
      );
    } else goNext();
  };

  return (
    <main
      className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-background px-4 py-8 md:px-6 md:py-12"
      style={{
        backgroundImage: `linear-gradient(to bottom, oklch(0.16 0.06 265 / 0.75), oklch(0.12 0.05 265 / 0.95)), url(${nightSky})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center w-full max-w-md mx-auto">
        <div className="animate-float flex flex-col items-center">
          <img
            src={logoAsset}
            alt="Logo Sam flash 2.0"
            className="mx-auto mb-5 h-24 w-24 md:h-28 md:w-28 rounded-full object-cover shadow-2xl"
          />
          <h1 className="max-w-xs text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Sam flash 2.0
          </h1>
          <p className="mt-2 text-xs md:text-sm tracking-[0.1em] md:tracking-[0.2em] text-muted-foreground px-4">Générez vidéos et images par IA</p>
          <p className="mt-6 font-mono text-sm md:text-base text-muted-foreground">Understand the Universe_</p>
        </div>
      </div>

      <div className="animate-float space-y-3 w-full max-w-sm mx-auto">
        {mode === "providers" ? (
          <>
            {!inApp && (
            <button
              type="button"
              disabled={busy}
              onClick={google}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-secondary/50 py-4 text-[17px] font-medium backdrop-blur-2xl transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-xl font-semibold">G</span>}
              Continuer avec Google
            </button>
            )}
            <button
              type="button"
              onClick={() => setMode("email")}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-primary/60 bg-secondary/50 py-4 text-[17px] font-medium backdrop-blur-2xl transition-transform active:scale-[0.98]"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Mail className="h-5 w-5" />
              Continuer avec l'e-mail
            </button>
          </>
        ) : (
          <form onSubmit={submitEmail} className="space-y-3">
            <button
              type="button"
              onClick={() => setMode("providers")}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Retour
            </button>
            <h2 className="text-xl font-semibold text-foreground">
              {signUp ? "Créer un nouveau compte" : "Se connecter"}
            </h2>
            {signUp && (
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nom complet"
                className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-[17px] outline-none backdrop-blur-2xl placeholder:text-muted-foreground"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-[17px] outline-none backdrop-blur-2xl placeholder:text-muted-foreground"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-[17px] outline-none backdrop-blur-2xl placeholder:text-muted-foreground"
            />
            {signUp && (
              <p className="px-1 text-xs text-muted-foreground">
                Au moins 8 caractères. Mélangez lettres et chiffres pour un compte plus sûr.
              </p>
            )}
            <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
            {captchaSlow && (
              <button
                type="button"
                onClick={() => setCaptchaReset((n) => n + 1)}
                className="w-full text-center text-xs text-muted-foreground underline"
              >
                La vérification ne s'affiche pas ? Réessayer
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-[17px] font-semibold text-primary-foreground disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              {signUp ? "Créer mon compte" : "Se connecter"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSignUp((v) => !v);
                setMessage(null);
              }}
              className="flex w-full items-center justify-center rounded-full border border-primary/60 py-3.5 text-[16px] font-medium text-foreground transition-transform active:scale-[0.98]"
            >
              {signUp ? "J'ai déjà un compte" : "Créer un nouveau compte"}
            </button>
          </form>
        )}

        {inApp && mode === "providers" && (
          <div className="rounded-xl bg-secondary/60 p-3 text-center text-xs text-muted-foreground">
            Pour utiliser Google, ouvrez ce lien dans Chrome.
            <button type="button" onClick={copyLink} className="mt-1 block w-full font-medium text-primary">
              {copied ? "Lien copié ✓" : "Copier le lien"}
            </button>
          </div>
        )}

        {message && (
          <div className={`mt-3 rounded-xl p-3 text-sm text-center ${message.startsWith("Compte") ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {message}
          </div>
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">
          En continuant, vous acceptez les Conditions d'utilisation et la Politique de
          confidentialité
        </p>
      </div>
      <LandingSection />
    </main>
  );
}
