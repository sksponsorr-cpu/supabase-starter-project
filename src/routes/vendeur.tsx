import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/vendeur")({
  component: EspaceVendeur,
});

type Kind = "images" | "video";
type Product = "physique" | "digital";

const STYLES = [
  { id: "ugc", title: "UGC", desc: "Une vraie personne montre le produit, comme une cliente qui filme.", from: "from-amber-400/40", to: "to-orange-500/20" },
  { id: "demo", title: "Démonstration", desc: "Le produit en action, montré étape par étape.", from: "from-sky-400/40", to: "to-blue-600/20" },
  { id: "avant-apres", title: "Avant / après", desc: "Le problème d'un côté, la solution de l'autre.", from: "from-emerald-400/40", to: "to-teal-600/20" },
  { id: "temoignage", title: "Témoignage", desc: "Un client raconte son expérience face caméra.", from: "from-fuchsia-400/40", to: "to-purple-600/20" },
  { id: "pub-produit", title: "Publicité produit", desc: "Un visuel soigné, lumière douce, fond épuré.", from: "from-violet-400/40", to: "to-indigo-600/20" },
  { id: "promo", title: "Promotion", desc: "Une offre claire, avec un prix et un appel à l'action.", from: "from-rose-400/40", to: "to-red-600/20" },
] as const;

const glass = "rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-500 ease-out";
const pill = "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px] shadow-primary/60 transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98]";
const choice = (on: boolean) =>
  `rounded-2xl border px-4 py-3 text-sm transition-all duration-500 ease-out active:scale-[0.98] ${
    on ? "border-primary/70 bg-primary/15 text-foreground shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
  }`;

/** Espace vendeur : même parcours que l'espace créateur, pensé pour les produits à vendre. */
function EspaceVendeur() {
  const [kind, setKind] = useState<Kind>("video");
  const [product, setProduct] = useState<Product>("physique");
  const [preview, setPreview] = useState<string | null>(null);
  const [style, setStyle] = useState<string>("ugc");
  const [person, setPerson] = useState(true);
  const [format, setFormat] = useState("9:16");
  const [quality, setQuality] = useState("Standard");
  const [voice, setVoice] = useState(false);
  const [desc, setDesc] = useState("");
  const [copied, setCopied] = useState(false);

  const styleName = STYLES.find((s) => s.id === style)?.title ?? "";
  const kindLabel = kind === "video" ? "Vidéo" : "Image";

  const brief = [
    `Type : ${kindLabel}`,
    `Produit : ${product === "physique" ? "Produit physique" : "Produit digital"}`,
    `Personne : ${person ? "Oui" : "Non"}`,
    `Style : ${styleName}`,
    `Format : ${format}`,
    `Qualité : ${quality}`,
    `Langue : Français`,
    `Voix off : ${voice ? "Oui" : "Non"}`,
    desc.trim() ? `Description : ${desc.trim()}` : "",
  ].filter(Boolean).join("\n");

  const onPick = (f: File | undefined) => {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(brief).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute top-[40%] -left-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[100px]" />

      <div className="relative mx-auto max-w-xl space-y-6 px-5 py-10">
        <header className="space-y-2 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Espace vendeur</p>
          <h1 className="text-3xl font-semibold tracking-tight">Qu'allons-nous vendre aujourd'hui ?</h1>
          <p className="text-sm text-muted-foreground">Choisissez le type de publicité : les choix s'adaptent à votre produit.</p>
        </header>

        {/* Type de création */}
        <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-2xl">
          {(["images", "video"] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full py-3 text-sm font-semibold transition-all duration-500 ease-out ${kind === k ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground"}`}>
              {k === "images" ? "Publicités images" : "Publicités vidéo"}
            </button>
          ))}
        </div>

        {/* Produit */}
        <section className={`${glass} space-y-4`}>
          <p className="text-sm font-semibold">Votre produit</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setProduct("physique")} className={choice(product === "physique")}>Produit physique</button>
            <button type="button" onClick={() => setProduct("digital")} className={choice(product === "digital")}>Produit digital</button>
          </div>
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-background/40 text-center transition-colors duration-300 hover:border-primary/50">
            {preview ? (
              <img src={preview} alt="Votre produit" className="h-full w-full object-cover" />
            ) : (
              <span className="px-6 text-sm text-muted-foreground">Ajoutez une photo de votre produit<br /><span className="text-xs">JPG ou PNG</span></span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          </label>
        </section>

        {/* Style */}
        <section className="space-y-3">
          <p className="px-1 text-sm font-semibold">Style de publicité</p>
          <div className="grid grid-cols-2 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`group relative overflow-hidden rounded-3xl border p-4 text-left transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] ${style === s.id ? "border-primary/70 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" : "border-white/10"}`}
              >
                <div className={`mb-3 h-20 rounded-2xl bg-gradient-to-br ${s.from} ${s.to}`} aria-hidden />
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Options */}
        <section className={`${glass} space-y-5`}>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Une personne dans la publicité ?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPerson(true)} className={choice(person)}>Oui</button>
              <button type="button" onClick={() => setPerson(false)} className={choice(!person)}>Non</button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Format</p>
            <div className="grid grid-cols-3 gap-2">
              {["9:16", "1:1", "16:9"].map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} className={choice(format === f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Qualité</p>
            <div className="grid grid-cols-2 gap-2">
              {["Standard", "HD"].map((q) => (
                <button key={q} type="button" onClick={() => setQuality(q)} className={choice(quality === q)}>{q}</button>
              ))}
            </div>
          </div>
          {kind === "video" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Voix off</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setVoice(true)} className={choice(voice)}>Avec voix off</button>
                <button type="button" onClick={() => setVoice(false)} className={choice(!voice)}>Sans voix off</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Décrivez votre offre (facultatif)</p>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex. : promo -20 % ce week-end, livraison à domicile" className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary/60" />
          </div>
        </section>

        {/* Récapitulatif */}
        <section className={`${glass} space-y-4`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Votre publicité</p>
          <pre className="whitespace-pre-wrap rounded-2xl bg-background/50 p-4 text-sm leading-relaxed text-muted-foreground">{brief}</pre>
          <button type="button" onClick={() => void copy()} className={`${pill} w-full`}>{copied ? "Brief copié ✓" : "Créer ma publicité"}</button>
          <p className="text-center text-xs text-muted-foreground">Le brief est copié. Collez-le dans Sam Flash, puis lancez la création.</p>
          <div className="text-center">
            <Link to="/app" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Ouvrir Sam Flash</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
