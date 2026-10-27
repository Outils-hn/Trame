// Captures d'ecran de Trame (valeurs fictives), pour une revue visuelle.
// Lance par .github/workflows/captures.yml ; resultat dans le dossier passe en argument.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = process.argv[2] ?? "captures";
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch();

async function session(name, mobile, fn) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem("trame:full-backup-date", new Date().toISOString());
    sessionStorage.setItem("seeded", "1");
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  try { await fn(page); } catch (e) { errors.push(`[${name}] ${e.message.split("\n")[0]}`); }
  await ctx.close();
}
const shot = (page, file, full = true) => page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
const fill = async (page, id, v) => { await page.locator(`#${id}`).fill(String(v)); await page.waitForTimeout(400); };
const tab = async (page, name) => { await page.getByRole("tab", { name }).click(); await page.waitForTimeout(600); };

await session("bureau", false, async (page) => {
  await shot(page, "01-intervalles-defaut");
  await fill(page, "L", 2737.5);
  await shot(page, "02-intervalles-longueur-decimale");
  await tab(page, /entraxe fixe/);
  await shot(page, "03-entraxe-fixe");
  await tab(page, /entraxe max/i);
  await shot(page, "04-entraxe-maximum-une-piece");
  await page.getByRole("button", { name: "Plusieurs pièces" }).click(); await page.waitForTimeout(600);
  await shot(page, "05-entraxe-maximum-plusieurs-pieces");
  await page.getByRole("button", { name: /historique/i }).first().click(); await page.waitForTimeout(500);
  await shot(page, "06-historique", false);
});
await session("sombre", false, async (page) => {
  await page.getByRole("button", { name: "Basculer le thème" }).click(); await page.waitForTimeout(500);
  await shot(page, "07-mode-sombre");
});
await session("mobile", true, async (page) => {
  await shot(page, "08-mobile");
  await tab(page, /entraxe max/i);
  await shot(page, "09-mobile-entraxe-maximum");
});
await browser.close();
writeFileSync(`${OUT}/erreurs.txt`, errors.length ? errors.join("\n") : "aucune");
console.log(errors.length ? errors.join("\n") : "Captures OK, aucune erreur");
