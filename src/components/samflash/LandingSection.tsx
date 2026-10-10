import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLanding, type LandingContent } from "@/lib/landing.functions";
import { Volume2, VolumeX, Check } from "lucide-react";
import { formatDuration, PLAN_VIDEO_SECONDS } from "@/lib/plans";

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Apparition douce (fondu + montée) quand l'élément entre à l'écran. */
function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) return setShown(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    const t = window.setTimeout(() => setShown(true), 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  const style: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : "translateY(28px)",
    filter: shown ? "none" : "blur(6px)",
    transition: `opacity .8s ease ${delay}ms, transform .8s cubic-bezier(.2,.8,.2,1) ${delay}ms, filter .8s ease ${delay}ms`,
  };
  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}

/** Cadre 3D : il se redresse et grandit au fil du défilement. */
function ScrollTilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh - r.top) / (vh * 0.85));
      const e = 1 - Math.pow(1 - p, 3);
      el.style.transform = `perspective(900px) rotateX(${(1 - e) * 24}deg) translateY(${(1 - e) * 50}px) scale(${0.88 + 0.12 * e})`;
      el.style.opacity = String(0.25 + 0.75 * e);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} style={{ transformOrigin: "50% 100%", willChange: "transform, opacity" }}>
      {children}
    </div>
  );
}

/** Vidéo en aperçu seulement : pas de barre de lecture, pas de téléchargement. Un appui active ou coupe le son. */
function PreviewVideo({
  src,
  sound,
  onToggle,
  className,
}: {
  src: string;
  sound: boolean;
  onToggle: () => void;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, failed]);
  useEffect(() => {
    if (ref.current) ref.current.muted = !sound;
  }, [sound]);
  if (failed) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={sound ? "Couper le son" : "Activer le son"}
      className={`relative block overflow-hidden border-[5px] border-black/70 bg-black shadow-2xl ring-1 ring-white/10 ${className}`}
    >
      <video
        ref={ref}
        src={src.includes("#") ? src : `${src}#t=0.001`}
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        draggable={false}
        onError={() => setFailed(true)}
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-none h-full w-full object-cover"
      />
      <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
        {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </span>
    </button>
  );
}

/** Carrousel « coverflow » : les vidéos pivotent en 3D selon leur distance au centre. Défilement manuel. */
function Coverflow({
  items,
  sound,
  setSound,
}: {
  items: LandingContent["videos"];
  sound: string | null;
  setSound: (u: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const update = () => {
      const b = box.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      Array.from(box.children).forEach((c) => {
        const el = c as HTMLElement;
        const r = el.getBoundingClientRect();
        const d = clamp((r.left + r.width / 2 - cx) / (b.width / 2), -1, 1);
        if (reduced()) return;
        el.style.transform = `rotateY(${-d * 38}deg) scale(${1 - Math.abs(d) * 0.14})`;
        el.style.opacity = String(1 - Math.abs(d) * 0.45);
      });
    };
    update();
    box.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      box.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);
  return (
    <div
      ref={ref}
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[calc(50%-5.5rem)] py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ perspective: "900px" }}
    >
      {items.map((v) => (
        <figure key={v.url} className="w-44 shrink-0 snap-center space-y-2" style={{ willChange: "transform, opacity" }}>
          <PreviewVideo
            src={v.url}
            sound={sound === v.url}
            onToggle={() => setSound(sound === v.url ? null : v.url)}
            className="aspect-[9/16] w-full rounded-[2rem]"
          />
          {v.caption && <figcaption className="text-center text-xs text-muted-foreground">{v.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/** Halos flous en arrière-plan qui glissent à un autre rythme que la page (parallaxe). */
function Orbs() {
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      if (a.current) a.current.style.transform = `translate3d(0, ${y * -0.15}px, 0)`;
      if (b.current) b.current.style.transform = `translate3d(0, ${y * 0.1}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full overflow-hidden">
      <div ref={a} className="absolute -left-24 top-40 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <div ref={b} className="absolute -right-24 top-[28rem] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
    </div>
  );
}

const PLAN_CARDS: { name: string; seconds: number; label?: string; items: string[] }[] = [
  {
    name: "Découverte",
    seconds: PLAN_VIDEO_SECONDS.free,
    label: "Offre d'essai",
    items: ["1 vidéo offerte (8 secondes maximum)", "2 images offertes", "Un compte gratuit par appareil"],
  },
  {
    name: "Super grok",
    seconds: PLAN_VIDEO_SECONDS.super_grok_monthly,
    items: [
      "Images et vidéos IA époustouflantes",
      "Vidéos HD 720p de 6 secondes",
      "Import de plus de fichiers",
      "Des réponses fulgurantes",
    ],
  },
  {
    name: "Super grok plus",
    seconds: PLAN_VIDEO_SECONDS.super_grok_plus,
    items: ["Tout dans Super grok", "Vidéo 1080p en création", "Générations prioritaires", "Crédits mensuels étendus"],
  },
  {
    name: "Super grok heavy",
    seconds: PLAN_VIDEO_SECONDS.superhearly_monthly,
    items: [
      "Tout dans Super grok plus",
      "Vidéo native 1080p en création",
      "Utilisation la plus élevée, vitesse maximale",
      "Résolution des problèmes les plus complexes",
      "Accès anticipé aux nouveaux modèles",
    ],
  },
];

const DEFAULT_FAQ = [
  {
    q: "C'est quoi Sam flash 2.0 ?",
    a: "Une application pour créer des images et des vidéos avec l'IA, depuis ton mobile : tu décris ton idée, elle la transforme en quelques secondes.",
  },
  {
    q: "Puis-je essayer gratuitement ?",
    a: "Oui. À l'inscription, tu reçois une vidéo (8 secondes maximum) et 2 images offertes, sans abonnement. L'offre d'essai est limitée à un compte par appareil.",
  },
  {
    q: "Combien de vidéo puis-je créer par jour ?",
    a: `Avec un abonnement, cela dépend de ta formule, sur 24 h glissantes : Super grok ${formatDuration(PLAN_VIDEO_SECONDS.super_grok_monthly)}, Super grok plus ${formatDuration(PLAN_VIDEO_SECONDS.super_grok_plus)}, Super grok heavy ${formatDuration(PLAN_VIDEO_SECONDS.superhearly_monthly)}.`,
  },
  {
    q: "Quelle qualité de vidéo ?",
    a: "Super grok crée des vidéos HD 720p de 6 secondes. Super grok plus et heavy passent à la vidéo 1080p.",
  },
  {
    q: "Puis-je annuler mon abonnement ?",
    a: "Oui, à tout moment. La facturation est mensuelle, et Super grok existe aussi en formule annuelle.",
  },
  {
    q: "Où retrouver mes créations ?",
    a: "Elles restent dans ton historique, une fois connecté à ton compte.",
  },
];

/** Section publique sous l'accueil : présentation, vidéos, abonnements, questions fréquentes. */
export function LandingSection() {
  const load = useServerFn(getLanding);
  const [c, setC] = useState<LandingContent | null>(null);
  const [sound, setSound] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then(setC)
      .catch(() => setC({ title: "", text: "", introVideo: "", videos: [], faq: [] }));
  }, [load]);

  if (!c) return null;
  const hasVideos = !!c.introVideo || c.videos.length > 0;
  const title = c.title || "Des vidéos et des images IA, créées en quelques secondes";
  const text =
    c.text ||
    `Décris ton idée, Sam flash 2.0 la transforme en vidéo ou en image depuis ton mobile.${hasVideos ? " Appuie sur une vidéo pour la regarder, avec le son." : ""}`;
  const faq = c.faq.length > 0 ? c.faq : DEFAULT_FAQ;

  return (
    <section className="relative mx-auto mt-6 w-full max-w-md space-y-16 pb-16 pt-6">
      <Orbs />

      <div aria-hidden className="flex justify-center">
        <span className="flex h-10 w-6 items-start justify-center rounded-full border border-[#0b1220]/30 bg-white/70 pt-2">
          <span className="h-2 w-1 animate-bounce rounded-full bg-[#0b1220]/60" />
        </span>
      </div>

      <Reveal className="text-center">
        <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Sam flash 2.0
        </span>
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-[#0b1220]">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[#4b5563]">{text}</p>
      </Reveal>

      {c.introVideo && (
        <ScrollTilt>
          <PreviewVideo
            src={c.introVideo}
            sound={sound === c.introVideo}
            onToggle={() => setSound(sound === c.introVideo ? null : c.introVideo)}
            className="aspect-video w-full rounded-3xl"
          />
        </ScrollTilt>
      )}

      {c.videos.length > 0 && (
        <div className="space-y-6">
          <Reveal className="text-center">
            <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Fait avec Sam flash 2.0
            </span>
            <h3 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-[#0b1220]">
              Voici ce que tu peux créer en quelques secondes
            </h3>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Ces vidéos ont été fabriquées sur Sam flash 2.0, telles quelles. Appuie pour regarder, avec le son.
            </p>
          </Reveal>
          <Reveal>
            <Coverflow items={c.videos} sound={sound} setSound={setSound} />
          </Reveal>
          <Reveal className="text-center">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full rounded-full bg-primary py-4 text-[16px] font-semibold text-primary-foreground"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Créer ma première vidéo
            </button>
            <p className="mt-3 text-xs text-muted-foreground">Essaie gratuitement : une vidéo et 2 images offertes.</p>
          </Reveal>
        </div>
      )}

      <div className="space-y-4">
        <Reveal className="text-center">
          <h3 className="text-2xl font-semibold tracking-tight">Ce que tu reçois selon ton abonnement</h3>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Choisis la formule qui te convient. Tu peux changer ou annuler à tout moment.
          </p>
        </Reveal>
        {PLAN_CARDS.map((p, i) => (
          <Reveal key={p.name} delay={i * 80}>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.label ?? `${formatDuration(p.seconds)} de vidéo / jour`}</p>
              </div>
              <ul className="mt-3 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
        <Reveal>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-full rounded-full bg-primary py-4 text-[16px] font-semibold text-primary-foreground"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Commencer
          </button>
        </Reveal>
      </div>

      <div className="space-y-3">
        <Reveal className="text-center">
          <h3 className="text-2xl font-semibold tracking-tight">Questions fréquentes</h3>
        </Reveal>
        {faq.map((f, i) => (
          <Reveal key={f.q} delay={i * 60}>
            <details className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl transition-colors open:bg-white/10">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                {f.q}
                <span className="ml-3 text-lg leading-none transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
