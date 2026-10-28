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
  verif("Diagnostic : longueur tapee", true, `champ « ${await page.locator("#L").inputValue()} », memoire « ${await page.evaluate(() => localStorage.getItem("trame:etat:L"))} », focus ${await page.evaluate(() => document.activeElement?.id)}`);
  await page.getByRole("tab", { name: /entraxe fixe/i }).click(); await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  const ongletActif = await page.getByRole("tab", { selected: true }).textContent();
  verif("Mode retenu apres rechargement", /entraxe fixe/i.test(ongletActif ?? ""), ongletActif ?? "");
  verif("Curseur dans la longueur du mode", await page.evaluate(() => document.activeElement?.id === "L2"));
  await page.getByRole("tab", { name: /intervalles/i }).click(); await page.waitForTimeout(300);
  const L = (await page.locator("#L").inputValue()).replace(/[\s\u00a0\u202f]/g, "");
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
// Quick wins : titre, entraxe le plus rond, champ fautif, cotes limitees
try {
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await c2.newPage();
  p2.on("pageerror", (e) => verif("Aucune erreur JavaScript", false, e.message));
  await p2.goto(BASE, { waitUntil: "networkidle" }); await p2.waitForTimeout(500);
  verif("Titre de l'onglet", (await p2.title()) === "Trame · Répartition de perçages", await p2.title());
  const choisi = (await p2.locator("tr[aria-selected='true']").innerText()).replace(/\s+/g, " ");
  verif("3000 mm, bords 50 : entraxe 580 choisi d'office", /580/.test(choisi), choisi);
  await p2.screenshot({ path: `${OUT}/check-entraxe-rond.png` });
  await p2.locator("#L").fill("500"); await p2.locator("#ds").fill("400"); await p2.waitForTimeout(300);
  verif("Bords trop grands : champ designe", (await p2.locator("#ds").getAttribute("aria-invalid")) === "true" && await p2.getByText(/dépassent la longueur/).first().isVisible());
  await p2.screenshot({ path: `${OUT}/check-champ-fautif.png` });
  await p2.getByRole("tab", { name: /entraxe fixe/i }).click(); await p2.waitForTimeout(300);
  const t0 = Date.now();
  await p2.locator("#L2").fill("3000"); await p2.locator("#E").fill("0.01"); await p2.waitForTimeout(500);
  verif("Entraxe 0,01 mm : la page reste fluide (< 10 s)", Date.now() - t0 < 10000, `${Date.now() - t0} ms`);
  verif("Entraxe 0,01 mm : cotes limitees a 200", await p2.getByText(/et .* autres/).first().isVisible());
  await p2.getByRole("tab", { name: /intervalles/i }).click(); await p2.waitForTimeout(300);
  await p2.locator("#L").fill("2737.5"); await p2.keyboard.press("Tab"); await p2.waitForTimeout(200);
  verif("Saisie : « 2737.5 » affiche « 2 737,5 »", (await p2.locator("#L").inputValue()).replace(/[\u00a0\u202f]/g, " ") === "2 737,5", await p2.locator("#L").inputValue());
  await p2.locator("#ds").fill("50"); await p2.locator("#L").fill("3'000"); await p2.waitForTimeout(300);
  verif("Saisie : apostrophe suisse acceptee (3'000)", /580/.test(await p2.locator("tr[aria-selected='true']").innerText()));
  await c2.close();
} catch (e) { verif("Deroulement des quick wins", false, e.message.split("\n")[0]); }
await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n"));
console.log(lignes.join("\n"));
