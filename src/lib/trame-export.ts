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

function fileStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

export function sheetFileName(moduleName: string, d = new Date()) {
  return `Fiche_Atelier_Trame_${safe(moduleName)}_${fileStamp(d)}.pdf`;
}

/** Rasterise un markup SVG en PNG haute résolution (dataURL) + dimensions px. */
async function svgToPng(markup: string, scale = 3): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const holder = document.createElement("div");
    holder.innerHTML = markup.trim();
    const svg = holder.querySelector("svg");
    if (!svg) return null;
    const vb = svg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
    const vw = vb && vb.length === 4 && vb[2] > 0 ? vb[2] : 800;
    const vh = vb && vb.length === 4 && vb[3] > 0 ? vb[3] : 480;
    svg.setAttribute("width", String(vw));
    svg.setAttribute("height", String(vh));
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg"));
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png"), w: vw, h: vh };
  } catch {
    return null;
  }
}

/** jsPDF (Helvetica/WinAnsi) ne connaît pas les espaces fines insécables : on normalise. */
function txt(s: string) {
  return (s ?? "").replace(/[\u00a0\u202f\u2009\u2007\u2060]/g, " ");
}

const INK = [24, 24, 27] as [number, number, number];
const GREY = [113, 113, 122] as [number, number, number];
const ORANGE = [255, 122, 34] as [number, number, number];
const HEAD_BG = [241, 245, 249] as [number, number, number];
const ZEBRA = [250, 250, 251] as [number, number, number];

/** Alignement automatique : n° centré, valeurs numériques à droite, texte à gauche. */
function alignFor(col: string, index: number): "left" | "right" | "center" {
  const c = col.toLowerCase();
  if (index === 0 && (c.includes("n°") || c.includes("no") || c.includes("#"))) return "center";
  if (/(mm|x|y|pas|entraxe|position|cote|ø|diam)/.test(c)) return "right";
  return "left";
}

/**
 * Génère et télécharge la fiche d'atelier A4 en PDF vectoriel natif
 * (jsPDF + jspdf-autotable ; seul le schéma est une image PNG haute résolution).
 */
export async function downloadWorkshopSheetPdf(opts: WorkshopSheetOptions) {
  try {
    const now = new Date();
    const sheet: WorkshopSheetOptions = {
      ...opts,
      moduleName: txt(opts.moduleName),
      subtitle: opts.subtitle ? txt(opts.subtitle) : undefined,
      material: opts.material ? txt(opts.material) : undefined,
      params: opts.params.map((p) => ({ label: txt(p.label), value: txt(p.value) })),
      columns: opts.columns.map(txt),
      rows: opts.rows.map((r) => r.map(txt)),
      notes: opts.notes?.map(txt),
    };
    const stamp = now.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const M = 14;
    const contentW = pageW - M * 2;
    const FOOT_H = 26;

    /* ---------- En-tête ---------- */
    pdf.setFont("helvetica", "bold").setFontSize(14).setTextColor(...INK);
    pdf.text("TRAME", M, M + 2);
    pdf.setFont("helvetica", "bold").setFontSize(10.5);
    pdf.text("Fiche de fabrication atelier", M + 22, M + 2);
    pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GREY);
    pdf.text(stamp, pageW - M, M - 1.5, { align: "right" });
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
    pdf.text(
      `${sheet.moduleName}${sheet.subtitle ? ` · ${sheet.subtitle}` : ""}`,
      pageW - M,
      M + 3,
      { align: "right" },
    );
    pdf.setDrawColor(...ORANGE).setLineWidth(0.5);
    pdf.line(M, M + 6.5, pageW - M, M + 6.5);

    let y = M + 13;

    /* ---------- Paramètres (grille 4 colonnes : label / valeur) ---------- */
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...GREY);
    pdf.text("PARAMÈTRES", M, y);
    y += 2;

    const allParams: SheetParam[] = [
      ...sheet.params,
      { label: "Matériau", value: sheet.material?.trim() || "—" },
    ];
    const paramRows: string[][] = [];
    for (let i = 0; i < allParams.length; i += 2) {
      const a = allParams[i];
      const b = allParams[i + 1];
      paramRows.push([a.label, a.value, b?.label ?? "", b?.value ?? ""]);
    }

    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M },
      body: paramRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: { top: 1.6, right: 2.4, bottom: 1.6, left: 2.4 },
        lineColor: [228, 228, 231],
        lineWidth: 0.15,
        textColor: INK,
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.19, textColor: GREY },
        1: { cellWidth: contentW * 0.31, fontStyle: "bold" },
        2: { cellWidth: contentW * 0.19, textColor: GREY },
        3: { cellWidth: contentW * 0.31, fontStyle: "bold" },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (pdf as any).lastAutoTable.finalY + 8;

    /* ---------- Schéma (PNG haute résolution, max 80 mm de hauteur) ---------- */
    if (sheet.svgMarkup) {
      const png = await svgToPng(sheet.svgMarkup, 3);
      if (png) {
        const maxH = 80;
        let w = contentW;
        let h = (png.h / png.w) * w;
        if (h > maxH) {
          h = maxH;
          w = (png.w / png.h) * h;
        }
        if (y + h + 10 > pageH - FOOT_H) {
          pdf.addPage();
          y = M + 6;
        }
        pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...GREY);
        pdf.text("SCHÉMA DE CALEPINAGE", M, y);
        y += 3;
        pdf.setDrawColor(228, 228, 231).setLineWidth(0.2);
        pdf.rect(M, y, contentW, h + 6);
        pdf.addImage(png.data, "PNG", M + (contentW - w) / 2, y + 3, w, h);
        y += h + 14;
      }
    }

    /* ---------- Tableau des cotes ---------- */
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...GREY);
    if (y + 14 > pageH - FOOT_H) {
      pdf.addPage();
      y = M + 6;
    }
    pdf.text(`COTES DE PERÇAGE (${sheet.rows.length})`, M, y);
    y += 2;

    const colStyles: Record<number, { halign: "left" | "right" | "center" }> = {};
    sheet.columns.forEach((c, i) => {
      colStyles[i] = { halign: alignFor(c, i) };
    });

    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M, bottom: FOOT_H },
      head: [sheet.columns],
      body: sheet.rows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: { top: 1.7, right: 2.6, bottom: 1.7, left: 2.6 },
        lineColor: [212, 212, 216],
        lineWidth: 0.15,
        textColor: INK,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: HEAD_BG,
        textColor: INK,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: colStyles,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (pdf as any).lastAutoTable.finalY + 6;

    if (sheet.notes?.length) {
      if (y + sheet.notes.length * 4 > pageH - FOOT_H) {
        pdf.addPage();
        y = M + 6;
      }
      pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY);
      for (const n of sheet.notes) {
        pdf.text(`• ${n}`, M, y);
        y += 3.8;
      }
    }

    /* ---------- Pied de page fixe (visas) sur chaque page ---------- */
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      const baseY = pageH - 18;
      const colW = contentW / 3;
      const labels = ["Validé par", "Date", "Visa atelier"];
      pdf.setDrawColor(...INK).setLineWidth(0.25);
      labels.forEach((label, i) => {
        const x = M + i * colW;
        const w = colW - 8;
        pdf.line(x, baseY, x + w, baseY);
        pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY);
        pdf.text(label, x, baseY + 3.6);
      });
      pdf.setDrawColor(228, 228, 231).setLineWidth(0.2);
      pdf.line(M, pageH - 9, pageW - M, pageH - 9);
      pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GREY);
      pdf.text("Trame — cotes en millimètres", M, pageH - 5.5);
      pdf.text(`Page ${p}/${pages} · ${stamp}`, pageW - M, pageH - 5.5, { align: "right" });
    }

    pdf.save(sheetFileName(sheet.moduleName, now));
    return true;
  } catch {
    return false;
  }
}
