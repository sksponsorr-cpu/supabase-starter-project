import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, Sparkles, X } from "lucide-react";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/remplacement-personnages")({
  component: RemplacementPersonnagesPage,
});

type CloneData = {
  videoUrl: string;
  seconds: number;
  photo?: string | null;
  photos?: string[];
  prompt?: string;
};

function RemplacementPersonnagesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CloneData | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sf:clone-prefill");

      if (!raw) {
        toast.error(
          "Aucun modèle sélectionné. Reviens au studio et sélectionne le modèle."
        );
        return;
      }

      const parsed = JSON.parse(raw) as CloneData;

      if (!parsed.videoUrl) {
        toast.error("Le modèle vidéo est introuvable.");
        return;
      }

      setData(parsed);
      setPhotos(
        Array.isArray(parsed.photos)
          ? parsed.photos
          : parsed.photo
            ? [parsed.photo]
            : []
      );
      setPrompt(parsed.prompt ?? "");
    } catch {
      toast.error("Impossible de charger le modèle vidéo.");
    } finally {
      setLoading(false);
    }
  }, []);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, 3 - photos.length));

    const read = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Lecture impossible"));

        reader.onerror = () => reject(new Error("Lecture impossible"));
        reader.readAsDataURL(file);
      });

    try {
      const loaded = await Promise.all(selected.map(read));

      setPhotos((current) => [...current, ...loaded].slice(0, 3));
    } catch {
      toast.error(
        "Impossible de lire une photo. Essaie une image plus légère."
      );
    }
  };

  const launch = () => {
    if (!data || photos.length === 0) {
      toast.error("Ajoute au moins une photo.");
      return;
    }

    try {
      sessionStorage.setItem(
        "sf:clone-prefill",
        JSON.stringify({
          ...data,
          photos,
          photo: photos[0],
          prompt: prompt.trim(),
        })
      );

      void navigate({ to: "/app" });
    } catch {
      toast.error(
        "Les photos sont trop volumineuses. Essaie des images plus légères."
      );
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090910] p-8 text-white">
        Chargement…
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#090910] p-6 text-white">
        <button onClick={() => void navigate({ to: "/app" })}>
          Retour au studio
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090910] px-4 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => void navigate({ to: "/app" })}
          className="mb-4 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
        >
          <ArrowLeft size={16} />
          Retour au studio
        </button>

        <h1 className="mb-2 text-2xl font-bold">Recréer la vidéo</h1>

        <p className="mb-4 text-sm text-white/60">
          Ajoute les photos de référence puis lance la préparation dans le
          studio.
        </p>

        <video
          src={data.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="mb-5 block w-full rounded-2xl bg-black object-contain"
          style={{
            height: "55vh",
            minHeight: 260,
            maxHeight: 460,
          }}
        />

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="font-semibold">
            Photos des personnages (jusqu’à 3)
          </h2>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                <img
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />

                <button
                  type="button"
                  onClick={() =>
                    setPhotos((current) =>
                      current.filter((_, photoIndex) => photoIndex !== index)
                    )
                  }
                  className="absolute right-1 top-1 rounded-full bg-black/80 p-1"
                  aria-label="Retirer"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {photos.length < 3 && (
              <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 text-xs text-white/60">
                <ImagePlus size={24} />
                Ajouter une photo

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void addPhotos(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <label
            className="mt-4 block text-sm font-medium"
            htmlFor="clone-prompt"
          >
            Instructions
          </label>

          <textarea
            id="clone-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={500}
            rows={4}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-[#c8ff00]"
          />

          <p className="mt-2 text-xs text-white/50">
            Seedance 2.5 · 720p · 9:16 · 30 secondes (durée disponible la plus
            proche de 26 s)
          </p>
        </section>

        <button
          type="button"
          onClick={launch}
          disabled={!photos.length || !prompt.trim()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#c8ff00] py-4 font-bold text-black disabled:opacity-40"
        >
          <Sparkles size={18} />
          Préparer la génération dans le studio
        </button>

        <p className="mt-3 text-center text-xs text-white/45">
          Le studio appliquera son système habituel de crédits. Vérifie les
          paramètres et le coût affiché avant de lancer la génération.
        </p>
      </div>
    </main>
  );
            }
