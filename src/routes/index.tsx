import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Loader2, ChevronLeft } from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import logoAsset from "@/assets/sam-flash-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { getLanding, type LandingContent } from "@/lib/landing.functions";
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
    <main className="relative flex min-h-screen flex-col bg-[#eef2ff] text-[#0b1220]">
      {/* En-tête : logo en haut à gauche, bouton en bleu à droite */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#eef2ff]/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <img src={logoAsset} alt="Logo Sam flash 2.0" className="h-9 w-9 rounded-full object-cover" />
          <span className="text-lg font-semibold tracking-tight">Sam flash 2.0</span>
        </div>
        <a
          href="/connexion"
          className="rounded-full bg-[#3b4ef8] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#3b4ef8]/30"
        >
          Commencer
        </a>
      </header>

      {/* Hero clair et bleu */}
      <section className="relative mx-auto flex w-full max-w-md flex-col items-center px-5 pb-10 pt-6 text-center">
        <span className="rounded-full border border-[#3b4ef8]/30 bg-white px-4 py-1.5 text-sm font-medium text-[#3b4ef8]">
          Création vidéo IA pour les créateurs
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          Transformez une idée en <span className="rounded-xl bg-[#3b4ef8] px-2 text-white">vidéo</span> prête à publier
        </h1>
        <p className="mt-5 text-base leading-relaxed text-[#4b5563] md:text-lg">
          Partagez sur TikTok, YouTube et Facebook, et monétisez vos contenus.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <a
            href="/connexion"
            className="flex items-center justify-center rounded-full bg-[#3b4ef8] py-4 text-[17px] font-semibold text-white shadow-xl shadow-[#3b4ef8]/30"
          >
            Créer mon compte gratuitement →
          </a>
          <a
            href="#presentation"
            className="flex items-center justify-center rounded-full bg-white py-4 text-[16px] font-semibold text-[#0b1220] shadow"
          >
            ▶ Voir la vidéo de présentation
          </a>
        </div>

        <div className="mt-5 rounded-2xl bg-white px-5 py-3 shadow">
          <p className="text-sm font-semibold">Essai : 2 000 FCFA · 40 crédits</p>
          <p className="text-xs text-[#4b5563]">Soit 8 vidéos de 5 secondes en 480p</p>
        </div>
        <p className="mt-3 text-xs text-[#4b5563]">Mobile Money, sans carte bancaire</p>
      </section>

      <div id="presentation" />
      <LandingSection />

      <section className="mx-auto mt-10 w-full max-w-md px-5">
        <h2 className="text-center text-2xl font-semibold text-[#0b1220]">Tout ce qu'il faut pour monétiser vos contenus</h2>
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
                <p className="font-semibold text-[#0b1220]">{f.t}</p>
                <p className="mt-1 text-xs text-[#4b5563]">{f.d}</p>
                {f.img && <ExampleTile label={f.t} />}
              </>
            );
            return (
              <div key={f.t} className="rounded-2xl border border-[#dbe2ff] bg-white p-4 shadow-sm">
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
        <p className="mt-3 text-center text-xs text-[#4b5563]">
          Les outils IA avancés sont en cours d'ouverture progressive.
        </p>
      </section>

      <section className="mx-auto mt-12 w-full max-w-md px-5">
        <h2 className="text-center text-2xl font-semibold text-[#0b1220]">Ce que les créateurs créent avec Sam flash</h2>
        <p className="mt-2 text-center text-sm text-[#4b5563]">Tous les modèles inclus, un seul portefeuille de crédits.</p>
        <ShowcaseGallery />
      </section>

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
  const PLACEHOLDERS = [
    { cat: "pub", label: "Publicité vidéo" },
    { cat: "clone", label: "Clonage vidéo" },
    { cat: "avatar", label: "Avatar vidéo" },
    { cat: "scene", label: "Mise en scène" },
  ];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [items, setItems] = useState<LandingContent["showcase"]>([]);
  const load = useServerFn(getLanding);
  useEffect(() => {
    load()
      .then((c) => setItems(c.showcase ?? []))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shownReal = items.filter((i) => filter === "all" || i.cat === filter);
  const shownPlaceholders = PLACEHOLDERS.filter((i) => filter === "all" || i.cat === filter);
  return (
    <>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-4 py-2 text-sm ${filter === f.id ? "border-[#0b1220] bg-[#0b1220] text-white" : "border-[#dbe2ff] bg-white text-[#0b1220]"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {shownReal.length > 0
          ? shownReal.map((i, idx) =>
              /\.(mp4|mov|webm)(\?|$)/i.test(i.url) ? (
                <video
                  key={`${i.url}-${idx}`}
                  src={i.url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="aspect-[4/5] w-full rounded-2xl object-cover"
                  aria-label={i.caption || i.cat}
                />
              ) : (
                <img
                  key={`${i.url}-${idx}`}
                  src={i.url}
                  alt={i.caption || i.cat}
                  className="aspect-[4/5] w-full rounded-2xl object-cover"
                />
              ),
            )
          : shownPlaceholders.map((i) => <ExampleTile key={i.label} label={i.label} rounded="rounded-2xl" />)}
      </div>
    </>
  );
}

function ExampleTile({ label, rounded = "rounded-xl" }: { label: string; rounded?: string }) {
  return (
    <div
      className={`mt-3 flex aspect-[4/5] w-full flex-col items-center justify-center ${rounded} p-4 text-center`}
      style={{ background: "linear-gradient(160deg, #1e2a5a 0%, #3b4ef8 100%)" }}
    >
      <span className="text-lg font-semibold text-white">{label}</span>
      <span className="mt-1 text-xs text-white/70">Exemple à remplacer</span>
    </div>
  );
}
