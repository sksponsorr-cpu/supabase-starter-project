/**
 * Estimation affichée à l'utilisateur. Ce n'est pas une limite : elle indique ce qu'il peut créer.
 * - Gratuit : une seule vidéo.
 * - Abonné : une estimation à partir de ses crédits et du coût d'une vidéo.
 */

export function CreditEstimate({
  planType,
  creditsAvailable,
  creditsPerVideo,
  videoSeconds,
  onSeeOffers,
}: {
  planType: string | null;
  creditsAvailable: number;
  /** Coût d'une vidéo de référence, par exemple 8 crédits pour Veo 3.1 720p 6 s. */
  creditsPerVideo: number;
  /** Durée de la vidéo de référence, en secondes. */
  videoSeconds: number;
  onSeeOffers: () => void;
}) {
  if (!planType || planType === "free") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="font-semibold">Gratuit : 10 crédits par jour</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos crédits se renouvellent chaque jour. Vidéos de 6 secondes maximum, avec Veo 3.1 (8 crédits)
          ou Grok Imagine (3 crédits). Seedance est réservé aux abonnés.
        </p>
        <button onClick={onSeeOffers} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Voir les offres
        </button>
      </div>
    );
  }

  const count = creditsPerVideo > 0 ? Math.floor(creditsAvailable / creditsPerVideo) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="font-semibold">Vos créations</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Avec vos {creditsAvailable} crédits, vous pouvez créer environ <strong>{count}</strong> vidéo(s) de{" "}
        {videoSeconds} secondes ({creditsPerVideo} crédits chacune).
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Besoin de plus ? Achetez des crédits à tout moment pour continuer sans attendre.
      </p>
    </div>
  );
}
