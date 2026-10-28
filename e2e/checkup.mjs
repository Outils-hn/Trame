// Check-up automatique de Trame dans un vrai navigateur : memoire des reglages et du mode,
// curseur dans la longueur, theme, sauvegarde complete. Resultat : checkup.txt (OK / ECHEC).
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = process.argv[2] ?? "captures";
const lignes = [];
const verif = (nom, ok, detail = "") => lignes.push(`${ok ? "OK    " : "ECHEC "} ${nom}${detail ? ` (${detail})` : ""}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
try {
  await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  verif("Curseur dans la longueur a l'ouverture", await page.evaluate(() => document.activeElement?.id === "L"));
  await page.keyboard.type("2500"); await page.waitForTimeout(300);
  await page.getByRole("tab", { name: /entraxe fixe/i }).click(); await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  const ongletActif = await page.getByRole("tab", { selected: true }).textContent();
  verif("Mode retenu apres rechargement", /entraxe fixe/i.test(ongletActif ?? ""), ongletActif ?? "");
  verif("Curseur dans la longueur du mode", await page.evaluate(() => document.activeElement?.id === "L2"));
  await page.getByRole("tab", { name: /intervalles/i }).click(); await page.waitForTimeout(300);
  const L = await page.locator("#L").inputValue();
  verif("Longueur retenue apres rechargement", L === "2500", `lu : ${L}`);
  await page.getByRole("button", { name: "Basculer le thème" }).click(); await page.waitForTimeout(200);
  await page.reload({ waitUntil: "networkidle" });
  verif("Mode sombre retenu apres rechargement", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await page.getByRole("button", { name: /^Sauvegarde$/ }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Télécharger la sauvegarde/ }).click()]);
  const chemin = `${OUT}/sauvegarde-test.json`; await dl.saveAs(chemin);
  const json = JSON.parse(readFileSync(chemin, "utf8"));
  verif("Sauvegarde complete : reglages inclus", json.app === "trame" && "trame:etat:L" in json.data && "trame:etat:dark" in json.data, Object.keys(json.data).length + " cles");
} catch (e) { verif("Deroulement du check-up", false, e.message.split("\n")[0]); }
await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n"));
console.log(lignes.join("\n"));
