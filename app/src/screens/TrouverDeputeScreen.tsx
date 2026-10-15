import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Animated, PanResponder, Pressable, useWindowDimensions, Platform, Linking } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, inputText, RADIUS, S, ICON, CONTROL, shadowCard, couleurGroupe } from "../theme";
import { Card, Button, Chip } from "../components/ui";
import { ProfilAvatar, CommeToiVerrou } from "../components/profil";
import { HemicycleLogo } from "../components/HemicycleLogo";
import { Segments } from "../components/texteUI";
import { OnboardingAffinite } from "../components/OnboardingAffinite";
import { catUI } from "../categoryUI";
import { AN_DEPUTES_URL, SEUIL_FIABILITE } from "../config";
import { rechercheCommunes, getCirconscription, communeParCoord, getProfil, getDissidences, getVotesBruts } from "../api";
import type { Commune } from "../api";
import type { DeputeResume } from "../types";
import type { Nav } from "../nav";
import { useJe, useProximiteDepute } from "../testProximite/jeProximite";
import { estSitue } from "../testProximite/storage";
import { baseAccordVotant, pctPondereDiffere } from "../testProximite/baseAccord";
import { useClassementAffinite, type DeputeAffinite } from "../testProximite/classementDeputes";
import { lotDuJour, resteAVoir, reinitialiserSelection, tailleLotDuJour } from "../testProximite/selectionDuJour";
import { isFollowed, toggleFollowSansUid, getFollows } from "../follows";
import { useFollow } from "../hooks/useFollows";
import { passer, annulerPasser, getPassed, viderPasses } from "../passedDeputes";
import { useReduceMotion } from "../components/HeroScrutins";
import {
  PHRASE_ENVOI, PHRASE_ENVOI_SAISIE, libelleCirco, phraseCircos, baseAffinite, pctAffinite, libelleVoteCompare,
} from "../trouverDepute";

/**
 * « Trouver ton député » (maquettes validées le 15/10/2026) : par code postal (ton siège dans
 * l'hémicycle, carte au moule de la fiche député) ou par affinité (carte sobre au swipe : % comme
 * toi en avant, base en petit, détail derrière un lien, Passer et Suivre au même poids).
 *
 * Vie privée : la saisie ou la position arrondie part à l'API Géo (cf. `trouverDepute.ts`, la phrase
 * affichée le dit) ; rien d'autre ne sort. En affinité, tout est calculé sur l'appareil et suivre un
 * député se mesure SANS son uid (`toggleFollowSansUid(…, "affinite")`, RGPD art. 9).
 */

type Mode = "cp" | "affinite";

const OB_KEY = "scrutoir.affinite.onboarding.seen";
const obVu = (): boolean => {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(OB_KEY) === "1"; } catch { return false; }
};
const marquerObVu = () => { try { if (typeof localStorage !== "undefined") localStorage.setItem(OB_KEY, "1"); } catch { /* mémoire */ } };

type Etat = { mode: Mode; commune?: Commune; circo?: number };

export function TrouverDeputeScreen({ nav, mode: modeRoute, commune, circo }: { nav: Nav; mode?: Mode; commune?: Commune; circo?: number }) {
  const [mode, setMode] = useState<Mode>(modeRoute ?? "cp");
  const [help, setHelp] = useState(false);
  // « Situé » = au moins une réponse pour/contre au test (lecture synchrone).
  const [situe] = useState(estSitue);

  // App.tsx ne rend que l'écran du sommet : en ouvrant une fiche, cet écran est démonté. On range
  // donc mode, commune et circonscription dans la route juste avant de partir (pas à chaque geste :
  // un `replace` renverrait la mesure d'écran), et on les relit au retour.
  const etat = useRef<Etat>({ mode: modeRoute ?? "cp", commune, circo });
  const noter = (maj: Partial<Etat>) => { etat.current = { ...etat.current, ...maj }; };
  const navGarde: Nav = useMemo(() => ({
    ...nav,
    push: (r) => { nav.replace({ name: "monDepute", ...etat.current }); nav.push(r); },
  }), [nav]);

  // Overlay pédagogique au PREMIER passage en affinité (seulement s'il y a un deck à expliquer).
  const choisirMode = (m: Mode) => {
    setMode(m);
    noter({ mode: m });
    if (m === "affinite" && situe && !obVu()) { setHelp(true); marquerObVu(); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s12 }}>
        <Segments<Mode>
          plein
          label="Façon de chercher"
          items={[{ key: "cp", label: "Par code postal" }, { key: "affinite", label: "Par affinité" }]}
          actif={mode}
          onChange={choisirMode}
        />
      </View>

      {mode === "cp"
        ? <ModeCodePostal nav={navGarde} situe={situe} communeInit={commune} circoInit={circo} onEtat={noter} />
        : <ModeAffinite nav={navGarde} situe={situe} onAide={() => setHelp(true)} />}

      <OnboardingAffinite visible={help} onClose={() => setHelp(false)} />
    </View>
  );
}

// ======================= MODE CODE POSTAL =======================
function ModeCodePostal({ nav, situe, communeInit, circoInit, onEtat }: { nav: Nav; situe: boolean; communeInit?: Commune; circoInit?: number; onEtat: (e: { commune?: Commune; circo?: number }) => void }) {
  const [q, setQ] = useState("");
  const [qFocus, setQFocus] = useState(false);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [cherche, setCherche] = useState(false);
  const [localisation, setLocalisation] = useState(false);
  const [erreurLoc, setErreurLoc] = useState<string | null>(null);
  const [contexte, setContexte] = useState<{ commune: string; dept: string; num: string } | null>(null);
  const [elus, setElus] = useState<DeputeResume[] | null>(null);
  const [sel, setSel] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requete = useRef(0); // numéro de la dernière saisie envoyée : une réponse plus ancienne est ignorée
  const secours = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoDispo = typeof navigator !== "undefined" && !!navigator.geolocation;
  const saisie = q.trim().length >= 2;

  // Recherche commune / code postal (API Géo officielle), débouncée.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const n = ++requete.current;
    if (!saisie) { setCommunes([]); setCherche(false); return; }
    setCherche(true);
    timer.current = setTimeout(async () => {
      let r: Commune[] = [];
      try { r = await rechercheCommunes(q); } catch { r = []; }
      if (n !== requete.current) return; // une saisie plus récente est partie entre-temps
      setCommunes(r);
      setCherche(false);
    }, 280);
  }, [q]);

  // Retour d'une fiche : la commune et la circonscription choisies sont relues dans la route.
  useEffect(() => {
    if (communeInit) resoudre(communeInit, circoInit ?? 0);
    return () => { if (secours.current) clearTimeout(secours.current); };
  }, []);

  async function resoudre(c: Commune, circo = 0) {
    setContexte({ commune: c.nom, dept: c.codeDepartement, num: c.codeDepartement });
    setQ(""); setCommunes([]); setElus(null); setSel(0); setErreurLoc(null);
    onEtat({ commune: c, circo });
    try {
      const list = await getCirconscription(c.codeDepartement);
      setElus(list);
      setSel(Math.min(circo, Math.max(0, list.length - 1)));
      setContexte((ctx) => (ctx ? { ...ctx, dept: list[0]?.departement ?? ctx.dept } : ctx));
    } catch { setElus([]); }
  }

  const finLocalisation = () => {
    if (secours.current) clearTimeout(secours.current);
    secours.current = null;
    setLocalisation(false);
  };

  function meLocaliser() {
    if (!geoDispo) return;
    setLocalisation(true);
    setErreurLoc(null);
    // Secours : fermer la demande d'autorisation sans répondre n'appelle aucun des deux rappels
    // (Firefox) et le `timeout` ne court pas pendant la demande.
    if (secours.current) clearTimeout(secours.current);
    secours.current = setTimeout(() => {
      finLocalisation();
      setErreurLoc("Position introuvable. Entre ton code postal.");
    }, 15000);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (secours.current) clearTimeout(secours.current);
        const c = await communeParCoord(pos.coords.latitude, pos.coords.longitude);
        finLocalisation();
        if (c) resoudre(c);
        else setErreurLoc("Aucune commune trouvée à cet endroit. Entre ton code postal.");
      },
      (err) => {
        finLocalisation();
        setErreurLoc(err?.code === 1 ? "Localisation refusée. Entre ton code postal." : "Position introuvable. Entre ton code postal.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const choisirCirco = (i: number) => { setSel(i); onEtat({ circo: i }); };
  const changer = () => { setContexte(null); setElus(null); onEtat({ commune: undefined, circo: undefined }); };
  const court = (elus?.length ?? 0) > 3;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: S.s16, paddingTop: S.s14, paddingBottom: S.s40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {!contexte ? (
        <>
          {/* Champ pleine largeur : « Me localiser » passe dessous (il tronquait le placeholder). */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.s10, height: 52, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 13, borderWidth: 1, borderColor: qFocus ? C.accent : C.borderStrong }}>
            <Feather name="map-pin" size={ICON.base} color={C.textFaint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onFocus={() => setQFocus(true)}
              onBlur={() => setQFocus(false)}
              placeholder="Code postal ou commune"
              placeholderTextColor={C.textFaint}
              inputMode="text"
              accessibilityLabel="Code postal ou commune"
              style={[inputText, { flex: 1, minWidth: 0, fontFamily: F.medium, color: C.text, outlineStyle: "none" }] as any}
              autoCorrect={false}
            />
            {cherche && <ActivityIndicator size="small" color={C.textFaint} />}
          </View>

          {geoDispo && (
            <TouchableOpacity
              onPress={meLocaliser}
              disabled={localisation}
              accessibilityRole="button"
              accessibilityLabel="Me localiser"
              style={{ marginTop: S.s8, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: CONTROL.md, paddingHorizontal: S.s14, borderRadius: RADIUS.pill, backgroundColor: C.surfaceAlt }}
            >
              {localisation ? <ActivityIndicator size="small" color={C.text} /> : <Feather name="crosshair" size={ICON.md} color={C.text} />}
              <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Me localiser</Text>
            </TouchableOpacity>
          )}
          {/* Ce qui part, et à qui : lu dans le code (`trouverDepute.ts`), pas écrit de mémoire. */}
          <Text style={[T.micro, { color: C.textFaint, marginTop: S.s6, paddingHorizontal: 2 }]}>
            {geoDispo ? PHRASE_ENVOI : PHRASE_ENVOI_SAISIE}
          </Text>
          {!!erreurLoc && (
            <Text accessibilityLiveRegion="polite" style={[T.small, { fontFamily: F.semibold, color: C.rejeteFg, marginTop: S.s8, paddingHorizontal: 2 }]}>{erreurLoc}</Text>
          )}

          {saisie ? (
            <>
              {communes.length > 0 && (
                <View style={{ marginTop: S.s14, gap: 7 }}>
                  {communes.map((c) => (
                    <Card key={c.code} onPress={() => resoudre(c)} padding={12} accessibilityRole="button" accessibilityLabel={`${c.nom}, département ${c.codeDepartement}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
              {!cherche && communes.length === 0 && (
                <Text style={[T.small, { color: C.textMuted, marginTop: S.s16, textAlign: "center" }]}>
                  Aucune commune trouvée. Essaie le code postal complet à 5 chiffres.
                </Text>
              )}
            </>
          ) : (
            // État vide : l'hémicycle du logo, le siège blanc de la marque est « ton siège ».
            <View style={{ marginTop: 44, alignItems: "center" }}>
              <HemicycleLogo groupes={[]} couleur={() => null} size={240} focal={C.accent} siegeBlanc label="Hémicycle du logo Scrutoir, le siège blanc représente le tien" />
              <Text accessibilityRole="header" style={[T.heading, { color: C.text, marginTop: S.s18, textAlign: "center" }]}>577 circonscriptions, un siège chacune</Text>
              <Text style={[T.body, { color: C.textMuted, marginTop: S.s6, marginHorizontal: S.s12, textAlign: "center" }]}>
                Entre ton code postal pour trouver le tien. Ton député te représente, qu'il vote comme toi ou non.
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Commune résolue + « Changer » */}
          <Card padding={0} style={{ flexDirection: "row", alignItems: "center", gap: S.s10, minHeight: 52, paddingLeft: 13, paddingRight: S.s6 }}>
            <Feather name="map-pin" size={ICON.base} color={C.accent} />
            <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={2}>
              {contexte.commune}, {contexte.dept} ({contexte.num})
            </Text>
            <Button label="Changer" variant="text" size="sm" onPress={changer} accessibilityLabel="Changer de commune" />
          </Card>

          {elus == null ? (
            <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />
          ) : elus.length === 0 ? (
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>Aucun député trouvé pour ce département.</Text>
          ) : (
            <>
              {/* Plusieurs circonscriptions : on ne sait pas laquelle (l'API Géo ne la donne pas), on le dit. */}
              {elus.length > 1 && (
                <>
                  <Text style={[T.small, { color: C.textMuted, marginTop: S.s14, marginBottom: S.s6, paddingHorizontal: 2 }]}>{phraseCircos(elus.length)}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.s8 }}>
                    {elus.map((e, i) => {
                      const on = i === sel;
                      return (
                        <TouchableOpacity
                          key={e.uid}
                          onPress={() => choisirCirco(i)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          aria-pressed={on}
                          accessibilityLabel={libelleCirco(e.circo ?? "")}
                          style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: S.s16, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: on ? C.accent : C.borderStrong, backgroundColor: on ? C.accent : C.surface }}
                        >
                          <Text style={[T.small, { fontFamily: F.bold, color: on ? C.onAccent : C.text }]}>{libelleCirco(e.circo ?? "", court)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <Text accessibilityRole="header" style={[T.heading, { color: C.text, marginTop: S.s20, marginBottom: S.s10, paddingHorizontal: 2 }]}>Ton député</Text>
              <CarteDeputeLocal depute={elus[sel]} situe={situe} nav={nav} />

              {elus.length > 1 && (
                <TouchableOpacity onPress={() => Linking.openURL(AN_DEPUTES_URL)} accessibilityRole="link" style={{ minHeight: CONTROL.md, justifyContent: "center", marginTop: S.s8, paddingHorizontal: 2 }}>
                  <Text style={[T.small, { color: C.textMuted }]}>
                    Pas sûr de ta circonscription ? <Text style={{ fontFamily: F.bold, color: C.accent }}>Le site de l'Assemblée nationale aide à la retrouver</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Une tuile chiffrée de la carte (fond `bg` posé sur la carte) : % en avant, base en petit. */
function Tuile({ valeur, label, contexte }: { valeur: string; label: string; contexte: string | null }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: RADIUS.md, paddingHorizontal: S.s12, paddingVertical: S.s10 }}>
      <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text }]}>{valeur}</Text>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.text, marginTop: 2 }]}>{label}</Text>
      {!!contexte && <Text style={[T.micro, { color: C.textFaint, marginTop: 3 }]}>{contexte}</Text>}
    </View>
  );
}

/** Barre d'accord (part « comme toi » en vert, le reste en rouge). */
function BarreAccord({ pct, largeur }: { pct: number; largeur?: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ flexDirection: "row", width: largeur ?? "100%", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken }}>
      <View style={{ width: `${p}%`, backgroundColor: C.pour }} />
      <View style={{ width: `${100 - p}%`, backgroundColor: C.contre }} />
    </View>
  );
}

/** Carte du député local, au moule de la fiche député (lot 2) : identité, deux chiffres, comme toi, actions. */
function CarteDeputeLocal({ depute, situe, nav }: { depute: DeputeResume; situe: boolean; nav: Nav }) {
  const [suivi, toggle] = useFollow(depute.uid);
  const prox = useProximiteDepute(depute.uid); // % du moteur, calculé sur l'appareil
  const je = useJe();
  const [chiffres, setChiffres] = useState<{ part: number | null; rang: number | null; loyaute: number | null; ecarts: number | null } | null>(null);
  const [votes, setVotes] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let vivant = true;
    setChiffres(null); setVotes(null);
    Promise.all([getProfil(depute.uid, "all"), getDissidences(depute.uid).catch(() => null)])
      .then(([p, diss]) => vivant && setChiffres({ part: p.participation_pct, rang: p.participation_rang_pct ?? null, loyaute: p.loyaute_globale_pct, ecarts: diss ? diss.length : null }))
      .catch(() => vivant && setChiffres({ part: null, rang: null, loyaute: null, ecarts: null }));
    if (situe) getVotesBruts(depute.uid).then((v) => vivant && setVotes(v)).catch(() => vivant && setVotes({}));
    return () => { vivant = false; };
  }, [depute.uid, situe]);

  const base = situe && je && votes ? baseAccordVotant(je.questions, je.reponses, votes) : null;
  // « Trop peu » se lit sur la base ; tant que le % du moteur n'est pas là, c'est un calcul en cours.
  const tropPeu = !!base && base.comparable < SEUIL_FIABILITE;
  const enCalcul = base == null || (!tropPeu && base.comparable > 0 && prox == null);
  const pct = prox && base ? pctAffinite(prox.pct, base.comparable) : null;
  const circo = depute.circo ? `${depute.departement}, ${libelleCirco(depute.circo, true)}` : depute.departement;
  const ecarts = chiffres?.ecarts;

  return (
    <Card radius={RADIUS.xl} padding={S.s16}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <ProfilAvatar uri={depute.photo_url} size={54} ring={couleurGroupe(depute.couleur)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.heading, { fontFamily: F.extra, color: C.text }]} numberOfLines={2}>{depute.nom_complet}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8, marginTop: 5, flexWrap: "wrap", rowGap: 5 }}>
            <Chip label={depute.abrev ?? depute.groupe ?? "—"} bg={C.surfaceAlt} fg={C.text} ph={9} pv={3} textStyle={{ fontFamily: F.bold }} icon={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleurGroupe(depute.couleur) }} />} />
            {!!circo && <Text style={[T.small, { color: C.textMuted }]}>{circo}</Text>}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: S.s8, marginTop: S.s14 }}>
        <Tuile
          valeur={chiffres?.part != null ? `${chiffres.part} %` : "—"}
          label="des scrutins publics"
          contexte={chiffres?.rang != null ? `Plus assidu·e que ${chiffres.rang} % des députés` : null}
        />
        <Tuile
          valeur={chiffres?.loyaute != null ? `${chiffres.loyaute} %` : "—"}
          label="avec son groupe"
          contexte={ecarts == null ? null : ecarts ? `${ecarts} vote${ecarts > 1 ? "s" : ""} à l'écart du groupe` : "Aucun vote à l'écart du groupe"}
        />
      </View>

      <View style={{ marginTop: S.s8 }}>
        {situe ? (
          <View style={{ backgroundColor: C.bg, borderRadius: RADIUS.md, paddingHorizontal: S.s12, paddingVertical: S.s10 }}>
            {enCalcul || base == null ? (
              <Text style={[T.small, { color: C.textMuted }]}>Calcul de ton accord…</Text>
            ) : base.comparable === 0 ? (
              <Text style={[T.small, { color: C.textMuted }]}>Aucun des scrutins que tu as tranchés n'a été voté par ce député.</Text>
            ) : (
              <>
                {pct != null && (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: S.s6 }}>
                    <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text }]}>{pct} %</Text>
                    <Text style={[T.small, { fontFamily: F.semibold, color: C.text }]}>comme toi</Text>
                  </View>
                )}
                <Text style={[T.micro, tnum, { color: C.textFaint, marginTop: pct != null ? 3 : 0 }]}>
                  {baseAffinite(base.accord, base.comparable)}{pct == null ? " : trop peu pour un pourcentage" : ""}
                </Text>
              </>
            )}
          </View>
        ) : (
          <CommeToiVerrou phrase="Situe-toi pour le savoir" onPress={() => nav.push({ name: "testIntro" })} />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: S.s10, marginTop: S.s12 }}>
        <Button
          label={suivi ? "Suivi" : "Suivre"}
          variant="primary"
          style={{ flex: 1 }}
          onPress={toggle}
          accessibilityLabel={suivi ? `Ne plus suivre ${depute.nom_complet}` : `Suivre ${depute.nom_complet}`}
          iconLeft={<Feather name={suivi ? "check" : "bell"} size={ICON.sm} />}
        />
        <Button
          label="Voir sa fiche"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => nav.push({ name: "depute", uid: depute.uid })}
          accessibilityLabel={`Ouvrir la fiche de ${depute.nom_complet}`}
        />
      </View>
    </Card>
  );
}

// ======================= MODE AFFINITÉ (deck au swipe) =======================
function ModeAffinite({ nav, situe, onAide }: { nav: Nav; situe: boolean; onAide: () => void }) {
  const je = useJe();
  const classement = useClassementAffinite(je);

  // Pas encore situé → renvoi au test (même entrée que partout).
  if (!situe) return <AffiniteNonSitue nav={nav} />;
  if (classement === null) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  }
  return <Deck classement={classement} nav={nav} onAide={onAide} />;
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
        Balaie quelques scrutins, pour ou contre. On te propose ensuite chaque jour une poignée de
        députés tirés au sort, avec vos votes en commun, à suivre ou à passer. Ton avis reste sur ton téléphone.
      </Text>
      <Button label="Faire le test" variant="primary" size="md" onPress={() => nav.push({ name: "testIntro" })} iconLeft={<Feather name="compass" size={ICON.md} />} style={{ marginTop: S.s20 }} />
    </View>
  );
}

/** Deck au swipe des députés du lot du jour. Animated + PanResponder (aucune dépendance). */
function Deck({ classement, nav, onAide }: { classement: DeputeAffinite[]; nav: Nav; onAide: () => void }) {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();

  // Un LOT QUOTIDIEN, tiré au hasard (cf. `selectionDuJour.ts`) : jamais les 577 d'un coup, et
  // jamais rangés du plus proche au moins proche. Le vivier retire les déjà-suivis et les
  // déjà-passés ; le lot est figé pour la journée (rechargement compris) et ne se réordonne
  // pas sous les doigts. Suivre depuis le deck garantit un FOLLOW (jamais un toggle inverse).
  const [tour, setTour] = useState(0);
  const { liste, epuise, total } = useMemo(() => {
    const suivis = new Set(getFollows());
    const passes = new Set(getPassed());
    const vivier = classement.filter((d) => !suivis.has(d.resume.uid) && !passes.has(d.resume.uid));
    const lot = lotDuJour(vivier); // marque le lot comme « vu » → jamais reproposé demain
    // Taille du lot tel que tiré : au retour d'une fiche, la liste rejouée ne garde que le reste.
    return { liste: lot, epuise: resteAVoir(vivier) === 0, total: Math.max(tailleLotDuJour(), lot.length) };
  }, [classement, tour]);
  const dejaVus = total - liste.length;

  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState<{ uid: string; action: "suivi" | "passe" }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeputeAffinite | null>(null);

  // « Repartir de zéro » (vivier épuisé) : on oublie les vus + les passés, et on retire un lot.
  const recommencer = () => {
    reinitialiserSelection();
    viderPasses();
    setIdx(0);
    setHistory([]);
    setTour((t) => t + 1);
  };

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

  // Suivre / annuler depuis le deck : mesuré SANS l'uid (on suit après avoir vu « N % comme toi »).
  const enregistrer = (action: "suivi" | "passe") => {
    const d = liste[idx];
    if (!d) return;
    if (action === "suivi") { if (!isFollowed(d.resume.uid)) toggleFollowSansUid(d.resume.uid, "affinite"); flash(`Tu suis ${d.resume.nom_complet}`); }
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
    if (last.action === "suivi") { if (isFollowed(last.uid)) toggleFollowSansUid(last.uid, "affinite"); } else annulerPasser(last.uid);
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
    <View style={{ flex: 1, paddingHorizontal: S.s16 }}>
      {/* Aide (geste, lot du jour tiré au hasard) à gauche, progression à droite. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S.s6, minHeight: CONTROL.md }}>
        <TouchableOpacity onPress={onAide} accessibilityRole="button" accessibilityLabel="Comment marche la sélection par affinité" style={{ minHeight: CONTROL.md, justifyContent: "center", paddingRight: S.s8 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Comment ça marche</Text>
        </TouchableOpacity>
        {!fini && <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textFaint }]}>{dejaVus + idx + 1} / {total}</Text>}
      </View>

      {/* Zone du deck */}
      <View style={{ flex: 1, marginTop: S.s4 }}>
        {fini ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: S.s24 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.loyalHautBg, alignItems: "center", justifyContent: "center" }}>
              <Feather name={epuise ? "flag" : "check"} size={30} color={C.pour} />
            </View>
            <Text style={[T.heading, { color: C.text, marginTop: S.s16, textAlign: "center" }]}>
              {epuise ? "Tu as vu tout le monde" : total > 1 ? `Tu as vu les ${total} députés du jour` : "Tu as vu le député du jour"}
            </Text>
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s10, textAlign: "center", lineHeight: 20, maxWidth: 300 }]}>
              {epuise
                ? "Plus de député à te proposer. Retrouve ceux que tu suis dans tes suivis, avec leurs votes au fil de l'eau."
                : "Retrouve ceux que tu suis dans tes suivis, avec leurs votes au fil de l'eau."}
            </Text>
            <Button label="Voir mes suivis" variant="primary" size="md" onPress={() => nav.reset({ name: "suivis", source: "deputes" })} style={{ marginTop: S.s20 }} />
            {epuise && (
              <Button label="Repartir de zéro" variant="outline" size="sm" onPress={recommencer} style={{ marginTop: S.s10 }} iconLeft={<Feather name="rotate-ccw" size={ICON.sm} />} />
            )}
          </View>
        ) : (
          <>
            {liste[idx + 1] && <CarteAffinite depute={liste[idx + 1]} dessous />}
            <Animated.View
              key={liste[idx].resume.uid}
              {...responder.panHandlers}
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] as any, ...(Platform.OS === "web" ? ({ cursor: "grab", touchAction: "none", userSelect: "none" } as any) : {}) }}
            >
              <CarteAffinite depute={liste[idx]} opSuivi={opSuivi} opPasse={opPasse} onDetail={() => setDetail(liste[idx])} />
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

      {/* Annuler · Passer · Suivre : mêmes actions que le geste. Passer et Suivre au même poids. */}
      {!fini && (
        <View style={{ flexDirection: "row", gap: S.s10, paddingVertical: S.s12 }}>
          <TouchableOpacity onPress={annuler} disabled={!history.length} accessibilityRole="button" accessibilityLabel="Annuler le dernier" accessibilityState={{ disabled: !history.length }} style={{ width: 52, height: 56, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", opacity: history.length ? 1 : 0.5 }}>
            <Feather name="rotate-ccw" size={ICON.base} color={C.textMuted} />
          </TouchableOpacity>
          <BoutonDeck icon="x" label="Passer" a11y={`Passer ${liste[idx].resume.nom_complet}`} onPress={() => decider("passe")} />
          <BoutonDeck icon="bell" label="Suivre" a11y={`Suivre ${liste[idx].resume.nom_complet}`} onPress={() => decider("suivi")} />
        </View>
      )}

      {detail && <DetailAffinite depute={detail} onClose={() => setDetail(null)} onFiche={() => { const uid = detail.resume.uid; setDetail(null); nav.push({ name: "depute", uid, depuis: "affinite" }); }} />}
    </View>
  );
}

/** Passer / Suivre : même taille, même filet, même encre (aucun des deux n'est poussé). */
function BoutonDeck({ icon, label, a11y, onPress }: { icon: "x" | "bell"; label: string; a11y: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ flex: 1, height: 56, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.borderStrong, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.s8 }}
    >
      <Feather name={icon} size={ICON.lg} color={C.accent} />
      <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Carte sobre du deck : photo, nom, groupe ; « N % comme toi » en avant, la base en petit ; détail derrière un lien. */
function CarteAffinite({ depute, dessous, opSuivi, opPasse, onDetail }: { depute: DeputeAffinite; dessous?: boolean; opSuivi?: Animated.AnimatedInterpolation<string | number>; opPasse?: Animated.AnimatedInterpolation<string | number>; onDetail?: () => void }) {
  const d = depute.resume;
  const n = depute.score.comparable;
  const pct = pctAffinite(depute.score.pct, n);
  const base = baseAffinite(depute.accord, n);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: C.border, paddingTop: S.s28, paddingHorizontal: 22, paddingBottom: S.s18, alignItems: "center", ...shadowCard, ...(dessous ? { transform: [{ scale: 0.955 }, { translateY: 14 }], opacity: 0.55 } : null) }}>
      {/* Tampons « Suivre » / « Passer » (opacité pilotée par le geste) */}
      {!dessous && (
        <>
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 22, left: 20, opacity: opPasse ?? 0, borderWidth: 3, borderColor: C.textFaint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, transform: [{ rotate: "-12deg" }], zIndex: 3 }}>
            <Text style={[T.title, { color: C.textFaint }]}>Passer</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 22, right: 20, opacity: opSuivi ?? 0, borderWidth: 3, borderColor: C.pour, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, transform: [{ rotate: "12deg" }], zIndex: 3 }}>
            <Text style={[T.title, { color: C.pour }]}>Suivre</Text>
          </Animated.View>
        </>
      )}

      <View testID="affinite-photo">
        <ProfilAvatar uri={d.photo_url} size={100} ring={couleurGroupe(d.couleur)} />
      </View>
      <Text testID="affinite-nom" style={[T.title, { color: C.text, marginTop: S.s16, textAlign: "center" }]} numberOfLines={2}>{d.nom_complet}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8, marginTop: S.s6, flexWrap: "wrap", justifyContent: "center" }}>
        <View testID="affinite-groupe">
          <Chip label={d.abrev ?? d.groupe ?? "—"} bg={C.surfaceAlt} fg={C.text} ph={9} pv={3} textStyle={{ fontFamily: F.bold }} icon={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleurGroupe(d.couleur) }} />} />
        </View>
        {!!d.departement && <Text testID="affinite-lieu" style={[T.small, { color: C.textMuted }]}>{d.departement}</Text>}
      </View>

      <View style={{ marginTop: S.s32, alignItems: "center", alignSelf: "stretch" }} accessible accessibilityLabel={pct != null ? `${pct} % comme toi, ${base}` : `${base}, trop peu pour un pourcentage`}>
        {pct != null ? (
          <>
            <Text style={[T.title, tnum, { color: C.text }]}>{pct} % comme toi</Text>
            <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted, marginTop: 2 }]}>{base}</Text>
            <View style={{ marginTop: S.s12 }}><BarreAccord pct={pct} largeur={200} /></View>
          </>
        ) : (
          <>
            <Text style={[T.title, tnum, { color: C.text }]}>{base}</Text>
            <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: 2 }]}>Trop peu pour un pourcentage</Text>
          </>
        )}
      </View>

      <View style={{ flex: 1 }} />
      {!dessous && onDetail && (
        <TouchableOpacity onPress={onDetail} accessibilityRole="button" style={{ minHeight: CONTROL.md, justifyContent: "center", paddingHorizontal: S.s8 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir vos votes et sa fiche</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Détail derrière le lien : chaque scrutin comparé (« son vote », jamais « lui »), puis la fiche. */
function DetailAffinite({ depute, onClose, onFiche }: { depute: DeputeAffinite; onClose: () => void; onFiche: () => void }) {
  const d = depute.resume;
  const n = depute.score.comparable;
  const pct = pctAffinite(depute.score.pct, n);
  const pondere = pct != null && pctPondereDiffere(depute.score.pct, { comparable: n, accord: depute.accord, inverse: n - depute.accord });
  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 50, justifyContent: "flex-end" }}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le détail" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.scrim }} />
      <View accessibilityViewIsModal style={{ maxHeight: "88%", backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingTop: S.s16, ...shadowCard }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s10, paddingHorizontal: S.s16 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text testID="affinite-detail-nom" accessibilityRole="header" style={[T.heading, { color: C.text }]} numberOfLines={2}>Vos votes, avec {d.nom_complet}</Text>
            <Text style={[T.small, tnum, { color: C.textMuted, marginTop: 2 }]}>
              {pct != null ? `${pct} % comme toi · ` : ""}{baseAffinite(depute.accord, n)}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" style={{ width: CONTROL.md, height: CONTROL.md, alignItems: "center", justifyContent: "center" }}>
            <Feather name="x" size={ICON.lg} color={C.textMuted} />
          </TouchableOpacity>
        </View>
        {pondere && (
          <Text style={[T.micro, { color: C.textFaint, marginTop: S.s6, paddingHorizontal: S.s16 }]}>
            Le pourcentage fait la moyenne de tes thèmes, chacun selon l'importance que tu lui donnes.
          </Text>
        )}
        <ScrollView style={{ marginTop: S.s10 }} contentContainerStyle={{ paddingHorizontal: S.s16, paddingBottom: S.s8 }}>
          {depute.compares.map((v, i) => {
            const ui = catUI(v.theme);
            const pareil = v.toi === v.sonVote;
            return (
              <View key={i} style={{ flexDirection: "row", gap: S.s10, paddingVertical: S.s10, ...(i ? { borderTopWidth: 1, borderTopColor: C.border } : null) }}>
                <MaterialCommunityIcons name={ui.icon as any} size={ICON.base} color={ui.fg} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start", gap: S.s6 }}>
                  <Text style={[T.small, { fontFamily: F.semibold, color: C.text }]}>{v.texte}</Text>
                  <Chip label={libelleVoteCompare(v.toi, v.sonVote)} bg={pareil ? C.adopteBg : C.rejeteBg} fg={pareil ? C.adopteFg : C.rejeteFg} ph={8} pv={3} textStyle={{ fontFamily: F.bold }} />
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ padding: S.s16, paddingTop: S.s8, borderTopWidth: 1, borderTopColor: C.border }}>
          <Button label="Voir sa fiche" variant="primary" fullWidth onPress={onFiche} accessibilityLabel={`Ouvrir la fiche de ${d.nom_complet}`} />
        </View>
      </View>
    </View>
  );
}
