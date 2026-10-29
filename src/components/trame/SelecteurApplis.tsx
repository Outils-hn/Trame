import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Les applis de la famille : de simples liens vers leurs adresses publiees.
 * Chaque appli reste independante (ses donnees restent sur son propre site).
 */
const APPLIS = [
  { nom: "Format", role: "Débit de panneaux", url: "https://format-hn.lovable.app", couleur: "#FF4D00" },
  { nom: "Index", role: "Fiches techniques", url: "https://index-hn.lovable.app", couleur: "#6D4AFF" },
  { nom: "Linear", role: "Mise en barre", url: "https://linear-hn.lovable.app", couleur: "#2B50FF" },
  { nom: "Masse", role: "Poids des éléments", url: "https://masse-hn.lovable.app", couleur: "#9A4A3A" },
  { nom: "Strate", role: "Épaisseurs d'isolation", url: "https://hnaegellen-hub.github.io/Strate/", couleur: "#D4A20B" },
  { nom: "Trame", role: "Répartition de perçages", url: "https://trame-hn.lovable.app", couleur: "#0E9F6E" },
] as const;

const ACTUELLE = "Trame";

export function SelecteurApplis() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="Changer d'application">
        <h1 className="text-[17px] font-semibold leading-none tracking-tight text-foreground">{ACTUELLE}</h1>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Mes outils</DropdownMenuLabel>
        {APPLIS.map((a) => (
          <DropdownMenuItem key={a.nom} asChild>
            <a href={a.url} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: a.couleur }} />
              {/* Largeur fixe : les descriptions commencent toutes au meme endroit */}
              <span className="w-14 shrink-0 font-medium">{a.nom}</span>
              <span className="text-xs text-muted-foreground">{a.role}</span>
              {a.nom === ACTUELLE && <Check className="ml-auto h-3.5 w-3.5" />}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
