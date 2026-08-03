/**
 * Trame — export DXF (ASCII R12) et fiche d'atelier imprimable (A4).
 * Aucune dépendance externe : génération de texte pur + fenêtre d'impression.
 */

export interface ExportHole {
  x: number;
  y: number;
  /** Diamètre de perçage en mm (défaut 8) */
  dia?: number;
}

export interface DxfOptions {
  moduleName: string;
  /** Largeur / longueur totale du support (mm) */
  width: number;
  /** Hauteur totale (mm) — ignorée en 1D */
  height?: number;
  is2D: boolean;
  holes: ExportHole[];
  defaultDia?: number;
}

const DEF_DIA = 8;

function num(n: number) {
  return Number(n.toFixed(4)).toString();
}

function pair(code: number | string, value: string | number) {
  return `${code}\n${value}\n`;
}

function line(layer: string, x1: number, y1: number, x2: number, y2: number) {
  return (
    pair(0, "LINE") +
    pair(8, layer) +
    pair(10, num(x1)) +
    pair(20, num(y1)) +
    pair(30, "0.0") +
    pair(11, num(x2)) +
    pair(21, num(y2)) +
    pair(31, "0.0")
  );
}

function circle(layer: string, x: number, y: number, r: number) {
  return (
    pair(0, "CIRCLE") +
    pair(8, layer) +
    pair(10, num(x)) +
    pair(20, num(y)) +
    pair(30, "0.0") +
    pair(40, num(r))
  );
}

function layerDef(name: string, color: number) {
  return pair(0, "LAYER") + pair(2, name) + pair(70, 0) + pair(62, color) + pair(6, "CONTINUOUS");
}

/** Génère un DXF ASCII R12 (calques CONTOUR + PERCAGES). */
export function buildDxf(opts: DxfOptions): string {
  const { moduleName, width, is2D, holes } = opts;
  const height = opts.height ?? 0;
  const dia = opts.defaultDia ?? DEF_DIA;

  let out = "";
  // HEADER
  out +=
    pair(0, "SECTION") +
    pair(2, "HEADER") +
    pair(9, "$ACADVER") +
    pair(1, "AC1009") +
    pair(9, "$INSUNITS") +
    pair(70, 4) +
    pair(9, "$EXTMIN") +
    pair(10, "0.0") +
    pair(20, "0.0") +
    pair(30, "0.0") +
    pair(9, "$EXTMAX") +
    pair(10, num(width)) +
    pair(20, num(is2D ? height : 0)) +
    pair(30, "0.0") +
    pair(0, "ENDSEC");

  // TABLES (calques)
  out +=
    pair(0, "SECTION") +
    pair(2, "TABLES") +
    pair(0, "TABLE") +
    pair(2, "LAYER") +
    pair(70, 2) +
    layerDef("CONTOUR", 8) + // gris
    layerDef("PERCAGES", 30) + // orange
    pair(0, "ENDTAB") +
    pair(0, "ENDSEC");

  // ENTITIES
  out += pair(0, "SECTION") + pair(2, "ENTITIES");
  if (is2D) {
    out += line("CONTOUR", 0, 0, width, 0);
    out += line("CONTOUR", width, 0, width, height);
    out += line("CONTOUR", width, height, 0, height);
    out += line("CONTOUR", 0, height, 0, 0);
  } else {
    // Profilé 1D : ligne de référence Y=0 + traits d'extrémités
    out += line("CONTOUR", 0, 0, width, 0);
    out += line("CONTOUR", 0, -10, 0, 10);
    out += line("CONTOUR", width, -10, width, 10);
  }
  for (const h of holes) {
    const d = h.dia && h.dia > 0 ? h.dia : dia;
    out += circle("PERCAGES", h.x, is2D ? h.y : 0, d / 2);
  }
  out += pair(0, "ENDSEC") + pair(0, "EOF");

  void moduleName;
  return out;
}

function safe(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function dxfFileName(moduleName: string, width: number, height: number, is2D: boolean) {
  const w = Math.round(width);
  const h = Math.round(height);
  return `Trame_${safe(moduleName)}_${w}${is2D ? `x${h}` : ""}mm.dxf`;
}

export function downloadDxf(opts: DxfOptions) {
  const content = buildDxf(opts);
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dxfFileName(opts.moduleName, opts.width, opts.height ?? 0, opts.is2D);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------- Fiche d'atelier (A4 print) ------------------------- */

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "opacity",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor",
];

/** Sérialise un SVG du DOM en figeant les styles calculés (les classes CSS ne suivent pas dans la fenêtre d'impression). */
export function serializeSvg(source: SVGSVGElement | null): string {
  if (!source) return "";
  const clone = source.cloneNode(true) as SVGSVGElement;
  const originals = source.querySelectorAll<SVGElement>("*");
  const clones = clone.querySelectorAll<SVGElement>("*");
  const apply = (from: Element, to: SVGElement) => {
    const cs = window.getComputedStyle(from);
    let css = "";
    for (const prop of STYLE_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) css += `${prop}:${v};`;
    }
    to.setAttribute("style", css);
    to.removeAttribute("class");
  };
  apply(source, clone);
  originals.forEach((el, i) => {
    const target = clones[i];
    if (target) apply(el, target);
  });
  // Dimensionne explicitement en mm pour tenir dans la page A4 (les classes CSS ne suivent pas)
  const vb = source.viewBox.baseVal;
  const ratio = vb && vb.width > 0 ? vb.height / vb.width : 0.6;
  const maxW = 168;
  const maxH = 95;
  let wmm = maxW;
  let hmm = wmm * ratio;
  if (hmm > maxH) {
    hmm = maxH;
    wmm = hmm / (ratio || 1);
  }
  clone.setAttribute("width", `${wmm.toFixed(1)}mm`);
  clone.setAttribute("height", `${hmm.toFixed(1)}mm`);
  clone.setAttribute("style", (clone.getAttribute("style") ?? "") + "max-width:100%;");
  return clone.outerHTML;
}


export interface SheetParam {
  label: string;
  value: string;
}

export interface WorkshopSheetOptions {
  moduleName: string;
  subtitle?: string;
  material?: string;
  params: SheetParam[];
  svgMarkup?: string;
  columns: string[];
  rows: string[][];
  notes?: string[];
}

const LOGO = `<svg viewBox="0 0 50 50" width="34" height="34">${(() => {
  let s = '<rect width="50" height="50" rx="8" fill="#f1f5f9"/>';
  const hi = new Set(["1,3", "2,2", "3,1"]);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const cx = 5 + x * 10;
      const cy = 5 + y * 10;
      if (hi.has(`${x},${y}`))
        s += `<circle cx="${cx}" cy="${cy}" r="3.6" fill="none" stroke="#ff7a22" stroke-width="1.2"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="1.3" fill="#71717a"/>`;
    }
  }
  return s;
})()}</svg>`;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fileStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

export function sheetFileName(moduleName: string, d = new Date()) {
  return `Fiche_Atelier_Trame_${safe(moduleName)}_${fileStamp(d)}.pdf`;
}

/** Construit le bloc HTML A4 de la fiche d'atelier (utilisé pour le rendu PDF). */
export function buildWorkshopSheetHtml(opts: WorkshopSheetOptions, stamp: string) {


  return `<style>
  #trame-sheet { font-family: ui-sans-serif, system-ui, "Helvetica Neue", Arial, sans-serif; color:#18181b; font-size:11px; background:#fff; width:690px; overflow:hidden; padding:0 0 6px; }
  #trame-sheet * { box-sizing: border-box; }
  #trame-sheet .head { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #ff7a22; padding-bottom:8px; }
  #trame-sheet .brand { display:flex; align-items:center; gap:10px; }
  #trame-sheet .brand h1 { margin:0; font-size:13px; letter-spacing:.22em; text-transform:uppercase; }
  #trame-sheet .brand p { margin:0; font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:#71717a; }
  #trame-sheet .title { text-align:right; }
  #trame-sheet .title h2 { margin:0; font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
  #trame-sheet .title p { margin:2px 0 0; font-size:10px; color:#52525b; }
  #trame-sheet h3 { font-size:10px; text-transform:uppercase; letter-spacing:.14em; color:#52525b; margin:14px 0 6px; }
  #trame-sheet .params { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px 14px; }
  #trame-sheet .params div { display:flex; justify-content:space-between; border-bottom:1px dotted #d4d4d8; padding:2px 0; }
  #trame-sheet .params span:last-child { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight:700; }
  #trame-sheet .schema { border:1px solid #e4e4e7; border-radius:6px; padding:8px; text-align:center; }
  #trame-sheet .schema svg { max-width:100%; }
  #trame-sheet tr, #trame-sheet thead, #trame-sheet .valid, #trame-sheet .schema { page-break-inside:avoid; }
  #trame-sheet table { width:100%; border-collapse:collapse; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  #trame-sheet th, #trame-sheet td { border:1px solid #d4d4d8; padding:3px 6px; text-align:left; font-size:10px; }
  #trame-sheet th { background:#f4f4f5; text-transform:uppercase; letter-spacing:.08em; font-size:9px; }
  #trame-sheet tbody tr:nth-child(even) td { background:#fafafa; }
  #trame-sheet .valid { margin-top:16px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
  #trame-sheet .valid div { border-top:1px solid #18181b; padding-top:4px; font-size:10px; }
  #trame-sheet .notes { margin-top:8px; font-size:9.5px; color:#52525b; }
  #trame-sheet .foot { margin-top:10px; border-top:1px solid #e4e4e7; padding-top:6px; font-size:9px; color:#71717a; display:flex; justify-content:space-between; }
</style>
<div class="head">
  <div class="brand">${LOGO}<div><h1>Trame</h1><p>Répartition de perçages</p></div></div>
  <div class="title"><h2>Fiche de fabrication atelier</h2><p>${esc(opts.moduleName)}${
    opts.subtitle ? ` · ${esc(opts.subtitle)}` : ""
  } — ${esc(stamp)}</p></div>
</div>

<h3>Paramètres</h3>
<div class="params">
  ${opts.params.map((p) => `<div><span>${esc(p.label)}</span><span>${esc(p.value)}</span></div>`).join("")}
  <div><span>Matériau</span><span>${esc(opts.material?.trim() || "—")}</span></div>
</div>

${opts.svgMarkup ? `<h3>Schéma de calepinage</h3><div class="schema">${opts.svgMarkup}</div>` : ""}

<h3>Cotes de perçage (${opts.rows.length})</h3>
<table>
  <thead><tr>${opts.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${opts.rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody>
</table>

${opts.notes?.length ? `<div class="notes">${opts.notes.map((n) => `• ${esc(n)}`).join("<br>")}</div>` : ""}

<div class="valid">
  <div>Validé par : ............................</div>
  <div>Date : ............................</div>
  <div>Visa atelier : ............................</div>
</div>
<div class="foot"><span>Trame — cotes en millimètres</span><span>${esc(stamp)}</span></div>`;
}

/**
 * Génère et télécharge directement la fiche d'atelier au format PDF A4.
 * Le rendu se fait dans une iframe isolée : les styles de l'application
 * (couleurs oklch de Tailwind v4) ne sont pas lisibles par html2canvas.
 */
export async function downloadWorkshopSheetPdf(opts: WorkshopSheetOptions) {
  const now = new Date();
  const stamp = now.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument;
    if (!doc) return false;
    doc.open();
    doc.write(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;}</style></head><body><div id="trame-sheet">${buildWorkshopSheetHtml(
        opts,
        stamp,
      )}</div></body></html>`,
    );
    doc.close();
    await new Promise((r) => setTimeout(r, 60));
    const target = doc.getElementById("trame-sheet");
    if (!target) return false;

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 690,
      width: 690,
      height: target.scrollHeight + 4,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const margin = 12;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;
    const pxPerMm = canvas.width / contentW;
    const sliceH = Math.floor(contentH * pxPerMm);

    let y = 0;
    let page = 0;
    while (y < canvas.height) {
      const h = Math.min(sliceH, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      const ctx = slice.getContext("2d");
      if (!ctx) return false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, contentW, h / pxPerMm);
      y += h;
      page += 1;
    }

    pdf.save(sheetFileName(opts.moduleName, now));
    return true;

  } catch {
    return false;
  } finally {
    frame.remove();
  }
}


