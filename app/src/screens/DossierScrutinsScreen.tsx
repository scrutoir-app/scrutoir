import React, { useEffect, useMemo, useState } from "react";
import { getDossier } from "../api";
import type { DetailDossier, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";

// Scrutins d'un dossier législatif présentés via le composant mutualisé ScrutinList (Fil/Liste).
// Cible de « Voir tout le texte » depuis la fiche scrutin. Les `ScrutinDossier` sont « sparse »
// (pas de comptes/dossier_titre) → mappés en ScrutinResume minimal, les cartes complètent le reste
// depuis le détail (hydratation via useScrutinGroupes). La catégorie du dossier alimente le motif.
type DossierScrutin = ScrutinResume & { nature: string };

export function DossierScrutinsScreen({ dossierRef, titre, nav }: { dossierRef: string; titre: string; nav: Nav }) {
  const [dossier, setDossier] = useState<DetailDossier | null>(null);

  useEffect(() => {
    getDossier(dossierRef).then(setDossier).catch(() => setDossier(null));
  }, [dossierRef]);

  const scrutins: DossierScrutin[] | null = useMemo(() => {
    if (!dossier) return null;
    // Vote final (« ensemble ») en tête, puis le reste par n° décroissant (le plus récent d'abord).
    const list = [...dossier.scrutins].sort((a, b) => {
      const fa = a.nature === "ensemble" ? 0 : 1;
      const fb = b.nature === "ensemble" ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (b.numero ?? 0) - (a.numero ?? 0);
    });
    return list.map((sc) => ({
      uid: sc.uid,
      numero: sc.numero,
      date: sc.date,
      titre: sc.titre,
      objet: sc.objet,
      sort_code: sc.sort_code,
      sort_libelle: null,
      categorie: dossier.categorie,
      dossier_ref: dossier.ref,
      nature: sc.nature,
    }));
  }, [dossier]);

  return (
    <ScrutinList
      scrutins={scrutins}
      contexte={{ titre: "Tout le texte", sousTitre: `${titre} · ${scrutins?.length ?? 0} scrutins` }}
      emptyLabel="Aucun scrutin public sur ce texte."
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro" })}
    />
  );
}
