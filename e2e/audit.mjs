// Audit UX de Trame : parcours reel, cas limites, mobile, accessibilite, performance (valeurs fictives).
import { lancer, ouvrir, photo, mesures, axe, tabsJusqua, focusVisible, constat, note, ecrire } from "./audit-lib.mjs";
import fs from "node:fs";
const b = await lancer();
const lire = async (p, sel) => (await p.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
const texteMain = async (p) => (await p.locator("main, #trame-panneau").first().innerText().catch(() => "")).replace(/\s+/g, " ");

// 1. Premiere impression + mesures
let p = await ouvrir(b, "bureau");
await photo(p, "01-premiere-impression", false);
await mesures(p, "bureau"); await axe(p, "bureau");
note("focus:bureau", await focusVisible(p));
// 2. Cas limites mode intervalles
const cas = [["vide", ""], ["zero", "0"], ["negatif", "-500"], ["texte", "abc"], ["absurde", "1000000000000"], ["tres-petit", "0.4"], ["virgule", "2737,5"], ["tout-colle", "3 000 mm"]];
p = await ouvrir(b, "limites");
for (const [nom, v] of cas) {
  await p.locator("#L").fill(v); await p.keyboard.press("Tab"); await p.waitForTimeout(350);
  const t = await texteMain(p);
  note(`intervalles:${nom}`, { champ: await p.locator("#L").inputValue(), invalide: await p.locator("#L").getAttribute("aria-invalid"), apercu: t.slice(0, 260), lignes: await p.locator("tr[aria-selected]").count() });
  await photo(p, `02-limite-${nom}`, false);
}
// bords trop grands, bords a zero
await p.locator("#L").fill("3000"); await p.locator("#ds").fill("1600"); await p.waitForTimeout(300); await photo(p, "02-bords-trop-grands", false);
note("bords-trop-grands", await texteMain(p).then((t) => t.slice(0, 300)));
await p.locator("#ds").fill("0"); await p.waitForTimeout(300); note("bords-zero", await texteMain(p).then((t) => t.slice(0, 300)));
// 3. Entraxe fixe
await p.getByRole("tab", { name: /entraxe fixe/i }).click(); await p.waitForTimeout(400);
for (const [nom, e] of [["zero", "0"], ["plus-grand-que-L", "99999"], ["minuscule", "0.01"], ["decimal", "333.33"]]) {
  await p.locator("#L2").fill("3000"); const t0 = Date.now(); await p.locator("#E").fill(e); await p.waitForTimeout(500);
  note(`fixe:${nom}`, { ms: Date.now() - t0, apercu: (await texteMain(p)).slice(0, 300) });
  await photo(p, `03-fixe-${nom}`, false);
}
// 4. Entraxe max, plusieurs pieces, gros volume
await p.getByRole("tab", { name: /entraxe max/i }).click(); await p.waitForTimeout(400);
await p.locator("#L3").fill("2450"); await p.locator("#emax").fill("600"); await p.waitForTimeout(400); await photo(p, "04-max-une-piece");
await p.getByRole("button", { name: "Plusieurs pièces" }).click(); await p.waitForTimeout(400);
const lignes = Array.from({ length: 800 }, (_, i) => `P${i + 1}\t${1500 + ((i * 137) % 4500)}`).join("\n");
const t0 = Date.now(); await p.locator("#pieces3").fill(lignes); await p.waitForTimeout(800);
note("max:800-pieces", { ms: Date.now() - t0, apercu: (await texteMain(p)).slice(0, 200) }); await photo(p, "04-max-800-pieces");
await p.locator("#pieces3").fill("A1 3000\nA2 abc\n\nA3 -5\nA4 2450,5"); await p.waitForTimeout(500);
note("max:lignes-fausses", (await texteMain(p)).slice(0, 400)); await photo(p, "04-max-lignes-fausses", false);
// 5. Historique, retour arriere, sauvegarde
await p.getByRole("button", { name: /historique/i }).first().click(); await p.waitForTimeout(500); await photo(p, "05-historique", false);
note("historique", (await p.locator("[role=dialog]").first().innerText().catch(() => "aucun panneau")).replace(/\s+/g, " ").slice(0, 300));
await p.keyboard.press("Escape");
await p.goBack().catch(() => {}); note("retour-navigateur", p.url());
// sauvegarde invalide
await p.getByRole("button", { name: /^Sauvegarde$/ }).click().catch(() => {}); await p.waitForTimeout(400); await photo(p, "05-sauvegarde", false);
fs.writeFileSync("/tmp/mauvais.json", '{"foo":1}');
const inp = p.locator("input[type=file]").first();
if (await inp.count()) { await inp.setInputFiles("/tmp/mauvais.json"); await p.waitForTimeout(600); note("restauration-fichier-invalide", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 200)); await photo(p, "05-sauvegarde-invalide", false); }
// 6. Mobile / tablette / sombre / 200% zoom
for (const [nom, w, h] of [["mobile", 390, 844], ["tablette", 768, 1024]]) {
  const m = await ouvrir(b, nom, { w, h }); await photo(m, `06-${nom}`); await mesures(m, nom); await axe(m, nom);
  await m.getByRole("tab", { name: /entraxe max/i }).click().catch(() => {}); await m.waitForTimeout(400); await photo(m, `06-${nom}-max`);
}
const d = await ouvrir(b, "sombre", { dark: true }); await photo(d, "07-sombre", false); await axe(d, "sombre");
const z = await ouvrir(b, "zoom", { w: 720, h: 450 }); await photo(z, "08-zoom-200", false); await mesures(z, "zoom200");
// 7. Clavier
p = await ouvrir(b, "clavier");
note("tabs-jusqu-au-tableau", await tabsJusqua(p, () => document.activeElement?.tagName === "TR"));
note("tabs-jusqu-a-copier", await tabsJusqua(p, () => /copier/i.test(document.activeElement?.textContent || "")));
ecrire(); await b.close();
