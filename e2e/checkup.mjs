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
  const apresOnglet = await page.evaluate(() => localStorage.getItem("trame:etat:L"));
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  verif("Diagnostic : memoire apres changement d'onglet / apres rechargement", true, `${apresOnglet} / ${await page.evaluate(() => localStorage.getItem("trame:etat:L"))}`);
  const ongletActif = await page.getByRole("tab", { selected: true }).textContent();
  verif("Mode retenu apres rechargement", /entraxe fixe/i.test(ongletActif ?? ""), ongletActif ?? "");
  verif("Curseur dans la longueur du mode", await page.evaluate(() => document.activeElement?.id === "L2"));
  await page.getByRole("tab", { name: /intervalles/i }).click(); await page.waitForTimeout(300);
  const L = (await page.locator("#L").inputValue()).replace(/[\s\u00a0\u202f']/g, "");
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
  verif("Entraxe 0,01 mm : refuse avec un message (plus de 500 percages)", await p2.getByText(/Entraxe trop petit/).first().isVisible());
  await p2.getByRole("tab", { name: /intervalles/i }).click(); await p2.waitForTimeout(300);
  await p2.locator("#L").fill("2737.5"); await p2.keyboard.press("Tab"); await p2.waitForTimeout(200);
  verif("Saisie : « 2737.5 » affiche « 2'737,5 »", (await p2.locator("#L").inputValue())=== "2'737,5", await p2.locator("#L").inputValue());
  await p2.locator("#ds").fill("50"); await p2.locator("#L").fill("3'000"); await p2.waitForTimeout(300);
  verif("Saisie : apostrophe suisse acceptee (3'000)", /580/.test(await p2.locator("tr[aria-selected='true']").innerText()));
  // Clavier dans le tableau : Tab jusqu'a la ligne choisie, fleche haut, Entree copie les cotes
  await c2.grantPermissions(["clipboard-read", "clipboard-write"]);
  let surLigne = false;
  for (let n = 0; n < 40 && !surLigne; n++) { await p2.keyboard.press("Tab"); surLigne = await p2.evaluate(() => document.activeElement?.tagName === "TR"); }
  verif("Clavier : la ligne choisie est atteignable avec Tab", surLigne);
  await p2.keyboard.press("ArrowUp"); await p2.waitForTimeout(150);
  const choisie = (await p2.locator("tr[aria-selected='true']").innerText()).replace(/\s+/g, " ");
  verif("Clavier : fleche haut change de repartition", /^4 /.test(choisie), choisie);
  await p2.keyboard.press("Enter"); await p2.waitForTimeout(300);
  verif("Clavier : Entree copie les cotes", /^50; /.test(await p2.evaluate(() => navigator.clipboard.readText())), await p2.evaluate(() => navigator.clipboard.readText()));
  await c2.close();
} catch (e) { verif("Deroulement des quick wins", false, e.message.split("\n")[0]); }
// Audit 3.7 : saisies absurdes et « mm » toleres ; telephone 390 px
try {
  const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p3 = await c3.newPage();
  await p3.goto(BASE, { waitUntil: "networkidle" }); await p3.waitForTimeout(500);
  await p3.locator("#L").fill("3 000 mm"); await p3.waitForTimeout(300);
  verif("Longueur « 3 000 mm » acceptee", (await p3.locator("#L-erreur").count()) === 0 && (await p3.getByText(/Intervalles/).count()) > 0);
  await p3.locator("#L").fill("1000000000000"); await p3.waitForTimeout(300);
  verif("Longueur absurde refusee avec un message", /Trop grande/.test((await p3.locator("#L-erreur").textContent().catch(() => "")) ?? ""));
  await p3.locator("#L").fill("abc"); await p3.waitForTimeout(300);
  verif("Texte illisible : message exact", /Saisissez un nombre/.test((await p3.locator("#L-erreur").textContent().catch(() => "")) ?? ""));
  await p3.getByRole("tab", { name: /entraxe fixe/i }).click(); await p3.waitForTimeout(300);
  await p3.locator("#L2").fill("3000"); await p3.locator("#E").fill("0,01"); await p3.waitForTimeout(300);
  verif("Entraxe 0,01 : refuse, pas de resultat faux", /Entraxe trop petit/.test((await p3.locator("#E-erreur").textContent().catch(() => "")) ?? ""));
  await c3.close();
  const cm = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const pm = await cm.newPage();
  await pm.goto(BASE, { waitUntil: "networkidle" }); await pm.waitForTimeout(500);
  const sortie = await pm.evaluate(() => ({
    debord: document.documentElement.scrollWidth - window.innerWidth,
    petits: [...document.querySelectorAll("header button, header a, main button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 36 || r.width < 36) && e.getAttribute("role") !== "switch" && !e.closest("footer"); }).map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 22)),
  }));
  verif("Telephone : pas de debordement horizontal", sortie.debord <= 0, `${sortie.debord} px`);
  verif("Telephone : boutons assez grands", sortie.petits.length === 0, sortie.petits.join(", "));
  await pm.screenshot({ path: `${OUT}/50-telephone.png` });
  await cm.close();
} catch (e) { verif("Audit 3.7", false, e.message.split("\n").slice(0, 5).join(" | ")); }
// 3.8 : petites aides qui s'ouvrent au clic (« ? », « conseillé », « mm ronds »)
try {
  const c4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p4 = await c4.newPage();
  await p4.goto(BASE, { waitUntil: "networkidle" }); await p4.waitForTimeout(500);
  const ecart = await p4.evaluate(() => document.querySelector("#pm").getBoundingClientRect().top - document.querySelector('button[aria-label="Aide : Intervalles max"]').getBoundingClientRect().bottom);
  verif("Aide « Intervalles max » : le rond ne touche pas le champ (>= 3 px)", ecart >= 3, `${Math.round(ecart)} px`);
  await p4.getByRole("button", { name: "Aide : Intervalles max" }).click(); await p4.waitForTimeout(300);
  verif("Aide « Intervalles max » : s'ouvre au clic", await p4.getByText(/Nombre maximum de segments/).isVisible());
  await p4.keyboard.press("Escape"); await p4.waitForTimeout(200);
  verif("Aide « Intervalles max » : Echap la ferme", (await p4.getByText(/Nombre maximum de segments/).count()) === 0);
  await p4.getByRole("tab", { name: /entraxe maximum/i }).click(); await p4.waitForTimeout(300);
  await p4.locator("#L3").fill("3000"); await p4.locator("#emax").fill("500"); await p4.waitForTimeout(400);
  const choisieAvant = await p4.locator("tr[aria-selected='true']").innerText().catch(() => "");
  const conseille = p4.getByRole("button", { name: "Aide : Conseillé" }).first();
  verif("Pastille « conseillé » : aide disponible", (await conseille.count()) > 0);
  if (await conseille.count()) {
    await conseille.click(); await p4.waitForTimeout(300);
    verif("Aide « conseillé » : s'ouvre au clic", await p4.getByText(/le moins de perçages/).isVisible());
    await p4.keyboard.press("Escape"); await p4.waitForTimeout(200);
    const choisieApres = await p4.locator("tr[aria-selected='true']").innerText().catch(() => "");
    verif("Aide « conseillé » : ne change pas la ligne choisie", choisieAvant === choisieApres, `${choisieAvant} / ${choisieApres}`);
  }
  await p4.screenshot({ path: `${OUT}/51-aides.png` });
  await c4.close();
} catch (e) { verif("Aides 3.8", false, e.message.split("\n").slice(0, 3).join(" | ")); }
await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n"));
console.log(lignes.join("\n"));
