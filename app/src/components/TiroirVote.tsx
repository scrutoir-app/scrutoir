import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TouchableOpacity, Animated, Easing, Platform, ActivityIndicator, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL, shadowCard } from "../theme";
import { getScrutin, getTestProximite } from "../api";
import { useJe } from "../testProximite/jeProximite";
import { useEtatTest } from "../testProximite/useReponses";
import { poserReponse, retirerReponse } from "../testProximite/storage";
import { groupesPos, verdictDeduit } from "../testProximite/verdict";
import { statutPerso, type StatutPerso } from "../testProximite/questionsPerso";
import { encartTiroir, statutEncart, texteTiroir, titreTiroir } from "../testProximite/texteVote";
import { memoriserQuestionPerso } from "../testProximite/chargerPerso";
import type { Reponse } from "../testProximite/score";
import type { DetailScrutin } from "../types";
import type { Nav } from "../nav";
import { BoutonChoix } from "./BoutonChoix";
import { Button } from "./ui";
import { LegendeVerdict } from "./LegendeVerdict";
import { useReduceMotion } from "./HeroScrutins";

/**
 * TIROIR DE VOTE — corriger un vote « comme toi » sur place, depuis n'importe quel scrutin.
 * Monté UNE fois à la racine (App.tsx) : une carte, une liste ou la fiche l'ouvrent avec
 * `useTiroirVote().ouvrir(uid)`, sans changer d'écran. Il porte aussi la légende du verdict
 * (une seule instance pour toute l'appli).
 *
 * Choisir = enregistrer + fermer. Aucun écart de proximité n'est affiché (même règle que le
 * deck : pas d'ancrage, pas de jeu sur le score). Rien n'est envoyé : la réponse reste sur
 * l'appareil (opinion politique, RGPD art. 9), aucune mesure d'audience ici.
 */

const natif = Platform.OS !== "web";
const COURBE_TIROIR = Easing.bezier(0.32, 0.72, 0, 1);

interface ContexteTiroir {
  /** Ouvre le tiroir de vote sur ce scrutin. */
  ouvrir: (uid: string) => void;
  /** Ouvre la légende du verdict à la page donnée (0 = ce que tu as tranché). */
  ouvrirLegende: (page?: number) => void;
  /** N° des scrutins tranchés depuis le tiroir pendant cette session (ligne sous la pastille des cartes). */
  repondusSession: ReadonlySet<number>;
  nav: Nav | null;
}

const Ctx = createContext<ContexteTiroir>({ ouvrir: () => {}, ouvrirLegende: () => {}, repondusSession: new Set(), nav: null });

export function useTiroirVote(): ContexteTiroir {
  return useContext(Ctx);
}

const CHOIX: { id: Reponse; icon: React.ComponentProps<typeof Feather>["name"]; label: string; couleur: () => string; teinte: () => string }[] = [
  { id: "contre", icon: "x", label: "Contre", couleur: () => C.contre, teinte: () => C.rejeteBg },
  { id: "sans_avis", icon: "minus", label: "Sans avis", couleur: () => C.accent, teinte: () => C.accentSoft },
  { id: "pour", icon: "check", label: "Pour", couleur: () => C.pour, teinte: () => C.adopteBg },
];

export function TiroirVoteProvider({ nav, children }: { nav: Nav; children: React.ReactNode }) {
  const [cible, setCible] = useState<string | null>(null); // uid du scrutin ouvert
  const [legende, setLegende] = useState<number | null>(null); // page de la légende ouverte
  const [repondus, setRepondus] = useState<Set<number>>(() => new Set());

  const ouvrir = useCallback((uid: string) => setCible(uid), []);
  const ouvrirLegende = useCallback((page = 0) => setLegende(page), []);
  const noterReponse = useCallback((numero: number) => setRepondus((s) => (s.has(numero) ? s : new Set(s).add(numero))), []);

  const valeur = useMemo(() => ({ ouvrir, ouvrirLegende, repondusSession: repondus, nav }), [ouvrir, ouvrirLegende, repondus, nav]);

  return (
    <Ctx.Provider value={valeur}>
      {children}
      <Tiroir
        uid={cible}
        onClose={() => setCible(null)}
        onRepondu={noterReponse}
        onLegende={() => { setCible(null); setLegende(1); }}
      />
      <LegendeVerdict visible={legende !== null} pageInitiale={legende ?? 0} onClose={() => setLegende(null)} />
    </Ctx.Provider>
  );
}

function Tiroir({ uid, onClose, onRepondu, onLegende }: { uid: string | null; onClose: () => void; onRepondu: (numero: number) => void; onLegende: () => void }) {
  const reduce = useReduceMotion();
  const { height } = useWindowDimensions();
  const ctx = useJe();
  const etat = useEtatTest();
  // Le tiroir reste monté le temps de sa sortie : `affiche` garde le dernier uid ouvert.
  const [affiche, setAffiche] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailScrutin | null>(null);
  const [idsTest, setIdsTest] = useState<Set<number> | null>(null);
  const y = useRef(new Animated.Value(1)).current; // 1 = caché (sous l'écran), 0 = ouvert
  const voile = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (uid) {
      setAffiche(uid);
      if (reduce) { y.setValue(0); voile.setValue(1); return; }
      y.setValue(1);
      voile.setValue(0);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 340, easing: COURBE_TIROIR, useNativeDriver: natif }),
        Animated.timing(voile, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: natif }),
      ]).start();
    } else if (affiche) {
      if (reduce) { setAffiche(null); return; }
      Animated.parallel([
        Animated.timing(y, { toValue: 1, duration: 340, easing: COURBE_TIROIR, useNativeDriver: natif }),
        Animated.timing(voile, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: natif }),
      ]).start(({ finished }) => { if (finished) setAffiche(null); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Détail du scrutin (déjà en cache si la carte l'a affiché) + questions actuelles du test.
  useEffect(() => {
    if (!uid) return;
    let vivant = true;
    setDetail(null);
    getScrutin(uid).then((d) => vivant && setDetail(d)).catch(() => {});
    getTestProximite().then((qs) => vivant && setIdsTest(new Set(qs.map((q) => q.id)))).catch(() => vivant && setIdsTest(new Set()));
    return () => { vivant = false; };
  }, [uid]);

  if (!affiche) return null;

  const s = detail?.scrutin ?? null;
  const numero = s?.numero ?? null;
  const pret = !!detail && numero != null && idsTest !== null;
  const reponse: Reponse | undefined = numero != null ? etat?.reponses[numero] : undefined;
  const groupes = detail ? groupesPos(detail.groupes) : [];
  const deduit = verdictDeduit(ctx, groupes, s?.sort_code);
  const dansTest = numero != null && !!idsTest?.has(numero);
  const statut: StatutPerso | null = detail
    ? statutPerso({ titre: s!.titre, type_vote: s!.type_vote, dossier_titre: s!.dossier_titre, groupes: detail.groupes })
    : null;
  const encart = statutEncart(dansTest, statut);
  const horsCalcul = !!encart && encart !== "compte";
  const titre = titreTiroir(reponse);

  const choisir = (r: Reponse) => {
    if (numero == null) return;
    // Hors test : la question (positions des groupes, thème) est gardée pour le calcul.
    if (!dansTest) memoriserQuestionPerso(affiche).catch(() => {});
    poserReponse(numero, r, { questionTest: dansTest });
    onRepondu(numero);
    onClose();
  };
  const effacer = () => {
    if (numero == null) return;
    retirerReponse(numero);
    onClose();
  };

  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 70 }} pointerEvents={uid ? "auto" : "none"}>
      <Animated.View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity: voile }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={{ flex: 1, backgroundColor: C.scrim }}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        role="dialog"
        aria-label={titre}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: C.surface,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: S.s10,
          paddingHorizontal: S.s18,
          paddingBottom: S.s24,
          gap: S.s12,
          ...shadowCard,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }],
        }}
      >
        <View style={{ alignSelf: "center", width: 38, height: 5, borderRadius: RADIUS.pill, backgroundColor: C.borderStrong }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text accessibilityRole="header" style={[T.heading, { fontFamily: F.extra, color: C.text, flexShrink: 1 }]}>{titre}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={{ width: CONTROL.md, height: CONTROL.md, marginRight: -10, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name="x" size={ICON.base} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {!pret ? (
          <ActivityIndicator color={C.textMuted} style={{ marginVertical: S.s24 }} />
        ) : (
          <>
            <Text style={[T.body, { color: C.text, lineHeight: 22 }]}>{texteTiroir({ reponse, verdict: deduit, sortCode: s!.sort_code })}</Text>

            <View style={{ flexDirection: "row", gap: S.s10, marginTop: S.s6 }}>
              {CHOIX.map((c) => (
                <BoutonChoix
                  key={c.id}
                  icon={c.icon}
                  label={c.label}
                  couleur={c.couleur()}
                  teinte={c.teinte()}
                  etat={reponse === c.id ? "choisi" : reponse === undefined && deduit.penche === c.id ? "deduit" : "neutre"}
                  onPress={() => choisir(c.id)}
                />
              ))}
            </View>

            {reponse !== undefined && (
              <Button
                label="Effacer ma réponse, revenir à la déduction"
                variant="text"
                size="sm"
                iconLeft={<Feather name="rotate-ccw" size={ICON.sm} />}
                onPress={effacer}
                style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
              />
            )}

            <View style={{ flexDirection: "row", gap: S.s8, padding: S.s12, borderRadius: RADIUS.sm, backgroundColor: horsCalcul ? C.abstentionBg : C.surfaceSunken }}>
              <Feather name="info" size={ICON.sm} color={C.textMuted} style={{ marginTop: 2 }} />
              <Text style={[T.small, { flex: 1, color: C.text, lineHeight: 18 }]}>
                {encartTiroir(encart)}{" "}
                <Text onPress={onLegende} accessibilityRole="link" style={{ fontFamily: F.bold, color: C.accent, textDecorationLine: "underline" }}>
                  Comment on déduit
                </Text>
              </Text>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}
