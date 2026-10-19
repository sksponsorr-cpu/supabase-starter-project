import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "@/lib/owners";
import { useAuth } from "@/hooks/useAuth";

/**
 * Vrai si l'utilisateur connecté est propriétaire ou administrateur.
 * Sert à montrer les nouveautés en aperçu avant leur publication.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => {
        if (!cancelled) setRole((data as { role?: string } | null)?.role ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return Boolean(user && (isOwnerEmail(user.email) || role === "admin"));
}
