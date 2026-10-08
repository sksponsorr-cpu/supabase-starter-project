import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLanding, type LandingContent } from "@/lib/landing.functions";
import { VideoTile } from "@/components/samflash/VideoTile";

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
    return () => io.disconnect();
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

/** Vidéo de présentation : démarre (muette) quand elle est visible, se met en pause sinon. */
function IntroVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
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
  }, [src]);
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-3xl bg-black object-contain"
      style={{ boxShadow: "0 30px 80px -20px oklch(0.6 0.2 265 / 0.55), 0 0 0 1px oklch(1 0 0 / 0.08)" }}
    />
  );
}

/** Carrousel « coverflow » : les vidéos pivotent en 3D selon leur distance au centre. */
function Coverflow({ items }: { items: LandingContent["videos"] }) {
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
        <figure
          key={v.url}
          className="w-44 shrink-0 snap-center space-y-2 transition-[opacity] duration-150"
          style={{ willChange: "transform, opacity" }}
        >
          <VideoTile
            src={v.url}
            className="aspect-[9/16] w-full rounded-2xl bg-black object-cover shadow-2xl ring-1 ring-white/10"
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

/** Section publique sous l'accueil : présentation, vidéos, questions fréquentes. */
export function LandingSection() {
  const load = useServerFn(getLanding);
  const [c, setC] = useState<LandingContent | null>(null);

  useEffect(() => {
    load()
      .then(setC)
      .catch(() => undefined);
  }, [load]);

  if (!c) return null;
  const empty = !c.title && !c.text && !c.introVideo && c.videos.length === 0 && c.faq.length === 0;
  if (empty) return null;

  return (
    <section className="relative mx-auto mt-6 w-full max-w-md space-y-16 pb-16 pt-6">
      <Orbs />

      <div aria-hidden className="flex justify-center">
        <span className="flex h-10 w-6 items-start justify-center rounded-full border border-white/30 pt-2">
          <span className="h-2 w-1 animate-bounce rounded-full bg-white/70" />
        </span>
      </div>

      {(c.title || c.text) && (
        <Reveal className="text-center">
          {c.title && (
            <h2 className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
              {c.title}
            </h2>
          )}
          {c.text && <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{c.text}</p>}
        </Reveal>
      )}

      {c.introVideo && (
        <ScrollTilt>
          <IntroVideo src={c.introVideo} />
        </ScrollTilt>
      )}

      {c.videos.length > 0 && (
        <Reveal>
          <Coverflow items={c.videos} />
        </Reveal>
      )}

      {c.faq.length > 0 && (
        <div className="space-y-3">
          {c.faq.map((f, i) => (
            <Reveal key={f.q} delay={i * 80}>
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
      )}
    </section>
  );
}
