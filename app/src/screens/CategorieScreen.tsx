import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../theme";
import { Card } from "../components/ui";
import { getScrutinsCategorie, getTestProximite } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinList } from "../components/ScrutinList";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { TypeScrutinFilter } from "../components/TypeScrutinFilter";
import { compterParType, filtrerParType, doitAfficherFiltreType, typeEffectif, type TypeScrutin } from "../typeScrutin";
import { compterParTheme, themeTestActif, MSG_THEME_VERROUILLE } from "../testProximite/config";

export function CategorieScreen({ id, libelle, nav }: { id: string; libelle: string; nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[] | null>(null);
  const [testActif, setTestActif] = useState(false);
  const { filtered, Bar } = useScrutinDateFilter(scrutins ?? []);
  const [typeScr, setTypeScr] = useState<TypeScrutin>("tous");

  const comptesType = compterParType(filtered);
  const visibles = filtrerParType(filtered, typeEffectif(typeScr, comptesType));

  useEffect(() => {
    getScrutinsCategorie(id).then(setScrutins);
  }, [id]);

  // Accès au test mono-thème : actif seulement si assez de questions validées sur ce thème.
  useEffect(() => {
    getTestProximite()
      .then((qs) => setTestActif(themeTestActif(compterParTheme(qs), id)))
      .catch(() => setTestActif(false));
  }, [id]);

  // Carte d'accès au test mono-thème, conservée en tête (avant les filtres).
  const testCTA = testActif ? (
    <Card
      onPress={() => nav.push({ name: "testIntro", theme: id, themeLibelle: libelle })}
      activeOpacity={0.85}
      bordered
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 }}
    >
      <Feather name="help-circle" size={18} color={C.accent} />
      <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={1}>Teste ta proximité sur {libelle}</Text>
      <Feather name="chevron-right" size={18} color={C.textFaint} />
    </Card>
  ) : (
    <Card raised={false} bordered style={{ paddingVertical: 11, opacity: 0.6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Feather name="lock" size={16} color={C.textFaint} />
        <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.textMuted }]} numberOfLines={1}>Teste ta proximité sur {libelle}</Text>
      </View>
      <Text style={[T.micro, { color: C.textFaint, marginTop: 6 }]}>{MSG_THEME_VERROUILLE}</Text>
    </Card>
  );

  return (
    <ScrutinList
      scrutins={scrutins == null ? null : visibles}
      contexte={{ titre: libelle, sousTitre: `${visibles.length} scrutins · les plus récents d'abord` }}
      filtres={
        <>
          {testCTA}
          {Bar}
          {doitAfficherFiltreType(comptesType) && (
            <TypeScrutinFilter value={typeScr} onChange={setTypeScr} counts={comptesType} />
          )}
        </>
      }
      emptyLabel="Aucun scrutin dans ce thème."
      onDetail={(u) => nav.push({ name: "scrutin", uid: u })}
      onSituer={() => nav.push({ name: "testIntro", theme: id, themeLibelle: libelle })}
    />
  );
}
