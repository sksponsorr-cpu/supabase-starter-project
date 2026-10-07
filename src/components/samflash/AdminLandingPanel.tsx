import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLanding, setLanding } from "@/lib/landing.functions";
import { listRecentGenerations } from "@/lib/admin.functions";
import { toast } from "@/lib/toast";

const box = "w-full rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm outline-none focus:border-primary";
const small = "flex-1 rounded-full bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground";

type Gen = { id: string; prompt: string; media_type: string; status: string; media_url: string | null };
// Les liens signés Supabase expirent : seuls les liens permanents (Cloudflare R2) sont proposés.
const temporary = (u: string) => /\/object\/sign\/|token=/.test(u);

/** Contenu affiché sous l'accueil : vidéo de présentation, vidéos, questions fréquentes. */
export function AdminLandingPanel() {
  const load = useServerFn(getLanding);
  const save = useServerFn(setLanding);
  const listGens = useServerFn(listRecentGenerations);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [intro, setIntro] = useState("");
  const [videos, setVideos] = useState("");
  const [faq, setFaq] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [gens, setGens] = useState<Gen[]>([]);

  useEffect(() => {
    load()
      .then((d) => {
        setTitle(d.title);
        setText(d.text);
        setIntro(d.introVideo);
        setVideos(d.videos.map((v) => `${v.url} | ${v.caption}`).join("\n"));
        setFaq(d.faq.map((f) => `${f.q} | ${f.a}`).join("\n"));
      })
      .catch(() => undefined);
  }, [load]);

  const togglePicker = async () => {
    setOpen((v) => !v);
    if (gens.length > 0) return;
    try {
      setGens((await listGens()) as unknown as Gen[]);
    } catch {
      toast.error("Impossible de charger vos vidéos.");
    }
  };
  const usable = gens.filter((g) => g.media_type === "video" && g.media_url && g.status !== "error");
  const addVideo = (g: Gen) =>
    setVideos((v) => `${v ? v + "\n" : ""}${g.media_url} | ${g.prompt.replace(/\|/g, " ").slice(0, 40)}`);

  const split = (line: string) => {
    const i = line.indexOf("|");
    return i < 0 ? [line.trim(), ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  };
  const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await save({
        data: {
          title,
          text,
          introVideo: intro,
          videos: lines(videos).map((l) => ({ url: split(l)[0]!, caption: split(l)[1]! })),
          faq: lines(faq).map((l) => ({ q: split(l)[0]!, a: split(l)[1]! })),
        },
      });
      if (r.ok) toast.success("Page d'accueil enregistrée.");
      else toast.error(r.message);
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Page d'accueil</h2>
      <p className="text-xs text-muted-foreground">
        Choisissez vos vidéos ci-dessous ou collez un lien https. Laissez tout vide pour masquer la section.
      </p>
      <input className={box} placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={box} rows={2} placeholder="Description courte" value={text} onChange={(e) => setText(e.target.value)} />

      <button
        type="button"
        onClick={togglePicker}
        className="w-full rounded-full border border-primary/60 py-3 text-sm font-medium"
      >
        {open ? "Fermer mes vidéos" : "Choisir parmi mes vidéos"}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3">
          {usable.length === 0 && <p className="col-span-2 text-xs text-muted-foreground">Aucune vidéo trouvée.</p>}
          {usable.map((g) => (
            <div key={g.id} className="space-y-2">
              <video
                src={`${g.media_url}#t=0.1`}
                preload="metadata"
                muted
                playsInline
                className="aspect-[9/16] w-full rounded-xl bg-black object-cover"
              />
              {temporary(g.media_url!) ? (
                <p className="text-[11px] text-amber-500">Lien temporaire : non utilisable.</p>
              ) : (
                <div className="flex gap-1">
                  <button type="button" className={small} onClick={() => setIntro(g.media_url!)}>
                    Présentation
                  </button>
                  <button type="button" className={small} onClick={() => addVideo(g)}>
                    Ajouter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <input className={box} placeholder="Vidéo de présentation (https://…)" value={intro} onChange={(e) => setIntro(e.target.value)} />
      <textarea
        className={box}
        rows={5}
        placeholder={"Une vidéo par ligne :\nhttps://…/video1.mp4 | Légende"}
        value={videos}
        onChange={(e) => setVideos(e.target.value)}
      />
      <textarea
        className={box}
        rows={5}
        placeholder={"Une question par ligne :\nCombien ça coûte ? | Réponse"}
        value={faq}
        onChange={(e) => setFaq(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </section>
  );
}
