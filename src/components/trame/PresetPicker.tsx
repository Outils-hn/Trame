import { MATERIAL_PRESETS, getPreset, type MaterialPreset } from "@/lib/trame-presets";
import { Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

/**
 * Sélecteur de préréglages matériaux / profilés.
 * "manual" = saisie manuelle (aucun champ modifié).
 */
export function PresetPicker({ onApply }: { onApply: (p: MaterialPreset) => void }) {
  const [value, setValue] = useState("manual");

  const onChange = (v: string) => {
    setValue(v);
    const preset = getPreset(v);
    if (preset) onApply(preset);
  };

  const current = getPreset(value);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="size-3.5 text-[var(--color-trame)]" />
        <h2 className="text-sm font-semibold">Préréglages matériaux / profilés</h2>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-xs" aria-label="Préréglage matériau">
          <SelectValue placeholder="Saisir manuellement" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual" className="text-xs">
            Saisir manuellement
          </SelectItem>
          {MATERIAL_PRESETS.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {current ? current.hint : "Choisissez un préréglage pour pré-remplir les rives et l'entraxe max."}
      </p>
    </section>
  );
}
