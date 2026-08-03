import { useState, type RefObject } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  downloadDxf,
  openWorkshopSheet,
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
  const off = disabled || !holes.length;

  const onDxf = () => {
    try {
      downloadDxf({ moduleName, width, height, is2D, holes, defaultDia });
      toast.success("Fichier DXF généré");
    } catch {
      toast.error("Échec de la génération DXF");
    }
  };

  const onPrint = () => {
    const ok = openWorkshopSheet({
      moduleName,
      subtitle,
      material,
      params,
      svgMarkup: serializeSvg(svgRef?.current ?? null),
      columns,
      rows,
      notes,
    });
    if (!ok) toast.error("Autorisez les fenêtres pop-up pour imprimer la fiche");
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
        onClick={onPrint}
        disabled={off}
        className="gap-1.5 bg-[var(--color-trame)] text-white hover:bg-[var(--color-trame)]/90"
      >
        <Printer className="size-3.5" />
        Imprimer / PDF Fiche d'Atelier
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
