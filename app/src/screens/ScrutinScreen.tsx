import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, LayoutChangeEvent } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  C, F, T, tnum, RADIUS, formatDate, positionLabel, couleurPosition,
} from "../theme";
import { Card, Chip } from "../components/ui";
import { scrutinSourceUrl, dossierSourceUrl } from "../config";
import { getScrutin, getPartis } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { track } from "../analytics";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { HemicyclePositions } from "../components/HemicyclePositions";
import { ScrutinMotif } from "../components/ScrutinMotif";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { VerdictPastille } from "../components/VerdictPastille";
import { LegendeVerdict } from "../components/LegendeVerdict";
import { ProfilTabs } from "../components/profil";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { catUI } from "../categoryUI";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import type { ContexteJe } from "../testProximite/jeProximite";
import { verdictScrutin, groupesPos, tailleGroupe } from "../testProximite/verdict";
import { chargerTest } from "../testProximite/storage";
import type { GroupeVentilation, AmendGroupe, AmendInstitutionnel, PartiResume } from "../types";
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

/** Utilisateur situé = au moins une réponse pour/contre au test (sync, lu au montage). */
function estSitue(): boolean {
  const t = chargerTest();
  return !!t && Object.values(t.reponses).some((r) => r === "pour" || r === "contre");
}

// --- Formatage -------------------------------------------------------------
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 1 312
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
  // `partis` (picto hémicycle) est décoratif : son échec ne bloque pas l'écran.
  const { data: charge, loading, error, retry } = useData(
    () => Promise.all([getScrutin(uid), getPartis().catch(() => [] as PartiResume[])]),
    [uid]
  );
  const data = charge?.[0] ?? null;
  const partis = charge?.[1] ?? [];
  const [briefOuvert, setBriefOuvert] = useState(false);
  const [parcours, setParcours] = useState(false);
  const [legende, setLegende] = useState(false);
  const [onglet, setOnglet] = useState<"groupe" | "amend">("groupe");
  const [triNombre, setTriNombre] = useState(false); // tri amendements : false = par groupe, true = par nombre
  const [heroBox, setHeroBox] = useState({ w: 0, h: 0 }); // pour le filigrane de thème
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
    if (data) groupesPos(data.groupes).forEach((g) => { if (g.abrev) m[g.abrev] = g.position; });
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
  const cat = catUI(s.categorie ?? "");
  const verdict = verdictScrutin({
    ctx: je, situe,
    reponse: s.numero != null ? reponses[s.numero] : undefined,
    groupes: groupesPos(data.groupes),
    sortCode: s.sort_code,
  });
  const heroHemi = Math.min((heroBox.w || 320) * 0.8, 300);

  const goVotants = (position: string, g: GroupeVentilation) =>
    nav.push({ name: "votants", scrutinUid: uid, titre: titreCourt, position, groupe: g.uid, groupeLibelle: g.abrev ?? g.libelle });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* ============ HÉRO (toujours visible) ============ */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <View onLayout={(e: LayoutChangeEvent) => setHeroBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {/* Filigrane de thème en fond */}
          {heroBox.w > 0 && <ScrutinMotif categorieId={s.categorie} width={heroBox.w} height={heroBox.h} />}

          <View style={{ padding: 16 }}>
            {/* Badge résultat + écart de N voix */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5, borderRadius: RADIUS.sm,
                  paddingHorizontal: 10, paddingVertical: 5, backgroundColor: adopte ? C.adopteBg : C.rejeteBg,
                }}
              >
                <Feather name={adopte ? "check" : "x"} size={15} color={adopte ? C.adopteFg : C.rejeteFg} />
                <Text style={[T.callout, { fontFamily: F.extra, color: adopte ? C.adopteFg : C.rejeteFg }]}>{adopte ? "Adopté" : "Rejeté"}</Text>
              </View>
              <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>écart de {fmt(ecart)} voix</Text>
            </View>

            {/* Hémicycle coloré par position */}
            <View style={{ alignItems: "center", marginTop: 6, marginBottom: 4 }}>
              <HemicyclePositions groupes={geo} positions={positions} size={heroHemi} />
            </View>

            {/* Barre de vote divergente + décomptes */}
            <VoteBarDivergenteCentree pour={s.pour} contre={s.contre} abstention={s.abstention} decompte />

            {/* Titre + thème · date · n° */}
            <Text style={[T.heading, { fontFamily: F.extra, color: C.text, marginTop: 14 }]}>
              {s.dossier_titre || s.titre || s.objet}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 }}>
              {!!s.categorie && (
                <View style={{ width: 22, height: 22, borderRadius: RADIUS.sm, backgroundColor: cat.bg, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name={cat.icon as any} size={13} color={cat.fg} />
                </View>
              )}
              <Text style={[T.micro, tnum, { color: C.textFaint }]} numberOfLines={1}>
                {cat.court ? `${cat.court} · ` : ""}{formatDate(s.date)} · scrutin n° {s.numero}
              </Text>
              <TouchableOpacity
                onPress={() => setParcours(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Qu'est-ce qu'un scrutin ? Voir le parcours d'une loi"
              >
                <Feather name="info" size={14} color={C.accent} />
              </TouchableOpacity>
            </View>

            {/* Objet du texte / exposé de l'amendement — TOUJOURS dans le héro */}
            {amObjet && (amObjet.expose || amObjet.dispositif) ? (
              <View style={{ marginTop: 12, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: 12 }}>
                <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.4, marginBottom: 5 }]}>
                  EXPOSÉ DE L'AMENDEMENT{amObjet.numero ? ` N° ${amObjet.numero}` : ""}
                </Text>
                {!briefOuvert ? (
                  <>
                    <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted }]} numberOfLines={5}>
                      {amObjet.expose || amObjet.dispositif}
                    </Text>
                    {((amObjet.expose || "").length > 220 || !!amObjet.dispositif) && (
                      <TouchableOpacity onPress={() => setBriefOuvert(true)} style={{ marginTop: 8 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Lire la suite ▾</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    {!!amObjet.dispositif && <Bloc titre="Ce que l'amendement modifie" texte={amObjet.dispositif} />}
                    {!!amObjet.expose && <Bloc titre="Justification de l'auteur" texte={amObjet.expose} />}
                    <TouchableOpacity onPress={() => setBriefOuvert(false)} style={{ marginTop: 10 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Replier ▴</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : !!s.dossier_titre ? (
              <View style={{ marginTop: 12, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: 12 }}>
                <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.4, marginBottom: 5 }]}>OBJET DU TEXTE</Text>
                <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted }]}>Intitulé officiel du dossier législatif.</Text>
              </View>
            ) : null}

            {/* Verdict personnel « comme toi » — pastille COMPACTE (même composant que le Fil/Liste),
                verrouillée si non situé, tap → overlay légende 2 pages. */}
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <VerdictPastille verdict={verdict} onPress={() => setLegende(true)} />
            </View>
          </View>
        </View>
      </Card>

      {/* ============ VOIR TOUT LE TEXTE → liste du dossier (ScrutinList) ============ */}
      {s.dossier_ref && (
        <Card
          onPress={() => nav.push({ name: "dossierScrutins", ref: s.dossier_ref!, titre: s.dossier_titre || s.titre || "Ce texte" })}
          activeOpacity={0.7}
          style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.accentSoft, borderWidth: 0 }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
            <Feather name="pie-chart" size={19} color={C.onAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[T.small, { fontFamily: F.extra, color: C.text }]}>Voir tout le texte</Text>
            <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>Qui a voté comme toi, scrutin par scrutin</Text>
          </View>
          <Feather name="arrow-right" size={18} color={C.accent} />
        </Card>
      )}

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
        <Card padding={0} style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 4 }}>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 10, marginBottom: 2 }]}>
            {data.groupes.length} groupes · {je ? "ordre selon ta proximité" : "ordre de l'hémicycle"} · touche un groupe pour sa fiche
          </Text>
          {groupesOrd.map((g) => (
            <GroupeRow
              key={g.uid}
              g={g}
              partis={partis}
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
      {scrutinSourceUrl(s.numero) && (
        <Card
          activeOpacity={0.7}
          onPress={() => { track("source", String(s.numero ?? "")); Linking.openURL(scrutinSourceUrl(s.numero)!); }}
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

// --- Ligne « position d'un groupe » (onglet Par groupe) ----------------------
// Zones tactiles SÉPARÉES (pas de Touchable imbriqué) : le cluster gauche + le chevron ouvrent
// la FICHE PARTI ; le décompte ouvre la liste nominative des VOTANTS (position majoritaire).
function GroupeRow({
  g, partis, onParti, onVotants,
}: {
  g: GroupeVentilation;
  partis: PartiResume[];
  onParti: () => void;
  onVotants: (position: string) => void;
}) {
  const nom = g.abrev ?? g.libelle;
  const exprimes = g.pour + g.contre + g.abstention;
  const majorite = g.pour >= g.contre && g.pour >= g.abstention ? "pour" : g.contre >= g.abstention ? "contre" : "abstention";
  const posValue = g.consigne ?? (exprimes > 0 ? majorite : null);
  // Dissidence : votes exprimés différents de la consigne.
  const dissidents = g.consigne
    ? exprimes - (g.consigne === "pour" ? g.pour : g.consigne === "contre" ? g.contre : g.abstention)
    : 0;
  const compte = [
    g.pour > 0 ? `${g.pour} p` : null,
    g.contre > 0 ? `${g.contre} c` : null,
    g.abstention > 0 ? `${g.abstention} a` : null,
  ].filter(Boolean).join(" · ");

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingVertical: 8 }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onParti}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir la fiche du groupe ${nom}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}
      >
        <HemicyclePicto groupes={partis} activeAbrev={g.abrev} color={g.couleur ?? C.textFaint} size={PICTO_SIZE} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.couleur ?? C.textFaint }} />
        <Text style={[T.small, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{nom}</Text>
        {posValue && (
          <Chip label={positionLabel(posValue)} bg={C.surfaceSunken} fg={couleurPosition(posValue)} radius={RADIUS.pill} ph={8} />
        )}
        {dissidents > 0 && (
          <Chip label="dissidence" bg={C.surfaceSunken} fg={C.textMuted} radius={RADIUS.pill} ph={8} bold={false} />
        )}
      </TouchableOpacity>
      {compte ? (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => onVotants(exprimes > 0 ? majorite : "pour")}
          accessibilityRole="button"
          accessibilityLabel={`Voir les votants de ${nom}`}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={{ paddingVertical: 4, paddingHorizontal: 2 }}
        >
          <Text style={[T.micro, tnum, { color: C.textMuted }]} numberOfLines={1}>{compte}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[T.micro, { color: C.textFaint }]}>—</Text>
      )}
      <TouchableOpacity onPress={onParti} accessibilityRole="button" accessibilityLabel={`Ouvrir la fiche du groupe ${nom}`} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <Feather name="chevron-right" size={16} color={C.textFaint} />
      </TouchableOpacity>
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
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, marginTop: 12, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }]}>
        {titre}
      </Text>
      <Text style={[T.small, { fontFamily: F.regular, color: C.text }]}>{texte}</Text>
    </>
  );
}
