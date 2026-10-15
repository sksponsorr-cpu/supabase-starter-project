/**
 * Contrôle automatique d'une composition, sans IA :
 *  - les textes demandés sont bien présents à l'écran ;
 *  - aucun texte n'est hors du cadre ;
 *  - quelques images clés, à renvoyer au modèle pour qu'il les regarde.
 */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeSrc = await readFile(join(here, "runtime.js"), "utf8");

/** Texte comparable : sans accents, sans apostrophes, en majuscules, espaces réduits. */
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();

/**
 * @returns {Promise<{problems: string[], frames: {mime: string, data: string}[]}>}
 */
export async function inspectComposition({ html, seconds, width, height, requiredTexts }) {
  const headTag = /<head[^>]*>/i;
  if (!headTag.test(html)) return { problems: ["balise <head> absente"], frames: [] };
  const page_html = html.replace(headTag, (m) => `${m}<script>${runtimeSrc}</script>`);

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const problems = [];
  const frames = [];
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(page_html, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    if (!(await page.evaluate(() => typeof window.renderAt === "function"))) {
      return { problems: ["window.renderAt(t) est absent"], frames: [] };
    }

    const N = 12;
    let allText = "";
    const outside = new Set();
    const overlapping = new Set();
    for (let i = 0; i < N; i++) {
      const t = (seconds * (i + 0.5)) / N;
      const info = await page.evaluate((time) => {
        window.renderAt(time);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const out = [];
        document.querySelectorAll("body *").forEach((el) => {
          const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!hasText) return;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const mx = vw * 0.02;
          const my = vh * 0.02;
          if (r.left < -mx || r.right > vw + mx || r.top < -my || r.bottom > vh + my) {
            out.push((el.textContent || "").trim().slice(0, 40));
          }
        });
        // Boîtes de texte visibles, pour repérer les chevauchements
        const boxes = [];
        document.querySelectorAll("body *").forEach((el) => {
          const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!hasText) return;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.5) return;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          boxes.push({ label: (el.textContent || "").trim().slice(0, 30), l: r.left, r: r.right, t: r.top, b: r.bottom });
        });
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
            const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
            if (w <= 0 || h <= 0) continue;
            const smaller = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t));
            if ((w * h) / smaller > 0.2) overlaps.push(`« ${a.label} » et « ${b.label} »`);
          }
        }
        return { text: document.body.innerText || "", out, overlaps };
      }, t);
      allText += " " + info.text;
      info.out.forEach((x) => outside.add(x));
      info.overlaps.forEach((x) => overlapping.add(x));
    }

    const haystack = norm(allText);
    for (const req of requiredTexts) {
      const needle = norm(req);
      if (needle && !haystack.includes(needle)) {
        problems.push(`texte absent de l'écran : « ${req} »`);
      }
    }
    for (const x of [...outside].slice(0, 5)) {
      problems.push(`élément hors du cadre : « ${x} »`);
    }

    for (const x of [...overlapping].slice(0, 3)) {
      problems.push(`textes qui se superposent : ${x}`);
    }

    // Trois images clés, pour que le modèle voie le résultat
    for (const f of [0.25, 0.5, 0.8]) {
      await page.evaluate((time) => window.renderAt(time), seconds * f);
      const buf = await page.screenshot({ type: "jpeg", quality: 70 });
      frames.push({ mime: "image/jpeg", data: buf.toString("base64") });
    }
  } finally {
    await browser.close();
  }
  return { problems, frames };
}
