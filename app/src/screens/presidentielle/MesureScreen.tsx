// Une mesure du programme, ou une ligne du chiffrage du parti : ce qui est promis (texte exact),
// le verdict avec ses nombres, puis les scrutins (date décroissante) : ceux qui s'écartent en
// cartes complètes, les « à juger » en faits sans verdict, ceux qui vont dans son sens en liste
// compacte (lots dépliables), puis ceux qui sont sans effet sur le verdict.
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, ICON } from "../../theme";
import type { Nav } from "../../nav";
import type { LigneChiffree, MesureLegere, Programme, ScrutinConfronte, Statut } from "../../presidentielle/types";
import { estCodeChiffrage, repartir } from "../../presidentielle/logique";
import { domaine, getChapitreProgramme, getChiffrageProgramme, getProgramme } from "../../presidentielle/donnees";
import { MOT_STATUT, PHRASE_TENSION, familleStatut, nombre, phraseVerdict, pluriel } from "../../presidentielle/libelles";
import { useData } from "../../hooks/useData";
import { ErreurChargement } from "../../components/ErreurChargement";
import { Button } from "../../components/ui";
import { Bloc, Entree, Kicker, PastilleVerdict, Pression } from "../../components/presidentielle/primitives";
import { CarteAJuger, CarteEcart, ListeCompacte, TitreSection } from "../../components/presidentielle/scrutins";
import { FeuilleMethode } from "../../components/presidentielle/FeuilleMethode";
import { partagerLien, urlRubrique } from "../../share";
import { track } from "../../analytics";
import { Chargement, LienExterne, LienMethode, MARGE, useProgrammeEnService, useRenvoiAccueil } from "./commun";

type Cible =
  | { type: "mesure"; m: MesureLegere; ligne: LigneChiffree | null }
  | { type: "ligne"; ligne: LigneChiffree };

function cibleDe(p: Programme, id: string): Cible | null {
  if (estCodeChiffrage(id)) {
    const ligne = p.listeChiffrees.find((l) => l.code === id);
    if (!ligne) return null;
    if (ligne.mesure) {
      const m = p.listeMesures.find((x) => x.id === ligne.mesure);
      return m ? { type: "mesure", m, ligne } : null;
    }
    return { type: "ligne", ligne };
  }
  const m = p.listeMesures.find((x) => x.id === id);
  if (!m) return null;
  return { type: "mesure", m, ligne: m.chiffree ? p.listeChiffrees.find((l) => l.code === m.chiffree) ?? null : null };
}

function Badge({ texte }: { texte: string }) {
  return (
    <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: "center", backgroundColor: C.accentSoft }}>
      <Text style={[T.micro, { fontFamily: F.extra, color: C.accent }]}>{texte}</Text>
    </View>
  );
}

export function MesureScreen({ programme, mesure, nav }: { programme: string; mesure: string; nav: Nav }) {
  const { resume } = useProgrammeEnService(programme, nav);
  const id = resume?.id ?? programme;
  const prog = useData(() => getProgramme(id), [id]);
  const p = prog.data;
  const cible = p ? cibleDe(p, mesure) : null;
  useRenvoiAccueil(!!p && !cible, nav);
  const cleDetail = cible ? (cible.type === "ligne" ? `chiffrage` : cible.m.statut === "h" ? "" : `chapitre:${cible.m.chapitre}`) : "";
  const detail = useData<ScrutinConfronte[] | null>(async () => {
    if (!cible || !cleDetail) return null;
    if (cible.type === "ligne") {
      const c = await getChiffrageProgramme(id);
      return c.lignes.find((l) => l.code === cible.ligne.code)?.scrutins ?? [];
    }
    const ch = await getChapitreProgramme(id, cible.m.chapitre);
    return ch.mesures.find((x) => x.id === cible.m.id)?.scrutins ?? [];
  }, [id, mesure, cleDetail]);
  const [methode, setMethode] = useState(false);

  if (!resume) return <Chargement />;
  if (prog.error && !p) return <ErreurChargement onRetry={prog.retry} />;
  if (!p || !cible) return <Chargement />;
  if (cleDetail && detail.error && !detail.data) return <ErreurChargement onRetry={detail.retry} />;
  if (cleDetail && !detail.data) return <Chargement />;

  const scrutins = detail.data ?? [];
  const statut: Statut = cible.type === "ligne" ? cible.ligne.statut : cible.m.statut;
  const groupe = p.groupe?.abrev ?? "";
  const r = repartir(scrutins);
  const ch = cible.type === "mesure" ? p.chapitres.find((c) => c.id === cible.m.chapitre) ?? null : null;
  const ouvrirMethode = () => {
    track("methode_open", p.id, "mesure");
    setMethode(true);
  };
  const partager = () => {
    const texte = cible.type === "ligne" ? cible.ligne.libelle : cible.m.texte;
    partagerLien(urlRubrique({ ecran: "mesure", programme: p.id, mesure }), `« ${texte} » : face aux votes du groupe ${groupe} à l'Assemblée.`, "Scrutoir · Présidentielle 2027");
  };
  const secondaires = cible.type === "ligne" ? cible.ligne.secondaires : [];

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: MARGE, paddingTop: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Entree cle={`mesure:${p.id}.${mesure}`} gap={12}>
          {/* PROMIS : texte exact, place dans le livre, mentions. */}
          <Bloc style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Kicker>Promis</Kicker>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {cible.type === "mesure" && cible.m.cle && <Badge texte="Mesure clé" />}
                {(cible.type === "ligne" || cible.ligne) && <Badge texte="Chiffrée par le parti" />}
              </View>
            </View>
            <Text accessibilityRole="header" style={[T.heading, { fontFamily: F.bold, color: C.text, lineHeight: 25 }]}>
              « {cible.type === "ligne" ? cible.ligne.libelle : cible.m.texte} »
            </Text>
            {cible.type === "mesure" && ch ? (
              <>
                <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>
                  Partie {ch.partie} · Chapitre {ch.numero}{cible.m.section ? ` · ${cible.m.section}` : ""}
                </Text>
                <LienExterne url={ch.url} libelle={domaine(ch.url) ? `Lire le chapitre sur ${domaine(ch.url)}` : "Lire le chapitre"} />
              </>
            ) : (
              <>
                <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>
                  Document de chiffrage du parti · {cible.type === "ligne" && cible.ligne.type === "recette" ? "Recettes" : "Dépenses"}
                </Text>
                {p.chiffrage && <LienExterne url={p.chiffrage.url} libelle={`Lire « ${p.chiffrage.titre} »`} />}
              </>
            )}
          </Bloc>

          {/* VERDICT */}
          {statut === "h" ? (
            <Bloc style={{ padding: 16, gap: 8 }}>
              <Text style={[T.heading, { fontFamily: F.extra, color: C.text }]}>Hors champ</Text>
              <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 19 }]}>Aucun vote de l’Assemblée ne peut porter cette mesure.</Text>
              {cible.type === "mesure" && !!cible.m.motifHorsChamp && (
                <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 19 }]}>{cible.m.motifHorsChamp}</Text>
              )}
            </Bloc>
          ) : (
            <Bloc style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {statut !== "j" && <PastilleVerdict famille={familleStatut(statut)} taille={36} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[T.heading, { fontFamily: F.extra, color: C.text }]}>{MOT_STATUT[statut]}</Text>
                  <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 19 }]}>{phraseVerdict(statut, scrutins)}</Text>
                </View>
              </View>
              {statut === "t" && (
                <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 19 }]}>{PHRASE_TENSION} Chaque vote est détaillé plus bas.</Text>
              )}
              {(statut === "j" || statut === "s" || statut === "r") && (
                <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 19 }]}>Compté parmi les neutres.</Text>
              )}
              <LienMethode onPress={ouvrirMethode} />
            </Bloc>
          )}

          {secondaires.length > 0 && (
            <View style={{ gap: 8 }}>
              <TitreSection titre={pluriel(secondaires.length, "Mesure du programme rattachée", "Mesures du programme rattachées")} n={secondaires.length} />
              <Bloc style={{ borderRadius: RADIUS.md, overflow: "hidden" }}>
                {secondaires.map((sx, i) => {
                  const m = p.listeMesures.find((x) => x.id === sx.id);
                  if (!m) return null;
                  return (
                    <Pression
                      key={sx.id}
                      onPress={() => nav.push({ name: "mesure", programme: p.id, mesure: m.id })}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.texte}. ${MOT_STATUT[m.statut]}`}
                      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: i === secondaires.length - 1 ? 0 : 1, borderBottomColor: C.border }}
                    >
                      {m.statut !== "h" && <PastilleVerdict famille={familleStatut(m.statut)} />}
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <Text numberOfLines={3} style={[T.small, { fontFamily: F.bold, color: C.text, lineHeight: 18 }]}>{m.texte}</Text>
                        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{MOT_STATUT[m.statut]}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={C.textFaint} />
                    </Pression>
                  );
                })}
              </Bloc>
            </View>
          )}

          {r.ecarts.length > 0 && <TitreSection titre={pluriel(r.ecarts.length, "S’écarte de la mesure", "S’écartent de la mesure")} n={r.ecarts.length} />}
          {r.ecarts.map((s) => (
            <CarteEcart key={s.uid} s={s} nav={nav} groupe={groupe} />
          ))}

          {r.aJuger.length > 0 && <TitreSection titre="À juger" n={r.aJuger.length} />}
          {r.aJuger.map((s) => (
            <CarteAJuger key={s.uid} s={s} nav={nav} groupe={groupe} />
          ))}

          {r.sens.length > 0 && <TitreSection titre="Vont dans son sens" n={r.sens.length} />}
          {r.sens.length > 0 && <ListeCompacte scrutins={r.sens} nav={nav} />}

          {r.sansEffet.length > 0 && <TitreSection titre="Sans effet sur le verdict" n={r.sansEffet.length} />}
          {r.sansEffet.length > 0 && <ListeCompacte scrutins={r.sansEffet} nav={nav} />}

          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <Button label="Partager" variant="outline" size="sm" onPress={partager} iconLeft={<Feather name="share" size={ICON.sm} color={C.accent} />} />
          </View>
          <Text style={[T.micro, tnum, { color: C.textFaint, lineHeight: 15 }]}>
            {scrutins.length ? `${nombre(scrutins.length)} ${pluriel(scrutins.length, "scrutin public retenu", "scrutins publics retenus")}, du plus récent au plus ancien.` : ""}
          </Text>
        </Entree>
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
