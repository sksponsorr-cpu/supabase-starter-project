import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Mail,
  Loader2,
  Sparkles,
  Film,
  CheckCircle2,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Wand2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import logoAsset from "@/assets/sam-flash-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { LandingBackground } from "@/components/samflash/LandingBackground";
import { getLanding, type LandingContent } from "@/lib/landing.functions";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/components/Turnstile";

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
          "Transformez une idée en vidéo prête à publier avec Sam flash 2.0. Vidéos de démonstration et génération IA ultra-rapide d'images et vidéos.",
      },
      {
        property: "og:title",
        content: "Sam flash 2.0 — Transformez une idée en vidéo prête à publier",
      },
      {
        property: "og:description",
        content:
          "Générez des vidéos et images IA en quelques secondes. Regardez les vidéos de démonstration créées par notre communauté.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const DEFAULT_LANDING: LandingContent = {
  title: "Transformez une idée en vidéo prête à publier",
  text: "Décrivez votre idée, Sam flash 2.0 la transforme en vidéo ou en image depuis votre mobile ou ordinateur.",
  introVideo:
    "https://pub-81238d7d2815461880e4a22dc5a71d16.r2.dev/landing/694ad18f-998f-4d7c-b1d2-8ee37b3f7dd2.mp4",
  videos: [
    {
      url: "https://pub-81238d7d2815461880e4a22dc5a71d16.r2.dev/grok_video_2026-08-26-17-09-07.mp4",
      caption: "Création IA cinématique",
    },
    {
      url: "https://pub-81238d7d2815461880e4a22dc5a71d16.r2.dev/grok_video_2026-08-26-18-27-14.mp4",
      caption: "Mouvement fluide 60fps",
    },
    {
      url: "https://pub-81238d7d2815461880e4a22dc5a71d16.r2.dev/grok_video_2026-08-26-17-06-26.mp4",
      caption: "Rendu photo-réaliste",
    },
  ],
  faq: [],
};

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

  // Chargement du contenu de landing depuis le serveur / Supabase app_settings
  const fetchLanding = useServerFn(getLanding);
  const [landingContent, setLandingContent] = useState<LandingContent>(DEFAULT_LANDING);

  useEffect(() => {
    fetchLanding()
      .then((data) => {
        if (data) {
          setLandingContent({
            title: data.title || DEFAULT_LANDING.title,
            text: data.text || DEFAULT_LANDING.text,
            introVideo: data.introVideo || DEFAULT_LANDING.introVideo,
            videos: data.videos && data.videos.length > 0 ? data.videos : DEFAULT_LANDING.videos,
            faq: data.faq && data.faq.length > 0 ? data.faq : DEFAULT_LANDING.faq,
          });
        }
      })
      .catch(() => {
        // En cas d'erreur réseau, les vidéos par défaut restent affichées
      });
  }, [fetchLanding]);

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  // État de la vidéo d'introduction
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [introSound, setIntroSound] = useState(false);

  // IntersectionObserver pour la vidéo d'introduction (lecture automatique quand visible)
  useEffect(() => {
    const el = introVideoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void el.play().catch(() => {});
          setIntroPlaying(true);
        } else {
          el.pause();
          setIntroPlaying(false);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [landingContent.introVideo]);

  // État du carrousel de vidéos communautaires
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [activeSoundUrl, setActiveSoundUrl] = useState<string | null>(null);

  // Défilement automatique continu du carrousel
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    let animId: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      if (!isCarouselHovered && el) {
        // Vitesse douce : environ 35px par seconde
        el.scrollLeft += delta * 0.035;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
          el.scrollLeft = 0;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isCarouselHovered, landingContent.videos]);

  // Apparition des éléments au défilement (Scroll Reveal / Fade Up)
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal-on-scroll");
    if (!elements.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollCarousel = (direction: "left" | "right") => {
    const el = carouselRef.current;
    if (!el) return;
    const offset = direction === "left" ? -280 : 280;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  const toggleCarouselSound = (videoUrl: string) => {
    setActiveSoundUrl((prev) => (prev === videoUrl ? null : videoUrl));
  };

  const scrollToSection = (id: string) => (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  const toggleIntroSound = () => {
    setIntroSound((prev) => {
      const nextVal = !prev;
      if (introVideoRef.current) {
        introVideoRef.current.muted = !nextVal;
      }
      return nextVal;
    });
  };

  const toggleIntroPlay = () => {
    if (introVideoRef.current) {
      if (introVideoRef.current.paused) {
        void introVideoRef.current.play();
        setIntroPlaying(true);
      } else {
        introVideoRef.current.pause();
        setIntroPlaying(false);
      }
    }
  };

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
        if (error.message.includes("User already registered") || (error as { status?: number }).status === 422) {
          setMessage("Cet e-mail est déjà utilisé. Veuillez vous connecter.");
        } else if (error.message.includes("Password should be")) {
          setMessage("Le mot de passe doit contenir au moins 8 caractères.");
        } else {
          setMessage("Inscription impossible. Vérifiez vos informations et réessayez.");
        }
      } else if (data.session) {
        goNext();
      } else {
        setMessage("Compte créé. Vérifiez votre boîte de réception pour confirmer votre inscription.");
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
      setMessage("Identifiants invalides. Vérifiez votre adresse et mot de passe.");
    } else {
      goNext();
    }
  };

  // Liste des vidéos dédoublée pour un défilement infini et fluide
  const displayVideos =
    landingContent.videos.length > 0
      ? [...landingContent.videos, ...landingContent.videos]
      : DEFAULT_LANDING.videos;

  return (
    <div
      className="relative min-h-screen text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground font-sans bg-background"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* 3. Arrière-plan 3D animé et discret */}
      <LandingBackground />

      {/* Navigation supérieure */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/60 transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <img
              src={logoAsset}
              alt="Logo Sam flash 2.0"
              className="h-9 w-9 rounded-full object-cover shadow-xs transition-transform group-hover:scale-105"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-foreground">
                Sam flash
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/20 text-indigo-300 border border-primary/30">
                2.0
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a
              href="#demonstration"
              onClick={scrollToSection("demonstration")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Démonstration
            </a>
            <a
              href="#comment-ca-marche"
              onClick={scrollToSection("comment-ca-marche")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Comment ça marche
            </a>
            <a
              href="#tarifs"
              onClick={scrollToSection("tarifs")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Tarifs
            </a>
            <a
              href="#faq"
              onClick={scrollToSection("faq")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
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
          {/* Badge haut : Création vidéo IA pour les créateurs */}
          <div className="reveal-on-scroll inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-primary/20 border border-primary/40 text-primary-foreground shadow-sm mb-6 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Création vidéo IA pour les créateurs</span>
          </div>

          {/* Titre Principal H1 */}
          <h1 className="reveal-on-scroll text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]">
            Transformez une idée en{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200">
              vidéo prête à publier
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="reveal-on-scroll mt-6 text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Décrivez votre vision en quelques mots. Sam flash 2.0 génère une vidéo cinématique ou une image haute fidélité en quelques secondes, prête pour vos réseaux sociaux ou vos projets.
          </p>

          {/* Encart Essai : 2 000 FCFA */}
          <div className="reveal-on-scroll mt-6 inline-flex flex-col items-center gap-1 rounded-2xl border border-primary/30 bg-primary/10 px-6 py-3 text-center backdrop-blur-md shadow-lg shadow-indigo-950/40">
            <p className="text-sm font-bold text-foreground">Essai : 2 000 FCFA · 40 crédits</p>
            <p className="text-xs text-muted-foreground">Soit 8 vidéos de 5 secondes en 480p · Sans carte bancaire</p>
          </div>

          {/* Boutons d'action centrés avec largeur max ~340px et effet 3D */}
          <div className="reveal-on-scroll mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl mx-auto">
            <button
              type="button"
              onClick={() => openAuth(true)}
              className="btn-3d-primary btn-float-gentle w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold gap-2 cursor-pointer text-center inline-flex items-center justify-center"
            >
              Créer mon compte gratuitement
              <ArrowRight className="h-4 w-4 inline ml-1.5" />
            </button>

            <button
              type="button"
              onClick={scrollToSection("demonstration")}
              className="btn-3d-secondary w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold text-center cursor-pointer inline-flex items-center justify-center"
            >
              Voir les vidéos de démonstration
            </button>
          </div>

          {/* Réassurance sous boutons */}
          <div className="reveal-on-scroll mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              1 vidéo & 2 images offertes
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Sans carte bancaire
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Sur mobile & ordinateur
            </span>
          </div>
        </div>
      </section>

      {/* Section Vidéos de démonstration */}
      <section id="demonstration" className="px-4 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          {/* En-tête de section */}
          <div className="reveal-on-scroll max-w-3xl mx-auto text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-indigo-300">
              Démonstration en direct
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Découvrez Sam flash en action
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Voyez comment fonctionne la plateforme et explorez les différentes vidéos créées par nos utilisateurs qui défilent et se jouent automatiquement.
            </p>
          </div>

          {/* 1. Vidéo de démonstration principale : Comment fonctionne Sam Flash */}
          {landingContent.introVideo && (
            <div className="reveal-on-scroll max-w-3xl mx-auto mb-16">
              <div className="relative rounded-3xl overflow-hidden border border-border/80 bg-card/60 backdrop-blur-md shadow-2xl">
                {/* Barre supérieure style application */}
                <div className="h-10 bg-secondary/80 border-b border-border/60 px-4 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground bg-secondary px-3 py-1 rounded-md border border-border/60">
                    <Film className="h-3 w-3 text-indigo-400" />
                    Démonstration vidéo — Fonctionnement de Sam Flash
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      HD
                    </span>
                  </div>
                </div>

                {/* Vidéo MP4 interactive */}
                <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
                  <video
                    ref={introVideoRef}
                    src={
                      landingContent.introVideo.includes("#")
                        ? landingContent.introVideo
                        : `${landingContent.introVideo}#t=0.001`
                    }
                    muted={!introSound}
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    draggable={false}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={toggleIntroPlay}
                  />

                  {/* Boutons de contrôle flottants */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    <button
                      type="button"
                      onClick={toggleIntroSound}
                      aria-label={introSound ? "Couper le son" : "Activer le son"}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/15 hover:bg-black/80 transition-colors cursor-pointer shadow-md"
                    >
                      {introSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/90 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 z-10">
                    <button
                      type="button"
                      onClick={toggleIntroPlay}
                      className="flex items-center gap-2 font-medium hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      {introPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Lecture</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] font-mono text-white/70">
                      {introSound ? "Son activé ✓" : "Appuyez pour le son"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Les différentes vidéos de démonstration qui défilent et se jouent d'elles-mêmes */}
          <div className="reveal-on-scroll mt-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-indigo-300">
                  Fait avec Sam flash 2.0
                </span>
                <h3 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Vidéos de démonstration créées par les utilisateurs
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Ces vidéos ont été générées sur la plateforme. Elles défilent et se jouent automatiquement. Touchez une vidéo pour écouter avec le son.
                </p>
              </div>

              {/* Boutons de contrôle fléchés */}
              <div className="flex items-center gap-2 self-end">
                <button
                  type="button"
                  onClick={() => scrollCarousel("left")}
                  aria-label="Vidéos précédentes"
                  className="h-9 w-9 rounded-full border border-border bg-card/90 text-foreground flex items-center justify-center hover:bg-secondary transition-colors shadow-xs cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel("right")}
                  aria-label="Vidéos suivantes"
                  className="h-9 w-9 rounded-full border border-border bg-card/90 text-foreground flex items-center justify-center hover:bg-secondary transition-colors shadow-xs cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Piste de défilement horizontal fluide et automatique */}
            <div
              ref={carouselRef}
              onMouseEnter={() => setIsCarouselHovered(true)}
              onMouseLeave={() => setIsCarouselHovered(false)}
              onTouchStart={() => setIsCarouselHovered(true)}
              onTouchEnd={() => setIsCarouselHovered(false)}
              className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x"
            >
              {displayVideos.map((video, idx) => {
                const isSoundOn = activeSoundUrl === video.url;
                return (
                  <div
                    key={`${video.url}-${idx}`}
                    className="relative w-48 sm:w-56 shrink-0 aspect-[9/16] rounded-3xl overflow-hidden border-2 border-border/80 bg-black shadow-xl group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-primary/50 cursor-pointer snap-start"
                    onClick={() => toggleCarouselSound(video.url)}
                  >
                    {/* Vidéo qui se joue d'elle-même en continu */}
                    <video
                      src={video.url.includes("#") ? video.url : `${video.url}#t=0.001`}
                      muted={!isSoundOn}
                      loop
                      autoPlay
                      playsInline
                      preload="metadata"
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      draggable={false}
                      className="h-full w-full object-cover pointer-events-none"
                    />

                    {/* Badge son flottant */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCarouselSound(video.url);
                      }}
                      aria-label={isSoundOn ? "Couper le son" : "Activer le son"}
                      className={`absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md border transition-all ${
                        isSoundOn
                          ? "bg-primary text-primary-foreground border-primary shadow-md scale-110"
                          : "bg-black/60 text-white/90 border-white/20 hover:bg-black/80"
                      }`}
                    >
                      {isSoundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>

                    {/* Gradient de superposition sombre en bas pour le texte */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end">
                      <span className="text-[11px] font-medium text-white/90 line-clamp-1">
                        {video.caption || "Généré avec Sam flash 2.0"}
                      </span>
                      <span className="text-[10px] text-indigo-300 font-mono">
                        {isSoundOn ? "Son actif 🔊" : "Touchez pour le son"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bouton centré pour inciter à la création */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => openAuth(true)}
                className="btn-3d-primary w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold gap-2 cursor-pointer mx-auto inline-flex items-center justify-center"
              >
                Créer ma première vidéo
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2.5 text-xs text-muted-foreground">
                Essayez gratuitement : une vidéo et 2 images offertes à l'inscription.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Comment ça marche */}
      <section id="comment-ca-marche" className="px-4 py-16 sm:py-20 border-t border-border/60">
        <div className="max-w-5xl mx-auto">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-indigo-300">
              Simplicité absolue
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Comment ça marche
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Trois étapes directes, sans compétences techniques ni montage manuel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="reveal-on-scroll relative rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md p-6 sm:p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:bg-card/80 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-indigo-300">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="font-mono text-2xl font-black text-muted-foreground/30">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Fonctionnalités */}
      <section id="fonctionnalites" className="px-4 py-16 sm:py-20 bg-card/30 border-y border-border/60">
        <div className="max-w-5xl mx-auto">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-indigo-300">
              Fonctionnalités clés
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Tout ce dont vous avez besoin pour vos contenus
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Un studio complet taillé pour la publication immédiate sur tous les réseaux.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="reveal-on-scroll rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-xs hover:border-primary/40 hover:bg-card/80 transition-all"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 text-indigo-300 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Tarifs & Abonnements */}
      <section id="tarifs" className="px-4 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="reveal-on-scroll text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-indigo-300">
              Offres flexibles
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Ce que vous recevez selon votre formule
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Commencez gratuitement, puis choisissez la formule adaptée à votre rythme de création.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLAN_CARDS.map((p) => (
              <div
                key={p.name}
                className={`reveal-on-scroll relative rounded-3xl p-6 flex flex-col justify-between transition-all ${
                  p.highlight
                    ? "border-2 border-primary bg-card/90 shadow-2xl shadow-indigo-950/60 ring-2 ring-primary/40"
                    : "border border-border/70 bg-card/60 backdrop-blur-md shadow-xs hover:border-primary/40 hover:bg-card/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        p.highlight
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground border border-border/50"
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-foreground">{p.name}</h3>
                  <div className="mt-2 text-xs font-semibold text-indigo-300 bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-md inline-block">
                    {p.quota}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>

                  <ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
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
      <section id="faq" className="px-4 py-16 sm:py-20 bg-card/20 border-t border-border/60">
        <div className="max-w-3xl mx-auto">
          <div className="reveal-on-scroll text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-indigo-300">
              Aide & Informations
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Questions fréquentes
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="reveal-on-scroll group rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs transition-colors open:bg-card/90 open:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-foreground">
                  <span>{item.q}</span>
                  <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground font-bold transition-transform duration-200 group-open:rotate-45 group-open:text-indigo-300">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Bannière d'appel à l'action final */}
      <section className="px-4 py-16 sm:py-20">
        <div className="reveal-on-scroll max-w-4xl mx-auto rounded-3xl border border-primary/40 bg-gradient-to-br from-card/90 via-primary/15 to-card/90 p-8 sm:p-14 text-center shadow-2xl backdrop-blur-md">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Prêt à donner vie à vos créations ?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Rejoignez Sam flash 2.0 dès aujourd'hui et réalisez votre première vidéo avec l'intelligence artificielle en quelques secondes.
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => openAuth(true)}
              className="btn-3d-primary w-full max-w-[340px] px-6 py-4 rounded-full text-base sm:text-[17px] font-semibold gap-2 cursor-pointer text-center inline-flex items-center justify-center"
            >
              Créer mon compte gratuitement
              <ArrowRight className="h-4 w-4 inline ml-2" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background/90 py-10 px-4 text-center text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Sam flash 2.0 — Tous droits réservés.</p>
          <div className="flex items-center gap-6 font-medium">
            <Link to="/conditions" className="hover:text-foreground transition-colors underline">
              Conditions
            </Link>
            <Link to="/confidentialite" className="hover:text-foreground transition-colors underline">
              Confidentialité
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors underline">
              Contact
            </Link>
          </div>
        </div>
      </footer>

      {/* Modale d'authentification complète */}
      {authOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl text-foreground">
            {/* Bouton de fermeture */}
            <button
              type="button"
              onClick={closeAuth}
              className="absolute right-4 top-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
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
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {signUp ? "Créer un compte gratuit" : "Se connecter"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
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
                  className="btn-3d-secondary w-full max-w-[340px] mx-auto py-3.5 rounded-full text-sm sm:text-base font-semibold gap-3 flex items-center justify-center cursor-pointer text-foreground"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="text-lg font-bold text-foreground">G</span>
                  )}
                  Continuer avec Google
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode("email")}
                  className="btn-3d-secondary w-full max-w-[340px] mx-auto py-3.5 rounded-full text-sm sm:text-base font-semibold gap-2.5 flex items-center justify-center cursor-pointer text-foreground"
                >
                  <Mail className="h-5 w-5 text-indigo-400" />
                  Continuer avec l'e-mail
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setSignUp(!signUp)}
                    className="text-xs font-semibold text-indigo-400 hover:underline cursor-pointer"
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
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 cursor-pointer"
                >
                  ← Retour aux options
                </button>

                {signUp && (
                  <div>
                    <label className="block text-xs font-medium text-foreground/90 mb-1">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Votre nom"
                      className="w-full rounded-xl border border-border/80 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground bg-secondary/80 placeholder:text-muted-foreground/50"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-foreground/90 mb-1">
                    Adresse e-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full rounded-xl border border-border/80 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground bg-secondary/80 placeholder:text-muted-foreground/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground/90 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border/80 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground bg-secondary/80 placeholder:text-muted-foreground/50"
                  />
                  {signUp && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Minimum 8 caractères.
                    </p>
                  )}
                </div>

                {TURNSTILE_SITE_KEY && (
                  <div className="pt-1">
                    <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
                  </div>
                )}

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
                    className="text-xs font-semibold text-indigo-400 hover:underline cursor-pointer"
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
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-950/60 text-rose-300 border border-rose-500/30"
                }`}
              >
                {message}
              </div>
            )}

            <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
              En continuant, vous acceptez nos{" "}
              <Link to="/conditions" onClick={closeAuth} className="underline hover:text-foreground">
                Conditions
              </Link>{" "}
              et notre{" "}
              <Link to="/confidentialite" onClick={closeAuth} className="underline hover:text-foreground">
                Politique de confidentialité
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
