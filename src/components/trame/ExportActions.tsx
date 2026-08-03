import { useState, type RefObject } from "react";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  downloadDxf,
  downloadWorkshopSheetPdf,
  serializeSvg,
  type ExportHole,
  type SheetParam,
} from "@/lib/trame-export";


export interface ExportActionsProps {
  moduleName: string;
  subtitle?: string;
  is2D: boolean;
  width: number;
  height?: number;
  holes: ExportHole[];
  defaultDia?: number;
  params: SheetParam[];
  columns: string[];
  rows: string[][];
  notes?: string[];
  svgRef?: RefObject<SVGSVGElement | null>;
  disabled?: boolean;
}

export function ExportActions({
  moduleName,
  subtitle,
  is2D,
  width,
  height = 0,
  holes,
  defaultDia,
  params,
  columns,
  rows,
  notes,
  svgRef,
  disabled,
}: ExportActionsProps) {
  const [material, setMaterial] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const off = disabled || !holes.length;

  const onDxf = () => {
    try {
      downloadDxf({ moduleName, width, height, is2D, holes, defaultDia });
      toast.success("Fichier DXF généré");
    } catch {
      toast.error("Échec de la génération DXF");
    }
  };

  const onPdf = async () => {
    setPdfBusy(true);
    try {
      const ok = await downloadWorkshopSheetPdf({
        moduleName,
        subtitle,
        material,
        params,
        svgMarkup: serializeSvg(svgRef?.current ?? null),
        columns,
        rows,
        notes,
      });
      if (ok) toast.success("Fiche d'atelier PDF téléchargée");
      else toast.error("Échec de la génération du PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Exports</span>
      <Button variant="outline" size="sm" onClick={onDxf} disabled={off} className="gap-1.5">
        <FileDown className="size-3.5" />
        Exporter DXF (.dxf)
      </Button>
      <Button
        size="sm"
        onClick={onPdf}
        disabled={off || pdfBusy}
        className="gap-1.5 bg-[var(--color-trame)] text-white hover:bg-[var(--color-trame)]/90"
      >
        {pdfBusy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
        {pdfBusy ? "Génération…" : "Fiche d'Atelier (PDF)"}
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <label htmlFor={`mat-${moduleName}`} className="text-xs text-muted-foreground">
          Matériau
        </label>
        <Input
          id={`mat-${moduleName}`}
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="Alu 3 mm, Tôle laquée…"
          className="h-9 w-[190px] text-xs"
        />
      </div>
    </div>
  );
}
