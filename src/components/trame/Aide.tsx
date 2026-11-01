import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Petite aide qui s'ouvre au clic ou à Entrée (pas au survol : ça marche aussi sur téléphone).
 * `children` = le déclencheur (pastille ou « ? ») ; `texte` = une ou deux phrases.
 */
export function Aide({ nom, texte, children, className }: { nom: string; texte: string; children: ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`Aide : ${nom}`}
        // Dans le tableau des résultats, un clic sur l'aide ne doit pas changer la ligne choisie
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn("cursor-help rounded-full outline-none max-sm:inline-flex max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center max-sm:justify-center focus-visible:ring-2 focus-visible:ring-[var(--color-trame)]", className)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-xs leading-relaxed" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 font-semibold text-foreground">{nom}</p>
        <p className="text-muted-foreground">{texte}</p>
      </PopoverContent>
    </Popover>
  );
}
