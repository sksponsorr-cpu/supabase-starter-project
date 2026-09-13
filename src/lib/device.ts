/**
 * Empreinte d'appareil (client) : identifiant stable stocké dans le navigateur.
 * Sert à limiter l'offre gratuite à un seul compte par téléphone.
 */
const STORAGE_KEY = "samflash.device.id";

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `d${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Signal stable et non identifiant, combiné à l'identifiant local. */
function deviceSignals(): string {
  if (typeof navigator === "undefined") return "srv";
  const parts = [
    navigator.userAgent ?? "",
    navigator.language ?? "",
    String(screen?.width ?? ""),
    String(screen?.height ?? ""),
    String(new Date().getTimezoneOffset()),
  ];
  let hash = 0;
  const raw = parts.join("|");
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** Renvoie (et crée si besoin) l'empreinte de l'appareil courant. */
export function getDeviceFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    id = randomId();
  }
  return `${deviceSignals()}.${id}`;
}
