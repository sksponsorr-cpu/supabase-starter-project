/**
 * Configuration des modèles vidéo proposés aux créateurs.
 * Données seulement : aucun secret, utilisable côté client et serveur.
 */

export type VideoMode =
  | "text_to_video"
  | "image_to_video"
  | "reference_to_video"
  | "video_edit"
  | "extend";

export type ModelId = "seedance-2" | "seedance-2-5" | "grok-imagine" | "veo-3-1" | "gemini-omni";

export interface CreatorModel {
  id: ModelId;
  label: string; // nom affiché à l'utilisateur
  apiModel: string; // identifiant envoyé à KIE
  modes: VideoMode[];
  durations: number[]; // secondes proposées
  resolutions: ("480p" | "720p" | "1080p" | "4k")[];
  /** Vrai seulement quand le serveur sait vraiment générer avec ce modèle. */
  live: boolean;
}

/** Types de vidéo réellement pris en charge par le serveur aujourd'hui. */
export const LIVE_MODES: VideoMode[] = ["text_to_video", "image_to_video", "reference_to_video"];

export const CREATOR_MODELS: CreatorModel[] = [
  {
    id: "seedance-2",
    label: "Seedance 2.0",
    apiModel: "bytedance/seedance-2",
    modes: ["text_to_video", "image_to_video", "reference_to_video", "video_edit"],
    durations: [4, 5, 6, 8, 10, 12, 15],
    resolutions: ["480p", "720p", "1080p"],
    live: true,
  },
  {
    id: "seedance-2-5",
    label: "Seedance 2.5",
    apiModel: "bytedance/seedance-2-5",
    modes: ["text_to_video", "image_to_video", "reference_to_video", "video_edit"],
    durations: [4, 5, 6, 8, 10, 15, 20, 30],
    resolutions: ["480p", "720p", "1080p"],
    live: true,
  },
  {
    id: "grok-imagine",
    label: "Grok Imagine",
    apiModel: "grok-imagine/text-to-video",
    modes: ["text_to_video", "image_to_video", "reference_to_video", "extend"],
    durations: [6, 10, 15, 20, 30],
    resolutions: ["480p", "720p", "1080p"],
    live: true,
  },
  {
    id: "veo-3-1",
    label: "Veo 3.1",
    apiModel: "veo-3-1",
    modes: ["text_to_video", "image_to_video", "reference_to_video", "extend"],
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    live: true,
  },
  {
    id: "gemini-omni",
    label: "Google Omni",
    apiModel: "google/gemini-omni-flash-1-1",
    modes: ["text_to_video", "image_to_video", "reference_to_video", "video_edit"],
    durations: [4, 6, 8, 10],
    resolutions: ["480p", "720p", "1080p", "4k"],
    live: false,
  },
];

export const MODE_LABELS: Record<VideoMode, string> = {
  text_to_video: "Texte vers vidéo",
  image_to_video: "Image vers vidéo",
  reference_to_video: "Référence vers vidéo",
  video_edit: "Clonage / modification vidéo",
  extend: "Extension de vidéo",
};

/** Zone « ajouter une photo » : seulement pour les modes image. */
export function needsImageUpload(mode: VideoMode): boolean {
  return mode === "image_to_video" || mode === "reference_to_video";
}

/** Zone « ajouter une vidéo » : pour clonage/modification et extension. */
export function needsVideoUpload(mode: VideoMode): boolean {
  return mode === "video_edit" || mode === "extend";
}
