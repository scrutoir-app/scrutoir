import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, S, tnum, RADIUS, CONTROL, shadowCard } from "../theme";
import { Button } from "../components/ui";
import { ErreurChargement } from "../components/ErreurChargement";
import { HemicycleLogo } from "../components/HemicycleLogo";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { catUI } from "../categoryUI";
import { titreCourt, issueDe } from "../hebdo";
import {
  getDossiersSitues, getCategories, getDossier, getTestProximite, getPartis, getNumeroVersDossier, getScrutinsParUids,
} from "../api";
import { useData } from "../hooks/useData";
import { chargerTest } from "../testProximite/storage";
import {
  accordsParTexte, libelleGroupes, majoriteCommeToi, phraseAccord, progressionTest, type Accord,
} from "../testProximite/accordsTexte";
import type { Nav } from "../nav";

// « Tes accords » — Qui a voté comme toi (maquette validée le 15/10/2026,
// `maquette-tes-accords-qui-a-vote-comme-toi.html`). Les TEXTES où tu t'es prononcé au test
// (≥ 1 réponse pour / contre), jamais un sujet au hasard. Par texte, l'hémicycle du logo :
// chaque siège en vert si son groupe a voté comme toi, en rouge sinon, en gris s'il s'est
// abstenu ou n'a pas de position (égalité, aucun votant). Position du groupe recalculée sur ses
// votants (`positionMajoritaire`, decompte.ts). Aucun nom de groupe à côté d'un accord.
//
// Vie privée (art. 9 RGPD) : tout se calcule sur l'appareil, à partir de fichiers chargés pour
// tout le monde (questions du test, index des scrutins et des textes, groupes) ; aucune requête
// ni mesure d'audience ne dépend de tes réponses ou de tes accords.

const couleurAccord = (): Record<Accord, string> => ({ comme: C.pour, pas: C.contre, neutre: C.siege });

function Legende() {
  const c = couleurAccord();
  const items: [string, string][] = [[c.comme, "comme toi"], [c.pas, "pas comme toi"], [c.neutre, "abstention ou égalité"]];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12, marginHorizontal: 2 }}>
      {items.map(([couleur, label]) => (
        <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleur }} />
          <Text style={[T.micro, { color: C.textMuted }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function AccordsIndexScreen({ nav }: { nav: Nav }) {
  // Réponses lues sur l'appareil (stockage local), sans attendre le calcul du spectre.
  const reponses = useMemo(() => chargerTest()?.reponses ?? {}, []);
  const { data, loading, error, retry } = useData(async () => {
    const [situes, cats, questions, partis, num2dos] = await Promise.all([
      getDossiersSitues(reponses), getCategories(), getTestProximite(), getPartis(), getNumeroVersDossier(),
    ]);
    const groupes = partis.filter((p) => p.abrev && ORDRE_HEMICYCLE.includes(p.abrev));
    const accords = accordsParTexte(situes.map((s) => s.dossier.ref), questions, reponses, (n) => num2dos.get(n), groupes.map((g) => g.abrev!));
    // Issue du vote comparé (index public des scrutins, déjà chargé).
    const scrs = await getScrutinsParUids(accords.map((a) => `VTANR5L17V${a.numero}`));
    const sorts = new Map(scrs.map((s) => [s.numero, s.sort_code]));
    const parRef = new Map(situes.map((s) => [s.dossier.ref, s.dossier]));
    const lignes = accords.map((a) => ({ accord: a, dossier: parRef.get(a.ref)!, sort: sorts.get(a.numero) ?? null }));
    return { lignes, groupes, cats, prog: progressionTest(questions, reponses) };
  }, []);

  const lignes = data?.lignes ?? [];
  const [ouvre, setOuvre] = useState<string | null>(null); // ref du dossier en cours d'ouverture
  const couleurs = couleurAccord();
  const libelleCat = (id: string | null) => (id ? catUI(id).court ?? data?.cats.find((c) => c.id === id)?.libelle ?? null : null);

  // Tap sur un texte → on ouvre DIRECTEMENT la fiche de son VOTE FINAL (nature « ensemble »),
  // qui porte déjà « Voir tout le texte » — pas d'écran-liste intermédiaire. Repli sur la liste
  // du dossier si aucun scrutin n'est résolu.
  const ouvrirTexte = async (ref: string, titre: string) => {
    if (ouvre) return;
    setOuvre(ref);
    try {
      const d = await getDossier(ref);
      const final =
        [...d.scrutins].filter((s) => s.nature === "ensemble").sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0))[0]
        ?? d.scrutins[0];
      if (final) nav.push({ name: "scrutin", uid: final.uid });
      else nav.push({ name: "dossierScrutins", ref, titre });
    } catch {
      nav.push({ name: "dossierScrutins", ref, titre });
    } finally {
      setOuvre(null);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36 }}>
      <Text style={[T.title, { color: C.text, marginHorizontal: 2 }]} accessibilityRole="header">Qui a voté comme toi</Text>
      {lignes.length > 0 && (
        <Text style={[T.small, { color: C.textMuted, marginTop: 4, marginHorizontal: 2 }]}>
          {lignes.length > 1 ? `Sur les ${lignes.length} textes où tu t'es situé` : "Sur le texte où tu t'es situé"}
        </Text>
      )}

      {loading && !data ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : error && !data ? (
        <ErreurChargement onRetry={retry} compact />
      ) : lignes.length === 0 ? (
        <View style={{ paddingHorizontal: 4, paddingTop: 30, alignItems: "center" }}>
          <Feather name="compass" size={36} color={C.textFaint} />
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 14, textAlign: "center" }]}>Tu ne t'es pas encore situé</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 6, textAlign: "center", lineHeight: 20 }]}>
            Fais le test de proximité : chaque texte où tu tranches un vote arrive ici, avec les groupes qui ont voté comme toi.
          </Text>
          <Button label="Me situer" onPress={() => nav.push({ name: "testIntro" })} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: 14, backgroundColor: C.surface, borderRadius: RADIUS.lg, overflow: "hidden", ...shadowCard }}>
            {lignes.map(({ accord: a, dossier, sort }, i) => {
              const titre = titreCourt(dossier.titre);
              const issue = issueDe(sort);
              const meta = [libelleCat(dossier.categorie), issue === "adopte" ? "adopté" : issue === "rejete" ? "rejeté" : null].filter(Boolean).join(" · ");
              const majorite = majoriteCommeToi(a);
              const phrase = phraseAccord(a);
              return (
                <React.Fragment key={dossier.ref}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 90 }} />}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={!!ouvre}
                    onPress={() => ouvrirTexte(dossier.ref, dossier.titre)}
                    accessibilityRole="button"
                    accessibilityLabel={`${titre}. Toi : ${a.reponse}. ${phrase}. Ouvrir le vote final`}
                    style={{ flexDirection: "row", alignItems: "center", gap: S.s12, paddingVertical: 13, paddingLeft: 14, paddingRight: 10, opacity: ouvre && ouvre !== dossier.ref ? 0.5 : 1 }}
                  >
                    <HemicycleLogo groupes={data!.groupes} size={64} couleur={(ab) => couleurs[a.parGroupe[ab] ?? "neutre"]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {!!meta && <Text style={[T.micro, { color: C.textFaint }]} numberOfLines={1}>{meta}</Text>}
                      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: meta ? 2 : 0 }]} numberOfLines={2}>{titre}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <View style={{ backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]}>Toi : {a.reponse}</Text>
                        </View>
                        <View style={{ backgroundColor: majorite ? C.adopteBg : C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={[T.micro, tnum, { fontFamily: F.bold, color: majorite ? C.adopteFg : C.textMuted }]}>{libelleGroupes(a.comme, a.total)}</Text>
                        </View>
                      </View>
                    </View>
                    {ouvre === dossier.ref ? (
                      <ActivityIndicator color={C.textFaint} />
                    ) : (
                      <Feather name="chevron-right" size={16} color={C.textFaint} />
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>

          <Legende />

          {(data?.prog.restants ?? 0) > 0 && (
            <Button
              label="Te situer sur d'autres textes"
              onPress={() => nav.push({ name: "test", mode: "affiner" })}
              fullWidth
              size="lg"
              style={{ marginTop: 14, minHeight: CONTROL.lg, borderRadius: RADIUS.md }}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
