import { useEffect, useMemo, useState } from "react";
import { getSourceHebdo } from "../api";
import {
  aujourdhuiParis,
  vendrediParu,
  construireEdition,
  editionsAvecContenu,
  textesFocus,
  texteDuScrutin,
  type EditionHebdo,
  type ScrutinSrc,
  type DossierSrc,
  type TexteHebdo,
} from "../hebdo";
import { focusDeLaSemaine, type FocusSemaine } from "../focusSemaine";

interface Source {
  scrutins: ScrutinSrc[];
  dossiers: Map<string, DossierSrc>;
  editions: string[]; // vendredis ayant au moins un scrutin, croissant
}

// Chargée une fois par session (les index sont déjà en cache côté api.ts).
let sourceP: Promise<Source> | null = null;
function chargerSource(): Promise<Source> {
  if (!sourceP) {
    sourceP = getSourceHebdo().then(({ scrutins, dossiers }) => ({
      scrutins,
      dossiers: new Map(dossiers.map((d) => [d.ref, d])),
      editions: editionsAvecContenu(scrutins),
    }));
    sourceP.catch(() => {
      sourceP = null; // pas d'échec figé en cache (même règle que api.ts)
    });
  }
  return sourceP;
}

export interface SemaineAccueil {
  /** Édition affichée : la dernière parue, ou à défaut la dernière qui contient des scrutins. */
  edition: EditionHebdo | null;
  /** true si l'édition affichée est celle parue ce vendredi (pas un repli). */
  estCourante: boolean;
  annee: string;
}

/** Semaine à montrer sur l'accueil. null tant que les données ne sont pas là (ou en échec). */
export function useSemaineAccueil(): SemaineAccueil {
  const [src, setSrc] = useState<Source | null>(null);
  useEffect(() => {
    let vivant = true;
    chargerSource().then((s) => vivant && setSrc(s)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  const aujourdhui = aujourdhuiParis();
  const courant = vendrediParu(aujourdhui);

  return useMemo(() => {
    const annee = aujourdhui.slice(0, 4);
    if (!src) return { edition: null, estCourante: false, annee };
    const e = construireEdition(courant, src.scrutins, src.dossiers);
    if (e.nbScrutins > 0) return { edition: e, estCourante: true, annee };
    const parues = src.editions.filter((v) => v <= courant);
    const repli = parues[parues.length - 1];
    return { edition: repli ? construireEdition(repli, src.scrutins, src.dossiers) : null, estCourante: false, annee };
  }, [src, courant, aujourdhui]);
}

export interface FocusSemaineAccueil {
  focus: FocusSemaine<ScrutinSrc>;
  /** Texte du scrutin dans son édition (même titre court que « La semaine à l'Assemblée »). */
  texte: TexteHebdo | null;
  annee: string;
}

/**
 * Focus de la semaine (focusSemaine.ts) : le scrutin de l'édition parue qui a réuni le plus de
 * votants, sur la même édition que `useSemaineAccueil`. null tant que les données ne sont pas là.
 */
export function useFocusSemaine(): FocusSemaineAccueil | null {
  const [src, setSrc] = useState<Source | null>(null);
  useEffect(() => {
    let vivant = true;
    chargerSource().then((s) => vivant && setSrc(s)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);
  const aujourdhui = aujourdhuiParis();
  const courant = vendrediParu(aujourdhui);
  return useMemo(() => {
    if (!src) return null;
    const focus = focusDeLaSemaine(src.scrutins, courant);
    if (!focus) return null;
    const texte = texteDuScrutin(focus.vendrediSource, focus.scrutin.uid, src.scrutins, src.dossiers);
    return { focus, texte, annee: aujourdhui.slice(0, 4) };
  }, [src, courant, aujourdhui]);
}

/** Focus actualité de l'accueil (content/focus.ts) et ses textes, ou null hors période / sans focus. */
export function useFocusActu(focus: import("../content/focus").FocusAN | null) {
  const [src, setSrc] = useState<Source | null>(null);
  useEffect(() => {
    let vivant = true;
    chargerSource().then((s) => vivant && setSrc(s)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);
  const aujourdhui = aujourdhuiParis();
  const actif = !!focus && aujourdhui >= focus.du && aujourdhui <= focus.au;
  return useMemo(
    () => (actif && src && focus ? textesFocus(focus, src.scrutins, src.dossiers) : null),
    [actif, src, focus],
  );
}
