import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLanding, setLanding, uploadLandingVideo, presignLandingUpload } from "@/lib/landing.functions";
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
  const upload = useServerFn(uploadLandingVideo);
  const presign = useServerFn(presignLandingUpload);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [intro, setIntro] = useState("");
  const [videos, setVideos] = useState("");
  const [faq, setFaq] = useState("");
  const [showcase, setShowcase] = useState("");
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
        setShowcase((d.showcase ?? []).map((v) => `${v.cat} | ${v.url} | ${v.caption}`).join("\n"));
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

  const putWithProgress = (url: string, file: File) =>
    new Promise<void>((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("PUT", url);
      x.setRequestHeader("Content-Type", file.type);
      x.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(String(x.status))));
      x.onerror = () => reject(new Error("réseau"));
      x.send(file);
    });

  const pickFile = async (file: File | undefined, target: "intro" | "list") => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      let link: string;
      if (file.size <= 20 * 1024 * 1024) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await upload({ data: fd });
        if (!r.ok) return void toast.error(r.message);
        link = r.url;
      } else {
        const r = await presign({ data: { type: file.type, size: file.size } });
        if (!r.ok) return void toast.error(r.message);
        try {
          await putWithProgress(r.uploadUrl, file);
        } catch {
          return void toast.error("Envoi refusé par Cloudflare R2 : vérifiez les règles CORS du bucket (autoriser PUT).");
        }
        link = r.publicUrl;
      }
      if (target === "intro") setIntro(link);
      else setVideos((v) => `${v ? v + "\n" : ""}${link} | ${file.name.replace(/\|/g, " ").slice(0, 40)}`);
      toast.success("Vidéo envoyée. Pensez à enregistrer.");
    } catch {
      toast.error("Envoi impossible. Réessayez avec une connexion stable.");
    } finally {
      setUploading(false);
    }
  };

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
          showcase: lines(showcase).map((l) => {
            const parts = l.split("|").map((x) => x.trim());
            return { cat: parts[0] ?? "", url: parts[1] ?? "", caption: parts[2] ?? "" };
          }),
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

      <label className="block w-full cursor-pointer rounded-full border border-primary/60 py-3 text-center text-sm font-medium">
        {uploading ? `Envoi en cours… ${progress}%` : "Importer la vidéo de présentation depuis ma galerie"}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            void pickFile(e.target.files?.[0], "intro");
            e.target.value = "";
          }}
        />
      </label>
      <label className="block w-full cursor-pointer rounded-full border border-primary/60 py-3 text-center text-sm font-medium">
        {uploading ? `Envoi en cours… ${progress}%` : "Ajouter une vidéo à la liste depuis ma galerie"}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            void pickFile(e.target.files?.[0], "list");
            e.target.value = "";
          }}
        />
      </label>
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
        placeholder={"Exemples créateurs, une par ligne :\npub | https://…/exemple.mp4 | Publicité TikTok\nclone | https://…/clone.mp4 | Clonage\navatar | https://…/avatar.mp4 | Avatar\nscene | https://…/scene.mp4 | Mise en scène\n(catégories : pub, clone, avatar, scene)"}
        value={showcase}
        onChange={(e) => setShowcase(e.target.value)}
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
