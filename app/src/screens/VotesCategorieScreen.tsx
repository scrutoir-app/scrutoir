import React, { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { C, F, T, positionLabel, couleurPosition } from "../theme";
import { getVotesDeputeCategorie } from "../api";
import type { VoteScrutin, Periode } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";
import { TypeScrutinFilter } from "../components/TypeScrutinFilter";
import { compterParType, filtrerParType, doitAfficherFiltreType, typeEffectif, type TypeScrutin } from "../typeScrutin";

// Ordre d'affichage des positions (le regroupement visuel devient un TRI + une annotation
// par-item « A voté : … », le Fil paginé plein écran ne pouvant pas porter de sections).
const ORDRE = ["pour", "contre", "abstention", "nonvotant"];
const rang = (p: string) => { const i = ORDRE.indexOf(p); return i === -1 ? ORDRE.length : i; };

export function VotesCategorieScreen({
  uid, nom, categorie, categorieLibelle, periode, nav,
}: {
  uid: string;
  nom: string;
  categorie: string;
  categorieLibelle: string;
  periode: Periode;
  nav: Nav;
}) {
  const [votes, setVotes] = useState<VoteScrutin[] | null>(null);
  const [typeScr, setTypeScr] = useState<TypeScrutin>("tous");

  useEffect(() => {
    getVotesDeputeCategorie(uid, categorie, periode).then(setVotes);
  }, [uid, categorie, periode]);

  // Comptes sur la liste COMPLÈTE (chips stables), filtre puis tri par position.
  const comptesType = votes ? compterParType(votes) : { projet: 0, proposition: 0, amendement: 0 };
  const visibles = useMemo(() => {
    if (!votes) return null;
    const f = filtrerParType(votes, typeEffectif(typeScr, comptesType));
    return [...f].sort((a, b) => rang(a.position) - rang(b.position));
  }, [votes, typeScr]);

  const renderAnnotation = (s: VoteScrutin) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: couleurPosition(s.position) }} />
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>A voté : {positionLabel(s.position)}</Text>
    </View>
  );

  return (
    <ScrutinList
      scrutins={visibles}
      contexte={{ titre: categorieLibelle, sousTitre: `${nom} · ${visibles?.length ?? 0} scrutins` }}
      filtres={
        doitAfficherFiltreType(comptesType) ? (
          <TypeScrutinFilter value={typeScr} onChange={setTypeScr} counts={comptesType} />
        ) : undefined
      }
      emptyLabel="Aucun scrutin dans ce thème pour cette période."
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro" })}
      renderAnnotation={renderAnnotation}
    />
  );
}
