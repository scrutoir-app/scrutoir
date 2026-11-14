// Un chapitre : son anneau et ses comptes, les mêmes filtres, les mesures dans l'ordre du livre
// sous les intertitres du livre (texte exact, coupé à 3 lignes à l'écran, lu en entier par les
// lecteurs d'écran), puis le hors champ avec son motif.
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS } from "../../theme";
import type { Nav } from "../../nav";
import type { Famille, Filtre, MesureLegere, SousNeutre } from "../../presidentielle/types";
import { comptesDe, confrontables, correspond, mesuresDuChapitre } from "../../presidentielle/logique";
import { domaine, getProgramme } from "../../presidentielle/donnees";
import { MOT_STATUT, annonceFiltre, comptesEnLettres, familleStatut, ligneComptes, metaMesure, nombre } from "../../presidentielle/libelles";
import { useData } from "../../hooks/useData";
import { ErreurChargement } from "../../components/ErreurChargement";
import { AnnoncePolie, Anneaux, Bloc, Entree, Kicker, LigneComptes, PastilleVerdict, Pression } from "../../components/presidentielle/primitives";
import { FiltresVerdict } from "../../components/presidentielle/filtres";
import { track } from "../../analytics";
import { Chargement, LienExterne, MARGE, useProgrammeEnService, useRenvoiAccueil } from "./commun";

export function ChapitreScreen({
  programme,
  chapitre,
  filtre = "toutes",
  sous = "tout",
  nav,
}: {
  programme: string;
  chapitre: string;
  filtre?: Filtre;
  sous?: SousNeutre;
  nav: Nav;
}) {
  const { resume } = useProgrammeEnService(programme, nav);
  const id = resume?.id ?? programme;
  const { data: p, error, retry } = useData(() => getProgramme(id), [id]);
  const ch = p?.chapitres.find((c) => c.id === chapitre) ?? null;
  useRenvoiAccueil(!!p && !ch, nav);
  if (!resume) return <Chargement />;
  if (error && !p) return <ErreurChargement onRetry={retry} />;
  if (!p || !ch) return <Chargement />;

  const toutes = mesuresDuChapitre(p, ch.id);
  const conf = toutes.filter((m) => m.statut !== "h");
  const hors = toutes.filter((m) => m.statut === "h");
  const k = comptesDe(conf.map((m) => m.statut));
  const on = (f: Famille) => filtre === "toutes" || filtre === f;
  const affichees = conf.filter((m) => correspond(m.statut, filtre, sous));
  // Intertitres du livre, dans l'ordre.
  const sections: { titre: string | null; mesures: MesureLegere[] }[] = [];
  for (const m of affichees) {
    const last = sections[sections.length - 1];
    if (last && last.titre === m.section) last.mesures.push(m);
    else sections.push({ titre: m.section, mesures: [m] });
  }
  const changer = (f: Filtre, s: SousNeutre) => {
    track("filtre", p.id, f === "toutes" ? "toutes" : f === "n" && s !== "tout" ? `n_${s}` : f);
    nav.replace({ name: "chapitre", programme: p.id, chapitre: ch.id, filtre: f, sous: s });
  };
  const site = domaine(ch.url);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: MARGE, paddingTop: 16, paddingBottom: 48, gap: 12 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 4 }}>
        <Kicker>Partie {ch.partie} · Chapitre {ch.numero}</Kicker>
        <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>{ch.titre}</Text>
        <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>
          {nombre(conf.length)} {conf.length > 1 ? "mesures confrontables" : "mesure confrontable"} sur {nombre(toutes.length)}
        </Text>
        <LienExterne url={ch.url} libelle={site ? `Texte du chapitre sur ${site}` : "Texte du chapitre"} />
      </View>

      <Bloc style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Anneaux
          taille={72}
          epaisseur={12}
          pas={0}
          cleSession={`chapitre:${p.id}.${ch.id}`}
          label={`${ch.titre} : ${comptesEnLettres(k)}, sur ${nombre(confrontables(k))} mesures confrontables`}
          anneaux={[{ cle: "ch", comptes: k, opacite: (f) => (on(f) ? 1 : 0.22) }]}
        />
        <View style={{ gap: 3 }}>
          <Text style={[T.small, tnum, { fontFamily: F.extra, color: C.text }]}>{nombre(confrontables(k))} confrontables</Text>
          <LigneComptes texte={ligneComptes(k, "   ")} style={[T.small, { fontFamily: F.bold }]} />
        </View>
      </Bloc>

      <FiltresVerdict comptes={k} filtre={filtre} sous={sous} onChange={changer} />
      <AnnoncePolie texte={annonceFiltre(affichees.length)} />

      <Entree cle={`chapitre:${p.id}.${ch.id}`} gap={16}>
        {sections.map((sec, si) => (
          <View key={`${sec.titre ?? ""}-${si}`} style={{ gap: 8 }}>
            {!!sec.titre && <Kicker>{sec.titre}</Kicker>}
            <Bloc style={{ borderRadius: RADIUS.md, overflow: "hidden" }}>
              {sec.mesures.map((m, i) => (
                <Pression
                  key={m.id}
                  onPress={() => nav.push({ name: "mesure", programme: p.id, mesure: m.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.cle ? "Mesure clé. " : ""}${m.texte}. ${metaMesure(m.statut, m.nScrutins)}`}
                  style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: i === sec.mesures.length - 1 ? 0 : 1, borderBottomColor: C.border }}
                >
                  <PastilleVerdict famille={familleStatut(m.statut)} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    {m.cle && <Kicker style={{ fontFamily: F.extra, color: C.accent }}>Mesure clé</Kicker>}
                    <Text numberOfLines={3} style={[T.callout, { fontFamily: F.bold, color: C.text, lineHeight: 20 }]}>{m.texte}</Text>
                    <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{metaMesure(m.statut, m.nScrutins)}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.textFaint} />
                </Pression>
              ))}
            </Bloc>
          </View>
        ))}
      </Entree>
      {affichees.length === 0 && <Text style={[T.small, { color: C.textMuted }]}>Aucune mesure de ce chapitre pour ce filtre.</Text>}

      {filtre === "toutes" && hors.length > 0 && (
        <View style={{ gap: 10, padding: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.borderStrong, borderRadius: RADIUS.md }}>
          <Text accessibilityRole="header" style={[T.callout, tnum, { fontFamily: F.extra, color: C.text }]}>
            {nombre(hors.length)} {hors.length > 1 ? "mesures hors champ" : "mesure hors champ"}
          </Text>
          <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>
            Aucun vote de l’Assemblée ne peut les porter : intentions générales, mesures réglementaires.
          </Text>
          {hors.map((m) => (
            <View key={m.id} accessible accessibilityLabel={`${m.texte}. ${MOT_STATUT.h} : ${m.motifHorsChamp ?? ""}`} style={{ gap: 2 }}>
              <Text numberOfLines={2} style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 18 }]}>{m.texte}</Text>
              {!!m.motifHorsChamp && <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 15 }]}>{m.motifHorsChamp}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
