import { useMemo, useState } from "react";
import { RESOURCE_CATEGORIES, hasResourceAccess, type Resource } from "@/lib/resources.data";

/**
 * Onglet Ressources. `planType` vient de checkAccess (planType).
 * Les non-abonnés voient les aperçus et un bouton vers les offres.
 */
export function ResourcesPanel({
  planType,
  onSeeOffers,
}: {
  planType: string | null | undefined;
  onSeeOffers: () => void;
}) {
  const unlocked = hasResourceAccess(planType);
  const [open, setOpen] = useState<string | null>(null);
  const categories = useMemo(() => RESOURCE_CATEGORIES, []);

  return (
    <div className="space-y-8">
      {!unlocked && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-semibold">Débloquez toutes les ressources</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Formations, prompts qui marchent, niches virales et actualités : réservés aux abonnés.
          </p>
          <button onClick={onSeeOffers} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Voir les offres
          </button>
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat.id}>
          <h2 className="mb-3 text-lg font-semibold">{cat.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {cat.items.map((item) => (
              <ResourceCard
                key={item.id}
                item={item}
                unlocked={unlocked}
                expanded={open === item.id}
                onToggle={() => setOpen(open === item.id ? null : item.id)}
                onSeeOffers={onSeeOffers}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ResourceCard({
  item,
  unlocked,
  expanded,
  onToggle,
  onSeeOffers,
}: {
  item: Resource;
  unlocked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSeeOffers: () => void;
}) {
  const canOpen = unlocked || item.preview;
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.type}</p>
      <h3 className="mt-1 font-semibold">{item.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>

      {expanded && canOpen && (
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-sm">{item.body}</pre>
      )}

      <div className="mt-3 flex gap-2">
        {canOpen ? (
          <button onClick={onToggle} className="rounded-full border border-white/15 px-3 py-1 text-sm">
            {expanded ? "Fermer" : unlocked ? "Lire" : "Aperçu"}
          </button>
        ) : (
          <button onClick={onSeeOffers} className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
            Réservé aux abonnés
          </button>
        )}
      </div>
    </article>
  );
}
