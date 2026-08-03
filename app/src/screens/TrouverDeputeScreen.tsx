import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Animated, PanResponder, useWindowDimensions, Platform } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, inputText, RADIUS, S, ICON, shadowCard, couleurGroupe } from "../theme";
import { Card, Button, Chip } from "../components/ui";
import { ProfilAvatar, StatCol, SEUIL_COMME } from "../components/profil";
import { OnboardingAffinite } from "../components/OnboardingAffinite";
import { catUI } from "../categoryUI";
import { rechercheCommunes, getCirconscription, communeParCoord, getProfil } from "../api";
import type { Commune } from "../api";
import type { DeputeResume } from "../types";
import type { Nav } from "../nav";
import { useJe, useProximiteDepute } from "../testProximite/jeProximite";
import { chargerTest } from "../testProximite/storage";
import { useClassementAffinite, type DeputeAffinite } from "../testProximite/classementDeputes";
import { useFollow, isFollowed, toggleFollow, getFollows } from "../follows";
import { passer, annulerPasser, getPassed } from "../passedDeputes";
import { useReduceMotion } from "../components/HeroScrutins";

type Mode = "cp" | "affinite";

const OB_KEY = "scrutoir.affinite.onboarding.seen";
const obVu = (): boolean => {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(OB_KEY) === "1"; } catch { return false; }
};
const marquerObVu = () => { try { if (typeof localStorage !== "undefined") localStorage.setItem(OB_KEY, "1"); } catch { /* mémoire */ } };

export function TrouverDeputeScreen({ nav }: { nav: Nav }) {
  const [mode, setMode] = useState<Mode>("cp");
  const [help, setHelp] = useState(false);
  // « Situé » = un test est enregistré (lecture synchrone). Pilote le deck ET la visibilité du « ? ».
  const situe = useMemo(() => { const t = chargerTest(); return !!t && Object.keys(t.reponses ?? {}).length > 0; }, []);

  // Overlay pédagogique au PREMIER passage en affinité (seulement s'il y a un deck à expliquer).
  const passerEnAffinite = () => {
    setMode("affinite");
    if (situe && !obVu()) { setHelp(true); marquerObVu(); }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Bascule des deux voies + « ? » (affinité). Code postal en première position. */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s12, flexDirection: "row", alignItems: "center", gap: S.s8 }}>
        <View style={{ flex: 1, flexDirection: "row", gap: S.s8 }}>
          <ModeBtn icon="map-pin" label="Code postal" actif={mode === "cp"} onPress={() => setMode("cp")} />
          <ModeBtn icon="user" label="Par affinité" actif={mode === "affinite"} onPress={passerEnAffinite} />
        </View>
        {mode === "affinite" && situe && (
          <TouchableOpacity
            onPress={() => setHelp(true)}
            accessibilityRole="button"
            accessibilityLabel="Comment marche le deck d'affinité"
            style={{ width: 40, height: 40, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="help-circle" size={ICON.lg} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {mode === "cp" ? <ModeCodePostal nav={nav} /> : <ModeAffinite nav={nav} />}

      <OnboardingAffinite visible={help} onClose={() => setHelp(false)} />
    </View>
  );
}

/** Un bouton de la bascule des modes (aplat accent quand actif). */
function ModeBtn({ icon, label, actif, onPress }: { icon: any; label: string; actif: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={label}
      style={{
        flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.s6,
        borderRadius: RADIUS.md, borderWidth: 1,
        borderColor: actif ? C.accent : C.border,
        backgroundColor: actif ? C.accent : C.surface,
      }}
    >
      <Feather name={icon} size={ICON.sm} color={actif ? C.onAccent : C.textMuted} />
      <Text style={[T.small, { fontFamily: F.extra, color: actif ? C.onAccent : C.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ======================= MODE CODE POSTAL =======================
function ModeCodePostal({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const [qFocus, setQFocus] = useState(false);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [cherche, setCherche] = useState(false);
  const [localisation, setLocalisation] = useState(false);
  const [contexte, setContexte] = useState<{ commune: string; dept: string; num: string } | null>(null);
  const [elus, setElus] = useState<DeputeResume[] | null>(null);
  const [sel, setSel] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recherche commune / code postal (API Géo officielle), débouncée.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const s = q.trim();
    if (s.length < 2) { setCommunes([]); return; }
    setCherche(true);
    timer.current = setTimeout(async () => {
      try { setCommunes(await rechercheCommunes(s)); } catch { setCommunes([]); }
      finally { setCherche(false); }
    }, 280);
  }, [q]);

  async function resoudre(c: Commune) {
    setContexte({ commune: c.nom, dept: c.codeDepartement, num: c.codeDepartement });
    setQ(""); setCommunes([]); setElus(null); setSel(0);
    try {
      const list = await getCirconscription(c.codeDepartement);
      setElus(list);
      setContexte((ctx) => (ctx ? { ...ctx, dept: list[0]?.departement ?? ctx.dept } : ctx));
    } catch { setElus([]); }
  }

  function meLocaliser() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocalisation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = await communeParCoord(pos.coords.latitude, pos.coords.longitude);
        setLocalisation(false);
        if (c) resoudre(c);
      },
      () => setLocalisation(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const changer = () => { setContexte(null); setElus(null); };

  return (
    <ScrollView contentContainerStyle={{ padding: S.s16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {!contexte ? (
        <>
          {/* Champ code postal + Me localiser */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: 48, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingLeft: 14, paddingRight: 6, borderWidth: 1, borderColor: qFocus ? C.accent : C.borderStrong, ...shadowCard }}>
            <Feather name="map-pin" size={ICON.base} color={C.textFaint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onFocus={() => setQFocus(true)}
              onBlur={() => setQFocus(false)}
              placeholder="Ton code postal ou ta commune…"
              placeholderTextColor={C.textFaint}
              inputMode="text"
              accessibilityLabel="Code postal ou commune"
              style={[inputText, { flex: 1, color: C.text, outlineStyle: "none" }] as any}
              autoCorrect={false}
            />
            {cherche && <ActivityIndicator size="small" color={C.textFaint} />}
            <TouchableOpacity
              onPress={meLocaliser}
              disabled={localisation}
              accessibilityRole="button"
              accessibilityLabel="Me localiser"
              style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.sm, paddingHorizontal: 10, minHeight: 36 }}
            >
              {localisation ? <ActivityIndicator size="small" color={C.textMuted} /> : <Feather name="crosshair" size={ICON.sm} color={C.text} />}
              <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]}>Me localiser</Text>
            </TouchableOpacity>
          </View>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: S.s8, paddingHorizontal: 2 }]}>
            Entre ton code postal pour voir qui te représente à l'Assemblée. Recherche via l'API Géo officielle.
          </Text>

          {communes.length > 0 && (
            <View style={{ marginTop: S.s12, gap: 7 }}>
              {communes.map((c) => (
                <Card key={c.code} onPress={() => resoudre(c)} padding={12} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Feather name="map-pin" size={ICON.sm} color={C.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{c.nom}</Text>
                    <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>{c.codesPostaux?.[0] ?? ""} · dépt {c.codeDepartement}</Text>
                  </View>
                  <Feather name="chevron-right" size={ICON.base} color={C.textFaint} />
                </Card>
              ))}
            </View>
          )}
          {q.trim().length >= 2 && !cherche && communes.length === 0 && (
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s14, textAlign: "center" }]}>
              Aucune commune trouvée. Essaie le code postal complet à 5 chiffres.
            </Text>
          )}
        </>
      ) : (
        <>
          {/* Contexte résolu : commune · département + « changer » */}
          <TouchableOpacity onPress={changer} accessibilityRole="button" accessibilityLabel="Changer de commune" style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <MaterialCommunityIcons name="map-marker" size={ICON.base} color={C.pour} />
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{contexte.commune}</Text>
            <Text style={[T.small, { color: C.textMuted }]}>· {contexte.dept} ({contexte.num})</Text>
            <Feather name="chevron-down" size={ICON.sm} color={C.textMuted} />
          </TouchableOpacity>

          {elus == null ? (
            <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />
          ) : elus.length === 0 ? (
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>Aucun député trouvé pour ce département.</Text>
          ) : (
            <>
              {/* Sélecteur de circonscription (chips) si plusieurs */}
              {elus.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.s8, paddingVertical: S.s12 }}>
                  {elus.map((e, i) => (
                    <TouchableOpacity
                      key={e.uid}
                      onPress={() => setSel(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: i === sel }}
                      accessibilityLabel={`Circonscription ${e.circo}`}
                      style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: i === sel ? C.accent : C.border, backgroundColor: i === sel ? C.accent : C.surface }}
                    >
                      <Text style={[T.small, { fontFamily: F.bold, color: i === sel ? C.onAccent : C.textMuted }]}>{e.circo}ᵉ circ.</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.4, marginTop: elus.length > 1 ? 4 : S.s16, marginBottom: S.s10 }]}>Ton député</Text>
              <CarteDeputeLocal depute={elus[sel]} nav={nav} />

              <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: S.s16, lineHeight: 16 }]}>
                Un code postal peut couvrir plusieurs circonscriptions — choisis la tienne ci-dessus. Ton
                député local te représente, qu'il vote comme toi ou non.
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Carte du député local (style fiche : avatar+anneau, stats comme toi/présence/loyauté, actions). */
function CarteDeputeLocal({ depute, nav }: { depute: DeputeResume; nav: Nav }) {
  const [suivi, toggle] = useFollow(depute.uid);
  const prox = useProximiteDepute(depute.uid);
  const [profil, setProfil] = useState<{ participation_pct: number | null; loyaute_globale_pct: number | null } | null>(null);
  useEffect(() => {
    setProfil(null);
    getProfil(depute.uid, "all").then((p) => setProfil({ participation_pct: p.participation_pct, loyaute_globale_pct: p.loyaute_globale_pct })).catch(() => setProfil(null));
  }, [depute.uid]);

  const commeToi = prox ? `${Math.round(prox.pct * 100)}%` : "—";
  const commeCouleur = prox ? (prox.pct >= SEUIL_COMME ? C.pour : C.contre) : undefined;

  return (
    <Card bordered padding={16}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <ProfilAvatar uri={depute.photo_url} size={64} ring={couleurGroupe(depute.couleur)} />
        <View style={{ flex: 1 }}>
          <Text style={[T.heading, { color: C.text }]} numberOfLines={1}>{depute.nom_complet}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap", rowGap: 5 }}>
            <Chip label={depute.abrev ?? depute.groupe ?? "—"} bg={C.surfaceAlt} fg={C.text} ph={9} pv={3} icon={<View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleurGroupe(depute.couleur) }} />} />
            {depute.circo && <Text style={[T.small, { color: C.textMuted }]}>· {depute.departement}, {depute.circo}ᵉ circ.</Text>}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
        <View style={{ flex: 1 }}><StatCol n={commeToi} label="comme toi" color={commeCouleur} /></View>
        <View style={{ flex: 1 }}><StatCol n={profil?.participation_pct != null ? `${profil.participation_pct}%` : "—"} label="présence" /></View>
        <View style={{ flex: 1 }}><StatCol n={profil?.loyaute_globale_pct != null ? `${profil.loyaute_globale_pct}%` : "—"} label={"avec son\ngroupe"} /></View>
      </View>

      <View style={{ flexDirection: "row", gap: 9, marginTop: 14 }}>
        <Button
          label={suivi ? "Suivi" : "Suivre"}
          variant="primary"
          size="sm"
          style={{ flex: 1 }}
          onPress={toggle}
          accessibilityLabel={suivi ? `Ne plus suivre ${depute.nom_complet}` : `Suivre ${depute.nom_complet}`}
          iconLeft={<Feather name={suivi ? "check" : "bell"} size={ICON.sm} color={C.onAccent} />}
        />
        <Button
          label="Voir sa fiche"
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          onPress={() => nav.push({ name: "depute", uid: depute.uid })}
          accessibilityLabel={`Ouvrir la fiche de ${depute.nom_complet}`}
          iconRight={<Feather name="chevron-right" size={ICON.sm} color={C.accent} />}
        />
      </View>
    </Card>
  );
}

// ======================= MODE AFFINITÉ (deck au swipe) =======================
function ModeAffinite({ nav }: { nav: Nav }) {
  // « Situé » = un test est enregistré localement (lecture synchrone, ≠ chargement de useJe).
  const situe = useMemo(() => { const t = chargerTest(); return !!t && Object.keys(t.reponses ?? {}).length > 0; }, []);
  const je = useJe();
  const classement = useClassementAffinite(je);

  // Pas encore situé → renvoi au deck « te situer » (même entrée que partout).
  if (!situe) return <AffiniteNonSitue nav={nav} />;
  if (classement === null) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  }
  return <Deck classement={classement} nav={nav} />;
}

/** État « pas encore situé » : renvoie au test (même entrée que partout). */
function AffiniteNonSitue({ nav }: { nav: Nav }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: S.s24 }}>
      <View style={{ flexDirection: "row", gap: S.s8, marginBottom: S.s16 }}>
        {[{ ic: "x", col: C.textFaint }, { ic: "bell", col: C.pour }].map((c, i) => (
          <View key={i} style={{ width: 48, height: 62, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: c.col, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center", transform: [{ rotate: i === 0 ? "-10deg" : "10deg" }] }}>
            <Feather name={c.ic as any} size={ICON.lg} color={c.col} />
          </View>
        ))}
      </View>
      <Text style={[T.heading, { color: C.text, textAlign: "center" }]}>Situe-toi pour trouver qui vote comme toi</Text>
      <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s10, lineHeight: 20, maxWidth: 320 }]}>
        Balaie quelques scrutins, pour ou contre. On classe alors les députés du plus proche de toi
        au moins proche, à suivre ou à passer. Ton avis reste privé.
      </Text>
      <Button label="Faire le test · 2 min" variant="primary" size="md" onPress={() => nav.push({ name: "testIntro" })} iconLeft={<Feather name="compass" size={ICON.md} color={C.onAccent} />} style={{ marginTop: S.s20 }} />
    </View>
  );
}

/** Deck au swipe des députés classés par affinité. Animated + PanResponder (aucune dépendance). */
function Deck({ classement, nav }: { classement: DeputeAffinite[]; nav: Nav }) {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();

  // Liste figée à l'entrée : classement moins déjà-suivis et déjà-passés (ne se réordonne pas
  // sous les doigts). Suivre depuis le deck garantit un FOLLOW (jamais un toggle inverse).
  const liste = useMemo(() => {
    const suivis = new Set(getFollows());
    const passes = new Set(getPassed());
    return classement.filter((d) => !suivis.has(d.resume.uid) && !passes.has(d.resume.uid));
  }, [classement]);

  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState<{ uid: string; action: "suivi" | "passe" }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false);
  const seuil = Math.max(90, width * 0.24);
  const horsChamp = width * 1.4;

  const flash = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  const enregistrer = (action: "suivi" | "passe") => {
    const d = liste[idx];
    if (!d) return;
    if (action === "suivi") { if (!isFollowed(d.resume.uid)) toggleFollow(d.resume.uid); flash(`Tu suis ${d.resume.nom_complet}`); }
    else passer(d.resume.uid);
    setHistory((h) => [...h, { uid: d.resume.uid, action }]);
    pan.setValue({ x: 0, y: 0 });
    busy.current = false;
    setIdx((i) => i + 1);
  };

  const envol = (action: "suivi" | "passe", toX: number) => {
    if (reduce) return enregistrer(action);
    Animated.timing(pan, { toValue: { x: toX, y: -30 }, duration: 300, useNativeDriver: false }).start(() => enregistrer(action));
  };
  const decider = (action: "suivi" | "passe") => {
    if (busy.current || idx >= liste.length) return;
    busy.current = true;
    envol(action, action === "suivi" ? horsChamp : -horsChamp);
  };
  const annuler = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    if (last.action === "suivi") { if (isFollowed(last.uid)) toggleFollow(last.uid); } else annulerPasser(last.uid);
    setHistory((h) => h.slice(0, -1));
    pan.setValue({ x: 0, y: 0 });
    setIdx((i) => Math.max(0, i - 1));
  };

  const responder = useMemo(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > seuil) decider("suivi");
        else if (g.dx < -seuil) decider("passe");
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
    }),
  [idx, history, liste.length, reduce, seuil]);

  const fini = idx >= liste.length;
  const rotate = pan.x.interpolate({ inputRange: [-width, 0, width], outputRange: ["-14deg", "0deg", "14deg"] });
  const opSuivi = pan.x.interpolate({ inputRange: [0, seuil], outputRange: [0, 1], extrapolate: "clamp" });
  const opPasse = pan.x.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <View style={{ flex: 1 }}>
      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, textAlign: "center", marginTop: S.s10, paddingHorizontal: S.s16 }]}>
        Les députés qui votent le plus comme toi. À droite tu suis, à gauche tu passes.
      </Text>

      {/* Zone du deck */}
      <View style={{ flex: 1, marginHorizontal: S.s16, marginTop: S.s12, marginBottom: S.s4 }}>
        {!fini && (
          <Text style={[T.small, tnum, { position: "absolute", top: 0, right: 2, zIndex: 5, fontFamily: F.bold, color: C.textFaint }]}>
            {idx + 1} / {liste.length}
          </Text>
        )}

        {fini ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: S.s24 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.loyalHautBg, alignItems: "center", justifyContent: "center" }}>
              <Feather name="check" size={30} color={C.pour} />
            </View>
            <Text style={[T.heading, { color: C.text, marginTop: S.s16, textAlign: "center" }]}>Tu as vu les plus proches</Text>
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s10, textAlign: "center", lineHeight: 20, maxWidth: 300 }]}>
              Retrouve les députés que tu suis sur ton accueil, avec leurs votes au fil de l'eau.
            </Text>
            <Button label="Voir mes suivis" variant="primary" size="md" onPress={() => nav.reset({ name: "suivis", source: "deputes" })} style={{ marginTop: S.s20 }} />
          </View>
        ) : (
          <>
            {liste[idx + 1] && <CarteAffinite depute={liste[idx + 1]} dessous />}
            <Animated.View
              key={liste[idx].resume.uid}
              {...responder.panHandlers}
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] as any, ...(Platform.OS === "web" ? ({ cursor: "grab", touchAction: "none", userSelect: "none" } as any) : {}) }}
            >
              <CarteAffinite depute={liste[idx]} opSuivi={opSuivi} opPasse={opPasse} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Toast de confirmation (suivre) */}
      {toast && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 96, alignItems: "center", zIndex: 9 }} pointerEvents="none">
          <Chip label={`✓ ${toast}`} bg={C.accent} fg={C.onAccent} ph={15} pv={9} />
        </View>
      )}

      {/* Boutons (voie clavier / desktop) : Annuler · Passer · Suivre — mêmes actions que le swipe. */}
      {!fini && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.s16, paddingVertical: S.s12 }}>
          <TouchableOpacity onPress={annuler} disabled={!history.length} accessibilityRole="button" accessibilityLabel="Annuler le dernier" style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", opacity: history.length ? 1 : 0.4 }}>
            <Feather name="rotate-ccw" size={20} color={C.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => decider("passe")} accessibilityRole="button" accessibilityLabel={`Passer ${liste[idx].resume.nom_complet}`} style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", ...shadowCard }}>
            <Feather name="x" size={27} color={C.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => decider("suivi")} accessibilityRole="button" accessibilityLabel={`Suivre ${liste[idx].resume.nom_complet}`} style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: C.pour, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", ...shadowCard }}>
            <Feather name="bell" size={26} color={C.pour} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Une carte du deck : avatar+anneau, groupe, circo, % de votes en commun, votes partagés, présence. */
function CarteAffinite({ depute, dessous, opSuivi, opPasse }: { depute: DeputeAffinite; dessous?: boolean; opSuivi?: Animated.AnimatedInterpolation<string | number>; opPasse?: Animated.AnimatedInterpolation<string | number> }) {
  const d = depute.resume;
  const [presence, setPresence] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let vivant = true;
    setPresence(undefined);
    getProfil(d.uid, "all").then((p) => vivant && setPresence(p.participation_pct)).catch(() => vivant && setPresence(null));
    return () => { vivant = false; };
  }, [d.uid]);

  const pct = Math.round(depute.score.pct * 100);
  const circo = d.circo ? `${d.departement} · ${d.circo}ᵉ circ.` : d.departement ?? null;

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: C.border, padding: 20, ...shadowCard, ...(dessous ? { transform: [{ scale: 0.955 }, { translateY: 14 }], opacity: 0.55 } : null) }}>
      {/* Tampons SUIVRE / PASSER (opacité pilotée par le drag) */}
      {!dessous && (
        <>
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 22, left: 20, opacity: opPasse ?? 0, borderWidth: 3, borderColor: C.textFaint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, transform: [{ rotate: "-12deg" }], zIndex: 3 }}>
            <Text style={{ fontFamily: F.extra, color: C.textFaint, fontSize: 20, letterSpacing: 1 }}>PASSER</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 22, right: 20, opacity: opSuivi ?? 0, borderWidth: 3, borderColor: C.pour, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, transform: [{ rotate: "12deg" }], zIndex: 3 }}>
            <Text style={{ fontFamily: F.extra, color: C.pour, fontSize: 20, letterSpacing: 1 }}>SUIVRE</Text>
          </Animated.View>
        </>
      )}

      {/* En-tête identité */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ProfilAvatar uri={d.photo_url} size={72} ring={couleurGroupe(d.couleur)} />
        <View style={{ flex: 1 }}>
          <Text style={[T.title, { color: C.text }]} numberOfLines={2}>{d.nom_complet}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap", rowGap: 5 }}>
            <Chip label={d.abrev ?? d.groupe ?? "—"} bg={C.surfaceAlt} fg={C.text} ph={9} pv={3} icon={<View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleurGroupe(d.couleur) }} />} />
            {circo && <Text style={[T.small, { color: C.textMuted }]}>· {circo}</Text>}
          </View>
        </View>
      </View>

      {/* % de votes en commun */}
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Text style={[tnum, { fontFamily: F.extra, fontSize: 40, lineHeight: 44, color: C.pour }]}>{pct}<Text style={{ fontSize: 22, color: C.pour }}> %</Text></Text>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, marginTop: -2 }]}>de tes votes en commun</Text>
      </View>

      {/* Vous avez voté pareil */}
      {depute.communs.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }]}>Vous avez voté pareil</Text>
          {depute.communs.map((c, i) => {
            const ui = catUI(c.theme);
            const teinte = c.position === "pour" ? C.pour : C.contre;
            const bg = c.position === "pour" ? C.adopteBg : C.rejeteBg;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, ...(i === depute.communs.length - 1 ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }) }}>
                <MaterialCommunityIcons name={ui.icon as any} size={17} color={ui.fg} />
                <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: C.text, lineHeight: 18 }]} numberOfLines={2}>{c.these}</Text>
                <Chip label={`Vous deux : ${c.position === "pour" ? "Pour" : "Contre"}`} bg={bg} fg={teinte} ph={8} pv={3} />
              </View>
            );
          })}
        </View>
      )}

      {/* Pied : présence + rappel du geste */}
      <View style={{ marginTop: "auto", paddingTop: 12 }}>
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>
          {presence != null ? `Présence ${presence}%` : "Présence —"} · à droite tu suis, à gauche tu passes
        </Text>
      </View>
    </View>
  );
}
