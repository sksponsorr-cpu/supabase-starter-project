import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import { isFeatureVisible, type FeatureFlags } from "@/lib/feature-flags";
import { CreatorModelPicker } from "@/components/samflash/CreatorModelPicker";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ProfileOnboarding } from "@/components/samflash/ProfileOnboarding";
import { useAuth } from "@/hooks/useAuth";
import { SellerStudio } from "@/components/samflash/SellerStudio";

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
  const { profile: account } = useAuth();
  // Nom affiché = nom saisi dans le profil (Paramètres).
  const displayName = account?.full_name?.trim() ?? "";

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
      {displayName && (
        <p className="mb-3 text-center text-[15px] text-muted-foreground">
          Bienvenue, <span className="font-semibold text-foreground">{displayName}</span>
        </p>
      )}
      <ProfileOnboarding onChoose={onOnboardingChoose} allowed={allowedChoices} />

      {current.id === "creator" && <CreatorModelPicker />}
      {current.id !== "creator" && <SellerStudio />}
    </div>
  );
}
