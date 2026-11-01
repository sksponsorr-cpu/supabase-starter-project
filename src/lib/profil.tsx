import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ProfilePage } from "@/components/samflash/ProfilePage";
import { getMyUserId } from "@/lib/profiles.functions";

/** Profil : /profil?id=... (sans id : votre propre profil). */
export const Route = createFileRoute("/profil")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Profil — Sam flash" }] }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const myId = useServerFn(getMyUserId);
  const [userId, setUserId] = useState<string | null>(id ?? null);

  useEffect(() => {
    if (!id) void myId().then((r) => setUserId(r.id));
  }, [id]);

  if (!userId) return <p className="p-6 text-sm text-muted-foreground">Chargement…</p>;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <ProfilePage userId={userId} onSeeOffers={() => navigate({ to: "/abonnements" })} />
    </main>
  );
}
