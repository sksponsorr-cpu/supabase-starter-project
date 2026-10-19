import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import { isFeatureVisible, type FeatureFlags } from "@/lib/feature-flags";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { CREATOR_MODELS } from "@/lib/creator-models";

const AUDIENCES = [
  {
    key: "creator_studio" as const,
    title: "Créateurs de contenu",
    text: "Créez des vidéos IA pour vos réseaux, avec le modèle et la durée que vous choisissez.",
  },
  {
    key: "seller_studio" as const,
    title: "Vendeurs et e-commerçants",
    text: "Présentez vos produits avec des influenceurs IA et des voix off prêtes à l'emploi.",
  },
];

/** Section d'accueil : les modèles et les espaces. Masquée tant que la fonctionnalité n'est pas publiée. */
export function HomeModelsSection() {
  const fetchFlags = useServerFn(getFeatureFlags);
  const [flags, setFlags] = useState<FeatureFlags>({});
  const isAdmin = useIsAdmin();

  useEffect(() => {
    void fetchFlags()
      .then((f) => setFlags(f))
      .catch(() => undefined);
  }, [fetchFlags]);

  const visibleAudiences = AUDIENCES.filter((a) => isFeatureVisible(a.key, flags, isAdmin));
  if (visibleAudiences.length === 0) return null;

  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Un espace pour chaque besoin
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {visibleAudiences.map((a) => (
            <div
              key={a.key}
              className="rounded-3xl border border-slate-200/70 bg-white/70 p-7 backdrop-blur-xl"
            >
              <h3 className="text-xl font-semibold text-slate-900">{a.title}</h3>
              <p className="mt-2 text-[15px] text-slate-600">{a.text}</p>
              <Link
                to="/app"
                className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Commencer
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <p className="text-center text-sm font-medium text-slate-500">Modèles disponibles</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {CREATOR_MODELS.map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
