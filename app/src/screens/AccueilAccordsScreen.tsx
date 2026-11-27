import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Animated, Easing } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, MOTION, ICON, CONTROL } from "../theme";
import { useIndexPresidentielle } from "../presidentielle/donnees";
import { rubriqueVisible } from "../presidentielle/logique";
import { CartePresidentielle } from "../components/presidentielle/CartePresidentielle";
import { ScrutoirMark } from "../components/brand/ScrutoirMark";
import { HebdoCarte } from "../components/HebdoCarte";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { SearchResultsList } from "../components/SearchResultsList";
import { useReduceMotion } from "../components/HeroScrutins";
import { getPartis, getTestProximite, getVotesSuivis, getVotesPartisSuivis, getDossiersSitues, getNumeroVersDossier } from "../api";
import { getLastSeen } from "../follows";
import { useFollows } from "../hooks/useFollows";
import { useCibleTour } from "../tourTargets";
import { ouvrirTourNav } from "../tour";
import { tourAccueilAFaire, marquerTourAccueilVu } from "../accueilTourPrefs";
import { useJe } from "../testProximite/jeProximite";
import { chargerTest } from "../testProximite/storage";
import { accordsParTexte, progressionTest } from "../testProximite/accordsTexte";
import { nbVotesActuels } from "../testProximite/config";
import type { PartiResume, VoteSuivi } from "../types";
import type { QuestionProximite } from "../testProximite/score";
import type { Nav } from "../nav";

// ACCUEIL v6 — « accueil allégé », 6 blocs (maquette Présidentielle validée le 14/11/2026, version
// « tuiles chiffrées » validée le 27/11/2026) : 1. masthead ; 2. recherche réelle (montage stable =
// garde le focus), sans rangée de thèmes ; 3. BLOC SOMBRE du test (« Commence à te situer » /
// « Continue à te situer ») qui, une fois situé, porte deux TUILES chiffrées « Ta proximité » et
// « Tes accords » (l'ancien duo de cartes : le « % comme toi » reste visible d'un coup d'œil) ;
// 4. carte Présidentielle 2027 (si un programme est en service) ; 5. la semaine à l'Assemblée, dont
// le vote le plus suivi est la 1re carte ; 6. une seule liste : suivis + Trouver ton député (ou,
// sans suivi, Trouver ton député + Face à face). Tout se calcule sur l'appareil : aucune requête
// ne dépend des réponses au test. Aucune couleur en dur : tokens de theme.ts uniquement.

/** Barre de remplissage animée (piste + fill mesuré en px → anim fiable web, comme VoteBar…). */
function BarreFill({ pct, color, track, height = 6, delay = 0 }: { pct: number; color: string; track: string; height?: number; delay?: number }) {
  const [w, setW] = useState(0);
  const a = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) { a.setValue(1); return; }
    a.setValue(0);
    const anim = Animated.timing(a, { toValue: 1, duration: MOTION.slow, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [reduce, w, pct]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: height / 2, overflow: "hidden", backgroundColor: track }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: [0, (w * Math.max(0, Math.min(100, pct))) / 100] }) }} />
    </View>
  );
}

type Rangee = { cle: string; icon: React.ComponentProps<typeof Feather>["name"]; titre: string; sousTitre: string; onPress: () => void; refCible?: (node: any) => void };

/** Liste calme : une seule carte, une rangée par entrée (suivis, Trouver ton député, Face à face). */
function ListeCalme({ rangees }: { rangees: Rangee[] }) {
  return (
    <View style={{ borderRadius: RADIUS.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: "hidden", ...shadowCard }}>
      {rangees.map((r, i) => (
        <View key={r.cle} ref={r.refCible} collapsable={false} style={i > 0 ? { borderTopWidth: 1, borderTopColor: C.border } : undefined}>
          <LigneCalme icon={r.icon} titre={r.titre} sousTitre={r.sousTitre} onPress={r.onPress} />
        </View>
      ))}
    </View>
  );
}

/** Rangée calme : pastille d'icône, titre + sous-titre, chevron. */
function LigneCalme({ icon, titre, sousTitre, onPress }: Omit<Rangee, "cle" | "refCible">) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titre}. ${sousTitre}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: CONTROL.lg, paddingVertical: 12, paddingHorizontal: 14 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={ICON.base} color={C.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{titre}</Text>
        <Text style={[T.small, { color: C.textFaint }]} numberOfLines={1}>{sousTitre}</Text>
      </View>
      <Feather name="chevron-right" size={ICON.md} color={C.textFaint} />
    </TouchableOpacity>
  );
}

/**
 * Tuile du bloc sombre (une fois situé) : libellé + chevron, le chiffre en avant, la base en petit
 * dessous. Même moule à gauche (Ta proximité) et à droite (Tes accords).
 */
function TuileHero({ titre, onPress, accessibilityLabel, children, base }: { titre: string; onPress: () => void; accessibilityLabel: string; children: React.ReactNode; base: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ flex: 1, minWidth: 0, borderRadius: RADIUS.md, backgroundColor: C.heroGhost, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 12, gap: 3 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.onHeroMuted, flexShrink: 1 }]} numberOfLines={1}>{titre}</Text>
        <Feather name="chevron-right" size={ICON.sm} color={C.onHeroMuted} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>{children}</View>
      <Text style={[T.micro, tnum, { color: C.onHeroMuted, opacity: 0.85 }]}>{base}</Text>
    </TouchableOpacity>
  );
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function AccueilAccordsScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const je = useJe();
  const follows = useFollows();
  const reduce = useReduceMotion();
  const deputeUids = useMemo(() => follows.filter((u) => u.startsWith("PA")), [follows]);
  const partiUids = useMemo(() => follows.filter((u) => u.startsWith("PO")), [follows]);

  // Cibles de la visite guidée (registre `tourTargets`) : callback refs stables par zone.
  const refRecherche = useCibleTour("recherche");
  const refHero = useCibleTour("hero");
  const refEspace = useCibleTour("espace");
  const refDepute = useCibleTour("depute");
  // « La semaine » et le vote le plus suivi posent leur propre cible (rien quand ils sont masqués).
  const refSuivis = useCibleTour("suivis");

  const [partis, setPartis] = useState<PartiResume[]>([]);
  const indexPresidentielle = useIndexPresidentielle(); // rubrique Présidentielle 2027 (null = en lecture)
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);
  const [votes, setVotes] = useState<VoteSuivi[] | null>(null);
  // Textes où tu t'es situé (du plus récent au plus ancien) + lien numéro de scrutin → texte.
  const [situes, setSitues] = useState<{ refs: string[]; num2dos: Map<number, string> } | null>(null);

  // Réponses lues tout de suite sur l'appareil (sans attendre `je`, qui charge les fichiers) :
  // le bloc sombre s'affiche d'emblée dans le bon état, sans bascule « Commence » → « Continue ».
  const reponses = useMemo(() => je?.reponses ?? chargerTest()?.reponses ?? {}, [je]);
  const nbVotes = useMemo(() => Object.values(reponses).filter((r) => r === "pour" || r === "contre").length, [reponses]);

  useEffect(() => {
    getPartis().then(setPartis).catch(() => {});
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
  }, []);
  useEffect(() => {
    if (!nbVotes) return;
    let alive = true;
    Promise.all([getDossiersSitues(reponses), getNumeroVersDossier()])
      .then(([d, num2dos]) => { if (alive) setSitues({ refs: d.map((x) => x.dossier.ref), num2dos }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [reponses, nbVotes]);
  useEffect(() => {
    let alive = true;
    setVotes(null);
    Promise.all([getVotesSuivis(deputeUids, 40), getVotesPartisSuivis(partiUids, 40)])
      .then(([d, p]) => { if (alive) setVotes([...d, ...p].sort((a, b) => (b.date || "").localeCompare(a.date || ""))); })
      .catch(() => { if (alive) setVotes([]); });
    return () => { alive = false; };
  }, [follows.join(",")]);

  // Base affichée sous le spectre : seules les réponses aux questions ACTUELLES du test comptent,
  // comme dans le calcul du spectre et sur l'écran de résultat. Une question retirée du test garde
  // sa réponse (utile à « Tes accords »), mais ne doit plus gonfler la base « Sur tes N votes ».
  // null tant que les questions ne sont pas chargées (on ne connaît pas encore les retirées).
  // Avec le « je » chargé : test + scrutins tranchés hors test qui comptent (même base que le spectre).
  const nbVotesSpectre = useMemo(
    () => (je ? je.nbVotes : questions.length ? nbVotesActuels(questions, reponses) : null),
    [je, questions, reponses]
  );
  // Situé d'emblée sur les réponses gardées (pas de bascule « Commence » → « Continue » au
  // chargement), puis sur les seules questions actuelles : qui n'a répondu qu'à des questions
  // retirées repart de « Commence à te situer ».
  const situe = nbVotesSpectre != null ? nbVotesSpectre > 0 : nbVotes > 0;
  const prog = progressionTest(questions, reponses);

  // Lancement AUTOMATIQUE de la visite guidée à la 1re arrivée sur l'accueil une fois situé
  // (une seule fois, persisté). Les zones sont déjà montées ici ; on laisse le court fondu-montée
  // d'entrée (MOTION.slow) se poser avant d'ouvrir pour mesurer les vraies positions finales.
  // Rejouable ensuite via le « ? » du masthead.
  useEffect(() => {
    if (!situe || !tourAccueilAFaire()) return;
    marquerTourAccueilVu();
    const t = setTimeout(() => ouvrirTourNav(), 550);
    return () => clearTimeout(t);
  }, [situe]);
  // Suivis : l'accueil ne liste plus leurs votes (« La semaine à l'Assemblée » fait le point).
  // Il nomme QUI a voté depuis la dernière visite de l'écran Suivis ; le flux complet vit là-bas.
  const entitesNeuves = useMemo(() => {
    const lastSeen = getLastSeen();
    const vus = new Set<string>();
    const noms: string[] = [];
    for (const v of votes ?? []) {
      if (lastSeen && !(v.date && v.date > lastSeen)) continue;
      if (vus.has(v.deputeUid)) continue;
      vus.add(v.deputeUid);
      noms.push(v.deputeUid.startsWith("PO") ? v.abrev ?? v.nom : v.nom);
    }
    return noms;
  }, [votes]);
  const resumeNeuf =
    entitesNeuves.length <= 2
      ? entitesNeuves.join(" et ")
      : `${entitesNeuves.slice(0, 2).join(", ")} et ${entitesNeuves.length - 2 === 1 ? "1 autre" : `${entitesNeuves.length - 2} autres`}`;

  // Ta proximité : le groupe le plus proche (classement DÉJÀ trié par pct dans `je`). Le spectre
  // complet est derrière la tuile (écran résultat) : « un spectre, pas un parti ».
  const premier = useMemo(() => {
    const g = je?.resultat.global[0];
    return g ? { abrev: g.abrev, pct: Math.round(g.pct * 100) } : null;
  }, [je]);

  // Tes accords : sur le dernier texte où tu t'es situé, chaque groupe de l'hémicycle a-t-il voté
  // comme toi ? Calcul pur (accordsTexte.ts) à partir des questions et de l'index des scrutins.
  const groupes = useMemo(() => partis.filter((p) => p.abrev && ORDRE_HEMICYCLE.includes(p.abrev)), [partis]);
  // Même calcul que l'écran Tes accords : un texte dont la question a quitté le test n'est pas compté.
  const accords = useMemo(() => {
    if (!situes || !questions.length || !groupes.length) return null;
    return accordsParTexte(situes.refs, questions, reponses, (n) => situes.num2dos.get(n), groupes.map((g) => g.abrev!));
  }, [situes, questions, reponses, groupes]);
  const accord = accords?.[0] ?? null;
  const nbTextes = accords?.length ?? situes?.refs.length ?? 0;

  // Entrée en fondu-montée (une valeur partagée), coupée si « animations réduites ».
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    enter.setValue(0);
    const a = Animated.timing(enter, { toValue: 1, duration: MOTION.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, situe]);
  const rise = (i = 0) => ({ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10 + i * 4, 0] }) }] });

  // Champ de recherche : la loupe en ligne, sans pastille — recherche réelle.
  const Champ = (
    <View ref={refRecherche} collapsable={false} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 52, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 13, borderWidth: 1, borderColor: C.border, ...shadowCard }}>
      <Feather name="search" size={19} color={C.text} />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Sur quoi ils ont voté ?"
        placeholderTextColor={C.textFaint}
        accessibilityLabel="Rechercher un vote"
        style={{ flex: 1, minWidth: 0, fontSize: 16, fontFamily: F.semibold, color: C.text }}
        returnKeyType="search"
      />
      {q.length > 0 && (
        <TouchableOpacity onPress={() => setQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
          <Feather name="x" size={18} color={C.textFaint} />
        </TouchableOpacity>
      )}
    </View>
  );

  // UN SEUL arbre : le champ de recherche reste TOUJOURS monté, à la même position dans la
  // ScrollView. Seul le contenu SOUS le champ bascule (accueil ↔ résultats). Sans ça, taper la
  // 1re lettre remplaçait tout l'arbre → le TextInput était démonté/remonté → perte du focus.
  const recherche = !!q.trim();
  // Boutons du masthead (aide, paramètres). Construit au rendu : `C` est vivant.
  const mastheadBouton = { width: CONTROL.md, height: CONTROL.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", ...shadowCard } as const;
  // Le bloc sombre : bouton blanc pleine largeur (même rendu situé / non situé).
  const boutonHero = (label: string, onPress: () => void) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      style={{ marginTop: 16, height: CONTROL.lg, borderRadius: RADIUS.md, backgroundColor: C.onHero, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={[T.callout, { fontFamily: F.bold, color: C.heroInk }]}>{label}</Text>
    </TouchableOpacity>
  );
  // Les trois cartes du test (contre, sans avis, pour), de même taille : illustration muette.
  const carteTest = (icon: React.ComponentProps<typeof Feather>["name"], bord: string, encre: string) => (
    <View key={icon} style={{ width: 46, height: 58, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: bord, alignItems: "center", justifyContent: "center" }}>
      <Feather name={icon} size={ICON.base} color={encre} />
    </View>
  );
  // Crans de progression : un par vote du test (au-delà de 60, une barre continue).
  const crans = prog.total > 0 && prog.total <= 60;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* 1 — Masthead (logo officiel brand/ScrutoirMark), caché en mode recherche */}
      {!recherche && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 }}>
          <ScrutoirMark size={44} />
          <Text style={[T.title, { fontFamily: F.extra, color: C.text, letterSpacing: -0.6 }]}>Scrutoir</Text>
          <View style={{ marginLeft: "auto", flexDirection: "row", gap: 8 }}>
            {/* Rejoue la visite guidée de l'accueil (seul point d'entrée de rattrapage). */}
            <TouchableOpacity onPress={() => ouvrirTourNav()} accessibilityRole="button" accessibilityLabel="Aide et visite guidée" style={mastheadBouton}>
              <Feather name="help-circle" size={ICON.lg} color={C.text} />
            </TouchableOpacity>
            {/* Seul accès à Paramètres (thème, avatars, données sur l'appareil). */}
            <TouchableOpacity onPress={() => nav.push({ name: "parametres" })} accessibilityRole="button" accessibilityLabel="Paramètres" style={mastheadBouton}>
              <Feather name="settings" size={ICON.lg} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2 — Recherche (position STABLE = garde le focus). Plus de rangée de thèmes : les thèmes
          sont dans l'onglet Scrutins et dans les suggestions à la frappe. */}
      <View style={{ paddingHorizontal: 16, paddingTop: recherche ? 12 : 0 }}>
        {Champ}
      </View>

      {/* 3a — Mode recherche : résultats sous le champ (le reste de l'accueil est masqué) */}
      {recherche && (
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <SearchResultsList q={q} nav={nav} onCorriger={setQ} />
        </View>
      )}

      {/* 3 & 4 — reste de l'accueil, masqué en mode recherche */}
      {!recherche && (
        <>
          {/* BLOC SOMBRE — la seule chose forte de l'écran : le test de proximité. Non situé :
              les trois cartes du test + « Commencer » (→ intro du test). Situé : la progression
              en crans + « Reprendre » (→ file à trancher, nav test mode « affiner »). */}
          <Animated.View style={[{ marginHorizontal: 16, marginTop: 12 }, rise(0)]}>
            <View ref={refHero} collapsable={false} style={{ backgroundColor: C.heroBg, borderRadius: RADIUS.xl, paddingHorizontal: 18, paddingTop: situe ? 18 : 20, paddingBottom: 18 }}>
              {situe ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <Text style={[T.title, { color: C.onHero, flexShrink: 1 }]}>Continue à te situer</Text>
                    {prog.total > 0 && <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.onHeroMuted }]}>{prog.faits} sur {prog.total}</Text>}
                  </View>
                  {prog.total > 0 && (
                    <View
                      accessible
                      accessibilityRole="progressbar"
                      accessibilityLabel="Votes tranchés"
                      accessibilityValue={{ min: 0, max: prog.total, now: prog.faits }}
                      style={{ marginTop: 12, flexDirection: "row", gap: 2 }}
                    >
                      {crans ? (
                        Array.from({ length: prog.total }, (_, i) => (
                          <View key={i} style={{ flex: 1, height: 6, borderRadius: 2, backgroundColor: i < prog.faits ? C.onHero : C.heroTrack }} />
                        ))
                      ) : (
                        <View style={{ flex: 1 }}><BarreFill pct={(prog.faits / prog.total) * 100} color={C.onHero} track={C.heroTrack} /></View>
                      )}
                    </View>
                  )}
                  {prog.restants > 0 ? (
                    <>
                      <Text style={[T.body, { color: C.onHeroMuted, marginTop: 12 }]}>
                        {prog.restants > 1 ? `${prog.restants} votes t'attendent.` : "1 vote t'attend."} Chaque réponse précise ta proximité.
                      </Text>
                      {boutonHero("Reprendre", () => nav.push({ name: "test", mode: "affiner" }))}
                    </>
                  ) : (
                    <>
                      <Text style={[T.body, { color: C.onHeroMuted, marginTop: 12 }]}>
                        Tu as tranché tous les votes du test. De nouveaux scrutins s'y ajoutent au fil des semaines.
                      </Text>
                      {boutonHero("Voir ta proximité", () => nav.push({ name: "testResultat" }))}
                    </>
                  )}
                  {/* TUILES — l'ancien duo replié dans le bloc sombre : le chiffre reste visible. */}
                  <View ref={refEspace} collapsable={false} style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <TuileHero
                      titre="Ta proximité"
                      onPress={() => nav.push({ name: "testResultat" })}
                      accessibilityLabel={`Ta proximité${premier ? ` : ${premier.pct} % avec le groupe ${partis.find((p) => p.abrev === premier.abrev)?.libelle ?? premier.abrev}` : ""}${nbVotesSpectre != null ? `, sur tes ${pluriel(nbVotesSpectre, "vote")}` : ""}. Voir le spectre`}
                      base={nbVotesSpectre != null ? `sur tes ${pluriel(nbVotesSpectre, "vote")}` : " "}
                    >
                      {premier ? (
                        <>
                          <Text style={[T.title, tnum, { fontFamily: F.extra, color: C.onHero }]}>{premier.pct}{"\u00A0"}%</Text>
                          {/* Sigle en texte simple : la tuile entière est déjà un bouton (pas de bouton
                              dans un bouton). Le nom complet est dans le libellé d'accessibilité. */}
                          <Text style={[T.small, { fontFamily: F.bold, color: C.onHeroMuted, flexShrink: 1 }]} numberOfLines={1}>{premier.abrev}</Text>
                        </>
                      ) : (
                        <Text style={[T.title, { color: C.onHero }]}>…</Text>
                      )}
                    </TuileHero>
                    {nbTextes > 0 || !situes ? (
                      <TuileHero
                        titre="Tes accords"
                        onPress={() => nav.push({ name: "accords" })}
                        accessibilityLabel={`Tes accords : ${pluriel(nbTextes, "texte")}${accord ? `, au dernier texte : ${accord.comme} groupe${accord.comme > 1 ? "s" : ""} sur ${accord.total} comme toi` : ""}. Voir tes textes`}
                        base={accord ? `au dernier texte : ${accord.comme} groupe${accord.comme > 1 ? "s" : ""} sur ${accord.total}` : " "}
                      >
                        <Text style={[T.title, tnum, { fontFamily: F.extra, color: C.onHero }]}>{situes ? nbTextes : "…"}</Text>
                        <Text style={[T.small, { fontFamily: F.bold, color: C.onHeroMuted }]}>{nbTextes > 1 ? "textes" : "texte"}</Text>
                      </TuileHero>
                    ) : (
                      // Aucun texte situé (tes votes tranchés ne se rattachent à aucun texte) : invitation.
                      <TuileHero
                        titre="Tes accords"
                        onPress={() => nav.push({ name: "test", mode: "affiner" })}
                        accessibilityLabel="Tes accords : aucun texte pour l'instant. Te situer sur un texte"
                        base="Tranche un vote sur un texte"
                      >
                        <Text style={[T.callout, { fontFamily: F.extra, color: C.onHero }]}>Aucun texte</Text>
                      </TuileHero>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                    {carteTest("x", C.contre, C.contre)}
                    {carteTest("minus", C.heroNeutre, C.onHeroMuted)}
                    {carteTest("check", C.pour, C.pour)}
                  </View>
                  <Text style={[T.title, { color: C.onHero, marginTop: 16 }]} accessibilityRole="header">Commence à te situer</Text>
                  <Text style={[T.body, { color: C.onHeroMuted, marginTop: 6 }]}>
                    Pour, contre ou sans avis : tranche de vrais scrutins, et vois de quels groupes tu es proche. Tes réponses restent sur ton téléphone.
                  </Text>
                  {boutonHero("Commencer", () => nav.push({ name: "testIntro" }))}
                </>
              )}
            </View>
          </Animated.View>

          {/* PRÉSIDENTIELLE 2027 : carte d'entrée, ABSENTE tant qu'aucun programme n'est en service
              (index vide, absent ou en erreur). Aucun parti, aucun drapeau. */}
          {rubriqueVisible(indexPresidentielle) && (
            <Animated.View style={[{ paddingHorizontal: 16, marginTop: 12 }, rise(2)]}>
              <CartePresidentielle onPress={() => nav.push({ name: "presidentielle" })} />
            </Animated.View>
          )}

          {/* LA SEMAINE À L'ASSEMBLÉE : le vote le plus suivi en 1re carte (il remplace le bloc
              « Focus de la semaine »), puis un thème par carte. */}
          <Animated.View style={[{ marginTop: 24 }, rise(3)]}>
            <HebdoCarte nav={nav} />
          </Animated.View>

          {/* UNE SEULE LISTE. Avec des suivis : Tes suivis (qui a voté depuis ta dernière visite,
              le flux complet vit sur l'écran Suivis) + Trouver ton député. Sans suivi : l'invitation
              « Suis un élu ou un groupe », puis Trouver ton député + Face à face. */}
          {follows.length > 0 ? (
            <Animated.View style={[{ paddingHorizontal: 16, marginTop: 22 }, rise(3)]}>
              <ListeCalme
                rangees={[
                  {
                    cle: "suivis",
                    icon: "bell",
                    titre: entitesNeuves.length ? "Du neuf chez tes suivis" : "Tes suivis",
                    sousTitre: votes == null ? "…" : entitesNeuves.length ? resumeNeuf : "Rien de neuf depuis ta dernière visite",
                    onPress: () => nav.push({ name: "suivis" }),
                    refCible: refSuivis,
                  },
                  { cle: "depute", icon: "user", titre: "Trouver ton député", sousTitre: "Par code postal ou par commune", onPress: () => nav.push({ name: "monDepute" }), refCible: refDepute },
                ]}
              />
            </Animated.View>
          ) : (
            <Animated.View style={rise(3)}>
              <View ref={refSuivis} collapsable={false}>
                <View style={{ paddingHorizontal: 18, paddingTop: 26 }}>
                  <Text style={[T.heading, { color: C.text }]} accessibilityRole="header">Suis un élu ou un groupe</Text>
                  <Text style={[T.small, { color: C.textMuted, marginTop: 3 }]}>Pour savoir quand ils votent. Commence par ton député, ou confronte deux élus.</Text>
                </View>
                <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
                  <ListeCalme
                    rangees={[
                      { cle: "depute", icon: "user", titre: "Trouver ton député", sousTitre: "Par code postal ou par commune", onPress: () => nav.push({ name: "monDepute" }), refCible: refDepute },
                      { cle: "duel", icon: "users", titre: "Face à face", sousTitre: "Deux élus, leurs votes côte à côte", onPress: () => nav.push({ name: "confrontation" }) },
                    ]}
                  />
                </View>
              </View>
            </Animated.View>
          )}
        </>
      )}
    </ScrollView>
  );
}
