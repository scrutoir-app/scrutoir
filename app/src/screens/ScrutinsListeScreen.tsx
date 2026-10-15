import React, { useEffect, useMemo, useState } from "react";
import { getScrutinsRecents, getCategories, getIndexTextes } from "../api";
import { ScrutinList } from "../components/ScrutinList";
import { PucesThemes } from "../components/texteUI";
import { rechercherTextes } from "../textes";
import type { CategorieRef, ScrutinResume } from "../types";
import type { Nav } from "../nav";

// Les scrutins UN PAR UN, hors regroupement par texte (bascule Fil | Liste de `ScrutinList`) :
//  · sans `q` : les 150 derniers scrutins publics (« Voir les 150 derniers scrutins, un par un »,
//    sous-onglet Textes) — l'ancien flux de l'onglet Scrutins, Fil immersif compris ;
//  · avec `q` : tous les scrutins dont l'intitulé cite la recherche (« Les 49 scrutins qui citent… »).
const NB_RECENTS = 150;

type Scr = ScrutinResume & { cats?: string[] | null };
const dansTheme = (s: Scr, id: string) => (s.cats?.length ? s.cats.includes(id) : s.categorie === id);

export function ScrutinsListeScreen({ q, nav }: { q?: string; nav: Nav }) {
  const [scrutins, setScrutins] = useState<Scr[] | null>(null);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    setScrutins(null);
    const charge: Promise<Scr[]> = q
      ? getIndexTextes().then((idx) => rechercherTextes(q, idx).scrutins as Scr[])
      : getScrutinsRecents(NB_RECENTS);
    charge.then((l) => vivant && setScrutins(l)).catch(() => vivant && setScrutins([]));
    getCategories().then((c) => vivant && setCats(c)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [q]);

  // Thèmes réellement présents (pas de filtre vide).
  const themes = useMemo(() => {
    const ids = new Set<string>();
    (scrutins ?? []).forEach((s) => (s.cats?.length ? s.cats : s.categorie ? [s.categorie] : []).forEach((c) => ids.add(c)));
    return cats.filter((c) => ids.has(c.id));
  }, [scrutins, cats]);
  const visibles = useMemo(() => (scrutins == null ? null : scrutins.filter((s) => !theme || dansTheme(s, theme))), [scrutins, theme]);

  const n = visibles?.length ?? 0;
  return (
    <ScrutinList
      scrutins={visibles}
      vueInitiale="liste"
      contexte={
        q
          ? { titre: `Les scrutins qui citent « ${q} »`, sousTitre: `${n} scrutin${n > 1 ? "s" : ""}, du plus récent au plus ancien` }
          : { titre: `Les ${NB_RECENTS} derniers scrutins`, sousTitre: theme ? `${n} sur ce thème, un par un` : "Un par un, du plus récent au plus ancien" }
      }
      filtres={themes.length > 1 ? <PucesThemes cats={themes} actif={theme} onChange={setTheme} marge={0} /> : undefined}
      emptyLabel="Aucun scrutin"
      onDetail={(uid) => nav.push({ name: "scrutin", uid })}
      onSituer={() => nav.push({ name: "testIntro" })}
    />
  );
}
