import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Sale = { first_initial: string | null; country_code: string | null; tier: string; created_at: string };

const TIER_LABEL: Record<string, string> = {
  super_grok: "Super grok",
  superhearly: "Super grok heavy",
};

/** Drapeau à partir d'un code pays ISO (ex. FR -> 🇫🇷). */
function flag(cc: string | null): string {
  if (!cc || !/^[A-Z]{2}$/.test(cc)) return "🌍";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function since(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/**
 * Notification de ventes récentes, uniquement à partir de vraies commandes payées
 * (fonction recent_subscriptions). Rien n'est affiché s'il n'y en a aucune.
 */
export function RecentSalesToast() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.rpc("recent_subscriptions", { _limit: 10 });
      if (active && !error && Array.isArray(data)) setSales(data as Sale[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (sales.length === 0) return;
    const timers: number[] = [];
    const flash = () => {
      setVisible(true);
      timers.push(window.setTimeout(() => setVisible(false), 4500));
    };
    timers.push(window.setTimeout(flash, 3000));
    const cycle = window.setInterval(() => {
      setIndex((i) => (i + 1) % sales.length);
      flash();
    }, 10000);
    return () => {
      window.clearInterval(cycle);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [sales]);

  if (sales.length === 0) return null;
  const s = sales[index];

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-40">
      <div
        className={`flex max-w-xs items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg transition-all duration-500 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <span className="text-2xl" aria-hidden="true">{flag(s.country_code)}</span>
        <p className="text-sm text-slate-900">
          <span className="font-semibold">{s.first_initial ? `${s.first_initial.toUpperCase()}.` : "Un client"}</span>{" "}
          a pris l'abonnement {TIER_LABEL[s.tier] ?? "Super grok"} · {since(s.created_at)}
        </p>
      </div>
    </div>
  );
}
