import { useEffect, useState } from "react";

const KEY = "sam-flash-profile";
const EVENT = "samflash:profile-changed";

/** Vrai si le profil choisi est « vendeur ». Lu depuis le navigateur. */
export function isSellerMode(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "seller";
  } catch {
    return false;
  }
}

/** Notifie les autres écrans qu'un changement de profil a eu lieu. */
export function notifyProfileChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function useSellerMode(): boolean {
  const [seller, setSeller] = useState(false);
  useEffect(() => {
    const sync = () => setSeller(isSellerMode());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return seller;
}
