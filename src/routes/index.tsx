import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Mail,
  Loader2,
  Sparkles,
  Film,
  CheckCircle2,
  X,
  Play,
  Volume2,
  VolumeX,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Wand2,
} from "lucide-react";
import logoAsset from "@/assets/sam-flash-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { LandingBackground } from "@/components/samflash/LandingBackground";

const credentialsSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72),
  fullName: z.string().trim().max(80).optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" && s["next"].startsWith("/") ? { next: s["next"] } : {},

  head: () => ({
    meta: [
      { title: "Sam flash 2.0 — Transformez une idée en vidéo prête à publier" },
      {
        name: "description",
        content:
          "Transformez une idée en vidéo prête à publier avec Sam flash 2.0. Génération IA ultra-rapide d'images et vidéos depuis mobile et ordinateur.",
      },
      {
        property: "og:title",
        content: "Sam flash 2.0 — Transformez une idée en vidéo prête à publier",
      },
      {
        property: "og:description",
        content:
          "Générez des vidéos et images IA en quelques secondes. Studio de création sur mobile et ordinateur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Wand2,
    title: "1. Décrivez votre idée",
    desc: "Écrivez en quelques mots la scène, l'ambiance ou le sujet que vous imaginez, en français ou dans toute autre langue.",
  },
  {
    step: "02",
    icon: Layers,
    title: "2. Choisissez image ou vidéo",
    desc: "Sélectionnez le format (vertical 9:16 pour TikTok/Reels ou horizontal 16:9) et lancez la génération en un clic.",
  },
  {
    step: "03",
    icon: CheckCircle2,
    title: "3. Retrouvez vos créations",
    desc: "Votre vidéo est prête en quelques secondes, enregistrée dans votre galerie, prête à être partagée ou téléchargée sans filigrane.",
  },
];

const FEATURES = [
  {
    icon: Film,
    title: "Vidéos cinématiques par IA",
    desc: "Transformez une idée ou une photo de référence en séquence vidéo fluide avec mouvements de caméra immersifs.",
  },
  {
    icon: Sparkles,
    title: "Images haute résolution",
    desc: "Concevez des visuels originaux et détaillés pour vos miniatures, vos réseaux sociaux ou vos projets créatifs.",
  },
  {
    icon: Zap,
    title: "Amélioration des prompts",
    desc: "Notre assistant IA enrichit vos descriptions pour maximiser la fidélité visuelle et la précision du résultat.",
  },
  {
    icon: Shield,
    title: "Galerie & Export direct",
    desc: "Conservez l'historique complet de vos générations et téléchargez vos fichiers immédiatement sur tous vos appareils.",
  },
];

const PLAN_CARDS = [
  {
    name: "Découverte",
    badge: "Offre d'essai",
    quota: "1 vidéo & 2 images offertes",
    desc: "Idéal pour tester gratuitement la puissance du studio de création.",
    features: [
      "1 vidéo offerte (8s max)",
      "2 images IA offertes",
      "Un compte gratuit par appareil",
      "Téléchargement direct",
    ],
    highlight: false,
    cta: "Essayer gratuitement",
  },
  {
    name: "Super Grok",
    badge: "Recommandé",
    quota: "3 min 20 s de vidéo / jour",
    desc: "La formule parfaite pour créer régulièrement du contenu sur les réseaux.",
    features: [
      "Vidéos HD 720p de 6 secondes",
      "Génération d'images illimitée",
      "Import d'images de référence",
      "Rendu ultra-rapide",
    ],
    highlight: true,
    cta: "Choisir Super Grok",
  },
  {
    name: "Super Grok Plus",
    badge: "Créateurs actifs",
    quota: "6 min 40 s de vidéo / jour",
    desc: "Davantage de temps de génération et un rendu supérieur pour vos projets.",
    features: [
      "Tout dans Super Grok",
      "Création en résolution 1080p",
      "Générations prioritaires",
      "Crédits mensuels étendus",
    ],
    highlight: false,
    cta: "Choisir Super Grok Plus",
  },
  {
    name: "Super Grok Heavy",
    badge: "Performance max",
    quota: "20 min de vidéo / jour",
    desc: "Pour les professionnels et les créateurs exigeants nécessitant le débit maximal.",
    features: [
      "Tout dans Super Grok Plus",
      "Vidéo 1080p native",
      "Vitesse de calcul maximale",
      "Accès anticipé aux nouveaux modèles",
    ],
    highlight: false,
    cta: "Choisir Super Grok Heavy",
  },
];

const FAQ_ITEMS = [
  {
    q: "Qu'est-ce que Sam flash 2.0 ?",
    a: "Sam flash 2.0 est un studio de création propulsé par l'intelligence artificielle. Il vous permet de générer des vidéos cinématiques et des images spectaculaires à partir d'une simple description textuelle, directement depuis votre navigateur mobile ou ordinateur.",
  },
  {
    q: "Puis-je essayer gratuitement sans carte bancaire ?",
    a: "Oui, absolument. Dès votre inscription gratuite, vous recevez immédiatement 1 vidéo (jusqu'à 8 secondes) et 2 images offertes, sans renseigner aucune carte bancaire.",
  },
  {
    q: "Combien de temps prend la génération d'une vidéo ?",
    a: "La majorité des vidéos sont créées en quelques secondes seulement grâce à notre infrastructure de serveurs accélérés par GPU.",
  },
  {
    q: "Quelle est la qualité des vidéos obtenues ?",
    a: "L'offre Super Grok produit des vidéos en haute définition 720p. Les formules Super Grok Plus et Heavy permettent d'atteindre la résolution Full HD 1080p avec des détails cinématiques nets.",
  },
  {
    q: "Puis-je annuler ou changer d'abonnement quand je veux ?",
    a: "Oui, votre abonnement est sans engagement. Vous pouvez l'annuler ou changer de formule à tout moment en un clic depuis votre espace personnel.",
  },
  {
    q: "Où sont stockées mes créations ?",
    a: "Toutes vos créations sont automatiquement sauvegardées dans votre espace galerie sécurisé, accessible dès que vous vous connectez à votre compte.",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { session, loading } = useAuth();

  // Redirection automatique si déjà connecté
  const goNext = () => {
    if (next) window.location.href = next;
    else void navigate({ to: "/app" });
  };

  useEffect(() => {
    if (!loading && session) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, next]);

  // État de la modale d'authentification
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"providers" | "email">("providers");
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // État de la vidéo de présentation
  const [videoSound, setVideoSound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  const openAuth = (isSignUp: boolean) => {
    setSignUp(isSignUp);
    setAuthMode("providers");
    setMessage(null);
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setAuthOpen(false);
    setMessage(null);
  };

  const handleGoogle = async () => {
    setBusy(true);
    setMessage(null);
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
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Informations invalides.");
      return;
    }
    setBusy(true);
    setMessage(null);
    if (signUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      setBusy(false);
      if (error) {
        if (error.message.includes("User already registered") || error.status === 422) {
          setMessage("Cet e-mail est déjà utilisé. Veuillez vous connecter.");
        } else if (error.message.includes("Password should be")) {
          setMessage("Le mot de passe doit contenir au moins 8 caractères.");
        } else {
          setMessage("Inscription impossible. Vérifiez vos informations et réessayez.");
        }
      } else {
        setMessage("Compte créé. Vérifiez votre boîte de réception pour confirmer votre inscription.");
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage("Identifiants invalides. Vérifiez votre adresse et mot de passe.");
    } else {
      goNext();
    }
  };

  return (
    <div className="relative min-h-screen text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      {/* 3. Arrière-plan 3D animé et discret */}
      <LandingBackground />

      {/* Navigation supérieure */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-slate-200/60 transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img
              src={logoAsset}
              alt="Logo Sam flash 2.0"
              className="h-9 w-9 rounded-full object-cover shadow-xs transition-transform group-hover:scale-105"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-slate-900">
                Sam flash
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                2.0
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#comment-ca-marche" className="hover:text-indigo-600 transition-colors">
              Comment ça marche
            </a>
            <a href="#fonctionnalites" className="hover:text-indigo-600 transition-colors">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="hover:text-indigo-600 transition-colors">
              Tarifs
            </a>
            <a href="#faq" className="hover:text-indigo-600 transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openAuth(false)}
              className="btn-3d-secondary px-5 py-2 rounded-full text-sm font-semibold cursor-pointer"
            >
              Se connecter
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-12 sm:pt-20 pb-16 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge haut */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-indigo-50 border border-indigo-200/70 text-indigo-700 shadow-xs mb-6">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>Studio de création vidéo & image par IA</span>
          </div>

          {/* Titre Principal H1 */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Transformez une idée en vidéo prête à publier
          </h1>

          {/* Sous-titre */}
          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Décrivez votre vision en quelques mots. Sam flash 2.0 génère une vidéo cinématique ou une image haute fidélité en quelques secondes, prête pour vos réseaux sociaux ou vos projets.
          </p>

          {/* 1 & 2. Boutons d'action avec largeur max ~340px et effet 3D */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl mx-auto">
            <button
              type="button"
              onClick={() => openAuth(true)}
              className="btn-3d-primary w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold gap-2 cursor-pointer"
            >
              Créer mon compte gratuitement
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="#presentation"
              className="btn-3d-secondary w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold text-center cursor-pointer"
            >
              Voir la vidéo de présentation
            </a>
          </div>

          {/* Réassurance sous boutons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              1 vidéo & 2 images offertes
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Sans carte bancaire
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Sur mobile & ordinateur
            </span>
          </div>
        </div>
      </section>

      {/* Section Vidéo de présentation */}
      <section id="presentation" className="px-4 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-200/70 text-slate-700">
            Aperçu interactif
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Voyez ce que l'IA réalise à partir d'un simple texte
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Pas de logiciel à installer, pas de montage complexe. Tout s'opère instantanément.
          </p>
        </div>

        {/* Cadre vidéo équilibré et centré */}
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 bg-slate-900 shadow-2xl">
            {/* Barre de navigation style navigateur */}
            <div className="h-10 bg-slate-900/90 border-b border-white/10 px-4 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-white/10 px-3 py-1 rounded-md">
                sam-flash.lat/studio
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Prêt à diffuser
                </span>
              </div>
            </div>

            {/* Zone visuelle dynamique de simulation */}
            <div className="relative aspect-video w-full bg-radial from-indigo-950 via-slate-950 to-black overflow-hidden flex flex-col justify-between p-6 sm:p-8">
              {/* Effet ambiant de lumière */}
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_40%,rgba(99,102,241,0.35),transparent_70%)]" />

              {/* Tag en haut de vidéo */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-md border border-white/10">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Génération terminée · 1080p Full HD
                </span>
                <button
                  type="button"
                  onClick={() => setVideoSound(!videoSound)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors cursor-pointer"
                  aria-label={videoSound ? "Couper le son" : "Activer le son"}
                >
                  {videoSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              </div>

              {/* Centre de la vidéo : simulation de prompt et scène */}
              <div className="relative z-10 text-center my-auto px-4">
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-indigo-600/30 border border-indigo-400/40 text-white mb-4 backdrop-blur-md">
                  <Film className="h-8 w-8 text-indigo-300" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Scène cinématique générée par Sam flash 2.0
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-indigo-200/90 font-mono max-w-lg mx-auto bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                  « Vue aérienne d'une métropole futuriste baignée par le soleil couchant, reflets dorés sur les gratte-ciels, 4k ultra-réaliste »
                </p>
              </div>

              {/* Barre de contrôle basse */}
              <div className="relative z-10 flex items-center justify-between text-xs text-white/80 bg-black/50 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-2 text-white font-medium hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <Play className={`h-4 w-4 fill-current ${isPlaying ? "text-indigo-400" : ""}`} />
                  <span>{isPlaying ? "En cours de lecture" : "Mettre en pause"}</span>
                </button>
                <span className="font-mono text-[11px] text-white/60">00:06 / 00:06 HD</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Comment ça marche */}
      <section id="comment-ca-marche" className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
              Simplicité absolue
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Comment ça marche
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Trois étapes directes, sans compétences techniques ni montage manuel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-6 sm:p-8 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="font-mono text-2xl font-black text-slate-300">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Fonctionnalités */}
      <section id="fonctionnalites" className="px-4 py-16 sm:py-20 bg-white/40 border-y border-slate-200/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-200/80 text-slate-700">
              Fonctionnalités clés
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Tout ce dont vous avez besoin pour vos contenus
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Un studio complet taillé pour la publication immédiate sur tous les réseaux.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-md p-6 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Tarifs & Abonnements */}
      <section id="tarifs" className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
              Offres flexibles
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Ce que vous recevez selon votre formule
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Commencez gratuitement, puis choisissez la formule adaptée à votre rythme de création.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLAN_CARDS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all ${
                  p.highlight
                    ? "border-2 border-indigo-500 bg-white shadow-xl shadow-indigo-100 ring-4 ring-indigo-50"
                    : "border border-slate-200/90 bg-white/80 backdrop-blur-md shadow-xs hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        p.highlight
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
                  <div className="mt-2 text-xs font-semibold text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-md inline-block">
                    {p.quota}
                  </div>
                  <p className="mt-3 text-xs text-slate-500 leading-relaxed">{p.desc}</p>

                  <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-5">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    onClick={() => openAuth(true)}
                    className={`w-full max-w-[260px] mx-auto py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      p.highlight ? "btn-3d-primary" : "btn-3d-secondary"
                    }`}
                  >
                    {p.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section FAQ */}
      <section id="faq" className="px-4 py-16 sm:py-20 bg-slate-100/50 border-t border-slate-200/60">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-200/80 text-slate-700">
              Aide & Informations
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Questions fréquentes
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors open:bg-slate-50/80"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-slate-900">
                  <span>{item.q}</span>
                  <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Bannière d'appel à l'action final */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/90 p-8 sm:p-14 text-center shadow-lg">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Prêt à donner vie à vos créations ?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
            Rejoignez Sam flash 2.0 en quelques secondes et réalisez votre première vidéo avec l'intelligence artificielle dès maintenant.
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => openAuth(true)}
              className="btn-3d-primary w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold gap-2 cursor-pointer"
            >
              Créer mon compte gratuitement
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/70 py-10 px-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Sam flash 2.0 — Tous droits réservés.</p>
          <div className="flex items-center gap-6 font-medium">
            <a href="/conditions" className="hover:text-slate-900 transition-colors underline">
              Conditions
            </a>
            <a href="/confidentialite" className="hover:text-slate-900 transition-colors underline">
              Confidentialité
            </a>
            <a href="/contact" className="hover:text-slate-900 transition-colors underline">
              Contact
            </a>
          </div>
        </div>
      </footer>

      {/* Modale d'authentification complète */}
      {authOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
            {/* Bouton de fermeture */}
            <button
              type="button"
              onClick={closeAuth}
              className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* En-tête modal */}
            <div className="text-center mb-6">
              <img
                src={logoAsset}
                alt="Logo Sam flash 2.0"
                className="mx-auto mb-3 h-12 w-12 rounded-full object-cover shadow-xs"
              />
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                {signUp ? "Créer un compte gratuit" : "Se connecter"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {signUp
                  ? "1 vidéo et 2 images offertes à l'inscription"
                  : "Retrouvez vos vidéos et images générées"}
              </p>
            </div>

            {/* Mode fournisseurs (Google / Email) */}
            {authMode === "providers" ? (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogle}
                  className="btn-3d-secondary w-full max-w-[340px] mx-auto py-3.5 rounded-full text-sm sm:text-base font-semibold gap-3 flex items-center justify-center cursor-pointer"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="text-lg font-bold text-slate-800">G</span>
                  )}
                  Continuer avec Google
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode("email")}
                  className="btn-3d-secondary w-full max-w-[340px] mx-auto py-3.5 rounded-full text-sm sm:text-base font-semibold gap-2.5 flex items-center justify-center cursor-pointer"
                >
                  <Mail className="h-5 w-5 text-slate-600" />
                  Continuer avec l'e-mail
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setSignUp(!signUp)}
                    className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {signUp
                      ? "Vous avez déjà un compte ? Se connecter"
                      : "Pas encore de compte ? S'inscrire gratuitement"}
                  </button>
                </div>
              </div>
            ) : (
              /* Mode formulaire Email */
              <form onSubmit={submitEmail} className="space-y-3.5">
                <button
                  type="button"
                  onClick={() => setAuthMode("providers")}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1 flex items-center gap-1 cursor-pointer"
                >
                  ← Retour aux options
                </button>

                {signUp && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Votre nom"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900 bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse e-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900 bg-white"
                  />
                  {signUp && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Minimum 8 caractères.
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-3d-primary w-full max-w-[340px] mx-auto py-3.5 rounded-full text-sm sm:text-base font-semibold gap-2 flex items-center justify-center cursor-pointer"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {signUp ? "Créer mon compte" : "Se connecter"}
                  </button>
                </div>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSignUp(!signUp);
                      setMessage(null);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {signUp
                      ? "Vous avez déjà un compte ? Se connecter"
                      : "Pas de compte ? Créer mon compte gratuitement"}
                  </button>
                </div>
              </form>
            )}

            {/* Message d'erreur ou d'état */}
            {message && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs text-center font-medium ${
                  message.startsWith("Compte")
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {message}
              </div>
            )}

            <p className="mt-5 text-center text-[11px] text-slate-400">
              En continuant, vous acceptez nos{" "}
              <a href="/conditions" className="underline hover:text-slate-600">
                Conditions
              </a>{" "}
              et notre{" "}
              <a href="/confidentialite" className="underline hover:text-slate-600">
                Politique de confidentialité
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
