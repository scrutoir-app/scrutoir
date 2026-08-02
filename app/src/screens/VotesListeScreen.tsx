import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { C, F, T, positionLabel, couleurPosition } from "../theme";
import { getVotesDepute } from "../api";
import type { VoteScrutin } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { TypeScrutinFilter } from "../components/TypeScrutinFilter";
import { compterParType, filtrerParType, doitAfficherFiltreType, typeEffectif, type TypeScrutin } from "../typeScrutin";

export function VotesListeScreen({
  uid, nom, categorie, categorieLibelle, position, nav,
}: {
  uid: string;
  nom: string;
  categorie: string;
  categorieLibelle: string;
  position: string;
  nav: Nav;
}) {
  const [scrutins, setScrutins] = useState<VoteScrutin[] | null>(null);
  const { filtered, Bar } = useScrutinDateFilter(scrutins ?? []);
  const [typeScr, setTypeScr] = useState<TypeScrutin>("tous");
  const voteExprime = position === "pour" || position === "contre" || position === "abstention";

  const comptesType = compterParType(filtered);
  const visibles = filtrerParType(filtered, typeEffectif(typeScr, comptesType));

  useEffect(() => {
    getVotesDepute(uid, categorie, position, "all").then(setScrutins);
  }, [uid, categorie, position]);

  const titre =
    position === "absent" || position === "nonvotant"
      ? `${nom} — n'a pas pris part`
      : `${nom} — a voté « ${positionLabel(position)} »`;

  // Annotation par-item : consigne du groupe sur ce scrutin + marqueur « écart ».
  const renderAnnotation = (s: VoteScrutin) =>
    voteExprime && s.consigne != null ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>consigne du groupe :</Text>
        <Text style={[T.micro, { fontFamily: F.bold, color: couleurPosition(s.consigne) }]}>{positionLabel(s.consigne)}</Text>
        {s.consigne !== position && <Text style={[T.micro, { fontFamily: F.bold, color: C.contre }]}>· écart</Text>}
      </View>
    ) : null;

  return (
    <ScrutinList
      scrutins={scrutins == null ? null : visibles}
      contexte={{ titre, sousTitre: `${visibles.length} scrutins en ${categorieLibelle}` }}
      filtres={
        <>
          {Bar}
          {doitAfficherFiltreType(comptesType) && (
            <TypeScrutinFilter value={typeScr} onChange={setTypeScr} counts={comptesType} />
          )}
        </>
      }
      emptyLabel="Aucun scrutin."
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro" })}
      renderAnnotation={renderAnnotation}
    />
  );
}
