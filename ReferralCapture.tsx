import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { claimReferral } from "@/lib/referral.functions";

const KEY = "samflash_ref";

/**
 * Invisible : mémorise le code `?ref=XXXX` présent dans le lien d'invitation,
 * puis le rattache au compte dès que la personne est connectée.
 */
export function ReferralCapture() {
  const { session } = useAuth();
  const claim = useServerFn(claimReferral);

  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) localStorage.setItem(KEY, ref.toUpperCase());
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (!code) return;
    void claim({ data: { code } })
      .catch(() => undefined)
      .finally(() => {
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
      });
  }, [session, claim]);

  return null;
}
