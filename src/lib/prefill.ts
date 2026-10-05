const KEY = "samflash:prefill";

/** Mémorise un prompt à réutiliser dans le studio (survit à une redirection de connexion). */
export function stashPrefill(text: string) {
  try {
    window.sessionStorage.setItem(KEY, text);
  } catch {
    /* ignoré */
  }
}

export function takePrefill(): string | null {
  try {
    const v = window.sessionStorage.getItem(KEY);
    if (v) window.sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
