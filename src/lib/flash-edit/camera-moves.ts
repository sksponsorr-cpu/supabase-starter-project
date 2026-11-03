/**
 * Mouvements de caméra proposés dans Flash Edit.
 * Chaque mouvement ajoute une consigne précise à la demande de l'utilisateur.
 */
export type CameraMove = {
  id: string;
  label: string;
  /** Texte court affiché à l'utilisateur. */
  hint: string;
  /** Consigne ajoutée au prompt envoyé au modèle. */
  prompt: string;
};

export const CAMERA_MOVES: CameraMove[] = [
  { id: "none", label: "Libre", hint: "Je décris tout moi-même", prompt: "" },
  { id: "wide", label: "Plan large", hint: "Vue d'ensemble", prompt: "Wide establishing shot, the full scene visible, steady framing." },
  { id: "close", label: "Gros plan", hint: "Cadrage serré", prompt: "Close-up shot, tight framing on the subject, shallow depth of field." },
  { id: "push", label: "Avance", hint: "La caméra s'approche", prompt: "Slow dolly push-in toward the subject, smooth and continuous." },
  { id: "pull", label: "Recul", hint: "La caméra s'éloigne", prompt: "Slow dolly pull-out, the camera moves backward to reveal the scene." },
  { id: "orbit", label: "Rotation", hint: "Autour du sujet", prompt: "Camera orbits around the subject, cinematic arc movement." },
  { id: "low", label: "Contre-plongée", hint: "Vue du bas", prompt: "Low-angle shot looking up at the subject, heroic perspective." },
  { id: "high", label: "Plongée", hint: "Vue du haut", prompt: "High-angle shot looking down at the subject." },
  { id: "track", label: "Suivi", hint: "La caméra accompagne", prompt: "Tracking shot following the subject at the same speed." },
];

/** Consigne finale : mouvement de caméra en tête, puis la demande de l'utilisateur. */
export function composePrompt(cameraId: string, userText: string): string {
  const move = CAMERA_MOVES.find((m) => m.id === cameraId);
  return [move?.prompt ?? "", userText.trim()].filter(Boolean).join(" ");
}
