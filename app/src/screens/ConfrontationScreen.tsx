import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Animated, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, inputText, RADIUS, S, ICON, CONTROL, couleurGroupe } from "../theme";
import { SEUIL_FIABILITE } from "../config";
import { catUI } from "../categoryUI";
import { rechercher, getConfrontation, getConfrontationShuffle, getDeputesByUids } from "../api";
import { Card, Button } from "../components/ui";
import { ProfilAvatar } from "../components/profil";
import { Segments } from "../components/texteUI";
import { ScrutoirMark } from "../components/ScrutoirMark";
import { DuelDeputesBar } from "../components/DuelDeputesBar";
import { ErreurChargement } from "../components/ErreurChargement";
import { track } from "../analytics";
import {
  tauxAccord, phraseBandeau, derniersVotes, votesCommuns, ventilerThemes, ailesPapillon, phraseHorsSeuil, positionCourte, ligneVote,
  type LigneTheme,
} from "../confrontation";
import type { DeputeResume, Confrontation, ConfrontationScrutin, Periode, AngleShuffle } from "../types";
import type { Nav } from "../nav";

/**
 * Face à face de deux élus (maquette validée le 15/10/2026, 3e proposition) : bandeau sombre avec
 * l'anneau d'accord et la relance (« Changer d'élus », « Duel au hasard ») ; derniers votes en deux
 * colonnes ; thèmes en barres papillon chiffrées (pareils ←, opposés →), dépliables vers le détail
 * des scrutins. Chiffres : règle de `getConfrontation` (scrutins avec thème, positions exprimées
 * des deux), rangés par `confrontation.ts` (pur, testé).
 */

const PERIODES: { key: Periode; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "12m", label: "12 mois" },
  { key: "6m", label: "6 mois" },
];

// Pourquoi ce duel (tirage au hasard) : ton neutre, sobre, sans vocabulaire de combat.
const ANGLE_LABEL: Record<AngleShuffle, string> = {
  fracture_interne: "Même groupe, votes les plus éloignés.",
  alliance_contre_nature: "Groupes opposés, votes étonnamment proches.",
  faux_duel: "Ni alliés ni adversaires : ça se joue dossier par dossier.",
};
const ANGLES_SHUFFLE: AngleShuffle[] = ["fracture_interne", "alliance_contre_nature", "faux_duel"];

// Largeur d'une colonne de position (pastille) : en-tête et lignes alignés.
const COL = 56;

export function ConfrontationScreen({ a, b, periode: periodeInit, hasard, angle, nav }: { a?: string; b?: string; periode?: Periode; hasard?: boolean; angle?: AngleShuffle; nav: Nav }) {
  const [depA, setDepA] = useState<DeputeResume | null>(null);
  const [depB, setDepB] = useState<DeputeResume | null>(null);
  const [periode, setPeriode] = useState<Periode>(periodeInit ?? "all");
  const [data, setData] = useState<Confrontation | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0); // bump = « Réessayer » (relance le chargement du duel)
  // Angle du dernier tirage au hasard (null dès qu'un élu est choisi à la main).
  const [shuffleAngle, setShuffleAngle] = useState<AngleShuffle | null>(null);
  const [shuffling, setShuffling] = useState(false);
  // « Changer d'élus » : les deux sélecteurs reviennent à la place du bandeau.
  const [edition, setEdition] = useState(false);

  // Barre sticky des deux élus : apparaît quand le bandeau a défilé hors champ.
  const scrollY = useRef(new Animated.Value(0)).current;
  const barOpacity = scrollY.interpolate({ inputRange: [220, 290], outputRange: [0, 1], extrapolate: "clamp" });
  const barTranslate = scrollY.interpolate({ inputRange: [220, 290], outputRange: [-10, 0], extrapolate: "clamp" });

  // Choix à la main → on quitte le contexte « tirage » ; les deux choisis → retour au bandeau.
  const choisirA = (d: DeputeResume) => { setDepA(d); setShuffleAngle(null); if (depB) setEdition(false); };
  const choisirB = (d: DeputeResume) => { setDepB(d); setShuffleAngle(null); if (depA) setEdition(false); };
  const viderA = () => { setDepA(null); setShuffleAngle(null); };
  const viderB = () => { setDepB(null); setShuffleAngle(null); };

  // Duel au hasard : une paire dans un autre angle que le précédent, puis le bandeau.
  async function lancerShuffle() {
    if (shuffling) return;
    setShuffling(true);
    try {
      const dispo = ANGLES_SHUFFLE.filter((x) => x !== shuffleAngle);
      const cible = dispo[Math.floor(Math.random() * dispo.length)];
      const res = await getConfrontationShuffle(cible);
      if (res) {
        setDepA(res.a);
        setDepB(res.b);
        setShuffleAngle(res.angle);
        setEdition(false);
        track("shuffle", res.angle);
      }
    } catch {
      /* silencieux : un tirage raté ne casse pas l'écran */
    } finally {
      setShuffling(false);
    }
  }

  // Pré-sélection (uids en route), « Duel au hasard » depuis l'accueil (aucun élu fourni), « Duel du
  // jour » (paire + angle en route → on rétablit la ligne « Pourquoi ce duel »).
  useEffect(() => {
    if ((a && !depA) || (b && !depB)) {
      getDeputesByUids([a, b].filter(Boolean) as string[])
        .then((ds) => {
          const byUid = new Map(ds.map((d) => [d.uid, d]));
          if (a && byUid.get(a)) setDepA(byUid.get(a)!);
          if (b && byUid.get(b)) setDepB(byUid.get(b)!);
        })
        .catch(() => {});
    }
    if (hasard && !a && !b) lancerShuffle();
    if (angle && a && b) setShuffleAngle(angle);
  }, []);

  // Persiste le duel dans la route : au retour de la liste détaillée, l'écran remonté le restaure.
  useEffect(() => {
    if (depA && depB) nav.replace({ name: "confrontation", a: depA.uid, b: depB.uid, periode, angle: shuffleAngle ?? undefined });
  }, [depA?.uid, depB?.uid, periode, shuffleAngle]);

  useEffect(() => {
    if (!depA || !depB) { setData(null); return; }
    let vivant = true;
    setLoading(true);
    setErreur(false);
    getConfrontation(depA.uid, depB.uid, periode)
      .then((d) => vivant && setData(d))
      .catch(() => vivant && setErreur(true))
      .finally(() => vivant && setLoading(false));
    return () => { vivant = false; };
  }, [depA?.uid, depB?.uid, periode, essai]);

  // Analytics : un duel regardé (paire triée, une fois par paire).
  useEffect(() => {
    if (depA && depB) track("confront", [depA.uid, depB.uid].sort().join("|"));
  }, [depA?.uid, depB?.uid]);

  const pret = !!depA && !!depB;
  const pareils = data?.accords ?? 0;
  const communs = data?.communs ?? 0;
  const taux = data && !loading ? tauxAccord(pareils, communs) : null;
  const ouvrirFiche = (d: DeputeResume) => nav.push({ name: "depute", uid: d.uid });

  return (
    <View style={{ flex: 1 }}>
      {/* Barre sticky : les deux élus + le taux d'accord, révélée au scroll. */}
      {pret && data && !loading && !edition && (
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, opacity: barOpacity, transform: [{ translateY: barTranslate }], pointerEvents: "none" }}>
          <DuelDeputesBar
            a={depA!}
            b={depB!}
            center={
              <View style={{ paddingVertical: 4, paddingHorizontal: 11, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.md, alignItems: "center" }}>
                <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text }]}>{taux != null ? `${taux} %` : "—"}</Text>
                <Text style={[T.micro, { color: C.textMuted }]}>d'accord</Text>
              </View>
            }
          />
        </Animated.View>
      )}

      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: S.s16, paddingTop: S.s14, paddingBottom: S.s44 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== "web" })}
      >
        {pret && !edition ? (
          <Bandeau
            depA={depA!}
            depB={depB!}
            taux={taux}
            phrase={data && !loading ? phraseBandeau(pareils, communs) : "Calcul des votes en commun…"}
            angle={shuffleAngle}
            shuffling={shuffling}
            onChanger={() => setEdition(true)}
            onHasard={lancerShuffle}
            onFiche={ouvrirFiche}
          />
        ) : (
          <Card radius={RADIUS.xl} padding={S.s16}>
            <Text accessibilityRole="header" style={[T.heading, { color: C.text }]}>Choisis deux élus</Text>
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s4 }]}>On compare leurs votes là où les deux ont pris position.</Text>
            <View style={{ flexDirection: "row", gap: S.s10, marginTop: S.s12 }}>
              <DeputeSlot depute={depA} onPick={choisirA} onClear={viderA} onOpen={ouvrirFiche} />
              <DeputeSlot depute={depB} onPick={choisirB} onClear={viderB} onOpen={ouvrirFiche} />
            </View>
            <View style={{ flexDirection: "row", gap: S.s10, marginTop: S.s14 }}>
              {edition && pret && <Button label="Annuler" variant="outline" style={{ flex: 1 }} onPress={() => setEdition(false)} />}
              <Button
                label="Duel au hasard"
                variant="primary"
                style={{ flex: 1 }}
                loading={shuffling}
                onPress={lancerShuffle}
                accessibilityLabel="Tirer deux élus au hasard"
                iconLeft={<MaterialCommunityIcons name="shuffle-variant" size={ICON.md} />}
              />
            </View>
          </Card>
        )}

        {pret && !edition && (
          <View style={{ marginTop: S.s14 }}>
            <Segments<Periode> plein label="Période" items={PERIODES} actif={periode} onChange={setPeriode} />
          </View>
        )}

        {pret && !edition && loading && <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s32 }} />}
        {pret && !edition && erreur && !loading && <ErreurChargement compact onRetry={() => setEssai((n) => n + 1)} />}
        {pret && !edition && data && !loading && <Resultats data={data} depA={depA!} depB={depB!} nav={nav} />}
      </Animated.ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ Bandeau sombre */

function Bandeau({
  depA, depB, taux, phrase, angle, shuffling, onChanger, onHasard, onFiche,
}: {
  depA: DeputeResume; depB: DeputeResume; taux: number | null; phrase: string; angle: AngleShuffle | null;
  shuffling: boolean; onChanger: () => void; onHasard: () => void; onFiche: (d: DeputeResume) => void;
}) {
  return (
    <View style={{ position: "relative", overflow: "hidden", backgroundColor: C.heroBg, borderRadius: RADIUS.xl, paddingTop: S.s20, paddingHorizontal: S.s16, paddingBottom: S.s16 }}>
      {/* Filigrane : l'hémicycle du logo, en blanc très léger. */}
      <View pointerEvents="none" style={{ position: "absolute", left: -31, top: -40 }}>
        <ScrutoirMark size={420} color={C.heroWatermark} accent="transparent" />
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <EluBandeau d={depA} onPress={() => onFiche(depA)} />
        <Anneau taux={taux} />
        <EluBandeau d={depB} onPress={() => onFiche(depB)} />
      </View>

      <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.onHeroMuted, textAlign: "center", marginTop: S.s12 }]}>{phrase}</Text>
      {angle && (
        <Text style={[T.micro, { color: C.onHeroMuted, textAlign: "center", marginTop: S.s4 }]}>Tiré au hasard. {ANGLE_LABEL[angle]}</Text>
      )}

      <View style={{ flexDirection: "row", gap: S.s8, marginTop: S.s14 }}>
        <TouchableOpacity
          onPress={onChanger}
          accessibilityRole="button"
          activeOpacity={0.8}
          style={{ flex: 1, height: CONTROL.md, borderRadius: RADIUS.md, backgroundColor: C.heroGhost, borderWidth: 1, borderColor: C.heroTrack, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.s8 }}
        >
          <Feather name="repeat" size={ICON.md} color={C.onHero} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.onHero }]}>Changer d'élus</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onHasard}
          disabled={shuffling}
          accessibilityRole="button"
          accessibilityLabel="Duel au hasard : tirer deux autres élus"
          activeOpacity={0.85}
          style={{ flex: 1, height: CONTROL.md, borderRadius: RADIUS.md, backgroundColor: C.onHero, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.s8 }}
        >
          {shuffling ? <ActivityIndicator size="small" color={C.heroInk} /> : <MaterialCommunityIcons name="shuffle-variant" size={ICON.md} color={C.heroInk} />}
          <Text style={[T.small, { fontFamily: F.bold, color: C.heroInk }]}>Duel au hasard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EluBandeau({ d, onPress }: { d: DeputeResume; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Voir la fiche de ${d.nom_complet}`}
      style={{ flex: 1, minWidth: 0, alignItems: "center", paddingTop: S.s14 }}
    >
      <ProfilAvatar uri={d.photo_url} size={54} ring={couleurGroupe(d.couleur)} />
      <Text style={[T.small, { fontFamily: F.bold, color: C.onHero, marginTop: S.s8, textAlign: "center" }]} numberOfLines={2}>{d.nom_complet}</Text>
      <Text style={[T.micro, { color: C.onHeroMuted, marginTop: 2 }]} numberOfLines={1}>{d.abrev ?? "—"}</Text>
    </TouchableOpacity>
  );
}

/** Anneau d'accord : part des votes pareils (vert), le reste opposé (rouge). */
function Anneau({ taux }: { taux: number | null }) {
  const taille = 112;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const arc = taux != null ? (circ * taux) / 100 : 0;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={taux != null ? `${taux} % d'accord` : "Taux d'accord en cours de calcul"}
      style={{ width: taille, height: taille }}
    >
      <Svg width={taille} height={taille}>
        <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={taux != null ? C.contre : C.heroTrack} strokeWidth={11} />
        {taux != null && taux > 0 && (
          <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={C.pour} strokeWidth={11} strokeDasharray={`${arc} ${circ}`} transform={`rotate(-90 ${taille / 2} ${taille / 2})`} />
        )}
      </Svg>
      <View style={{ position: "absolute", left: 0, top: 0, width: taille, height: taille, alignItems: "center", justifyContent: "center" }}>
        <Text style={[T.title, tnum, { color: C.onHero }]}>{taux != null ? `${taux} %` : "—"}</Text>
        <Text style={[T.micro, { color: C.onHeroMuted }]}>d'accord</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ Sélecteur */

function DeputeSlot({ depute, onPick, onClear, onOpen }: { depute: DeputeResume | null; onPick: (d: DeputeResume) => void; onClear: () => void; onOpen: (d: DeputeResume) => void }) {
  const [q, setQ] = useState("");
  const [qFocus, setQFocus] = useState(false); // focus clavier visible sur le champ
  const [res, setRes] = useState<DeputeResume[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      try { const r = await rechercher(q.trim()); setRes(r.deputes.slice(0, 6)); } catch { setRes([]); }
    }, 220);
  }, [q]);

  if (depute) {
    return (
      <View style={{ flex: 1, alignItems: "center", backgroundColor: C.bg, borderRadius: RADIUS.md, padding: S.s10 }}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => onOpen(depute)} accessibilityRole="button" accessibilityLabel={`Voir la fiche de ${depute.nom_complet}`} style={{ alignItems: "center" }}>
          <ProfilAvatar uri={depute.photo_url} size={44} ring={couleurGroupe(depute.couleur)} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginTop: S.s6, textAlign: "center" }]} numberOfLines={2}>{depute.nom_complet}</Text>
          <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>{depute.abrev ?? "—"}</Text>
        </TouchableOpacity>
        <Button label="Changer" variant="text" size="sm" onPress={onClear} accessibilityLabel={`Changer ${depute.nom_complet}`} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {/* Bordure accent au focus = focus clavier visible (l'outline navigateur est désactivée). */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.bg, borderRadius: RADIUS.sm, paddingHorizontal: S.s10, height: CONTROL.md, borderWidth: 1, borderColor: qFocus ? C.accent : C.borderStrong }}>
        <Feather name="search" size={ICON.sm} color={C.textFaint} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setQFocus(true)}
          onBlur={() => setQFocus(false)}
          placeholder="Un élu…"
          placeholderTextColor={C.textFaint}
          accessibilityLabel="Chercher un élu"
          style={[inputText, { flex: 1, minWidth: 0, color: C.text, outlineStyle: "none" }] as any}
          autoCorrect={false}
        />
      </View>
      {res.map((d) => (
        <TouchableOpacity key={d.uid} onPress={() => { onPick(d); setQ(""); setRes([]); }} accessibilityRole="button" accessibilityLabel={`Choisir ${d.nom_complet}`} style={{ flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: CONTROL.md }}>
          <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfaceAlt }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[T.small, { fontFamily: F.semibold, color: C.text }]} numberOfLines={1}>{d.nom_complet}</Text>
            <Text style={[T.micro, { color: C.textMuted }]}>{d.abrev ?? "—"}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ Résultats */

function Resultats({ data, depA, depB, nav }: { data: Confrontation; depA: DeputeResume; depB: DeputeResume; nav: Nav }) {
  const derniers = derniersVotes(data.themes, 3);
  const { fiables, peu, aucun } = ventilerThemes(data.themes, SEUIL_FIABILITE);
  const court = (t: LigneTheme) => ({ ...t, libelle: catUI(t.id).court ?? t.libelle });
  const horsSeuil = phraseHorsSeuil(peu.map(court), aucun.map(court));
  const sousTitre = `${depA.nom_complet} et ${depB.nom_complet}`;

  const ouvrirListe = (kind: "accord" | "desaccord" | "tous", themeLibelle: string, scrutins: ConfrontationScrutin[], themeCommuns: number) =>
    nav.push({ name: "confrontationListe", kind, themeLibelle, sousTitre, scrutins, depA, depB, communs: themeCommuns });

  return (
    <View>
      {/* ===== Derniers votes, en deux colonnes ===== */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S.s20, marginBottom: S.s8, paddingHorizontal: 2 }}>
        <Text accessibilityRole="header" style={[T.heading, { color: C.text }]}>Derniers votes</Text>
        {/* Aligné sur les colonnes de pastilles (marge interne des lignes : 14, de l'en-tête : 2). */}
        <View style={{ paddingRight: S.s12 }}><EnteteColonnes a={depA} b={depB} /></View>
      </View>
      {data.communs === 0 ? (
        <Card radius={RADIUS.lg}>
          <Text style={[T.small, { color: C.textMuted }]}>Aucun vote en commun sur cette période : leurs positions ne se comparent pas par ce canal.</Text>
        </Card>
      ) : (
        <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
          {derniers.map((sc, i) => <LigneVoteDuel key={sc.uid} sc={sc} premier={i === 0} depA={depA} depB={depB} nav={nav} />)}
          <TouchableOpacity
            onPress={() => ouvrirListe("tous", "Tous les thèmes", votesCommuns(data.themes), data.communs)}
            accessibilityRole="button"
            style={{ minHeight: CONTROL.md, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: C.border }}
          >
            <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.accent }]}>{data.communs > 1 ? `Voir les ${data.communs} votes en commun` : "Voir le vote en commun"}</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* ===== Par thème : barres papillon ===== */}
      {fiables.length > 0 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: S.s20, marginBottom: S.s8, paddingHorizontal: 2 }}>
            <Text accessibilityRole="header" style={[T.heading, { color: C.text }]}>Par thème</Text>
            <View style={{ flexDirection: "row", gap: S.s12 }}>
              <Text style={[T.micro, { fontFamily: F.bold, color: C.adopteFg }]}>← pareils</Text>
              <Text style={[T.micro, { fontFamily: F.bold, color: C.rejeteFg }]}>opposés →</Text>
            </View>
          </View>
          <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
            {fiables.map((t, i) => {
              const th = data.themes.find((x) => x.id === t.id)!;
              return (
                <ThemePapillon
                  key={t.id}
                  ligne={court(t)}
                  premier={i === 0}
                  onPareils={() => ouvrirListe("accord", court(t).libelle, th.accords, th.communs)}
                  onOpposes={() => ouvrirListe("desaccord", court(t).libelle, th.desaccords, th.communs)}
                />
              );
            })}
          </Card>
        </>
      )}
      {!!horsSeuil && <Text style={[T.small, { color: C.textFaint, marginTop: S.s10, paddingHorizontal: 2 }]}>{horsSeuil}</Text>}

      <Text style={[T.micro, { color: C.textFaint, marginTop: S.s16, paddingHorizontal: 2 }]}>
        Votes en commun : scrutins publics nominatifs de la 17ᵉ législature (depuis 2024), rattachés à un thème, où les deux ont voté pour, contre ou se sont abstenus. Quand l'un des deux n'a pas voté, le scrutin ne compte pas.
      </Text>
    </View>
  );
}

/** Les deux élus au-dessus des colonnes de positions (mêmes largeurs que les pastilles). */
export function EnteteColonnes({ a, b }: { a: DeputeResume; b: DeputeResume }) {
  return (
    <View style={{ flexDirection: "row", gap: S.s8 }}>
      {[a, b].map((d) => (
        <View key={d.uid} style={{ width: COL, alignItems: "center" }} accessible accessibilityLabel={`Colonne de ${d.nom_complet}`}>
          <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: couleurGroupe(d.couleur), backgroundColor: C.surfaceAlt }} />
        </View>
      ))}
    </View>
  );
}

/** Pastille de position en colonne : Pour (vert doux), Contre (rouge doux), Abst. (neutre). */
function PastillePosition({ pos }: { pos: string }) {
  const bg = pos === "pour" ? C.adopteBg : pos === "contre" ? C.rejeteBg : C.surfaceSunken;
  const fg = pos === "pour" ? C.adopteFg : pos === "contre" ? C.rejeteFg : C.textMuted;
  return (
    <View style={{ width: COL, alignItems: "center", paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: bg }}>
      <Text style={[T.micro, { fontFamily: F.bold, color: fg }]}>{positionCourte(pos)}</Text>
    </View>
  );
}

const ANNEE = new Date().toISOString().slice(0, 4);

/** Une ligne de vote du duel : ce qui a été voté, puis la position de chacun en colonnes. */
export function LigneVoteDuel({ sc, premier, depA, depB, nav }: { sc: ConfrontationScrutin; premier: boolean; depA: DeputeResume; depB: DeputeResume; nav: Nav }) {
  const { meta, titre } = ligneVote(sc, ANNEE);
  return (
    <>
      {!premier && <View style={{ height: 1, backgroundColor: C.border, marginLeft: S.s14 }} />}
      <TouchableOpacity
        onPress={() => nav.push({ name: "scrutin", uid: sc.uid })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${titre}. ${depA.nom_complet} : ${positionCourte(sc.posA)}. ${depB.nom_complet} : ${positionCourte(sc.posB)}.`}
        style={{ flexDirection: "row", alignItems: "center", gap: S.s10, paddingHorizontal: S.s14, paddingVertical: 11 }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.micro, tnum, { color: C.textFaint }]}>{meta}</Text>
          <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginTop: 2 }]} numberOfLines={2}>{titre}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: S.s8 }}>
          <PastillePosition pos={sc.posA} />
          <PastillePosition pos={sc.posB} />
        </View>
      </TouchableOpacity>
    </>
  );
}

/** Un thème : % d'accord, barre papillon chiffrée (pareils ←, opposés →), dépliable vers le détail. */
function ThemePapillon({ ligne, premier, onPareils, onOpposes }: { ligne: LigneTheme; premier: boolean; onPareils: () => void; onOpposes: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const ui = catUI(ligne.id);
  const { gauche, droite } = ailesPapillon(ligne.pareils, ligne.opposes);
  const pl = (n: number, s: string) => `${n} vote${n > 1 ? "s" : ""} ${s}${n > 1 ? "s" : ""}`;
  const voir = (n: number, s: string) => (n > 1 ? `Voir les ${n} ${s}s` : n === 1 ? `Voir le vote ${s}` : `Aucun vote ${s}`);
  return (
    <>
      {!premier && <View style={{ height: 1, backgroundColor: C.border, marginLeft: S.s14 }} />}
      <View style={{ paddingHorizontal: S.s14, paddingVertical: S.s12 }}>
        <TouchableOpacity
          onPress={() => setOuvert((o) => !o)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: ouvert }}
          aria-expanded={ouvert}
          accessibilityLabel={`${ligne.libelle} : ${ligne.pct} % d'accord, ${pl(ligne.pareils, "pareil")}, ${pl(ligne.opposes, "opposé")}`}
          style={{ gap: 7 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name={ui.icon as any} size={ICON.xs} color={ui.fg} />
            </View>
            <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{ligne.libelle}</Text>
            <Text style={[T.small, tnum, { fontFamily: F.extra, color: C.text }]}>{ligne.pct} %</Text>
            <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={ICON.sm} color={C.textFaint} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.s6 }}>
            <Text style={[T.micro, tnum, { width: 26, textAlign: "right", fontFamily: F.bold, color: C.adopteFg }]}>{ligne.pareils}</Text>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 10 }}>
              <View style={{ flex: 1, height: 10, flexDirection: "row", justifyContent: "flex-end" }}>
                <View style={{ width: `${gauche}%`, backgroundColor: C.pour, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 }} />
              </View>
              <View style={{ width: 2, height: 16, backgroundColor: C.hairlineStrong }} />
              <View style={{ flex: 1, height: 10, flexDirection: "row" }}>
                <View style={{ width: `${droite}%`, backgroundColor: C.contre, borderTopRightRadius: 5, borderBottomRightRadius: 5 }} />
              </View>
            </View>
            <Text style={[T.micro, tnum, { width: 26, fontFamily: F.bold, color: C.rejeteFg }]}>{ligne.opposes}</Text>
          </View>
        </TouchableOpacity>

        {ouvert && (
          <View style={{ flexDirection: "row", gap: S.s8, marginTop: S.s10 }}>
            <BoutonDetail label={voir(ligne.pareils, "pareil")} bg={C.adopteBg} fg={C.adopteFg} disabled={!ligne.pareils} onPress={onPareils} />
            <BoutonDetail label={voir(ligne.opposes, "opposé")} bg={C.rejeteBg} fg={C.rejeteFg} disabled={!ligne.opposes} onPress={onOpposes} />
          </View>
        )}
      </View>
    </>
  );
}

function BoutonDetail({ label, bg, fg, disabled, onPress }: { label: string; bg: string; fg: string; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={{ flex: 1, minHeight: 40, borderRadius: RADIUS.md, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.6 : 1 }}
    >
      <Text style={[T.small, tnum, { fontFamily: F.bold, color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}
