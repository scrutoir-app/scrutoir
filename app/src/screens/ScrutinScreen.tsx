import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, LayoutChangeEvent } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  C, F, T, tnum, RADIUS, S, positionLabel, couleurGroupe,
} from "../theme";
import { Card, Chip } from "../components/ui";
import { scrutinSourceUrl, dossierSourceUrl } from "../config";
import { getScrutin, getPartis, getDossiers } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { track } from "../analytics";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { HemicyclePositions } from "../components/HemicyclePositions";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { VerdictPastille } from "../components/VerdictPastille";
import { LegendeVerdict } from "../components/LegendeVerdict";
import { ProfilTabs } from "../components/profil";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { catUI } from "../categoryUI";
import { ceQuiEstVote } from "../typeScrutin";
import { decompteClair, positionMajoritaire } from "../decompte";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import type { ContexteJe } from "../testProximite/jeProximite";
import { verdictScrutin, groupesPos, tailleGroupe } from "../testProximite/verdict";
import { chargerTest, estSitue } from "../testProximite/storage";
import type { GroupeVentilation, AmendGroupe, AmendInstitutionnel, PartiResume, DossierResume } from "../types";
import type { Nav } from "../nav";
import { ParcoursLoi } from "../components/ParcoursLoi";
import { AccordSuivis } from "../components/AccordSuivis";

// ⓘ Encart amendements. Version DESCRIPTIVE retenue par défaut (sans le mot « blocage ») ;
// la variante explicite est gardée pour basculer d'un seul réglage si décidé plus tard.
const NOTE_AMENDEMENTS_DESCRIPTIF =
  "Le nombre d'amendements reflète des stratégies parlementaires différentes, pas la qualité du travail. Un fort volume concentré sur un même article, avec peu d'adoptions, va souvent de pair avec un dépôt répétitif.";
const NOTE_AMENDEMENTS_EXPLICITE =
  "Le nombre d'amendements reflète des stratégies parlementaires différentes, pas la qualité du travail. Un fort volume concentré sur un même article, avec peu d'adoptions, traduit souvent une stratégie de blocage.";
const NOTE_AMENDEMENTS = NOTE_AMENDEMENTS_DESCRIPTIF; // ← basculer ici (descriptif ↔ explicite)

const PICTO_SIZE = 38; // dérivé du picto de groupe de la fiche Partis (HemicyclePicto), réduit pour la densité

// Index hémicycle gauche→droite (groupes hors ordre, ex. NI → en fin de liste).
const idxHemicycle = (ab: string | null) => {
  const i = ORDRE_HEMICYCLE.indexOf(ab ?? "");
  return i < 0 ? ORDRE_HEMICYCLE.length : i;
};
/**
 * Ordre d'affichage des groupes : si l'utilisateur a fait le test de proximité (« je »),
 * du plus proche au plus éloigné (cohérent avec l'onglet Partis) ; sinon ordre hémicycle
 * neutre. Départage par l'hémicycle à proximité égale / inconnue.
 */
function ordreParti(je: ContexteJe | null, a: string | null, b: string | null): number {
  if (je) {
    const pa = scoreGroupeJe(je, a)?.pct ?? -1;
    const pb = scoreGroupeJe(je, b)?.pct ?? -1;
    if (pb !== pa) return pb - pa;
  }
  return idxHemicycle(a) - idxHemicycle(b);
}

// --- Formatage -------------------------------------------------------------
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 1 312
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 14 octobre 2026 » (date du scrutin, en toutes lettres). */
function dateLongue(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const j = Number(d);
  return `${j === 1 ? "1er" : j} ${MOIS[Number(m) - 1] ?? ""} ${y}`;
}
function artShort(raw: string | null): string {
  return raw ? raw.toLowerCase().replace(/\s+/g, " ").trim() : ""; // "ART. 4" → "art. 4"
}
function artLong(raw: string | null): string {
  const s = artShort(raw);
  if (!s) return "";
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/^Art\./, "Article"); // "Article 4"
}
const SEUIL_CONCENTRE = 0.5; // part sur un même article au-delà de laquelle on parle de concentration

/** Texte de concentration affiché sous la barre. */
function concentration(a: { articleTop: string | null; articleTopN: number; articlesDistincts: number; total: number }): string {
  const part = a.total ? a.articleTopN / a.total : 0;
  if (a.articleTop && part >= SEUIL_CONCENTRE) return `${Math.round(part * 100)} % sur ${artShort(a.articleTop)}`;
  if (a.articlesDistincts > 1) return `réparti sur ${a.articlesDistincts} articles`;
  return a.articleTop ? `sur ${artShort(a.articleTop)}` : "";
}
/** Répartition par article affichée au dépli. */
function repartitionArticles(a: { articleTop: string | null; articleTopN: number; articlesDistincts: number; total: number }): string {
  const part = a.total ? a.articleTopN / a.total : 0;
  if (a.articleTop && part >= SEUIL_CONCENTRE) {
    const autres = a.total - a.articleTopN;
    return `${artLong(a.articleTop)} : ${fmt(a.articleTopN)}${autres > 0 ? ` · autres : ${fmt(autres)}` : ""}`;
  }
  if (a.articlesDistincts > 1) return `Répartis sur ${a.articlesDistincts} articles`;
  return a.articleTop ? `${artLong(a.articleTop)} : ${fmt(a.articleTopN)}` : "";
}

export function ScrutinScreen({ uid, nav }: { uid: string; nav: Nav }) {
  // `partis` (picto hémicycle) et `dossiers` (thème du texte, pour son picto) sont décoratifs :
  // leur échec ne bloque pas l'écran.
  const { data: charge, loading, error, retry } = useData(
    () => Promise.all([
      getScrutin(uid),
      getPartis().catch(() => [] as PartiResume[]),
      getDossiers().catch(() => [] as DossierResume[]),
    ]),
    [uid]
  );
  const data = charge?.[0] ?? null;
  const partis = charge?.[1] ?? [];
  const dossiers = charge?.[2] ?? [];
  const [briefOuvert, setBriefOuvert] = useState(false);
  const [parcours, setParcours] = useState(false);
  const [legende, setLegende] = useState(false);
  const [onglet, setOnglet] = useState<"groupe" | "amend">("groupe");
  const [triNombre, setTriNombre] = useState(false); // tri amendements : false = par groupe, true = par nombre
  const [heroW, setHeroW] = useState(0); // largeur du héros (taille de l'hémicycle)
  const je = useJe(); // résultat du test de proximité (pour ordonner les groupes au plus proche)
  const [situe] = useState(estSitue);
  const reponses = chargerTest()?.reponses ?? {};

  useEffect(() => {
    setBriefOuvert(false);
    setOnglet("groupe");
  }, [uid]);

  const am = data?.amendements ?? null;

  // Position par groupe : ordonnée au plus proche (« je ») sinon hémicycle.
  const groupesOrd = useMemo(
    () => (data ? [...data.groupes].sort((a, b) => ordreParti(je, a.abrev, b.abrev)) : []),
    [data, je]
  );

  // Lignes d'amendements : par groupe (proximité « je » sinon hémicycle) ou par nombre.
  const lignesAmend = useMemo(() => {
    if (!am) return [] as Array<{ kind: "groupe"; g: AmendGroupe } | { kind: "instit"; g: AmendInstitutionnel }>;
    const groupes = [...am.groupes].sort((a, b) => ordreParti(je, a.abrev, b.abrev));
    const grp = groupes.map((g) => ({ kind: "groupe" as const, g }));
    const inst = am.institutionnels.map((g) => ({ kind: "instit" as const, g }));
    let list = [...grp, ...inst];
    if (triNombre) list = [...list].sort((a, b) => b.g.total - a.g.total);
    return list;
  }, [am, triNombre, je]);

  // Héro : géométrie de l'hémicycle + position (couleur) de chaque groupe sur CE scrutin.
  const geo = useMemo(() => (data ? data.groupes.map((g) => ({ abrev: g.abrev, nb_deputes: tailleGroupe(g) })) : []), [data]);
  const positions = useMemo(() => {
    const m: Record<string, "pour" | "contre" | "abstention"> = {};
    if (data) groupesPos(data.groupes).forEach((g) => { if (g.abrev && g.position) m[g.abrev] = g.position; });
    return m;
  }, [data]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!data) return error ? <ErreurChargement onRetry={retry} /> : null;

  const s = data.scrutin;
  const adopte = s.sort_code === "adopte";
  const titreCourt = (s.titre || s.objet || "").slice(0, 80);
  const amObjet = data.amendement;
  const ecart = Math.abs((s.pour ?? 0) - (s.contre ?? 0));
  // Thème : celui du texte (index des dossiers) — le détail d'un scrutin n'en porte pas.
  const themeId = (s.dossier_ref && dossiers.find((d) => d.ref === s.dossier_ref)?.categorie) || s.categorie || "";
  const cat = catUI(themeId);
  // Ce qui a été voté : lu mécaniquement dans l'intitulé officiel (jamais reformulé).
  const vote = ceQuiEstVote(s);
  const texteNom = s.dossier_titre || vote.texte; // intitulé officiel du dossier, sinon celui du scrutin
  const meta = [...vote.precisions, dateLongue(s.date)].filter(Boolean).join(" · ");
  const surAmendement = vote.nature === "amendement" || vote.nature === "sous-amendement";
  const aExpose = !!amObjet && !!(amObjet.expose || amObjet.dispositif);
  const sourceUrl = scrutinSourceUrl(s.numero);
  const ouvrirSource = () => { track("source", String(s.numero ?? "")); Linking.openURL(sourceUrl!); };
  const verdict = verdictScrutin({
    ctx: je, situe,
    reponse: s.numero != null ? reponses[s.numero] : undefined,
    groupes: groupesPos(data.groupes),
    sortCode: s.sort_code,
  });
  const heroHemi = Math.min((heroW || 320) * 0.8, 300);
  const ouvrirTexte = s.dossier_ref
    ? () => nav.push({ name: "dossierScrutins", ref: s.dossier_ref!, titre: s.dossier_titre || vote.texte || "Ce texte" })
    : undefined;

  const goVotants = (position: string, g: GroupeVentilation) =>
    nav.push({ name: "votants", scrutinUid: uid, titre: titreCourt, position, groupe: g.uid, groupeLibelle: g.abrev ?? g.libelle });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* ============ HÉRO (toujours visible) ============ */}
      <Card padding={S.s16} radius={RADIUS.xl}>
        <View onLayout={(e: LayoutChangeEvent) => setHeroW(e.nativeEvent.layout.width)}>
          {/* Texte de loi visé, en lien vers « Tout le texte » (picto de thème à gauche) */}
          {!!texteNom && (
            <TouchableOpacity
              onPress={ouvrirTexte}
              disabled={!ouvrirTexte}
              activeOpacity={0.7}
              accessibilityRole={ouvrirTexte ? "link" : undefined}
              accessibilityLabel={ouvrirTexte ? `Voir tout le texte : ${texteNom}${cat.court ? `, thème ${cat.court}` : ""}` : undefined}
              style={{ flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: 36 }}
            >
              {!!themeId && (
                <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: cat.bg, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name={cat.icon as any} size={14} color={cat.fg} />
                </View>
              )}
              <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.accent }]}>{texteNom}</Text>
              {ouvrirTexte && <Feather name="chevron-right" size={ICON_CHEVRON} color={C.accent} />}
            </TouchableOpacity>
          )}
          {/* Lecture · date (+ ⓘ parcours d'une loi) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Text style={[T.micro, tnum, { color: C.textFaint, flexShrink: 1 }]}>{meta}</Text>
            <TouchableOpacity
              onPress={() => setParcours(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Qu'est-ce qu'un scrutin ? Voir le parcours d'une loi"
            >
              <Feather name="info" size={14} color={C.accent} />
            </TouchableOpacity>
          </View>

          {/* Type de vote + ce qui a été voté (titre) */}
          <View style={{ flexDirection: "row", marginTop: S.s14 }}>
            <Chip label={vote.etiquette} bg={C.surfaceAlt} fg={C.accent} ph={8} />
          </View>
          <Text accessibilityRole="header" style={[T.title, { color: C.text, marginTop: 6 }]}>{vote.titre}</Text>

          {/* Résultat + écart de N voix */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: S.s12 }}>
            <Chip label={adopte ? "Adopté" : "Rejeté"} bg={adopte ? C.adopteBg : C.rejeteBg} fg={adopte ? C.adopteFg : C.rejeteFg} ph={8} />
            <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>écart de {fmt(ecart)} voix</Text>
          </View>

          {/* Hémicycle (sièges du logo) coloré par position */}
          <View style={{ alignItems: "center", marginTop: S.s10, marginBottom: 4 }}>
            <HemicyclePositions groupes={geo} positions={positions} size={heroHemi} />
          </View>

          {/* Barre de vote divergente + décomptes en clair (« 33 pour · 1 abst. · 73 contre ») */}
          <VoteBarDivergenteCentree pour={s.pour} contre={s.contre} abstention={s.abstention} height={8} decompte />

          {/* Ce que proposait l'amendement : l'exposé s'il est dans nos données, sinon on le dit */}
          {(surAmendement || aExpose) && (
            <View style={{ marginTop: S.s18 }}>
              <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>
                Ce que proposait {vote.nature === "sous-amendement" ? "le sous-amendement" : "l'amendement"}
              </Text>
              {aExpose ? (
                !briefOuvert ? (
                  <>
                    <Text style={[T.body, { color: C.textMuted, marginTop: 4 }]} numberOfLines={5}>
                      {amObjet!.expose || amObjet!.dispositif}
                    </Text>
                    {((amObjet!.expose || "").length > 220 || !!amObjet!.dispositif) && (
                      <TouchableOpacity onPress={() => setBriefOuvert(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
                        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Lire la suite</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    {!!amObjet!.dispositif && <Bloc titre="Ce que l'amendement modifie" texte={amObjet!.dispositif} />}
                    {!!amObjet!.expose && <Bloc titre="Justification de l'auteur" texte={amObjet!.expose} />}
                    <TouchableOpacity onPress={() => setBriefOuvert(false)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
                      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Replier</Text>
                    </TouchableOpacity>
                  </>
                )
              ) : (
                <>
                  <Text style={[T.body, { color: C.textMuted, marginTop: 4 }]}>Son exposé n'est pas encore dans nos données.</Text>
                  {sourceUrl && (
                    <TouchableOpacity onPress={ouvrirSource} accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
                      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Le lire sur le site de l'Assemblée</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* Verdict personnel « comme toi » — pastille verrouillée si non situé, tap → légende. */}
          <View style={{ flexDirection: "row", marginTop: S.s12 }}>
            <VerdictPastille verdict={verdict} onPress={() => setLegende(true)} invite />
          </View>
        </View>
      </Card>

      {/* Toi & tes suivis (sur les scrutins tranchés au test) */}
      <AccordSuivis scrutinUid={uid} numero={s.numero} groupes={data.groupes} partis={partis} je={je} nav={nav} />

      {/* ============ ONGLETS (remplacent les accordéons) ============ */}
      <View style={{ marginTop: 16 }}>
        <ProfilTabs
          tabs={[{ key: "groupe", label: "Par groupe" }, { key: "amend", label: "Amendements" }]}
          active={onglet}
          onChange={setOnglet}
        />
      </View>

      {onglet === "groupe" ? (
        <Card padding={0} radius={RADIUS.lg} style={{ marginTop: 10, overflow: "hidden" }}>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 10, marginBottom: 4, paddingHorizontal: 14 }]}>
            {data.groupes.length} groupes · {je ? "ordre selon ta proximité" : "ordre de l'hémicycle"} · touche un groupe pour sa fiche
          </Text>
          {groupesOrd.map((g, i) => (
            <GroupeRow
              key={g.uid}
              g={g}
              premier={i === 0}
              onParti={() => nav.push({ name: "parti", uid: g.uid })}
              onVotants={(pos) => goVotants(pos, g)}
            />
          ))}
        </Card>
      ) : am ? (
        <Card padding={0} style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 6, gap: 8 }}>
            <Text style={[T.small, { fontFamily: F.medium, color: C.textMuted, flex: 1 }]} numberOfLines={2}>
              {fmt(am.total)} déposés · {am.nbGroupes} groupes · {fmt(am.adoptes)} adoptés
            </Text>
            <TriToggle triNombre={triNombre} onToggle={() => setTriNombre((v) => !v)} />
          </View>
          <View style={{ flexDirection: "row", gap: 8, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: 12, marginBottom: 8 }}>
            <Feather name="info" size={15} color={C.textFaint} style={{ marginTop: 1 }} />
            <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, flex: 1, lineHeight: 18 }]}>{NOTE_AMENDEMENTS}</Text>
          </View>
          {lignesAmend.map((l) => (
            <AmendRow
              key={l.kind === "groupe" ? l.g.groupe : l.g.kind}
              row={l}
              partis={partis}
              moyenne={am.moyenne}
              dossierRef={am.dossierRef}
            />
          ))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10, marginBottom: 12 }}>
            <Legende couleur={C.pour} label="Adoptés" />
            <Legende couleur={C.contre} label="Rejetés" />
            <Legende couleur={C.absent} label="Sans suite (tombés, retirés…)" />
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: 12 }}>
          <Text style={[T.small, { color: C.textMuted, textAlign: "center" }]}>Aucun amendement recensé sur ce texte.</Text>
        </Card>
      )}

      {/* ============ LIEN SOURCE AN (permanent, hors onglets) ============ */}
      {sourceUrl && (
        <Card
          activeOpacity={0.7}
          onPress={ouvrirSource}
          padding={12}
          accessibilityLabel="Voir le scrutin sur assemblee-nationale.fr"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, minHeight: 44 }}
        >
          <Feather name="external-link" size={15} color={C.accent} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le scrutin sur assemblee-nationale.fr</Text>
        </Card>
      )}

      <ParcoursLoi visible={parcours} onClose={() => setParcours(false)} source="scrutin" />
      <LegendeVerdict visible={legende} onClose={() => setLegende(false)} />
    </ScrollView>
  );
}

const ICON_CHEVRON = 15;

// --- Ligne « position d'un groupe » (onglet Par groupe) ----------------------
// Décompte EN CLAIR (« 10 pour, 1 abst. »). Zones tactiles SÉPARÉES (pas de Touchable
// imbriqué) : le nom + la position ouvrent la FICHE PARTI ; le décompte ouvre la liste
// nominative des VOTANTS (position majoritaire). La position est celle du décompte affiché
// (`positionMajoritaire`, même règle qu'en base) : jamais la positionMajoritaire de l'AN,
// qui peut le contredire. Égalité en tête → pastille neutre « Égalité ».
function GroupeRow({
  g, premier, onParti, onVotants,
}: {
  g: GroupeVentilation;
  premier: boolean;
  onParti: () => void;
  onVotants: (position: string) => void;
}) {
  const nom = g.abrev ?? g.libelle;
  const exprimes = g.pour + g.contre + g.abstention;
  const posValue = positionMajoritaire(g);
  const etiquette = posValue ? positionLabel(posValue) : exprimes > 0 ? "Égalité" : null;
  const compte = decompteClair(g);
  const chip = posValue === "pour" ? { bg: C.adopteBg, fg: C.adopteFg }
    : posValue === "contre" ? { bg: C.rejeteBg, fg: C.rejeteFg }
    : { bg: C.surfaceSunken, fg: C.textMuted };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 14, ...(premier ? {} : { borderTopWidth: 1, borderTopColor: C.border }) }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onParti}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir la fiche du groupe ${nom}${etiquette ? `, position ${etiquette}` : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0, minHeight: 52 }}
      >
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleurGroupe(g.couleur) }} />
        <Text style={[T.callout, { fontFamily: F.bold, color: C.text, minWidth: 70 }]} numberOfLines={1}>{nom}</Text>
        {etiquette && <Chip label={etiquette} bg={chip.bg} fg={chip.fg} ph={8} pv={2} />}
      </TouchableOpacity>
      {compte ? (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => onVotants(posValue ?? "pour")}
          accessibilityRole="button"
          accessibilityLabel={`Voir les votants de ${nom} : ${compte}`}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={{ paddingVertical: 4, paddingHorizontal: 2 }}
        >
          <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]} numberOfLines={1}>{compte}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[T.small, { color: C.textFaint }]}>aucun vote</Text>
      )}
    </View>
  );
}

// --- Ligne « amendements d'un groupe / institution » (onglet Amendements) ----
function AmendRow({
  row, partis, moyenne, dossierRef,
}: {
  row: { kind: "groupe"; g: AmendGroupe } | { kind: "instit"; g: AmendInstitutionnel };
  partis: PartiResume[];
  moyenne: number;
  dossierRef: string;
}) {
  const [open, setOpen] = useState(false);
  const a = row.g;
  const nom = row.kind === "groupe" ? (a as AmendGroupe).abrev ?? (a as AmendGroupe).libelle
    : (a as AmendInstitutionnel).kind === "gouv" ? "Gouvernement" : "Commission";
  const sansSuite = Math.max(0, a.total - a.adoptes - a.rejetes);
  const w = (n: number): `${number}%` => `${(n / (a.total || 1)) * 100}%`;
  // Écart à la moyenne : SEULEMENT pour les groupes parlementaires. Badge neutre.
  const facteur = row.kind === "groupe" && moyenne > 0 ? a.total / moyenne : null;
  const dir = facteur == null ? 0 : facteur >= 1.15 ? 1 : facteur <= 0.87 ? -1 : 0;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ minHeight: 44, paddingVertical: 9 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {row.kind === "groupe" ? (
            <HemicyclePicto groupes={partis} activeAbrev={(a as AmendGroupe).abrev} color={(a as AmendGroupe).couleur ?? C.textFaint} size={PICTO_SIZE} />
          ) : (
            <View style={{ width: PICTO_SIZE, height: PICTO_SIZE * 0.72, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
                <Feather name={(a as AmendInstitutionnel).kind === "gouv" ? "briefcase" : "file-text"} size={15} color={C.textMuted} />
              </View>
            </View>
          )}
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{nom}</Text>
          {facteur != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto", backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
              {dir !== 0 && <Feather name={dir > 0 ? "arrow-up-right" : "arrow-down-right"} size={11} color={C.textMuted} />}
              <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{facteur.toFixed(1).replace(".", ",")}× moy.</Text>
            </View>
          )}
          <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text, marginLeft: facteur != null ? 0 : "auto" }]}>{fmt(a.total)}</Text>
          <Feather name="chevron-down" size={16} color={C.textFaint} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </View>
        {/* Barre de sort empilée : adoptés / rejetés / sans suite */}
        <View style={{ flexDirection: "row", height: 8, borderRadius: RADIUS.pill, overflow: "hidden", marginTop: 8, marginBottom: 6, backgroundColor: C.surfaceSunken }}>
          <View style={{ width: w(a.adoptes), backgroundColor: C.pour }} />
          <View style={{ width: w(a.rejetes), backgroundColor: C.contre }} />
          <View style={{ width: w(sansSuite), backgroundColor: C.absent }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {!!concentration(a) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="crosshair" size={13} color={C.textFaint} />
              <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted }]}>{concentration(a)}</Text>
            </View>
          )}
          <Text style={[T.micro, { color: C.textFaint }]}>·</Text>
          <Text style={[T.micro, tnum, { fontFamily: F.medium, color: C.textMuted }]}>{fmt(a.adoptes)} adoptés</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={{ paddingLeft: PICTO_SIZE + 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, columnGap: 12, marginBottom: 6 }}>
            <KV label="Adoptés" n={a.adoptes} color={C.pour} />
            <KV label="Rejetés" n={a.rejetes} color={C.contre} />
            <KV label="Tombés" n={a.tombes} color={C.textMuted} />
            <KV label="Retirés" n={a.retires} color={C.textMuted} />
            <KV label="Irrecevables" n={a.irrecevables} color={C.textMuted} />
          </View>
          {!!repartitionArticles(a) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <Feather name="crosshair" size={13} color={C.textFaint} />
              <Text style={[T.small, { fontFamily: F.medium, color: C.textMuted }]}>{repartitionArticles(a)}</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { const u = dossierSourceUrl(dossierRef); if (u) Linking.openURL(u); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32, alignSelf: "flex-start" }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="external-link" size={14} color={C.accent} />
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
              Voir les {fmt(a.total)} amendements{row.kind === "groupe" ? " du groupe" : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// --- Petits composants -----------------------------------------------------
function TriToggle({ triNombre, onToggle }: { triNombre: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={triNombre ? "Trier par groupe" : "Trier par nombre"}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 }}
    >
      <Feather name={triNombre ? "bar-chart-2" : "list"} size={12} color={C.textMuted} />
      <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>{triNombre ? "Par nombre" : "Par groupe"}</Text>
    </TouchableOpacity>
  );
}

function KV({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <Text style={[T.small, { color }]}>
      {label} <Text style={[tnum, { fontFamily: F.extra }]}>{fmt(n)}</Text>
    </Text>
  );
}

function Legende({ couleur, label }: { couleur: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: couleur }} />
      <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>{label}</Text>
    </View>
  );
}

function Bloc({ titre, texte }: { titre: string; texte: string }) {
  return (
    <>
      <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, marginTop: 12, marginBottom: 3 }]}>
        {titre}
      </Text>
      <Text style={[T.body, { color: C.text }]}>{texte}</Text>
    </>
  );
}
