import { useEffect, useState } from "react";
import { Check, ChevronDown, Search, Keyboard } from "lucide-react";
import { RaccourcisApplis, useToucheAide } from "./RaccourcisApplis";
import { ACCUEIL_URL } from "./LienRetour";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Les applis de la famille : de simples liens vers leurs adresses publiees.
 * Chaque appli reste independante (ses donnees restent sur son propre site).
 */
const APPLIS = [
  { nom: "Access", role: "Annuaire fournisseurs", url: "https://outils-hn.github.io/Access/", couleur: "#C2255C" },
  { nom: "Check", role: "Notes & tâches", url: "https://outils-hn.github.io/Check/", couleur: "#4338CA" },
  { nom: "Format", role: "Débit de panneaux", url: "https://outils-hn.github.io/Format/", couleur: "#FF4D00" },
  { nom: "Index", role: "Fiches techniques", url: "https://outils-hn.github.io/Index/", couleur: "#6D4AFF" },
  { nom: "Joint", role: "Dilatation et joints", url: "https://outils-hn.github.io/Joint/", couleur: "#0B7285" },
  { nom: "Linear", role: "Mise en barre", url: "https://outils-hn.github.io/Linear/", couleur: "#2B50FF" },
  { nom: "Masse", role: "Poids des éléments", url: "https://outils-hn.github.io/Masse/", couleur: "#9A4A3A" },
  { nom: "Membrane", role: "Étanchéité", url: "https://outils-hn.github.io/Membrane/", couleur: "#B45309" },
  { nom: "Strate", role: "Épaisseurs d'isolation", url: "https://outils-hn.github.io/Strate/", couleur: "#D4A20B" },
  { nom: "Trame", role: "Répartition de perçages", url: "https://outils-hn.github.io/Trame/", couleur: "#0E9F6E" },
] as const;


const ACTUELLE = "Trame";

/** Ctrl+K : ouvre la recherche de l'Accueil dans un autre onglet (on ne quitte pas ce qu'on est en train de faire). */
const RECHERCHE_URL = "https://outils-hn.github.io/#recherche";
function useRaccourciRecherche() {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); window.open(RECHERCHE_URL, "outils-accueil"); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
}

export function SelecteurApplis() {
  useRaccourciRecherche();
  const [raccourcis, setRaccourcis] = useState(false);
  useToucheAide(() => setRaccourcis(true));
  const applis = APPLIS;
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="Changer d'application">
        <h1 className="text-[17px] font-semibold leading-none tracking-tight text-foreground">{ACTUELLE}</h1>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Mes outils</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={ACCUEIL_URL} className="flex items-center gap-2.5">
            {/* Pastille aux couleurs de la famille */}
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "conic-gradient(#C2255C 0 25%, #6D4AFF 0 50%, #0E9F6E 0 75%, #FF4D00 0)" }} />
            <span className="w-[4.5rem] shrink-0 font-medium">Accueil</span>
            <span className="text-xs text-muted-foreground">Toutes les applis, idées &amp; bugs</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={RECHERCHE_URL} target="outils-accueil" className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center"><Search className="!size-4 shrink-0 text-muted-foreground" aria-hidden /></span>
            <span className="w-[4.5rem] shrink-0 font-medium">Rechercher</span>
            <span className="text-xs text-muted-foreground">Dans toutes les applis · Ctrl K</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {applis.map((a) => (
          <DropdownMenuItem key={a.nom} asChild>
            <a href={a.url} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: a.couleur }} />
              {/* Largeur fixe : les descriptions commencent toutes au meme endroit */}
              <span className="w-[4.5rem] shrink-0 font-medium">{a.nom}</span>
              <span className="text-xs text-muted-foreground">{a.role}</span>
              {a.nom === ACTUELLE && <Check className="ml-auto h-3.5 w-3.5" />}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setRaccourcis(true)} className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center"><Keyboard className="!size-4 shrink-0 text-muted-foreground" aria-hidden /></span>
          <span className="w-[4.5rem] shrink-0 font-medium">Raccourcis</span>
          <span className="text-xs text-muted-foreground">Touches du clavier · ?</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <RaccourcisApplis app="Trame" open={raccourcis} onOpenChange={setRaccourcis} />
    </>
  );
}
