// « Comment on compare » : la méthode, en feuille. iOS natif : Modal pageSheet. Web (PWA, cible
// v1) : feuille de l'app qui monte du bas, à fermer en la glissant vers le bas ou par « OK ».
// Les nombres viennent des données du programme (jamais écrits en dur ici).
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { C, F, T, tnum, RADIUS } from "../../theme";
import type { BaseScrutins } from "../../presidentielle/types";
import { dateLongue, nombre } from "../../presidentielle/libelles";
import { useReduceMotion } from "../HeroScrutins";
import { COURBE, Kicker, PastilleVerdict } from "./primitives";

export interface ChiffresMethode {
  mesures: number;
  horsChamp: number;
  confrontables: number;
}

function Etape({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Text style={[T.micro, { fontFamily: F.extra, color: C.accent }]}>{n}</Text>
      </View>
      <Text style={[T.body, tnum, { flex: 1, fontFamily: F.semibold, color: C.text, lineHeight: 22 }]}>{children}</Text>
    </View>
  );
}

function Verdict({ famille, titre, texte }: { famille: "c" | "t" | "n"; titre: string; texte: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <PastilleVerdict famille={famille} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{titre}</Text>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 19 }]}>{texte}</Text>
      </View>
    </View>
  );
}

const Para = ({ children, faible }: { children: React.ReactNode; faible?: boolean }) => (
  <Text style={[T.small, tnum, { fontFamily: F.semibold, color: faible ? C.textMuted : C.text, lineHeight: 19 }]}>{children}</Text>
);

function Carte({ children, cadre }: { children: React.ReactNode; cadre?: boolean }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 16, gap: 12, ...(cadre ? { borderWidth: 1.5, borderColor: C.text } : {}) }}>
      {children}
    </View>
  );
}

export function ContenuMethode({ chiffres, base }: { chiffres: ChiffresMethode | null; base: BaseScrutins | null }) {
  const n = (v: number | undefined, sinon: string) => (v != null ? nombre(v) : sinon);
  return (
    <View style={{ gap: 14 }}>
      <Carte>
        <Kicker>Quatre étapes, les mêmes pour chaque programme</Kicker>
        <Etape n={1}>On relève {chiffres ? `les ${n(chiffres.mesures, "")} mesures` : "toutes les mesures"} du programme, mot pour mot, dans le livre publié sur le site du parti.</Etape>
        <Etape n={2}>
          On écarte celles qu’aucun vote de l’Assemblée ne peut porter : intentions générales, mesures réglementaires ou locales.
          {chiffres ? ` ${n(chiffres.horsChamp, "")} mesures, chacune avec son motif.` : " Chacune garde son motif."}
        </Etape>
        <Etape n={3}>
          Pour {chiffres ? `les ${n(chiffres.confrontables, "")} autres` : "les autres"}, on cherche tous les scrutins publics de la législature qui portent la même mesure, ou son inverse, par une règle de recherche écrite et conservée.
        </Etape>
        <Etape n={4}>On lit la position majoritaire du groupe à chaque scrutin. Rien n’est pondéré, aucun scrutin n’est choisi à la main.</Etape>
      </Carte>

      <Carte>
        <Kicker>Ce qu’on en conclut</Kicker>
        <Verdict famille="c" titre="Cohérent" texte="Les votes du groupe vont dans le sens de la mesure." />
        <Verdict famille="t" titre="Tension" texte="Au moins un vote du groupe s’écarte de la mesure." />
        <Verdict famille="n" titre="Neutre" texte="Aucun verdict n’est donné, pour l’une de ces trois raisons :" />
        <View style={{ gap: 8, paddingLeft: 36 }}>
          <Para><Text style={{ fontFamily: F.extra }}>Sans scrutin public.</Text> Aucun scrutin de la législature ne porte la mesure. Un silence n’est pas un désaccord.</Para>
          <Para><Text style={{ fontFamily: F.extra }}>À juger.</Text> Le même sens se discute. On donne les faits, le verdict revient au lecteur.</Para>
          <Para><Text style={{ fontFamily: F.extra }}>Sans vote représentatif.</Text> Trois députés du groupe ou moins ont voté. Le vote est affiché, il ne vaut pas verdict.</Para>
        </View>
      </Carte>

      <Carte cadre>
        <Kicker>Ce qu’est une tension</Kicker>
        <Text accessibilityRole="header" style={[T.heading, { fontFamily: F.extra, color: C.text, lineHeight: 23 }]}>Un écart à débattre, pas une contradiction.</Text>
        <Para>
          Un groupe refuse parfois un scrutin pour des raisons compatibles avec son programme : un calendrier différent, un texte porteur qu’il rejette dans son ensemble, une rédaction qu’il conteste, un auteur dont il combat le reste du projet. La tension signale l’écart, elle ne l’explique pas. Chaque vote est détaillé pour que chacun en juge.
        </Para>
        <Para faible>
          Quand aucun député du groupe ne prend part à un scrutin qui porte la mesure, c’est compté en tension : ne pas prendre part au vote est une façon de ne pas voter un texte, sans voter contre.
        </Para>
      </Carte>

      <Carte>
        <Kicker>Ce qui compte comme le même sens</Kicker>
        <Para>Une variante de la mesure, déposée par n’importe quel groupe : autre montant, autre calendrier, périmètre plus étroit, suspension au lieu d’abrogation. L’écart est noté sur la mesure.</Para>
        <Para>
          Un scrutin de sens inverse compte aussi. Le groupe vote pour : tension. Il vote contre : cohérent. Il s’abstient : tension, uniquement si le texte vient du groupe lui-même ou du groupe qui lui est apparié pour cette règle (LFI-NFP et Écologiste et Social, RN et UDR, EPR et Horizons).
        </Para>
        <Para faible>
          Ces paires sont une convention de méthode, fixée pour trancher les abstentions. Elles ne disent rien de la proximité réelle entre ces groupes et restent discutables.
        </Para>
      </Carte>

      <Carte>
        <Kicker>Limites</Kicker>
        {base ? (
          <Para faible>
            La base compte {nombre(base.scrutins)} scrutins publics de la XVIIe législature, du {dateLongue(base.du)} au {dateLongue(base.au)}. Ni les votes à main levée, ni le Sénat, ni les législatures précédentes.
          </Para>
        ) : (
          <Para faible>La base ne compte que les scrutins publics de la XVIIe législature. Ni les votes à main levée, ni le Sénat, ni les législatures précédentes.</Para>
        )}
        <Para faible>Les amendements de crédits n’ont pas de texte comparable : ils ne sont pas appariés. C’est la première cause de « sans scrutin public » pour les mesures budgétaires.</Para>
        <Para faible>Afficher des nombres, jamais un pourcentage : Scrutoir ne note pas les programmes.</Para>
      </Carte>
      <Text style={[T.micro, { color: C.textFaint, lineHeight: 15 }]}>
        Sources : le programme publié par le parti, les scrutins publics de l’Assemblée nationale (open data). Même crible pour chaque programme, dans l’ordre de publication.
      </Text>
    </View>
  );
}

/** La feuille. `visible` faux : rien n'est monté (react-native-web rendrait le Modal quand même). */
export function FeuilleMethode({ visible, onClose, chiffres, base }: { visible: boolean; onClose: () => void; chiffres: ChiffresMethode | null; base: BaseScrutins | null }) {
  if (!visible) return null;
  if (Platform.OS === "ios") {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <EnTeteFeuille onClose={onClose} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <ContenuMethode chiffres={chiffres} base={base} />
          </ScrollView>
        </View>
      </Modal>
    );
  }
  return <FeuilleWeb onClose={onClose} chiffres={chiffres} base={base} />;
}

function EnTeteFeuille({ onClose, poignee }: { onClose: () => void; poignee?: object }) {
  return (
    <View {...poignee} style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 8 }}>
      <View aria-hidden style={{ alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: C.borderStrong }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>Comment on compare</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer la méthode" style={{ minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.accent }]}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FeuilleWeb({ onClose, chiffres, base }: { onClose: () => void; chiffres: ChiffresMethode | null; base: BaseScrutins | null }) {
  const { height, width } = useWindowDimensions();
  const rm = useReduceMotion();
  const y = useRef(new Animated.Value(rm ? 0 : height)).current;
  const fondu = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: rm ? 0 : 320, easing: COURBE, useNativeDriver: false }),
      Animated.timing(fondu, { toValue: 1, duration: rm ? 200 : 240, easing: Easing.linear, useNativeDriver: false }),
    ]).start();
  }, []);
  const fermer = () => {
    Animated.parallel([
      Animated.timing(y, { toValue: rm ? 0 : height, duration: rm ? 0 : 240, easing: COURBE, useNativeDriver: false }),
      Animated.timing(fondu, { toValue: 0, duration: 200, easing: Easing.linear, useNativeDriver: false }),
    ]).start(() => onClose());
  };
  // Glisser vers le bas (poignée et en-tête) : au-delà de 110 px ou d'un geste vif, la feuille se ferme.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 0.8) fermer();
        else Animated.timing(y, { toValue: 0, duration: 200, easing: COURBE, useNativeDriver: false }).start();
      },
    }),
  ).current;
  return (
    <Modal visible transparent animationType="none" onRequestClose={fermer}>
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        <Animated.View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.scrim, opacity: fondu }}>
          <Pressable onPress={fermer} accessibilityLabel="Fermer la méthode" style={{ flex: 1 }} />
        </Animated.View>
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 54, bottom: 0, alignItems: "center" }}>
          <Animated.View
            role="dialog"
            aria-modal
            accessibilityLabel="Comment on compare"
            style={{
              flex: 1,
              width: Math.min(width, 480),
              backgroundColor: C.bg,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              transform: [{ translateY: y }],
              opacity: rm ? fondu : 1,
            }}
          >
            <EnTeteFeuille onClose={fermer} poignee={pan.panHandlers} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
              <ContenuMethode chiffres={chiffres} base={base} />
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
