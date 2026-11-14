// Liens profonds de la rubrique → pile de navigation complète, pour que le retour suive
// toujours le même chemin (Accueil > Tous les programmes > Un programme > Un chapitre > Une mesure).
import type { Route } from "../nav";
import type { IndexPresidentielle } from "./types";
import { cibleLienProfond, estCodeChiffrage, type CibleLien } from "./logique";

export function pileDeCible(c: CibleLien): Route[] {
  const base: Route[] = [{ name: "search" }, { name: "presidentielle" }];
  if (c.ecran === "presidentielle") return base;
  if (c.ecran === "programme") return [...base, { name: "programme", programme: c.programme }];
  if (c.ecran === "chapitre")
    return [...base, { name: "programme", programme: c.programme }, { name: "chapitre", programme: c.programme, chapitre: c.chapitre }];
  if (estCodeChiffrage(c.mesure))
    return [...base, { name: "programme", programme: c.programme, perimetre: "ch" }, { name: "mesure", programme: c.programme, mesure: c.mesure }];
  const chap = c.mesure.split("-")[0];
  return [
    ...base,
    { name: "programme", programme: c.programme },
    { name: "chapitre", programme: c.programme, chapitre: chap },
    { name: "mesure", programme: c.programme, mesure: c.mesure },
  ];
}

/** `?open=…` de la rubrique → pile, ou null (accueil, sans message d'erreur). */
export function pileLienProfond(open: string, index: IndexPresidentielle | null | undefined): Route[] | null {
  const c = cibleLienProfond(open, index);
  return c ? pileDeCible(c) : null;
}
