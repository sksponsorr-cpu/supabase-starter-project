import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Film, ImageIcon, Loader2, PencilLine, X } from "lucide-react";
import { generateMedia } from "@/lib/generation.functions";
import { useAuth } from "@/hooks/useAuth";
import { stashPrefill } from "@/lib/prefill";
import { toast } from "@/lib/toast";
import type { CommunityItem } from "@/lib/community.functions";
import { usePauseTiles } from "@/components/samflash/VideoTile";

const action =
  "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary/80 px-3 py-3 text-sm font-medium backdrop-blur-xl transition-colors disabled:opacity-40";

/** Visionneuse de la galerie communautaire : voir, modifier le prompt, ou générer à partir de celui-ci. */
export function CommunityViewer({ item, onClose }: { item: CommunityItem; onClose: () => void }) {
  usePauseTiles();
  const navigate = useNavigate();
  const { session } = useAuth();
  const generate = useServerFn(generateMedia);
  const [busy, setBusy] = useState<null | "video" | "image">(null);
  const isVideo = item.media_type === "video";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Ouvre le studio avec le prompt pré-rempli, prêt à être modifié. */
  const editPrompt = () => {
    stashPrefill(item.prompt);
    void navigate({ to: "/app" });
  };

  const run = async (mediaType: "video" | "image") => {
    if (!session) {
      toast.info("Connectez-vous pour générer à partir de ce prompt.");
      stashPrefill(item.prompt);
      void navigate({ to: "/" });
      return;
    }
    setBusy(mediaType);
    try {
      const result = await generate({
        data: {
          prompt: item.prompt,
          mediaType,
          resolution: mediaType === "video" ? "720p" : "1080p",
          duration: "5s",
          aspectRatio: "2:3",
        },
      });
      if (result.ok) {
        toast.success("Génération lancée. Retrouvez-la dans « Mes créations ».");
        void navigate({ to: "/app" });
      } else {
        toast.error(result.reason === "quota" ? "Quota atteint. Consultez les offres." : (result.message ?? "Génération impossible."));
      }
    } catch {
      toast.error("Génération impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-2xl animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm font-medium">{isVideo ? "Vidéo" : "Image"} de la communauté</span>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        {item.media_url ? (
          isVideo ? (
            <video
              src={item.media_url}
              controls
              playsInline
              autoPlay
              loop
              preload="auto"
              className="max-h-full w-full rounded-3xl border border-border object-contain shadow-2xl"
            />
          ) : (
            <img
              src={item.media_url}
              alt={item.prompt}
              className="max-h-full w-full rounded-3xl border border-border object-contain shadow-2xl"
            />
          )
        ) : (
          <p className="px-6 text-center text-sm text-muted-foreground">{item.prompt}</p>
        )}
      </div>

      <div className="px-4 pt-3 text-xs text-muted-foreground line-clamp-4">{item.prompt}</div>

      <div className="flex flex-wrap gap-2 px-4 pb-8 pt-3">
        <button type="button" onClick={editPrompt} className={action}>
          <PencilLine className="h-4 w-4" /> Modifier le prompt
        </button>
        <button type="button" onClick={() => void run("video")} disabled={busy !== null} className={action}>
          {busy === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          Générer en vidéo
        </button>
        <button type="button" onClick={() => void run("image")} disabled={busy !== null} className={action}>
          {busy === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          Générer en image
        </button>
      </div>
    </div>
  );
}
