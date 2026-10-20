import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import { isFeatureVisible, type FeatureFlags } from "@/lib/feature-flags";
import { CreatorModelPicker } from "@/components/samflash/CreatorModelPicker";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ProfileOnboarding } from "@/components/samflash/ProfileOnboarding";

type Profile = "creator" | "seller" | "ecommerce";

const PROFILES: { id: Profile; label: string; flag: "creator_studio" | "seller_studio" }[] = [
  { id: "creator", label: "Créateur de contenu", flag: "creator_studio" },
  { id: "seller", label: "Vendeur", flag: "seller_studio" },
  { id: "ecommerce", label: "E-commerçant", flag: "seller_studio" },
];

/**
 * Choix du profil sur /app, sans redirection.
 * Créateur : affiche le choix du modèle. Vendeur / e-commerçant : espace provisoire.
 * Tout est masqué tant que les interrupteurs ne sont pas publiés.
 */
export function ProfilePicker() {
  const fetchFlags = useServerFn(getFeatureFlags);
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [profile, setProfile] = useState<Profile>("creator");
  const isAdmin = useIsAdmin();

  useEffect(() => {
    void fetchFlags()
      .then((f) => setFlags(f))
      .catch(() => undefined);
  }, [fetchFlags]);

  const onOnboardingChoose = useCallback((c: "creator" | "seller") => {
    setProfile(c);
  }, []);

  const available = PROFILES.filter((p) => isFeatureVisible(p.flag, flags, isAdmin));
  const allowedChoices = useMemo(
    () => available.map((p) => (p.id === "creator" ? "creator" : "seller") as "creator" | "seller"),
    [available.length],
  );
  if (available.length === 0) return null;

  const current = available.find((p) => p.id === profile) ?? available[0];

  return (
    <div className="w-full flex flex-col items-center">
      <ProfileOnboarding onChoose={onOnboardingChoose} allowed={allowedChoices} />

      {current.id === "creator" && <CreatorModelPicker />}

      {current.id !== "creator" && (
        <div className="w-full max-w-2xl px-4 mb-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-[15px] font-semibold">Espace {current.label.toLowerCase()}</p>
            <p className="text-sm text-white/60 mt-1">
              Influenceurs IA, produits et voix off seront proposés ici.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
