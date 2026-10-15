import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL, tnum } from "../theme";
import { Card, Chip } from "../components/ui";
import { getIndexTextes } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { HemicyclePositions } from "../components/HemicyclePositions";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { VerdictPastille } from "../components/VerdictPastille";
import { LegendeVerdict } from "../components/LegendeVerdict";
import { TuileTheme, teinteTexte, couleursIssue, Filet } from "../components/texteUI";
import { useScrutinGroupes } from "../scrutinGroupes";
import { useJe } from "../testProximite/jeProximite";
import { chargerTest, estSitue } from "../testProximite/storage";
import { verdictScrutin, groupesPos, tailleGroupe } from "../testProximite/verdict";
import { dossierSourceUrl } from "../config";
import { aujourdhuiParis, issueDe, raisonsCompte, type ScrutinSrc } from "../hebdo";
import {
  statutPage,
  dateLongue,
  ventilerTexte,
  raisonsEcrites,
  titreLigne,
  metaLigne,
  resumeSorts,
} from "../textes";
import type { Nav } from "../nav";

// Page d'un TEXTE (route `dossierScrutins`, clé = uid de dossier, ou clé d'un texte non rattaché).
// Maquette validée le 15/10/2026 (`maquette-page-texte-style-du-jour.html`) : la structure du
// 14/10 (`maquette-scrutins-par-texte.html`) au style du jour. Le vote sur l'ensemble en tête
// avec l'hémicycle du logo ; les amendements qui ont compté, titre = ce qui a été voté et raison
// MÉCANIQUE écrite sur la ligne ; le reste replié. Cible de l'onglet Scrutins, de la fiche scrutin,
// de la semaine à l'Assemblée, du focus, de « Tes accords » et du lien SEO `texte`.

const COMPTENT_VISIBLES = 3; // amendements qui ont compté visibles avant « Voir les N »
const PAS_PLI = 40; // lignes ajoutées à chaque « Afficher plus » dans un pli
const pl = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`;

export function DossierScrutinsScreen({ dossierRef, titre, nav }: { dossierRef: string; titre?: string; nav: Nav }) {
  const { data: index, loading, error, retry } = useData(() => getIndexTextes(), [dossierRef]);
  const texte = useMemo(() => index?.textes.find((x) => x.cle === dossierRef) ?? null, [index, dossierRef]);
  const scrs = useMemo(() => index?.scrutinsDe.get(dossierRef) ?? [], [index, dossierRef]);
  const ref = texte?.reference ?? null;
  const v = useMemo(() => ventilerTexte(scrs, ref?.uid ?? null), [scrs, ref]);

  const detail = useScrutinGroupes(ref?.uid ?? null);
  const je = useJe();
  const [situe] = useState(estSitue);
  const reponses = chargerTest()?.reponses ?? {};
  const [legende, setLegende] = useState(false);
  const [tousComptent, setTousComptent] = useState(false);
  const [largeur, setLargeur] = useState(0);

  // Hémicycle du vote de référence : chaque siège prend la position (recalculée sur ses votants)
  // du groupe qui l'occupe. Sièges neutres le temps du chargement du détail.
  const geo = useMemo(() => (detail ? detail.groupes.map((g) => ({ abrev: g.abrev, nb_deputes: tailleGroupe(g) })) : []), [detail]);
  const positions = useMemo(() => {
    const m: Record<string, "pour" | "contre" | "abstention"> = {};
    detail?.pos.forEach((g) => { if (g.abrev && g.position) m[g.abrev] = g.position; });
    return m;
  }, [detail]);

  if (loading && !index)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!index) return error ? <ErreurChargement onRetry={retry} /> : null;
  if (!texte)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: S.s24 }}>
        <Text style={[T.callout, { color: C.textMuted, textAlign: "center" }]}>
          {titre ? `« ${titre} » : aucun scrutin public trouvé pour ce texte.` : "Aucun scrutin public trouvé pour ce texte."}
        </Text>
      </View>
    );

  const auj = aujourdhuiParis();
  const annee = auj.slice(0, 4);
  const statut = statutPage(texte, auj);
  const cs = couleursIssue(statut.sort);
  const ouvrir = (uid: string) => nav.push({ name: "scrutin", uid });
  const source = texte.dossierRef ? dossierSourceUrl(texte.dossierRef) : null;
  const lectureRef = ref?.lecture ?? null;
  const tt = teinteTexte(texte.theme);
  const hemi = Math.min((largeur || 320) * 0.78, 280);
  const verdict = ref?.final
    ? verdictScrutin({ ctx: je, situe, reponse: ref.numero != null ? reponses[ref.numero] : undefined, groupes: detail?.pos ?? [], sortCode: ref.sort_code })
    : null;
  const comptentVisibles = tousComptent ? v.comptent : v.comptent.slice(0, COMPTENT_VISIBLES);
  const enCours = !ref?.final && statut.sort === null && statut.label.startsWith("En cours");

  return (
    <ScrollView contentContainerStyle={{ padding: S.s16, paddingBottom: S.s44 }} showsVerticalScrollIndicator={false}>
      {/* ============ EN-TÊTE : genre · thème, titre, statut, date et volume ============ */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
        <TuileTheme theme={texte.theme} size={24} />
        <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: C.textMuted }]} numberOfLines={1}>
          {texte.genreLabel} · {tt.nom}
        </Text>
      </View>
      <Text accessibilityRole="header" style={[T.title, { color: C.text, marginTop: S.s10 }]}>{texte.titre}</Text>
      <View style={{ flexDirection: "row", marginTop: S.s10 }}>
        <Chip label={statut.label} bg={cs.bg} fg={cs.fg} radius={7} ph={8} pv={3} />
      </View>
      <Text style={[T.small, tnum, { color: C.textMuted, marginTop: S.s8 }]}>
        {dateLongue(texte.derniereDate)} · {pl(texte.nb, "scrutin public", "scrutins publics")}
      </Text>

      {/* ============ VOTE SUR L'ENSEMBLE (sinon le vote le plus marquant) ============ */}
      <Card padding={S.s16} radius={RADIUS.lg} style={{ marginTop: S.s16 }}>
        <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}>
          {ref ? (
            <>
              <Text accessibilityRole="header" style={[T.callout, { fontFamily: F.bold, color: C.text }]}>
                {ref.nature === "declaration" ? "Vote sur la déclaration" : ref.final && ref.nature === "censure" ? "Motion de censure" : ref.final ? "Vote sur l'ensemble" : ref.objet}
              </Text>
              {!ref.final && (
                <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>
                  {ref.objet === "Article unique"
                    ? "Le seul article du texte, voté en scrutin public."
                    : enCours
                      ? "Pas encore de vote sur l'ensemble : le vote le plus marquant à ce jour."
                      : "Pas de vote sur l'ensemble en scrutin public : le vote le plus marquant."}
                </Text>
              )}
              <View style={{ alignItems: "center", marginTop: S.s12, marginBottom: S.s4 }}>
                <HemicyclePositions groupes={geo} positions={positions} size={hemi} />
              </View>
              <VoteBarDivergenteCentree pour={ref.pour} contre={ref.contre} abstention={ref.abstention} height={8} decompte />
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: S.s12, marginTop: S.s14 }}>
                {verdict && (
                  situe ? (
                    <VerdictPastille verdict={verdict} onPress={() => setLegende(true)} />
                  ) : (
                    // Pas encore situé : « Comme toi ? » verrouillé, qui mène au test.
                    <TouchableOpacity
                      onPress={() => nav.push({ name: "testIntro" })}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Comme toi ? Situe-toi pour le savoir"
                      style={{ flexDirection: "row", alignItems: "center", gap: S.s6, minHeight: CONTROL.md, paddingHorizontal: S.s14, borderRadius: RADIUS.pill, backgroundColor: C.surfaceAlt }}
                    >
                      <Feather name="lock" size={ICON.sm} color={C.textMuted} />
                      <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Comme toi ?</Text>
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity
                  onPress={() => ouvrir(ref.uid)}
                  accessibilityRole="link"
                  accessibilityLabel="Voir le détail par groupe de ce vote"
                  style={{ minHeight: CONTROL.md, justifyContent: "center" }}
                >
                  <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le détail par groupe</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={[T.callout, { fontFamily: F.bold, color: C.text }]}>Vote sur l'ensemble</Text>
              <Text style={[T.small, { color: C.textMuted, marginTop: S.s4 }]}>
                {enCours ? "Pas encore de vote sur l'ensemble en scrutin public." : "Pas de vote sur l'ensemble en scrutin public : il a pu avoir lieu à main levée."}
                {v.nbAmendements === scrs.length ? ` ${scrs.length > 1 ? `Ses ${scrs.length} scrutins publics portent` : "Son seul scrutin public porte"} sur des amendements.` : ""}
              </Text>
            </>
          )}
        </View>
      </Card>

      {/* ============ AMENDEMENTS QUI ONT COMPTÉ ============ */}
      {v.nbAmendements > 0 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: S.s8, marginTop: S.s24 }}>
            <Text accessibilityRole="header" style={[T.heading, { color: C.text, flexShrink: 1 }]}>Amendements qui ont compté</Text>
            <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{v.comptent.length} sur {v.nbAmendements}</Text>
          </View>
          <Text style={[T.small, { color: C.textMuted, marginTop: S.s4 }]}>Votes serrés, ou adoptés qui suppriment ou rétablissent un article.</Text>
          {v.comptent.length ? (
            <Card padding={0} radius={RADIUS.lg} style={{ marginTop: S.s10, overflow: "hidden" }}>
              {comptentVisibles.map((s, i) => (
                <View key={s.uid}>
                  {i > 0 && <Filet retrait={14} />}
                  <LigneScrutin s={s} meta={metaLigne(s, { annee, lectureRef, raisons: raisonsEcrites(s) })} titre={titreLigne(s, raisonsCompte(s).some((r) => r !== "serre"))} onPress={() => ouvrir(s.uid)} />
                </View>
              ))}
              {v.comptent.length > COMPTENT_VISIBLES && (
                <TouchableOpacity
                  onPress={() => setTousComptent((x) => !x)}
                  accessibilityRole="button"
                  aria-expanded={tousComptent}
                  style={{ minHeight: CONTROL.lg, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: C.border }}
                >
                  <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text }]}>{tousComptent ? "Réduire" : `Voir les ${v.comptent.length}`}</Text>
                </TouchableOpacity>
              )}
            </Card>
          ) : (
            <Card padding={S.s14} radius={RADIUS.lg} style={{ marginTop: S.s10 }}>
              <Text style={[T.small, { color: C.textMuted }]}>Aucun amendement de ce texte ne répond à ce critère.</Text>
            </Card>
          )}
        </>
      )}

      {/* ============ LE RESTE DU TEXTE (replié) ============ */}
      {(v.articles.length > 0 || v.autresAmendements.length > 0 || v.autres.length > 0) && (
        <>
          <Text accessibilityRole="header" style={[T.heading, { color: C.text, marginTop: S.s24 }]}>Le reste du texte</Text>
          <Card padding={0} radius={RADIUS.lg} style={{ marginTop: S.s10, overflow: "hidden" }}>
            {[
              { cle: "articles", titre: pl(v.articles.length, "article", "articles"), l: v.articles },
              { cle: "amd", titre: pl(v.autresAmendements.length, v.comptent.length ? "autre amendement" : "amendement", v.comptent.length ? "autres amendements" : "amendements"), l: v.autresAmendements },
              { cle: "autres", titre: pl(v.autres.length, "autre vote", "autres votes"), l: v.autres },
            ]
              .filter((x) => x.l.length > 0)
              .map((x, i) => (
                <View key={x.cle}>
                  {i > 0 && <Filet retrait={14} />}
                  <Pli titre={x.titre} scrutins={x.l} rendu={(s) => <LigneScrutin s={s} meta={metaLigne(s, { annee, lectureRef })} titre={titreLigne(s)} onPress={() => ouvrir(s.uid)} />} />
                </View>
              ))}
          </Card>
        </>
      )}

      {/* ============ SOURCE AN ============ */}
      {source && (
        <TouchableOpacity
          onPress={() => Linking.openURL(source)}
          accessibilityRole="link"
          accessibilityLabel="Le dossier sur le site de l'Assemblée nationale"
          style={{ minHeight: CONTROL.lg, alignItems: "center", justifyContent: "center", marginTop: S.s16 }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Le dossier sur le site de l'Assemblée</Text>
        </TouchableOpacity>
      )}

      <LegendeVerdict visible={legende} onClose={() => setLegende(false)} />
    </ScrollView>
  );
}

/** Une ligne de scrutin : méta (date, raison) + résultat et décompte à droite, puis ce qui a été voté. */
function LigneScrutin({ s, meta, titre, onPress }: { s: ScrutinSrc; meta: string; titre: string; onPress: () => void }) {
  const sort = issueDe(s.sort_code);
  const c = couleursIssue(sort);
  const issue = sort === "adopte" ? "Adopté" : sort === "rejete" ? "Rejeté" : null; // sans résultat publié : le décompte seul
  const res = `${issue ? `${issue} ` : ""}${s.pour ?? 0}–${s.contre ?? 0}`;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${titre}. ${meta}. ${issue ? `${issue}, ` : ""}${s.pour ?? 0} pour, ${s.contre ?? 0} contre`}
      style={{ paddingHorizontal: S.s14, paddingVertical: S.s12, minHeight: CONTROL.md }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.s8 }}>
        <Text style={[T.micro, tnum, { flex: 1, color: C.textFaint }]}>{meta}</Text>
        <Chip label={res} bg={c.bg} fg={c.fg} radius={7} ph={7} pv={2} textStyle={tnum} />
      </View>
      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: S.s4 }]} numberOfLines={3}>{titre}</Text>
    </TouchableOpacity>
  );
}

/** Groupe de scrutins replié par défaut, déplié par tranches (un texte peut en compter des centaines). */
function Pli({ titre, scrutins, rendu }: { titre: string; scrutins: ScrutinSrc[]; rendu: (s: ScrutinSrc) => React.ReactNode }) {
  const [n, setN] = useState(0);
  const ouvert = n > 0;
  return (
    <View>
      <TouchableOpacity
        onPress={() => setN(ouvert ? 0 : PAS_PLI)}
        activeOpacity={0.7}
        accessibilityRole="button"
        aria-expanded={ouvert}
        accessibilityLabel={`${titre}, ${resumeSorts(scrutins)}. ${ouvert ? "Replier" : "Déplier"}`}
        style={{ flexDirection: "row", alignItems: "center", gap: S.s10, minHeight: 52, paddingHorizontal: S.s14 }}
      >
        <View style={{ flex: 1, minWidth: 0, paddingVertical: S.s10 }}>
          <Text style={[T.callout, tnum, { fontFamily: F.bold, color: C.text }]}>{titre}</Text>
          {ouvert && <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 2 }]}>{resumeSorts(scrutins)}</Text>}
        </View>
        <Feather name={ouvert ? "chevron-down" : "chevron-right"} size={ICON.base} color={C.textMuted} />
      </TouchableOpacity>
      {scrutins.slice(0, n).map((s) => (
        <View key={s.uid}>
          <Filet retrait={14} />
          {rendu(s)}
        </View>
      ))}
      {ouvert && n < scrutins.length && (
        <TouchableOpacity
          onPress={() => setN((x) => x + PAS_PLI)}
          accessibilityRole="button"
          style={{ minHeight: CONTROL.md, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: C.border }}
        >
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.accent }]}>Afficher plus ({scrutins.length - n} restants)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
