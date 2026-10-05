import { useEffect, useState } from "react";
import type { Preferences } from "@/hooks/useAuth";

const KEY = "samflash:prefs";
const EVT = "samflash:prefs";

export function readPrefs(): Preferences {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Preferences;
  } catch {
    return {};
  }
}

/** Diffuse les préférences à toute l'application (et les garde en local pour un démarrage instantané). */
export function publishPrefs(p: Preferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new CustomEvent<Preferences>(EVT, { detail: p }));
}

/** Préférences utilisateur, mises à jour en direct dès qu'un réglage change. */
export function usePrefs(): Preferences {
  const [prefs, setPrefs] = useState<Preferences>({});
  useEffect(() => {
    setPrefs(readPrefs());
    const on = (e: Event) => setPrefs((e as CustomEvent<Preferences>).detail ?? readPrefs());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return prefs;
}

export const NOTIF_DEFAULTS: Record<string, boolean> = {
  push: false,
  done: true,
  news: true,
  offers: true,
};

export function notifOn(p: Preferences, key: keyof typeof NOTIF_DEFAULTS & string): boolean {
  return p.notifications?.[key] ?? NOTIF_DEFAULTS[key] ?? false;
}

export function optionOn(p: Preferences, key: string, fallback = false): boolean {
  return p.options?.[key] ?? fallback;
}

/** Vibration courte (Android / navigateurs compatibles). */
export function vibrate(ms = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* non supporté */
    }
  }
}

/** Notification système quand une génération se termine alors que l'onglet est en arrière-plan. */
export function notifyDone(p: Preferences, title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!notifOn(p, "push") || !notifOn(p, "done")) return;
  if (Notification.permission !== "granted" || !document.hidden) return;
  try {
    new Notification(title, { body, icon: "/favicon-512x512.png" });
  } catch {
    /* ignoré */
  }
}

/** Demande l'autorisation du navigateur pour les notifications push. */
export async function requestPush(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const r = await Notification.requestPermission();
  return r === "granted" ? "granted" : "denied";
}

/** Lecture à voix haute (mode vocal). */
export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "fr" ? "fr-FR" : "en-US";
    window.speechSynthesis.speak(u);
  } catch {
    /* ignoré */
  }
}
