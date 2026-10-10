import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
          <p className="mt-3 max-w-sm px-4 text-center text-base md:text-lg font-medium text-foreground/90">
            Transformez une idée en vidéo prête à partager sur TikTok, YouTube et Facebook, et à monétiser avec AdSense.
          </p>
          <div className="mt-5 flex flex-col items-center gap-1 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-3 text-center">
            <p className="text-sm font-semibold text-foreground">Essai : 2 000 FCFA · 40 crédits</p>
            <p className="text-xs text-muted-foreground">Soit 8 vidéos de 5 secondes en 480p</p>
          </div>
          <div className="mt-6 flex w-full max-w-sm flex-col gap-3 px-4">
            <a
              href="#inscription"
              className="flex items-center justify-center rounded-full bg-primary py-4 text-[17px] font-semibold text-primary-foreground"
            >
              Créer mon compte gratuitement
            </a>
            <a
              href="#presentation"
              className="flex items-center justify-center rounded-full border border-border bg-secondary/50 py-4 text-[16px] font-medium"
            >
              Voir la vidéo de présentation
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Mobile Money, sans carte bancaire</p>
        </div>
      </div>

      <div id="presentation" />
      <LandingSection />

      <section className="mx-auto mt-10 w-full max-w-md px-5">
        <h2 className="text-center text-2xl font-semibold text-foreground">Tout ce qu'il faut pour monétiser vos contenus</h2>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { t: "Vidéos IA", d: "TikTok, YouTube, Facebook et WhatsApp" },
            { t: "Images IA", d: "Visuels pour vos publications" },
            { t: "ChatGPT", d: "Idées, scripts et légendes", to: "/chat-ia", search: { p: "gpt" } },
            { t: "Claude AI", d: "Rédaction et programmation", to: "/chat-ia", search: { p: "claude" } },
            { t: "Clonage vidéo", d: "Reproduisez un mouvement", to: "/clonage-video", img: "/showcase/clonage-anim.svg" },
            { t: "Avatar AI", d: "Un avatar qui parle", to: "/avatar-ai", img: "/showcase/avatar-anim.svg" },
          ].map((f) => {
            const body = (
              <>
                <p className="font-semibold text-foreground">{f.t}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.d}</p>
                {f.img && <img src={f.img} alt={`Exemple ${f.t}`} className="mt-3 aspect-[4/5] w-full rounded-xl object-cover" />}
              </>
            );
            return (
              <div key={f.t} className="rounded-2xl border border-border bg-card/50 p-4">
                {f.to ? (
                  <Link to={f.to} search={f.search} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Les outils IA avancés sont en cours d'ouverture progressive.
        </p>
      </section>

      <section className="mx-auto mt-12 w-full max-w-md px-5">
        <h2 className="text-center text-2xl font-semibold text-foreground">Ce que les créateurs créent avec Sam flash</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Tous les modèles inclus, un seul portefeuille de crédits.</p>
        <ShowcaseGallery />
      </section>

      <div id="inscription" className="animate-float mt-8 space-y-3 w-full max-w-sm mx-auto">
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
              S'inscrire avec Google
            </button>
            )}
            <button
              type="button"
              onClick={() => setMode("email")}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-primary/60 bg-secondary/50 py-4 text-[17px] font-medium backdrop-blur-2xl transition-transform active:scale-[0.98]"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Mail className="h-5 w-5" />
              S'inscrire avec l'adresse e-mail
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
          En continuant, vous acceptez les{" "}
          <a href="/conditions" className="underline">Conditions d'utilisation</a> et la{" "}
          <a href="/confidentialite" className="underline">Politique de confidentialité</a>
        </p>
      </div>
      <footer className="px-5 pb-10 pt-4 text-center text-xs text-muted-foreground">
        <a href="/conditions" className="underline">Conditions</a>
        {" · "}
        <a href="/confidentialite" className="underline">Confidentialité</a>
        {" · "}
        <a href="/contact" className="underline">Contact</a>
      </footer>
    </main>
  );
}

function ShowcaseGallery() {
  const FILTERS = [
    { id: "all", label: "Tout" },
    { id: "pub", label: "Publicité vidéo" },
    { id: "clone", label: "Clonage vidéo" },
    { id: "avatar", label: "Avatar vidéo" },
    { id: "scene", label: "Mise en scène" },
  ] as const;
  const ITEMS = [
    { cat: "pub", src: "/showcase/pub-video.svg", label: "Publicité vidéo" },
    { cat: "clone", src: "/showcase/clonage.svg", label: "Clonage vidéo" },
    { cat: "avatar", src: "/showcase/avatar.svg", label: "Avatar vidéo" },
    { cat: "scene", src: "/showcase/mise-en-scene.svg", label: "Mise en scène" },
  ];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const shown = filter === "all" ? ITEMS : ITEMS.filter((i) => i.cat === filter);
  return (
    <>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-4 py-2 text-sm ${filter === f.id ? "border-foreground bg-foreground text-background" : "border-border bg-card/50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {shown.map((i) => (
          <img key={i.src} src={i.src} alt={i.label} className="aspect-[4/5] w-full rounded-2xl object-cover" />
        ))}
      </div>
    </>
  );
}
