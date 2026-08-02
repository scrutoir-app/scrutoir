import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { Chip } from "../components/ui";
import { ErreurChargement } from "../components/ErreurChargement";
import { getDossiersSitues, getCategories, getDossier } from "../api";
import { useData } from "../hooks/useData";
import { useJe } from "../testProximite/jeProximite";
import type { Nav } from "../nav";

// INDEX « Tes accords » (DONNÉES RÉELLES) : la liste des TEXTES où tu t'es prononcé au test
// (≥1 réponse pour/contre), jamais un sujet au hasard. Chaque carte ouvre la vue texte réelle.

export function AccordsIndexScreen({ nav }: { nav: Nav }) {
  const je = useJe();
  const reponses = je?.reponses ?? {};
  const { data, loading, error, retry } = useData(
    () => Promise.all([getDossiersSitues(reponses), getCategories()]),
    [Object.keys(reponses).length]
  );
  const dossiers = data?.[0] ?? [];
  const cats = data?.[1] ?? [];
  const libelleCat = (id: string | null) => (id ? cats.find((c) => c.id === id)?.libelle ?? id : "");
  const [ouvre, setOuvre] = useState<string | null>(null); // ref du dossier en cours d'ouverture

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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={[T.title, { fontFamily: F.extra, color: C.text, letterSpacing: -0.4 }]}>Tes accords</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 3, lineHeight: 20 }]}>
          Les textes où tu t'es prononcé. Ouvre-en un pour voir qui a voté comme toi.
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
        <Text style={[T.small, { fontFamily: F.extra, color: C.text }]}>Là où tu t'es situé</Text>
        {!loading && <Chip label={`${dossiers.length} texte${dossiers.length > 1 ? "s" : ""}`} bg={C.surfaceSunken} fg={C.textMuted} ph={9} pv={2} />}
      </View>

      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : error ? (
        <ErreurChargement onRetry={retry} />
      ) : dossiers.length === 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 30, alignItems: "center" }}>
          <Feather name="compass" size={36} color={C.textFaint} />
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 14, textAlign: "center" }]}>Tu ne t'es pas encore situé</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 6, textAlign: "center", lineHeight: 20 }]}>
            Fais le test de proximité : chaque scrutin que tu tranches ajoute son texte ici.
          </Text>
          <TouchableOpacity onPress={() => nav.push({ name: "testIntro" })} style={{ marginTop: 16, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.onAccent }]}>Me situer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        dossiers.map(({ dossier, nbSitue }) => (
          <TouchableOpacity
            key={dossier.ref}
            activeOpacity={0.7}
            disabled={!!ouvre}
            onPress={() => ouvrirTexte(dossier.ref, dossier.titre)}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir le vote final : ${dossier.titre}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 11, marginHorizontal: 16, marginTop: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, opacity: ouvre && ouvre !== dossier.ref ? 0.5 : 1, ...shadowCard }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              {dossier.categorie && (
                <View style={{ alignSelf: "flex-start", backgroundColor: C.surfaceSunken, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={[T.micro, { fontFamily: F.extra, letterSpacing: 0.3, color: C.textMuted }]}>{libelleCat(dossier.categorie).toUpperCase()}</Text>
                </View>
              )}
              <Text style={[T.small, { fontFamily: F.extra, color: C.text, lineHeight: 20, marginTop: dossier.categorie ? 7 : 0 }]} numberOfLines={3}>{dossier.titre}</Text>
              <Text style={[T.micro, { color: C.textMuted, marginTop: 5 }]}>
                Tu t'es situé sur <Text style={{ fontFamily: F.bold, color: C.text }}>{nbSitue} scrutin{nbSitue > 1 ? "s" : ""}</Text> · {dossier.nb_scrutins} publics
              </Text>
            </View>
            {ouvre === dossier.ref ? (
              <ActivityIndicator color={C.textFaint} />
            ) : (
              <Feather name="chevron-right" size={20} color={C.textFaint} />
            )}
          </TouchableOpacity>
        ))
      )}

      {dossiers.length > 0 && (
        <Text style={[T.micro, { color: C.textFaint, lineHeight: 17, paddingHorizontal: 18, paddingTop: 14 }]}>
          Ces textes contiennent les scrutins que tu as tranchés au test — c'est de là qu'on ouvre le détail, jamais un sujet au hasard.
        </Text>
      )}
    </ScrollView>
  );
}
