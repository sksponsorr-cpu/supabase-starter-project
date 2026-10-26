import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, Sparkles, X, Video } from "lucide-react";
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
      const saved = sessionStorage.getItem("sf:clone-prefill");

      if (!saved) {
        toast.error("Aucun modèle vidéo sélectionné.");
        void navigate({ to: "/app", replace: true });
        return;
      }

      const parsed = JSON.parse(saved) as CloneData;

      if (!parsed.videoUrl) {
        toast.error("Le modèle vidéo est introuvable.");
        void navigate({ to: "/app", replace: true });
        return;
      }

      setData(parsed);
      setPhotos(
        Array.isArray(parsed.photos)
          ? parsed.photos
          : parsed.photo
            ? [parsed.photo]
            : [],
      );
      setPrompt(parsed.prompt ?? "");
    } catch {
      toast.error("Impossible de charger les informations du modèle.");
      void navigate({ to: "/app", replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;

    const available = Math.max(0, 3 - photos.length);

    if (available === 0) {
      toast.error("Tu peux ajouter jusqu'à 3 photos.");
      return;
    }

    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, available);

    if (selected.length === 0) {
      toast.error("Sélectionne une image valide.");
      return;
    }

    let completed = 0;
    const results: string[] = [];

    selected.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          results.push(reader.result);
        }

        completed++;

        if (completed === selected.length) {
          setPhotos((current) => [...current, ...results].slice(0, 3));
        }
      };

      reader.onerror = () => {
        completed++;

        if (completed === selected.length && results.length > 0) {
          setPhotos((current) => [...current, ...results].slice(0, 3));
        }
      };

      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
  };

  const prepareRecreation = () => {
    if (!data) return;

    if (photos.length === 0) {
      toast.error("Ajoute au moins une photo pour continuer.");
      return;
    }

    const payload = {
      ...data,
      photos,
      photo: photos[0] ?? null,
      prompt: prompt.trim(),
    };

    try {
      sessionStorage.setItem("sf:clone-prefill", JSON.stringify(payload));

      toast.success(
        "Informations enregistrées. La génération doit encore être reliée au service vidéo.",
      );
    } catch {
      toast.error(
        "Les photos sont trop volumineuses pour le stockage du navigateur. Essaie avec des images plus légères.",
      );
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090910] text-white">
        Chargement du modèle vidéo…
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="min-h-screen bg-[#090910] px-4 py-6 text-white">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/app" })}
          className="mb-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au studio
        </button>

        <div className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#c8ff00]/10 px-3 py-1 text-xs font-semibold text-[#c8ff00]">
            <Sparkles className="h-4 w-4" />
            SAM FLASH 2.0
          </span>

          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
            Recréer ma vidéo
          </h1>

          <p className="mt-2 text-sm text-white/60">
            Utilise le modèle vidéo et ajoute les photos des personnes ou des
            éléments que tu souhaites intégrer.
          </p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Video className="h-5 w-5 text-[#c8ff00]" />
            Modèle vidéo
          </div>

          <video
            src={data.videoUrl}
            controls
            playsInline
            className="mx-auto max-h-[65vh] w-full rounded-2xl bg-black object-contain"
          />

          <p className="mt-3 text-xs text-white/50">
            Durée du modèle : {data.seconds} secondes
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="font-semibold">Photos de référence</h2>

          <p className="mt-1 text-xs text-white/50">
            Ajoute jusqu'à trois photos. Utilise uniquement des images que tu
            as le droit d'utiliser.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {photos.map((photo, index) => (
              <div key={`${index}-${photo.length}`} className="relative">
                <img
                  src={photo}
                  alt={`Photo de référence ${index + 1}`}
                  className="aspect-[3/4] w-full rounded-2xl object-cover"
                />

                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`Retirer la photo ${index + 1}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {photos.length < 3 && (
              <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-center text-xs text-white/60">
                <ImagePlus className="h-7 w-7" />
                Ajouter une photo
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <label htmlFor="clone-prompt" className="font-semibold">
            Instructions de recréation
          </label>

          <textarea
            id="clone-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={500}
            rows={5}
            placeholder="Décris les changements souhaités en conservant la scène, les mouvements et le rythme de la vidéo."
            className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-[#c8ff00]"
          />

          <p className="mt-2 text-right text-xs text-white/40">
            {prompt.length}/500
          </p>
        </section>

        <button
          type="button"
          onClick={prepareRecreation}
          disabled={photos.length === 0}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#c8ff00] px-5 py-4 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-5 w-5" />
          Préparer la recréation
        </button>

        <p className="mt-3 text-center text-xs text-white/40">
          Cette étape prépare les données. La génération réelle nécessite une
          connexion au service de génération vidéo.
        </p>
      </div>
    </main>
  );
}
