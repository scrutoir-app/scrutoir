import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Image } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, inputText, RADIUS, shadowCard, positionLabel, couleurPosition, couleurGroupe, getScheme } from "../theme";
import { getVotesSuivis, getVotesPartisSuivis, getPartis, getTestProximite, getScrutinsRecents } from "../api";
import { catUI } from "../categoryUI";
import { useFollows, getLastSeen } from "../follows";
import { chargerTest } from "../testProximite/storage";
import { useJe, useProximiteDepute, scoreGroupeJe, type ContexteJe, type ProximiteScore } from "../testProximite/jeProximite";
import { nbNeuves, SEUIL_AFFINER } from "../testProximite/config";
import type { QuestionProximite } from "../testProximite/score";
import type { VoteSuivi, PartiResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { SearchResultsList } from "../components/SearchResultsList";
import { ScrutoirLogo } from "../components/brand/ScrutoirLogo";
import { HemicyclePicto } from "../components/HemicyclePicto";

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

// --- Petits éléments de carte -------------------------------------------------

/** Identité d'une personne : photo, ou avatar à initiales en repli. */
function Avatar({ photo, nom, couleur, size = 42 }: { photo: string | null; nom: string; couleur: string | null; size?: number }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceAlt }} />;
  const initiales = nom.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const col = couleurGroupe(couleur);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
      <Text style={[T.small, { fontFamily: F.extra, color: col }]}>{initiales || "?"}</Text>
    </View>
  );
}

/** Groupe en SECOND, à côté du nom : pastille couleur + abrev (jamais le picto principal). */
function GroupChip({ abrev, couleur }: { abrev: string | null; couleur: string | null }) {
  if (!abrev) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 3, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: couleurGroupe(couleur) }} />
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{abrev}</Text>
    </View>
  );
}

/** Picto du THÈME du scrutin (catUI partagé avec les grilles de thèmes). */
function ThemePicto({ categorie, size = 28 }: { categorie: string | null | undefined; size?: number }) {
  if (!categorie) return null;
  const ui = catUI(categorie);
  return (
    <View style={{ width: size, height: size, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
      <MaterialCommunityIcons name={ui.icon as any} size={size * 0.56} color={ui.fg} />
    </View>
  );
}

/** Score de proximité GLOBALE (≠ accord sur le vote affiché) — libellé explicite. */
function ProximiteGlobale({ score }: { score: ProximiteScore | null }) {
  if (!score) return null;
  return (
    <View style={{ alignItems: "flex-end", marginLeft: 4 }}>
      <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text }]}>{Math.round(score.pct * 100)}%</Text>
      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>proximité globale</Text>
    </View>
  );
}

/** Kicker « pourquoi cette carte est là ». */
function Motif({ texte }: { texte: string }) {
  return <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }]}>{texte}</Text>;
}

/** Ligne de vote d'une PERSONNE (identité à gauche) — fil « élus suivis ». */
function CarteDepute({ v, nav }: { v: VoteSuivi; nav: Nav }) {
  const score = useProximiteDepute(v.deputeUid);
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })} style={carteStyle()}>
      <Motif texte={`Tu suis ${v.nom}`} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "depute", uid: v.deputeUid })}>
          <Avatar photo={v.photo} nom={v.nom} couleur={v.couleur} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{v.nom}</Text>
          <GroupChip abrev={v.abrev} couleur={v.couleur} />
        </View>
        <ProximiteGlobale score={score} />
      </View>
      <LigneDuVote v={v} />
    </TouchableOpacity>
  );
}

/** Ligne de vote d'un GROUPE (PictoGroupe à gauche — c'est une ligne de groupe). */
function CarteParti({ v, partis, je, nav }: { v: VoteSuivi; partis: PartiResume[]; je: ContexteJe | null; nav: Nav }) {
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })} style={carteStyle()}>
      <Motif texte="Tu suis ce groupe" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "parti", uid: v.deputeUid })}>
          <HemicyclePicto groupes={partis} activeAbrev={v.abrev} color={v.couleur ?? C.textFaint} size={44} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{v.abrev ?? v.nom}</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]} numberOfLines={1}>{v.nom}</Text>
        </View>
        <ProximiteGlobale score={scoreGroupeJe(je, v.abrev)} />
      </View>
      <LigneDuVote v={v} />
    </TouchableOpacity>
  );
}

/** Le vote précis (picto thème + position colorée + intitulé) — distinct de l'identité. */
function LigneDuVote({ v }: { v: VoteSuivi }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 11 }}>
      <ThemePicto categorie={v.categorie} />
      <Text style={[T.small, { flex: 1, color: C.text }]} numberOfLines={2}>
        <Text style={{ fontFamily: F.bold, color: couleurPosition(v.position) }}>{positionLabel(v.position)}</Text>
        {v.titre ? ` · ${v.titre}` : ""}
      </Text>
    </View>
  );
}

/** Carte « découverte » : un scrutin notable sur un thème marqué Fort (sans suivi requis). */
function CarteDecouverte({ s, nav }: { s: ScrutinResume; nav: Nav }) {
  const adopte = (s.sort_code ?? "").toLowerCase().includes("adopt");
  const ui = s.categorie ? catUI(s.categorie) : null;
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "scrutin", uid: s.uid })} style={carteStyle()}>
      <Motif texte={`Thème qui t'intéresse · ${ui?.court ?? ""}`} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <ThemePicto categorie={s.categorie ?? null} size={42} />
        <Text style={[T.small, { flex: 1, color: C.text }]} numberOfLines={3}>{s.titre}</Text>
        {s.sort_code != null && (
          <View style={{ backgroundColor: adopte ? C.adopteBg : C.rejeteBg, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={[T.micro, { fontFamily: F.bold, color: adopte ? C.adopteFg : C.rejeteFg }]}>{adopte ? "Adopté" : "Rejeté"}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Fonction (pas une constante) : `C` et `shadowCard` sont des palettes VIVANTES réécrites au
// changement de thème → il faut relire leurs valeurs à CHAQUE rendu, sinon le style reste figé
// sur le thème actif au chargement du module (cartes sombres en clair, et inversement).
const carteStyle = () => ({ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard });

/** Bloc nommé du fil. */
function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 11 }]}>{titre}</Text>
      <View style={{ gap: 9 }}>{children}</View>
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

  useEffect(() => {
    getPartis().then(setPartis);
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
    getScrutinsRecents(120).then(setRecents).catch(() => setRecents([]));
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
  const voirSuivis = (
    <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "suivis" })} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 2, marginBottom: 18 }}>
      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir tous tes suivis</Text>
      <Feather name="chevron-right" size={16} color={C.accent} />
    </TouchableOpacity>
  );

  return (
    <View style={{ paddingHorizontal: SIDE }}>
      <Text style={[T.title, { fontFamily: F.extra, color: C.text, marginTop: 6 }]}>Depuis ta dernière visite</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 3, marginBottom: 16 }]}>Le digest de tes suivis — l'essentiel d'abord</Text>

      {chargement ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 20, marginBottom: 20 }} />
      ) : digestVide ? (
        <>
          <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: C.border, ...shadowCard }}>
            <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Rien de neuf chez tes suivis</Text>
            <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>Tu es à jour. Les nouveaux votes de tes suivis apparaîtront ici.</Text>
          </View>
          {voirSuivis}
        </>
      ) : (
        <>
          {filDeputes.length > 0 && (
            <Bloc titre="Tes élus suivis">
              {filDeputes.map((v) => <CarteDepute key={v.deputeUid + v.scrutinUid} v={v} nav={nav} />)}
            </Bloc>
          )}
          {filPartis.length > 0 && (
            <Bloc titre="Tes groupes suivis">
              {filPartis.map((v) => <CarteParti key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />)}
            </Bloc>
          )}
          {voirSuivis}
        </>
      )}

      {/* Découverte : thématique (≠ digest des suivis), section à part. */}
      {decouverte.length > 0 && (
        <Bloc titre="Sur tes thèmes forts">
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
    </View>
  );
}
