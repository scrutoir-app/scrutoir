import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Animated,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, inputText, RADIUS, shadowCard, formatDate, positionLabel, couleurPosition, getScheme } from "../theme";
import { getMeta, getVotesSuivis, getDuelDuJour } from "../api";
import { catUI } from "../categoryUI";
import { useFollows, getLastSeen } from "../follows";
import type { VoteSuivi, ShuffleConfrontation } from "../types";
import type { Nav } from "../nav";
import { SearchResultsList } from "../components/SearchResultsList";
import { ScrutoirLogo } from "../components/brand/ScrutoirLogo";
import { ParcoursLoi } from "../components/ParcoursLoi";

// Aplat « encre » du héros, volontairement contrasté dans les DEUX thèmes (poster).
// En clair : ardoise très sombre sur fond clair. En sombre : panneau ardoise NETTEMENT
// plus clair que le fond encre (#0F1318) pour ne pas s'y fondre (retour terrain).
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
const PILL_BG = "#FFFFFF";
const PILL_INK = "#171A1F";
const PILL_PLACEHOLDER = "#8A8F98";

// Tags exemples : mots communs et NEUTRES (préremplissent la recherche).
const EXEMPLES = ["Pouvoir d'achat", "Santé", "Europe", "Médicaments", "Logement", "Écologie"];

const SIDE = 18;

/** En-tête de marque (logo prod intouché) + roue Réglages + baseline. */
function Masthead({ nav }: { nav: Nav }) {
  return (
    <View style={{ paddingHorizontal: SIDE, paddingTop: 14, paddingBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <ScrutoirLogo wordHeight={33} color={C.text} accent={C.accent} />
        <TouchableOpacity
          onPress={() => nav.push({ name: "parametres" })}
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong, ...shadowCard }}
        >
          <Feather name="settings" size={18} color={C.accent} />
        </TouchableOpacity>
      </View>
      <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
        Tes députés votent comment ?
      </Text>
    </View>
  );
}

/** Le champ de recherche réel, en pill blanc (16 px → pas de zoom iOS au focus). */
function SearchPill({ q, setQ, inputRef, autoFocus }: { q: string; setQ: (s: string) => void; inputRef?: React.RefObject<TextInput | null>; autoFocus?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 10, height: 52,
        backgroundColor: PILL_BG, borderRadius: RADIUS.md, paddingLeft: 13, paddingRight: 13,
      }}
    >
      <Feather name="search" size={19} color={PILL_INK} />
      <TextInput
        ref={inputRef as any}
        value={q}
        onChangeText={setQ}
        autoFocus={autoFocus}
        placeholder="Un sujet, un nom, une loi… ex. logement, santé, agriculture"
        placeholderTextColor={PILL_PLACEHOLDER}
        style={[inputText, { flex: 1, color: PILL_INK, outlineStyle: "none" }] as any}
        autoCorrect={false}
      />
      {q.length > 0 && (
        <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={18} color={PILL_PLACEHOLDER} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Héros recherche — aplat encre. `compact` = mode résultats (champ seul). */
function Hero({ q, setQ, compact, inputRef, autoFocus }: { q: string; setQ: (s: string) => void; compact?: boolean; inputRef?: React.RefObject<TextInput | null>; autoFocus?: boolean }) {
  const h = heroTokens();
  return (
    <View
      style={{
        marginHorizontal: SIDE, backgroundColor: h.bg, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: h.border, paddingHorizontal: 14,
        paddingTop: compact ? 12 : 18, paddingBottom: compact ? 12 : 16, ...shadowCard,
      }}
    >
      {!compact && (
        <>
          <Text style={[T.heading, { color: h.title }]}>Sur quoi ils ont voté ?</Text>
          <Text style={[T.small, { color: h.sub, marginTop: 5, marginBottom: 13 }]}>
            Tape un sujet, un nom ou une loi
          </Text>
        </>
      )}

      <SearchPill q={q} setQ={setQ} inputRef={inputRef} autoFocus={autoFocus} />

      {!compact && (
        // Une seule ligne : défilement horizontal (sinon le héros devient trop haut).
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 13 }}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {EXEMPLES.map((ex) => (
            <TouchableOpacity
              key={ex}
              activeOpacity={0.7}
              onPress={() => setQ(ex)}
              style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: RADIUS.pill, backgroundColor: h.tagBg, borderWidth: 1, borderColor: h.tagBorder }}
            >
              <Text style={[T.small, { fontFamily: F.semibold, color: h.tagFg }]}>{ex}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const [parcours, setParcours] = useState(false);
  const enRecherche = q.trim().length >= 2;

  // Sticky au scroll : le héros défile ; une barre de recherche compacte se colle en
  // haut dès qu'on l'a dépassé (tap → on remonte et on redonne le focus au champ).
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [heroBottom, setHeroBottom] = useState(300);
  const [stuck, setStuck] = useState(false);

  // Seuil d'apparition du sticky : un peu AVANT que le héros ait fini de défiler
  // (≈ quand le champ atteint le haut), pas seulement une fois tout le héros sorti.
  const seuilSticky = Math.max(70, heroBottom - 90);

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setStuck(value > seuilSticky - 24));
    return () => scrollY.removeListener(id);
  }, [seuilSticky]);

  // Mode résultats : héros compact épinglé (champ conservé, focus auto) + liste.
  if (enRecherche) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingTop: 8 }}>
          <Hero q={q} setQ={setQ} compact autoFocus />
        </View>
        <View style={{ flex: 1, marginTop: 8 }}>
          <SearchResultsList q={q} nav={nav} onCorriger={setQ} />
        </View>
        <ParcoursLoi visible={parcours} onClose={() => setParcours(false)} source="accueil" />
      </View>
    );
  }

  const stickyOpacity = scrollY.interpolate({ inputRange: [seuilSticky - 24, seuilSticky], outputRange: [0, 1], extrapolate: "clamp" });
  const stickyTranslate = scrollY.interpolate({ inputRange: [seuilSticky - 24, seuilSticky], outputRange: [-8, 0], extrapolate: "clamp" });

  const allerEnHaut = () => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
    setTimeout(() => inputRef.current?.focus?.(), 60);
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={scrollRef as any}
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        <Masthead nav={nav} />

        <View onLayout={(e) => { const b = e.nativeEvent.layout.y + e.nativeEvent.layout.height; if (Math.abs(b - heroBottom) > 1) setHeroBottom(b); }}>
          <Hero q={q} setQ={setQ} inputRef={inputRef} />
        </View>

        {/* Sous le bloc sombre, sur fond clair : ⓘ tuto pédagogique (entrée permanente). */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setParcours(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: SIDE, marginTop: 12, marginBottom: 2 }}
        >
          <Feather name="help-circle" size={14} color={C.accent} />
          <Text style={[T.small, { color: C.accent, fontFamily: F.medium }]}>
            Loi, amendement, scrutin : qui est qui ?
          </Text>
        </TouchableOpacity>

        <AccueilContent nav={nav} />
      </Animated.ScrollView>

      {/* Barre de recherche STICKY : apparaît au scroll, sous la marque. Tap → haut + focus. */}
      <Animated.View
        pointerEvents={stuck ? "auto" : "none"}
        style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: stickyOpacity, transform: [{ translateY: stickyTranslate }] }}
      >
        <View style={{ backgroundColor: C.bg, paddingHorizontal: SIDE, paddingTop: 9, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
          {/* Même champ que les autres onglets : carré ardoise + loupe blanche + placeholder réel. */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={allerEnHaut}
            accessibilityRole="search"
            accessibilityLabel="Rechercher"
            style={{ flexDirection: "row", alignItems: "center", gap: 11, height: 54, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingLeft: 8, paddingRight: 15, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
              <Feather name="search" size={19} color="#fff" />
            </View>
            <Text style={[inputText, { flex: 1, color: C.textMuted }]} numberOfLines={1}>
              Un sujet, un nom, une loi… ex. logement, santé, agriculture
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ParcoursLoi visible={parcours} onClose={() => setParcours(false)} source="accueil" />
    </View>
  );
}

/** Contenu de l'accueil sous le héros (dans le scroll parent : pas de ScrollView propre). */
function AccueilContent({ nav }: { nav: Nav }) {
  const [ingestedAt, setIngestedAt] = useState<string | null>(null);

  useEffect(() => {
    getMeta().then((m) => setIngestedAt(m.ingestedAt)).catch(() => setIngestedAt(null));
  }, []);

  return (
    <View>
      {/* Bloc « test » — carte claire secondaire (pas d'aplat sombre). */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => nav.push({ name: "testIntro" })}
        style={{ marginHorizontal: SIDE, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderStrong, paddingVertical: 13, paddingHorizontal: 15, ...shadowCard }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Feather name="help-circle" size={20} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Et toi, tu votes comment ?</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>
            Teste ta proximité, si tu cherches un point de départ
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.textFaint} />
      </TouchableOpacity>

      {/* Bloc « duel » compact : deux boutons + une ligne « duel du jour ». */}
      <BlocDuel nav={nav} />

      {/* Slot du bas, adaptatif : feed des suivis (revenant) ou invite (nouveau). */}
      <SlotSuivis nav={nav} />

      {/* Accès discret « mon député » (plus de bloc empilé ; accessible aussi via recherche). */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => nav.push({ name: "monDepute" })}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 22, marginHorizontal: SIDE }}
      >
        <Feather name="map-pin" size={14} color={C.accent} />
        <Text style={[T.small, { color: C.accent, fontFamily: F.semibold }]}>Trouver mon député</Text>
      </TouchableOpacity>

      {/* Pied : fraîcheur des données. */}
      <Text style={[T.micro, { color: C.textFaint, textAlign: "center", marginTop: 18 }]}>
        {ingestedAt ? `À jour ${frais(ingestedAt)} · en direct` : "En direct"}
      </Text>
    </View>
  );
}

/** « Aujourd'hui » si les données datent du jour, sinon « le 12 juin 2026 ». */
function frais(iso: string): string {
  const jour = new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10) === jour ? "aujourd'hui" : `le ${formatDate(iso.slice(0, 10))}`;
}

/** Confronte deux élus — version compacte (deux boutons + ligne « duel du jour »). */
function BlocDuel({ nav }: { nav: Nav }) {
  const [duel, setDuel] = useState<ShuffleConfrontation | null>(null);

  useEffect(() => {
    getDuelDuJour().then(setDuel).catch(() => setDuel(null));
  }, []);

  return (
    <View style={{ marginHorizontal: SIDE, marginTop: 22 }}>
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 11 }]}>Confronte deux élus</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.push({ name: "confrontation" })}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, backgroundColor: C.accent, borderRadius: RADIUS.md, ...shadowCard }}
        >
          <Feather name="git-pull-request" size={17} color={C.surface} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.surface }]}>Lancer un duel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.push({ name: "confrontation", hasard: true })}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}
        >
          <Feather name="shuffle" size={17} color={C.accent} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Duel au hasard</Text>
        </TouchableOpacity>
      </View>

      {duel && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => nav.push({ name: "confrontation", a: duel.a.uid, b: duel.b.uid, angle: duel.angle })}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 11, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderStrong, paddingVertical: 12, paddingHorizontal: 14, ...shadowCard }}
        >
          <MaterialCommunityIcons name="fire" size={20} color="#E0703A" />
          <Text style={[T.small, { color: C.text, flex: 1 }]} numberOfLines={1}>
            <Text style={{ fontFamily: F.bold }}>Duel du jour : </Text>
            {duel.a.nom_complet} × {duel.b.nom_complet} · d'accord à {duel.tauxAccord}%
          </Text>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PositionPill({ position }: { position: string }) {
  const col = couleurPosition(position);
  return (
    <View style={{ backgroundColor: col + "1F", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={[T.small, { fontFamily: F.bold, color: col }]}>{positionLabel(position)}</Text>
    </View>
  );
}

/**
 * Slot adaptatif du bas de l'accueil :
 *  - utilisateur qui revient (a des suivis) → feed « Depuis ta dernière visite »
 *    (votes récents de ses élus, badge « Nouveau » depuis la dernière visite) + accès Suivis ;
 *  - nouveau (aucun suivi) → invite « Suis ton premier député » (jamais un feed vide).
 * La logique de fraîcheur réutilise getLastSeen (on ne marque PAS vu ici : seul l'onglet
 * Suivis consomme le « Nouveau »).
 */
function SlotSuivis({ nav }: { nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  const [lastSeen] = useState(() => getLastSeen());

  useEffect(() => {
    let alive = true;
    if (deputeUids.length) {
      setItems(null);
      getVotesSuivis(deputeUids, 4).then((r) => { if (alive) setItems(r); });
    } else {
      setItems([]);
    }
    return () => { alive = false; };
  }, [deputeUids.join(",")]);

  const isNew = (date: string | null) => !!lastSeen && !!date && date > lastSeen;

  // Nouveau (aucun élu suivi) : invite, pas un feed vide.
  if (!deputeUids.length) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "monDepute" })}
        style={{ marginHorizontal: SIDE, marginTop: 22, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderStrong, borderStyle: "dashed", paddingVertical: 14, paddingHorizontal: 15 }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Feather name="bell" size={19} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Suis ton premier député</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>
            Et retrouve ici ses derniers votes, dès ta prochaine visite
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.textFaint} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ marginHorizontal: SIDE, marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Depuis ta dernière visite</Text>
        <TouchableOpacity onPress={() => nav.push({ name: "suivis" })}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Tous tes suivis ›</Text>
        </TouchableOpacity>
      </View>

      {items === null ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 10 }} />
      ) : items.length === 0 ? (
        <Text style={[T.small, { color: C.textMuted }]}>
          Aucun vote nominatif récent pour tes élus suivis.
        </Text>
      ) : (
        <View style={{ gap: 9 }}>
          {items.map((v) => {
            const cat = v.categorie ? catUI(v.categorie) : null;
            return (
              <TouchableOpacity
                key={v.deputeUid + v.scrutinUid}
                activeOpacity={0.6}
                onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })}
                style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, ...shadowCard }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <Text style={[T.small, { fontFamily: F.bold, color: C.text, flex: 1 }]} numberOfLines={1}>
                    {v.nom}
                  </Text>
                  <Text style={[T.micro, { color: C.textFaint }]}>{formatDate(v.date)}</Text>
                  {isNew(v.date) && (
                    <View style={{ backgroundColor: C.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={[T.micro, { fontFamily: F.bold, color: C.surface }]}>Nouveau</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9 }}>
                  {cat && (
                    <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: cat.bg, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name={cat.icon as any} size={15} color={cat.fg} />
                    </View>
                  )}
                  <Text style={[T.small, { flex: 1, color: C.text }]} numberOfLines={2}>
                    {v.titre}
                  </Text>
                  <PositionPill position={v.position} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
