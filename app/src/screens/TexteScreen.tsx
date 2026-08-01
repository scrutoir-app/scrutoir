import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { Chip } from "../components/ui";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { HemicycleCamps, campDe, type GroupeCamp } from "../components/HemicycleCamps";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { ErreurChargement } from "../components/ErreurChargement";
import { getPartis, getDossier, getScrutin } from "../api";
import { useData } from "../hooks/useData";
import { useFollow } from "../follows";
import { useJe } from "../testProximite/jeProximite";
import type { PartiResume, DetailDossier, ScrutinDossier } from "../types";
import type { Nav } from "../nav";

// VUE TEXTE « Tes accords » (DONNÉES RÉELLES) : les scrutins publics d'un dossier (uid = dossier_ref).
// L'hémicycle figé « OÙ TU SIÈGES » se recolore selon le scrutin sélectionné, à partir des positions
// MAJORITAIRES réelles de chaque groupe comparées à TA réponse au test (localStorage). Sur un scrutin
// que tu n'as pas tranché, pas de « comme toi » → invitation à te situer. Un seul moteur : campDe.

const MAX_LISTE = 60; // au-delà (gros budgets), on plafonne l'affichage — jamais un top-N trompeur, on l'annonce.

const NATURE_LABEL: Record<string, string> = { ensemble: "Vote final", amendement: "Amendement", article: "Article", motion: "Motion" };

/** Nature du texte (procédure) dérivée des intitulés de ses scrutins. */
function natureTexte(scr: ScrutinDossier[]): string {
  const t = scr.map((s) => (s.objet ?? "")).join(" ").toLowerCase();
  if (t.includes("proposition de loi")) return "PROPOSITION DE LOI";
  if (t.includes("projet de loi")) return "PROJET DE LOI";
  if (t.includes("motion")) return "MOTION";
  return "TEXTE EXAMINÉ";
}

export function TexteScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const { data, loading, error, retry } = useData(
    () => Promise.all([getDossier(uid), getPartis().catch(() => [] as PartiResume[])]),
    [uid]
  );
  const dossier: DetailDossier | null = data?.[0] ?? null;
  const partis = data?.[1] ?? [];
  const je = useJe();
  const { width } = useWindowDimensions();
  const [amd, setAmd] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null); // groupe survolé (desktop) → mise en évidence
  const [amdOuvert, setAmdOuvert] = useState(false); // amendements liés repliés par défaut (affinage sous le vote final)

  useEffect(() => { setAmd(0); setSel(null); setAmdOuvert(false); }, [uid]);

  // Scrutins ordonnés : le VOTE FINAL (« ensemble ») en tête de dossier — d'abord celui que TU
  // as tranché (souvent la dernière lecture / CMP), sinon la lecture la plus récente ; puis tes
  // scrutins tranchés, puis le reste par n°. La tête pilote l'hémicycle par défaut : le parcours
  // cible est texte → vote final → amendements.
  const scrutins = useMemo(() => {
    const list = dossier?.scrutins ?? [];
    const tranche = (s: ScrutinDossier) => je != null && s.numero != null && je.reponses[s.numero] != null;
    const rang = (s: ScrutinDossier) => (s.nature === "ensemble" ? (tranche(s) ? 0 : 1) : tranche(s) ? 2 : 3);
    // Départage : entre deux votes d'ensemble, la lecture la plus récente d'abord (n° décroissant) ;
    // ailleurs, ordre naturel par n° croissant.
    const tie = (a: ScrutinDossier, b: ScrutinDossier) =>
      a.nature === "ensemble" && b.nature === "ensemble" ? (b.numero ?? 0) - (a.numero ?? 0) : (a.numero ?? 0) - (b.numero ?? 0);
    return [...list].sort((a, b) => rang(a) - rang(b) || tie(a, b));
  }, [dossier, je]);
  const affichees = scrutins.slice(0, MAX_LISTE);
  const nbFinaux = scrutins.filter((x) => x.nature === "ensemble").length; // nb de votes d'ensemble (tête)

  const s: ScrutinDossier | undefined = scrutins[amd];
  const maPosition = s && je && s.numero != null ? je.reponses[s.numero] : undefined;

  // Camp de chaque groupe sur CE scrutin (position majoritaire réelle vs ta réponse).
  const groupesCamp: GroupeCamp[] = useMemo(
    () => partis.map((p) => ({
      abrev: p.abrev, nb_deputes: p.nb_deputes, couleur: p.couleur,
      camp: campDe(p.abrev ? s?.positions[p.abrev] : undefined, maPosition),
    })),
    [partis, s, maPosition]
  );

  // Détail du scrutin sélectionné : pour la ventilation RÉELLE (pour/contre/abst) de la fiche parti.
  const { data: detail } = useData(() => (s ? getScrutin(s.uid) : Promise.resolve(null)), [s?.uid]);

  const selEffectif = useMemo(() => {
    if (sel) return sel;
    const comme = groupesCamp.filter((g) => g.camp === "comme");
    const pool = comme.length ? comme : groupesCamp;
    return pool.reduce((best, g) => (g.nb_deputes > (best?.nb_deputes ?? -1) ? g : best), pool[0])?.abrev ?? null;
  }, [sel, groupesCamp]);

  // Groupes présents sur CE scrutin, en ordre hémicycle (gauche → droite) — pour la nav desktop.
  const groupesOrdre = useMemo(() => ORDRE_HEMICYCLE.filter((ab) => s?.positions?.[ab] != null), [s]);
  const cycleGroupe = (dir: number) => {
    if (groupesOrdre.length < 2) return;
    const i = groupesOrdre.indexOf(selEffectif ?? "");
    setSel(groupesOrdre[(i + dir + groupesOrdre.length) % groupesOrdre.length]);
  };

  // Navigation clavier ←/→ entre groupes (web uniquement) : pilote le parti ouvert dans la fiche.
  useEffect(() => {
    if (Platform.OS !== "web" || groupesOrdre.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return; // ne pas voler la saisie
      cycleGroupe(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupesOrdre, selEffectif]);

  if (loading && !dossier) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  if (!dossier) return error ? <ErreurChargement onRetry={retry} /> : null;

  const gSel = partis.find((p) => p.abrev === selEffectif) ?? null;
  const posSel = gSel?.abrev ? s?.positions[gSel.abrev] : undefined;
  const commeSel = campDe(posSel, maPosition) === "comme";
  const gDetail = detail?.groupes.find((g) => g.abrev === gSel?.abrev);
  const vent = gDetail ? { pour: gDetail.pour, contre: gDetail.contre, abstention: gDetail.abstention } : { pour: 0, contre: 0, abstention: 0 };
  const situe = maPosition === "pour" || maPosition === "contre";

  // Flèches de navigation entre groupes : web / grand écran (le doigt suffit sur mobile — tap d'un siège).
  const showArrows = (Platform.OS === "web" || width > 700) && groupesOrdre.length > 1;
  const arrowStyle = {
    position: "absolute" as const, top: 46, width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong,
    alignItems: "center" as const, justifyContent: "center" as const, ...shadowCard, zIndex: 3,
  };

  // Une carte de scrutin (pilote l'hémicycle). k = index dans `scrutins`/`affichees` → setAmd(k).
  const renderScrutin = (x: ScrutinDossier, k: number) => {
    const on = k === amd;
    const rep = je && x.numero != null ? je.reponses[x.numero] : undefined;
    const badge = NATURE_LABEL[x.nature] ?? "Scrutin";
    return (
      <TouchableOpacity
        key={x.uid}
        activeOpacity={0.7}
        onPress={() => { setAmd(k); }}
        style={{ marginHorizontal: 14, marginBottom: 9, backgroundColor: on ? C.surfaceAlt : C.surface, borderWidth: 1.5, borderColor: on ? C.accent : C.border, borderRadius: RADIUS.md, padding: 12 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <View style={{ backgroundColor: x.nature === "ensemble" ? C.accent : C.surfaceSunken, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={[T.micro, { fontFamily: F.extra, letterSpacing: 0.3, color: x.nature === "ensemble" ? C.onAccent : C.textMuted }]}>{badge.toUpperCase()}</Text>
          </View>
          {on && <Text style={[T.micro, { fontFamily: F.extra, color: C.accent, marginLeft: "auto" }]}>AFFICHÉ EN HAUT</Text>}
        </View>
        <Text style={[T.small, { fontFamily: F.medium, color: C.text, lineHeight: 19 }]} numberOfLines={3}>{x.objet ?? x.titre}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap", rowGap: 6 }}>
          {rep === "pour" || rep === "contre" ? (
            <>
              {/* Verdict « comme toi » : ta réponse comparée au RÉSULTAT du scrutin (adopté ⇒ « pour »
                  l'a emporté ; rejeté ⇒ « contre »). Puis ta réponse. Un seul moteur : campDe. */}
              {(() => {
                const issue = x.sort_code === "adopte" ? "pour" : x.sort_code === "rejete" ? "contre" : undefined;
                const verdict = campDe(issue, rep);
                if (verdict === "neutre") return null;
                const comme = verdict === "comme";
                return (
                  <Chip
                    label={comme ? "comme toi" : "pas comme toi"}
                    bg={comme ? C.adopteBg : C.rejeteBg}
                    fg={comme ? C.adopteFg : C.rejeteFg}
                    ph={9} pv={2}
                  />
                );
              })()}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: rep === "pour" ? C.pour : C.contre }} />
                <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted }]}>ta réponse {rep === "pour" ? "Pour" : "Contre"}</Text>
              </View>
            </>
          ) : (
            <Text style={[T.micro, { color: C.textFaint }]}>Pas encore situé</Text>
          )}
          {x.sort_code && (
            <Chip
              label={x.sort_code === "adopte" ? "Adopté" : "Rejeté"}
              bg={x.sort_code === "adopte" ? C.adopteBg : C.rejeteBg}
              fg={x.sort_code === "adopte" ? C.adopteFg : C.rejeteFg}
              ph={7} pv={2}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* 0 — Nature + titre du texte */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.5 }]}>{natureTexte(dossier.scrutins)}</Text>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text, lineHeight: 24, marginTop: 4 }]}>{dossier.titre}</Text>
      </View>

      {/* 1 — HÉMICYCLE FIGÉ (sticky) */}
      <View style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="bookmark" size={12} color={C.textFaint} />
          <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>OÙ TU SIÈGES</Text>
          <Text style={[T.micro, { color: C.textFaint, marginLeft: "auto", flexShrink: 1 }]} numberOfLines={1}>{s?.objet ?? ""}</Text>
        </View>
        <View style={{ marginTop: 4, position: "relative" }}>
          {situe ? (
            <HemicycleCamps groupes={groupesCamp} size={200} selectedAbrev={selEffectif} onPickParty={setSel} survolAbrev={survol} onHoverParty={setSurvol} />
          ) : (
            <>
              <HemicycleCamps groupes={groupesCamp} size={200} selectedAbrev={selEffectif} onPickParty={setSel} survolAbrev={survol} onHoverParty={setSurvol} showAxe commeLabel="—" faceLabel="—" />
              <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: 4 }]}>
                Tu ne t'es pas situé sur ce scrutin — <Text style={{ fontFamily: F.bold, color: C.accent }}>situe-toi</Text> pour voir qui a voté comme toi.
              </Text>
            </>
          )}
          {showArrows && (
            <>
              <TouchableOpacity accessibilityLabel="Groupe précédent" accessibilityRole="button" onPress={() => cycleGroupe(-1)} style={{ ...arrowStyle, left: 0 }}>
                <Feather name="chevron-left" size={20} color={C.accent} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Groupe suivant" accessibilityRole="button" onPress={() => cycleGroupe(1)} style={{ ...arrowStyle, right: 0 }}>
                <Feather name="chevron-right" size={20} color={C.accent} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* 2 — FICHE DU PARTI SÉLECTIONNÉ */}
      <View style={{ marginHorizontal: 14, marginTop: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 13, ...shadowCard }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 40 }}>
            <HemicyclePicto groupes={partis} activeAbrev={gSel?.abrev ?? null} color={gSel?.couleur ?? C.textFaint} size={40} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[T.small, { fontFamily: F.extra, color: C.text }]} numberOfLines={1}>{gSel?.libelle ?? gSel?.abrev}</Text>
            <Text style={[T.micro, { color: C.textMuted, marginTop: 2 }]}>{gSel?.nb_deputes} élus</Text>
          </View>
          {situe && (
            <Chip label={commeSel ? "comme toi" : "pas comme toi"} bg={commeSel ? C.accentSoft : C.surfaceAlt} fg={commeSel ? C.accent : C.textMuted} ph={9} pv={3} />
          )}
        </View>
        <View style={{ marginTop: 12 }}>
          <VoteBarDivergenteCentree key={`${selEffectif}-${amd}`} pour={vent.pour} contre={vent.contre} abstention={vent.abstention} siegesTotal={gSel?.nb_deputes || 1} height={12} decompte />
        </View>
        <SuivreLien uid={gSel?.uid ?? ""} />
      </View>

      {/* 3 & 4 — Le VOTE FINAL en tête (qui a voté comme toi), les amendements en affinage dessous. */}
      {nbFinaux > 0 ? (
        <>
          <Text style={[T.micro, { fontFamily: F.extra, color: C.accent, letterSpacing: 0.4, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }]}>
            LE VOTE FINAL · QUI A VOTÉ COMME TOI
          </Text>
          {affichees.map((x, k) => (x.nature === "ensemble" ? renderScrutin(x, k) : null))}
          {/* Amendements/articles = affinage, repliés par défaut sous le vote final. */}
          {scrutins.length > nbFinaux && (
            <>
              <TouchableOpacity
                onPress={() => setAmdOuvert((o) => !o)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: amdOuvert }}
                style={{ flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 14, marginTop: 8, marginBottom: 10, paddingVertical: 12, paddingHorizontal: 13, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderStrong, borderStyle: "dashed", backgroundColor: C.surface }}
              >
                <Feather name={amdOuvert ? "chevron-down" : "chevron-right"} size={16} color={C.textMuted} />
                <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>
                  {amdOuvert ? "Masquer les amendements liés" : "Voir les amendements liés"}
                </Text>
                <View style={{ marginLeft: "auto", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
                  <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint }]}>{scrutins.length - nbFinaux}</Text>
                </View>
              </TouchableOpacity>
              {amdOuvert && affichees.map((x, k) => (x.nature !== "ensemble" ? renderScrutin(x, k) : null))}
            </>
          )}
        </>
      ) : (
        <>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, letterSpacing: 0.3, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }]}>
            LES SCRUTINS PUBLICS DE CE TEXTE · {scrutins.length}
          </Text>
          {affichees.map((x, k) => renderScrutin(x, k))}
        </>
      )}

      {scrutins.length > MAX_LISTE && (
        <Text style={[T.micro, { color: C.textFaint, paddingHorizontal: 18, paddingTop: 2, paddingBottom: 6 }]}>
          {MAX_LISTE} scrutins affichés sur {scrutins.length} (les tiens et les votes d'ensemble d'abord).
        </Text>
      )}

      {/* 5 — Note d'honnêteté */}
      <Text style={[T.micro, { color: C.textFaint, lineHeight: 17, paddingHorizontal: 18, paddingTop: 6 }]}>
        Scrutoir ne voit que les scrutins publics nominatifs sur ce texte — jamais tous les amendements. L'hémicycle est propre à chaque scrutin, jamais agrégé.
      </Text>
    </ScrollView>
  );
}

/** Bouton « Suivre » du groupe dans la fiche (réactif via useFollow). */
function SuivreLien({ uid }: { uid: string }) {
  const [suivi, toggle] = useFollow(uid);
  if (!uid) return null;
  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, minHeight: 38, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: suivi ? C.accent : C.borderStrong, backgroundColor: suivi ? C.accentSoft : C.surface }}
    >
      <Feather name={suivi ? "check" : "bell"} size={14} color={suivi ? C.accent : C.textMuted} />
      <Text style={[T.small, { fontFamily: F.bold, color: suivi ? C.accent : C.textMuted }]}>{suivi ? "Suivi" : "Suivre ce groupe"}</Text>
    </TouchableOpacity>
  );
}
