// Un programme : les sélections du parti (trois anneaux qui servent de sélecteur de périmètre),
// les filtres = / ≠ / ∅, le tamis des N mesures, puis les chapitres (ou, en « Chiffrées », les
// recettes et les dépenses, sans montants). Périmètre et filtres vivent dans la route.
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS } from "../../theme";
import type { Nav } from "../../nav";
import type { Comptes, Famille, Filtre, LigneChiffree, Perimetre, Programme, SousNeutre } from "../../presidentielle/types";
import { comptesDe, confrontables, correspond, mesuresDuChapitre, statutsDuPerimetre } from "../../presidentielle/logique";
import { getProgramme } from "../../presidentielle/donnees";
import { MOT_STATUT, PHRASE_MONTANTS, annonceFiltre, comptesEnLettres, dateLongue, familleStatut, ligneComptes, nombre } from "../../presidentielle/libelles";
import { useData } from "../../hooks/useData";
import { ErreurChargement } from "../../components/ErreurChargement";
import { AnnoncePolie, Anneaux, Bloc, Entree, Kicker, LigneComptes, MiniAnneau, PastilleVerdict, Pression, retourSelection } from "../../components/presidentielle/primitives";
import { FiltresVerdict } from "../../components/presidentielle/filtres";
import { Tamis } from "../../components/presidentielle/Tamis";
import { FeuilleMethode } from "../../components/presidentielle/FeuilleMethode";
import { track } from "../../analytics";
import { Chargement, LienMethode, MARGE, useProgrammeEnService } from "./commun";

const SELECTIONS: { id: Perimetre; nom: string; mesure: string }[] = [
  { id: "all", nom: "Tout le programme", mesure: "tout" },
  { id: "cle", nom: "Mesures clés du parti", mesure: "cles" },
  { id: "ch", nom: "Chiffrées par le parti", mesure: "chiffrees" },
];

export function echelleSelection(p: Programme, id: Perimetre): string {
  if (id === "all") return `${nombre(p.comptes.confrontables)} confrontables sur ${nombre(p.comptes.mesures)}`;
  if (id === "cle") return `${nombre(p.comptes.clesConfrontables)} confrontables sur ${nombre(p.comptes.cles)}`;
  return `${nombre(p.comptes.chiffrees)} sur ${nombre(p.comptes.mesures)}`;
}

export function libelleAnneaux(p: Programme): string {
  const v = p.verdicts;
  return `Tout le programme : ${comptesEnLettres(v.all)}. Mesures clés : ${comptesEnLettres(v.cle)}. Chiffrées par le parti : ${comptesEnLettres(v.ch)}.`;
}

/** Trois anneaux concentriques, chacun fait le tour de son propre total. Partagé avec la fiche parti. */
export function AnneauxSelections({ p, perimetre, filtre, taille }: { p: Programme; perimetre: Perimetre | null; filtre: Filtre; taille: number }) {
  const on = (f: Famille) => filtre === "toutes" || filtre === f;
  const ep = Math.round(taille * 0.094);
  return (
    <Anneaux
      taille={taille}
      epaisseur={ep}
      pas={Math.round(taille * 0.1125)}
      cleSession={`programme:${p.id}`}
      label={libelleAnneaux(p)}
      anneaux={SELECTIONS.map((s) => ({
        cle: s.id,
        comptes: p.verdicts[s.id],
        opacite: (f: Famille) => (perimetre === null || s.id === perimetre ? (on(f) ? 1 : 0.22) : 0.16),
      }))}
    />
  );
}

function noteDePerimetre(p: Programme, perimetre: Perimetre): string {
  if (perimetre === "all")
    return `+ ${nombre(p.comptes.horsChamp)} mesures hors champ, à part, chacune avec son motif : aucun vote de l’Assemblée ne peut les porter.`;
  if (perimetre === "cle")
    return `Les ${nombre(p.comptes.cles)} mesures que le parti désigne comme clés dans son livre : ${nombre(p.comptes.clesConfrontables)} confrontables, ${nombre(p.comptes.cles - p.comptes.clesConfrontables)} hors champ.`;
  return p.chiffrage
    ? `Les ${nombre(p.comptes.chiffrees)} mesures que le parti a chiffrées lui-même dans « ${p.chiffrage.titre} » (${p.chiffrage.date}).`
    : `Les ${nombre(p.comptes.chiffrees)} mesures que le parti a chiffrées lui-même.`;
}

export function ProgrammeScreen({
  programme,
  perimetre = "all",
  filtre = "toutes",
  sous = "tout",
  nav,
}: {
  programme: string;
  perimetre?: Perimetre;
  filtre?: Filtre;
  sous?: SousNeutre;
  nav: Nav;
}) {
  const { resume } = useProgrammeEnService(programme, nav);
  const id = resume?.id ?? programme;
  const { data: p, error, retry } = useData(() => getProgramme(id), [id]);
  const [methode, setMethode] = useState(false);
  if (resume === undefined || resume === null) return <Chargement />;
  if (error && !p) return <ErreurChargement onRetry={retry} />;
  if (!p) return <Chargement />;

  const k = p.verdicts[perimetre];
  const groupe = p.groupe?.abrev ?? "";
  const changer = (r: { perimetre?: Perimetre; filtre?: Filtre; sous?: SousNeutre }) =>
    nav.replace({ name: "programme", programme: p.id, perimetre, filtre, sous, ...r });
  const choisirSelection = (s: (typeof SELECTIONS)[number]) => {
    if (s.id === perimetre) return;
    retourSelection();
    track("selection", p.id, s.mesure);
    changer({ perimetre: s.id, filtre: "toutes", sous: "tout" });
  };
  const choisirFiltre = (f: Filtre, s: SousNeutre) => {
    track("filtre", p.id, f === "toutes" ? "toutes" : f === "n" && s !== "tout" ? `n_${s}` : f);
    changer({ filtre: f, sous: s });
  };
  const on = (f: Famille) => filtre === "toutes" || filtre === f;
  const nAffiches =
    perimetre === "ch"
      ? p.listeChiffrees.filter((l) => correspond(l.statut, filtre, sous)).length
      : statutsDuPerimetre(p, perimetre).filter((s) => correspond(s, filtre, sous)).length;
  const ouvrirMethode = () => {
    track("methode_open", p.id, "programme");
    setMethode(true);
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: MARGE, paddingTop: 4, paddingBottom: 48, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4, paddingTop: 12 }}>
          <Kicker>Programme 2027 · {p.parti}</Kicker>
          <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>Promis face aux votes du groupe {groupe}</Text>
          <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>Publié le {dateLongue(p.publieLe)}</Text>
        </View>

        <Bloc style={{ paddingVertical: 14, gap: 10 }}>
          <Text accessibilityRole="header" style={[T.callout, { fontFamily: F.extra, color: C.text, paddingHorizontal: 14 }]}>Les sélections du parti</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 8, paddingRight: 6 }}>
            <AnneauxSelections p={p} perimetre={perimetre} filtre={filtre} taille={160} />
            <View accessibilityRole="radiogroup" accessibilityLabel="Choisir la sélection" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              {SELECTIONS.map((s) => {
                const sel = s.id === perimetre;
                return (
                  <Pression
                    key={s.id}
                    onPress={() => choisirSelection(s)}
                    accessibilityLabel={`${s.nom}, ${echelleSelection(p, s.id)} : ${comptesEnLettres(p.verdicts[s.id])}`}
                    accessibilityState={{ selected: sel }}
                    style={{ minHeight: 52, justifyContent: "center", gap: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: sel ? C.surfaceSunken : "transparent" }}
                  >
                    <Text style={[T.small, { fontFamily: F.extra, color: sel ? C.text : C.textMuted, lineHeight: 16 }]}>{s.nom}</Text>
                    <Text style={[T.micro, tnum, { fontFamily: F.bold, color: sel ? C.text : C.textMuted }]}>{echelleSelection(p, s.id)}</Text>
                    <LigneComptes texte={ligneComptes(p.verdicts[s.id])} />
                  </Pression>
                );
              })}
            </View>
          </View>
          <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted, paddingHorizontal: 14, lineHeight: 16 }]}>
            Anneau extérieur : tout le programme. Puis ses mesures clés, puis ses mesures chiffrées. Chaque anneau fait le tour de son propre total.
          </Text>
        </Bloc>

        <FiltresVerdict comptes={k} filtre={filtre} sous={sous} onChange={choisirFiltre} />
        <AnnoncePolie texte={annonceFiltre(nAffiches, perimetre === "ch" ? "ligne" : "mesure")} />

        <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted, paddingHorizontal: 4, lineHeight: 18 }]}>{noteDePerimetre(p, perimetre)}</Text>

        <Bloc style={{ padding: 14, gap: 10 }}>
          <Text accessibilityRole="header" style={[T.callout, tnum, { fontFamily: F.extra, color: C.text }]}>Le chemin des {nombre(p.comptes.mesures)} mesures</Text>
          <Tamis total={p.comptes.mesures} horsChamp={p.comptes.horsChamp} comptes={p.verdicts.all} />
          <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 16 }]}>
            De gauche à droite : le programme, ce qui se confronte à un vote, le verdict, puis le détail du neutre.
          </Text>
          <LienMethode onPress={ouvrirMethode} />
        </Bloc>

        {perimetre !== "ch" ? (
          <ListeChapitres p={p} perimetre={perimetre} on={on} onOpen={(ch) => nav.push({ name: "chapitre", programme: p.id, chapitre: ch, filtre, sous })} />
        ) : (
          <ListesChiffrees p={p} filtre={filtre} sous={sous} onOpen={(code) => nav.push({ name: "mesure", programme: p.id, mesure: code })} />
        )}
      </ScrollView>
      <FeuilleMethode
        visible={methode}
        onClose={() => setMethode(false)}
        chiffres={{ mesures: p.comptes.mesures, horsChamp: p.comptes.horsChamp, confrontables: p.comptes.confrontables }}
        base={p.base}
      />
    </>
  );
}

function ListeChapitres({ p, perimetre, on, onOpen }: { p: Programme; perimetre: Perimetre; on: (f: Famille) => boolean; onOpen: (ch: string) => void }) {
  // Parties dans l'ordre du livre, chapitres dans l'ordre du livre.
  const parties: { titre: string; chapitres: typeof p.chapitres }[] = [];
  for (const c of p.chapitres) {
    const titre = `Partie ${c.partie} · ${c.partieTitre}`;
    const last = parties[parties.length - 1];
    if (last && last.titre === titre) last.chapitres.push(c);
    else parties.push({ titre, chapitres: [c] });
  }
  const opacite = (f: Famille) => (on(f) ? 1 : 0.22);
  return (
    <Entree cle={`chapitres:${p.id}`} gap={16}>
      {parties.map((pa) => (
        <View key={pa.titre} style={{ gap: 8 }}>
          <Kicker>{pa.titre}</Kicker>
          <Bloc style={{ borderRadius: RADIUS.md, overflow: "hidden" }}>
            {pa.chapitres.map((c, i) => {
              const ms = mesuresDuChapitre(p, c.id).filter((m) => perimetre === "all" || m.cle);
              const kc: Comptes = comptesDe(ms.map((m) => m.statut));
              const aucun = confrontables(kc) === 0;
              return (
                <Pression
                  key={c.id}
                  onPress={() => onOpen(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Chapitre ${c.numero} : ${c.titre}. ${aucun ? (perimetre === "cle" ? "Aucune mesure clé confrontable" : "Aucune mesure confrontable") : comptesEnLettres(kc)}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === pa.chapitres.length - 1 ? 0 : 1, borderBottomColor: C.border }}
                >
                  <MiniAnneau comptes={kc} opacite={opacite} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={[T.callout, { fontFamily: F.extra, color: C.text, lineHeight: 19 }]}>{c.titre}</Text>
                    {aucun ? (
                      <Text style={[T.small, { fontFamily: F.semibold, color: C.textFaint }]}>{perimetre === "cle" ? "Aucune mesure clé confrontable" : "Aucune mesure confrontable"}</Text>
                    ) : (
                      <LigneComptes texte={ligneComptes(kc, "   ")} />
                    )}
                  </View>
                  <Feather name="chevron-right" size={18} color={C.textFaint} />
                </Pression>
              );
            })}
          </Bloc>
        </View>
      ))}
    </Entree>
  );
}

function ListesChiffrees({ p, filtre, sous, onOpen }: { p: Programme; filtre: Filtre; sous: SousNeutre; onOpen: (code: string) => void }) {
  const lignes = (type: LigneChiffree["type"]) => p.listeChiffrees.filter((l) => l.type === type && correspond(l.statut, filtre, sous));
  const rec = lignes("recette");
  const dep = lignes("depense");
  const Liste = ({ titre, l }: { titre: string; l: LigneChiffree[] }) =>
    l.length === 0 ? null : (
      <View style={{ gap: 8 }}>
        <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{titre}</Text>
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{nombre(l.length)}</Text>
        </View>
        <Bloc style={{ borderRadius: RADIUS.md, overflow: "hidden" }}>
          {l.map((r, i) => (
            <Pression
              key={r.code}
              onPress={() => onOpen(r.code)}
              accessibilityRole="button"
              accessibilityLabel={`${r.libelle}. ${MOT_STATUT[r.statut]}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: i === l.length - 1 ? 0 : 1, borderBottomColor: C.border }}
            >
              <PastilleVerdict famille={familleStatut(r.statut)} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text, lineHeight: 20 }]}>{r.libelle}</Text>
                <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{MOT_STATUT[r.statut]}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textFaint} />
            </Pression>
          ))}
        </Bloc>
      </View>
    );
  return (
    <Entree cle={`chiffrees:${p.id}`} gap={12}>
      <Liste titre="Recettes" l={rec} />
      <Liste titre="Dépenses" l={dep} />
      {rec.length + dep.length === 0 && <Text style={[T.small, { color: C.textMuted }]}>Aucune ligne pour ce filtre.</Text>}
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textFaint, paddingHorizontal: 4, lineHeight: 18 }]}>{PHRASE_MONTANTS}</Text>
    </Entree>
  );
}

