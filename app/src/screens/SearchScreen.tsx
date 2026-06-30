import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, inputText, RADIUS, shadowCard, getScheme } from "../theme";
import { getVotesSuivis, getVotesPartisSuivis, getPartis, getTestProximite, getScrutinsRecents, getDuelDuJour } from "../api";
import { catUI } from "../categoryUI";
import { useFollows, getLastSeen } from "../follows";
import { chargerTest } from "../testProximite/storage";
import { useJe } from "../testProximite/jeProximite";
import { nbNeuves, SEUIL_AFFINER } from "../testProximite/config";
import type { QuestionProximite } from "../testProximite/score";
import type { VoteSuivi, PartiResume, ScrutinResume, ShuffleConfrontation } from "../types";
import type { Nav } from "../nav";
import { SearchResultsList } from "../components/SearchResultsList";
import { ScrutoirLogo } from "../components/brand/ScrutoirLogo";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { CarteSuivi, ThemePicto } from "../components/CarteSuivi";

const SIDE = 18;
const EXEMPLES = ["Pouvoir d'achat", "Santé", "Europe", "Médicaments", "Logement", "Écologie"];
const FORT = 2; // poids « Fort »

function heroTokens() {
  const dark = getScheme() === "dark";
  return {
    bg: dark ? "#2A323E" : "#161A20",
    border: dark ? "#414C5C" : "rgba(255,255,255,0.08)",
    title: "#FFFFFF",
    sub: "rgba(255,255,255,0.74)",
    tagBg: "rgba(255,255,255,0.10)",
    tagBorder: "rgba(255,255,255,0.22)",
    tagFg: "rgba(255,255,255,0.95)",
  };
}

function Masthead({ nav }: { nav: Nav }) {
  return (
    <View style={{ paddingHorizontal: SIDE, paddingTop: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <ScrutoirLogo wordHeight={31} color={C.text} accent={C.accent} />
      <TouchableOpacity
        onPress={() => nav.push({ name: "parametres" })}
        accessibilityRole="button"
        accessibilityLabel="Préférences"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong, ...shadowCard }}
      >
        <Feather name="settings" size={18} color={C.accent} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Champ de recherche. `clair` = pill blanc volontaire (posé sur le héros SOMBRE, contraste
 * dans les deux thèmes). Sans `clair` (champ utilisé seul, ex. mode résultats), il suit le
 * thème via les tokens — sinon une pastille blanche resterait sur fond sombre en dark.
 */
function SearchPill({ q, setQ, autoFocus, clair }: { q: string; setQ: (s: string) => void; autoFocus?: boolean; clair?: boolean }) {
  const bg = clair ? "#FFFFFF" : C.surface;
  const fg = clair ? "#171A1F" : C.text;
  const ph = clair ? "#8A8F98" : C.textMuted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 52, backgroundColor: bg, borderRadius: RADIUS.md, paddingHorizontal: 13, ...(clair ? {} : { borderWidth: 1, borderColor: C.borderStrong }) }}>
      <Feather name="search" size={19} color={clair ? "#171A1F" : C.textMuted} />
      <TextInput
        value={q}
        onChangeText={setQ}
        autoFocus={autoFocus}
        placeholder="Sur quoi ils ont voté ?"
        placeholderTextColor={ph}
        style={[inputText, { flex: 1, color: fg, outlineStyle: "none" }] as any}
        autoCorrect={false}
      />
      {q.length > 0 && (
        <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={18} color={ph} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function HeroRecherche({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  const h = heroTokens();
  return (
    <View style={{ backgroundColor: h.bg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: h.border, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14, ...shadowCard }}>
      <Text style={[T.heading, { color: h.title }]}>Sur quoi ils ont voté ?</Text>
      <Text style={[T.small, { color: h.sub, marginTop: 4, marginBottom: 12 }]}>Tape un sujet, un nom ou une loi</Text>
      <SearchPill q={q} setQ={setQ} clair />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {EXEMPLES.map((ex) => (
          <TouchableOpacity key={ex} activeOpacity={0.7} onPress={() => setQ(ex)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: RADIUS.pill, backgroundColor: h.tagBg, borderWidth: 1, borderColor: h.tagBorder }}>
            <Text style={[T.small, { fontFamily: F.semibold, color: h.tagFg }]}>{ex}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const enRecherche = q.trim().length >= 2;

  if (enRecherche) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: SIDE, paddingTop: 10 }}>
          <SearchPill q={q} setQ={setQ} autoFocus />
        </View>
        <View style={{ flex: 1, marginTop: 8 }}>
          <SearchResultsList q={q} nav={nav} onCorriger={setQ} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Masthead nav={nav} />
      <Accueil q={q} setQ={setQ} nav={nav} />
    </ScrollView>
  );
}

// --- Carte « découverte » (le bloc « thèmes forts » garde, lui, son motif) ----------

/** Un scrutin notable sur un thème marqué Fort (sans suivi requis). */
function CarteDecouverte({ s, nav }: { s: ScrutinResume; nav: Nav }) {
  const adopte = (s.sort_code ?? "").toLowerCase().includes("adopt");
  const ui = s.categorie ? catUI(s.categorie) : null;
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "scrutin", uid: s.uid })} style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}>
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }]}>
        Thème qui t'intéresse · {ui?.court ?? ""}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <ThemePicto categorie={s.categorie ?? null} size={42} />
        <Text style={[T.small, { fontFamily: F.medium, flex: 1, color: C.text }]} numberOfLines={3}>{s.titre}</Text>
        {s.sort_code != null && (
          <View style={{ backgroundColor: adopte ? C.adopteBg : C.rejeteBg, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={[T.micro, { fontFamily: F.bold, color: adopte ? C.adopteFg : C.rejeteFg }]}>{adopte ? "Adopté" : "Rejeté"}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Bloc nommé du fil, avec un lien d'action « Voir tout › » optionnel aligné à droite. */
function Bloc({ titre, onVoirTout, children }: { titre: string; onVoirTout?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{titre}</Text>
        {onVoirTout && (
          <TouchableOpacity onPress={onVoirTout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir tout</Text>
            <Feather name="chevron-right" size={15} color={C.accent} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ gap: 9 }}>{children}</View>
    </View>
  );
}

// --- Carte « Duels » (état rien de neuf) ---------------------------------------

/** Nom de famille à partir du nom complet (1er token = prénom, le reste = patronyme,
 *  particules incluses : « Marine Le Pen » → « Le Pen »). Garde la ligne du jour compacte. */
const nomFamille = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? p.slice(1).join(" ") : n;
};

/**
 * Tuile d'action de la carte Duels. `primaire` = tuile BLANCHE (action principale), même
 * traitement que le champ blanc du héros : fond #FFFFFF, encre sombre fixe (lisible en clair
 * comme en sombre, puisque la carte est sombre dans les deux modes). Sinon : tuile sombre
 * (action secondaire), un cran au-dessus du fond de carte.
 */
function TuileDuel({ icon, label, onPress, primaire }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; primaire?: boolean }) {
  const bg = primaire ? "#FFFFFF" : C.duelTileBg;
  const fg = primaire ? "#171A1F" : "#FFFFFF";
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ flex: 1, backgroundColor: bg, borderWidth: 1, borderColor: primaire ? "#FFFFFF" : C.duelTileBorder, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, alignItems: "center", gap: 6 }}
    >
      <MaterialCommunityIcons name={icon} size={21} color={fg} />
      <Text style={[T.small, { fontFamily: F.bold, color: fg, textAlign: "center" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Carte « Duels » de l'accueil, rendue UNIQUEMENT dans l'état « rien de neuf » (digest des
 * suivis à jour). Ardoise (C.accent), jamais rouge : la couleur n'encode pas un parti.
 * Deux actions (lancer / hasard) + la ligne « Duel du jour » (paire stable sur la journée,
 * via getDuelDuJour). Le hasard et le duel du jour sont délégués à l'écran confrontation.
 */
function CarteDuels({ duel, nav }: { duel: ShuffleConfrontation | null; nav: Nav }) {
  return (
    <View style={{ marginTop: 12, backgroundColor: C.duelBg, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}>
      <Text style={[T.heading, { color: "#FFFFFF", marginBottom: 8 }]}>Duels</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TuileDuel icon="swap-horizontal" label="Lancer un duel" primaire onPress={() => nav.push({ name: "confrontation" })} />
        <TuileDuel icon="shuffle-variant" label="Duel au hasard" onPress={() => nav.push({ name: "confrontation", hasard: true })} />
      </View>
      {duel && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => nav.push({ name: "confrontation", a: duel.a.uid, b: duel.b.uid, angle: duel.angle })}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, backgroundColor: C.duelTileBg, borderWidth: 1, borderColor: C.duelTileBorder, borderRadius: RADIUS.sm, paddingVertical: 9, paddingHorizontal: 11 }}
        >
          <MaterialCommunityIcons name="fire" size={16} color="#FFFFFF" style={{ flexShrink: 0 }} />
          <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: "rgba(255,255,255,0.74)" }]} numberOfLines={2}>
            Duel du jour : <Text style={{ fontFamily: F.semibold, color: "#FFFFFF" }}>{nomFamille(duel.a.nom_complet)} × {nomFamille(duel.b.nom_complet)}</Text> · d'accord à <Text style={{ fontFamily: F.extra, color: "#FFFFFF" }}>{duel.tauxAccord}%</Text>
          </Text>
          <Text style={[T.small, { fontFamily: F.bold, color: "#FFFFFF", flexShrink: 0 }]}>Voir ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Accueil allégé. Revenant : le fil agrège TROIS sources présentées SÉPARÉMENT et étiquetées —
 * « Tes élus suivis », « Tes groupes suivis », puis « Sur tes thèmes forts » (découverte, élus/
 * groupes NON suivis). Dans chaque bloc, priorité aux thèmes Fort, Peu relégués, à égalité chrono.
 * Nouveau : état vide « Tu ne suis encore personne ».
 */
function Accueil({ q, setQ, nav }: { q: string; setQ: (s: string) => void; nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const partiUids = follows.filter((u) => u.startsWith("PO"));
  const je = useJe();
  const [votesDeputes, setVotesDeputes] = useState<VoteSuivi[] | null>(null);
  const [votesPartis, setVotesPartis] = useState<VoteSuivi[] | null>(null);
  const [recents, setRecents] = useState<ScrutinResume[]>([]);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);
  const [duelDuJour, setDuelDuJour] = useState<ShuffleConfrontation | null>(null);

  useEffect(() => {
    getPartis().then(setPartis);
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
    getScrutinsRecents(120).then(setRecents).catch(() => setRecents([]));
    getDuelDuJour().then(setDuelDuJour).catch(() => setDuelDuJour(null));
  }, []);

  useEffect(() => {
    let alive = true;
    if (deputeUids.length) { setVotesDeputes(null); getVotesSuivis(deputeUids, 60).then((r) => alive && setVotesDeputes(r)); }
    else setVotesDeputes([]);
    if (partiUids.length) { setVotesPartis(null); getVotesPartisSuivis(partiUids, 60).then((r) => alive && setVotesPartis(r)); }
    else setVotesPartis([]);
    return () => { alive = false; };
  }, [deputeUids.join(","), partiUids.join(",")]);

  const poids = je?.poids ?? {};
  const w = (cat: string | null | undefined) => poids[cat ?? ""] ?? 1;
  // DIGEST : seulement les votes postérieurs à la dernière visite des Suivis (le flux complet
  // vit dans l'écran Suivis). Un vote par entité, priorité aux thèmes Fort, à égalité chrono.
  const lastSeen = getLastSeen();
  const estNouveau = (v: VoteSuivi) => !lastSeen || (!!v.date && v.date > lastSeen);
  const trier = (items: VoteSuivi[] | null, cap: number) => {
    const best = new Map<string, VoteSuivi>();
    for (const v of (items ?? []).filter(estNouveau)) {
      const cur = best.get(v.deputeUid);
      if (!cur || w(v.categorie) > w(cur.categorie) || (w(v.categorie) === w(cur.categorie) && (v.date || "") > (cur.date || ""))) best.set(v.deputeUid, v);
    }
    return [...best.values()].sort((a, b) => w(b.categorie) - w(a.categorie) || (b.date || "").localeCompare(a.date || "")).slice(0, cap);
  };
  const filDeputes = trier(votesDeputes, 3);
  const filPartis = trier(votesPartis, 2);

  // Découverte : scrutins récents sur les thèmes marqués Fort (priorité Fort, puis chrono).
  const fortThemes = new Set(Object.entries(poids).filter(([, v]) => v >= FORT).map(([t]) => t));
  const decouverte = fortThemes.size
    ? recents.filter((s) => s.categorie && fortThemes.has(s.categorie)).slice(0, 3)
    : [];

  // État NOUVEAU.
  if (!deputeUids.length && !partiUids.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 60 }}>
        <HemicyclePicto groupes={partis} activeAbrev={null} color={C.textFaint} size={88} />
        <Text style={[T.title, { fontFamily: F.extra, color: C.text, textAlign: "center", marginTop: 18 }]}>Tu ne suis encore personne</Text>
        <Text style={[T.body, { color: C.textMuted, textAlign: "center", marginTop: 10 }]}>
          Fais le test pour voir de qui tu es proche, ou cherche directement ton député.
        </Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => nav.push({ name: "testIntro" })} style={{ alignSelf: "stretch", marginTop: 28, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: "center", ...shadowCard }}>
          <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Faire le test · 2 min</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "monDepute" })} style={{ marginTop: 18 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Trouver mon député</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const test = chargerTest();
  const aTest = !!test && Object.keys(test.reponses).length > 0;
  const neuves = aTest && questions.length ? nbNeuves(questions, test!.reponses) : 0;
  const affinerDispo = aTest && neuves >= SEUIL_AFFINER;
  const chargement = votesDeputes === null || votesPartis === null;
  const digestVide = !filDeputes.length && !filPartis.length;

  return (
    <View style={{ paddingHorizontal: SIDE }}>
      <Text style={[T.title, { fontFamily: F.extra, color: C.text, marginTop: 6 }]}>Depuis ta dernière visite</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 3, marginBottom: 16 }]}>Le digest de tes suivis — l'essentiel d'abord</Text>

      {chargement ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 20, marginBottom: 20 }} />
      ) : digestVide ? (
        // Rien de neuf : la carte EST le lien vers le flux complet (plus de lien flottant).
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => nav.push({ name: "suivis" })}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: C.border, ...shadowCard }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Rien de neuf chez tes suivis</Text>
            <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>Tu es à jour. Vois tous tes suivis et leurs derniers votes.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={C.textFaint} />
        </TouchableOpacity>
      ) : (
        <>
          {filDeputes.length > 0 && (
            <Bloc titre="Tes élus suivis" onVoirTout={() => nav.push({ name: "suivis", source: "deputes" })}>
              {filDeputes.map((v) => <CarteSuivi key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />)}
            </Bloc>
          )}
          {filPartis.length > 0 && (
            <Bloc titre="Tes groupes suivis" onVoirTout={() => nav.push({ name: "suivis", source: "partis" })}>
              {filPartis.map((v) => <CarteSuivi key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />)}
            </Bloc>
          )}
        </>
      )}

      {/* Découverte : thématique (≠ digest des suivis), section à part → onglet Scrutins. */}
      {decouverte.length > 0 && (
        <Bloc titre="Sur tes thèmes forts" onVoirTout={() => nav.push({ name: "themes" })}>
          {decouverte.map((s) => <CarteDecouverte key={s.uid} s={s} nav={nav} />)}
        </Bloc>
      )}

      <HeroRecherche q={q} setQ={setQ} />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => (aTest ? nav.push({ name: "testResultat" }) : nav.push({ name: "testIntro" }))}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 15, paddingHorizontal: 16, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}
      >
        <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Ta proximité</Text>
        {affinerDispo ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "test", mode: "affiner" })} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{neuves} nouveaux votes</Text>
            <Feather name="chevron-right" size={17} color={C.accent} />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{aTest ? "Voir" : "Faire le test"}</Text>
            <Feather name="chevron-right" size={17} color={C.accent} />
          </View>
        )}
      </TouchableOpacity>

      {/* Carte Duels : seulement quand l'accueil n'a RIEN de neuf à montrer — digest des
          suivis à jour ET aucun scrutin sur tes thèmes forts. Sinon on n'alourdit pas la
          page. Ardoise, jamais rouge (cf. theme.ts). */}
      {!chargement && digestVide && decouverte.length === 0 && <CarteDuels duel={duelDuJour} nav={nav} />}
    </View>
  );
}
