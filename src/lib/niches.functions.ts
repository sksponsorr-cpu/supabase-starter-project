import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Récupère les tendances (Google Trends, France) et l'actualité (Google News) des niches,
 * et crée des BROUILLONS dans la table resources (published = false).
 * Vous validez ensuite chaque brouillon avant publication.
 */

const SOURCES = [
  { url: "https://trends.google.com/trending/rss?geo=FR", category: "niches", source: "Google Trends" },
  { url: "https://news.google.com/rss/search?q=football&hl=fr&gl=FR&ceid=FR:fr", category: "actu", source: "Google News · football" },
  { url: "https://news.google.com/rss/search?q=%22intelligence+artificielle%22&hl=fr&gl=FR&ceid=FR:fr", category: "actu", source: "Google News · IA" },
];

type Item = { title: string; link: string; pubDate: string };

function readTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function parseRss(xml: string): Item[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks
    .map((b) => ({ title: readTag(b, "title"), link: readTag(b, "link"), pubDate: readTag(b, "pubDate") }))
    .filter((i) => i.title && i.link)
    .slice(0, 10);
}

/** Actualise les brouillons. Réservé aux administrateurs. */
export const refreshNicheDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Accès refusé");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let created = 0;
    for (const src of SOURCES) {
      const res = await fetch(src.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      for (const item of parseRss(await res.text())) {
        const { error } = await supabaseAdmin.from("resources").upsert(
          {
            category: src.category,
            kind: src.category === "niches" ? "niche" : "actu",
            title: item.title,
            summary: item.pubDate ? `${src.source} · ${item.pubDate}` : src.source,
            body: `Source : ${item.link}\n\nÀ compléter : ce que cette tendance veut dire pour vos vidéos, et l'idée de vidéo à lancer.`,
            preview: true,
            published: false,
            source: src.source,
            source_url: item.link,
          },
          { onConflict: "source_url", ignoreDuplicates: true },
        );
        if (!error) created++;
      }
    }
    return { ok: true as const, created };
  });
