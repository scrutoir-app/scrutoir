import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, tnum, couleurPosition } from "../theme";
import { HemicyclePositions } from "./HemicyclePositions";
import { ScrutinMotif } from "./ScrutinMotif";
import { VerdictPastille } from "./VerdictPastille";
import { useScrutinGroupes } from "../scrutinGroupes";
import { useKept } from "../keptScrutins";
import { verdictScrutin, positionMajoritaire, tailleGroupe } from "../testProximite/verdict";
import { catUI } from "../categoryUI";
import type { ContexteJe } from "../testProximite/jeProximite";
import type { Reponse } from "../testProximite/score";
import type { ScrutinResume, GroupeVentilation } from "../types";

const fmt = (n: number | null | undefined) => (n == null ? "?" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "));

/** Camps « Pour » / « Contre » : abrevs des groupes de chaque camp, triés par taille. */
function camps(groupes: GroupeVentilation[]) {
  const pour: { abrev: string; couleur: string | null; nb: number }[] = [];
  const contre: typeof pour = [];
  for (const g of groupes) {
    if (!g.abrev) continue;
    const pos = positionMajoritaire(g);
    const item = { abrev: g.abrev, couleur: g.couleur, nb: tailleGroupe(g) };
    if (pos === "pour") pour.push(item);
    else if (pos === "contre") contre.push(item);
  }
  pour.sort((a, b) => b.nb - a.nb);
  contre.sort((a, b) => b.nb - a.nb);
  return { pour, contre };
}

function CampChip({ label, position, groupes }: { label: string; position: "pour" | "contre"; groupes: { abrev: string }[] }) {
  if (!groupes.length) return null;
  const shown = groupes.slice(0, 3).map((g) => g.abrev).join(" ");
  const extra = groupes.length > 3 ? ` +${groupes.length - 3}` : "";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: S.s6, backgroundColor: C.glass, borderRadius: RADIUS.pill, paddingHorizontal: S.s10, paddingVertical: S.s6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleurPosition(position) }} />
      <Text style={[T.micro, { fontFamily: F.extra, color: C.text }]}>{label}</Text>
      <Text style={[T.micro, { color: C.textFaint }]}>{shown}{extra}</Text>
    </View>
  );
}

function RailAction({ icon, label, active, onPress }: { icon: any; label: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: "center", gap: S.s4 }}>
      <View style={{ width: 50, height: 50, borderRadius: RADIUS.pill, backgroundColor: active ? C.glassStrong : C.glass, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={ICON.xl} color={C.text} />
      </View>
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FilScrutinCard({
  scrutin,
  height,
  width,
  topInset = 0,
  ctx,
  situe,
  reponse,
  isFirst,
  annotation,
  adaptive,
  onDetail,
  onShare,
  onVerdict,
}: {
  scrutin: ScrutinResume;
  height: number;
  width: number;
  topInset?: number; // hauteur de la barre glassy en surimpression (les slides passent dessous)
  ctx: ContexteJe | null;
  situe: boolean;
  reponse: Reponse | undefined;
  isFirst: boolean;
  annotation?: React.ReactNode; // slot par-item propre à l'écran (ex. consigne du groupe / écart)
  adaptive?: boolean; // compacte l'hémicycle/titre quand la carte est courte (en-tête haut). L'onglet
  // Scrutins ne le passe PAS → son rendu reste inchangé ; seul ScrutinList l'active.
  onDetail: () => void;
  onShare: () => void;
  onVerdict: () => void; // ouvre légende (situé) ou onboarding (verrouillé)
}) {
  const detail = useScrutinGroupes(scrutin.uid);
  const [kept, toggleKept] = useKept(scrutin.uid);
  const [heroH, setHeroH] = useState(0); // hauteur mesurée du héros (layout adaptatif) → taille hémicycle
  // Hydratation : les données sparse (ex. une Dissidence) n'ont ni sort_code, ni comptes, ni
  // catégorie → on les complète depuis le détail déjà chargé pour l'hémicycle (aucun fetch en plus).
  const r = detail?.resume;
  const sortCode = scrutin.sort_code ?? r?.sort_code ?? null;
  const adopte = sortCode === "adopte";
  const pour = scrutin.pour ?? r?.pour;
  const contre = scrutin.contre ?? r?.contre;
  const categorieId = scrutin.categorie ?? r?.categorie ?? null;

  const positions = useMemo(() => {
    const m: Record<string, "pour" | "contre" | "abstention"> = {};
    detail?.pos.forEach((g) => { if (g.abrev) m[g.abrev] = g.position; });
    return m;
  }, [detail]);
  const geo = useMemo(() => (detail?.groupes ?? []).map((g) => ({ abrev: g.abrev, nb_deputes: tailleGroupe(g) })), [detail]);
  const c = useMemo(() => (detail ? camps(detail.groupes) : { pour: [], contre: [] }), [detail]);

  const verdict = verdictScrutin({ ctx, situe, reponse, groupes: detail?.pos ?? [], sortCode });
  const titre = scrutin.dossier_titre || scrutin.titre || r?.dossier_titre || r?.titre || "Scrutin";
  const catLabel = catUI(categorieId ?? "").court ?? categorieId ?? "";
  const availH = Math.max(1, height - topInset); // hauteur visible sous la barre glassy

  // Layout ADAPTATIF (flex) : badge → hémicycle flexible → bloc info/rail. L'espace est distribué,
  // donc AUCUN chevauchement possible quelle que soit la hauteur (en-tête solide court) ; l'hémicycle
  // se RÉDUIT pour tenir (jamais rogné). Réservé à ScrutinList — l'onglet Scrutins garde le layout
  // absolu ci-dessous, inchangé.
  if (adaptive) {
    // L'hémicycle mesure `size × 0.72` de haut (markGeo) → borné à la hauteur réelle du héros mesuré
    // et à la largeur. Rendu une fois le héros mesuré (évite un flash trop grand puis réduit).
    const heroSize = Math.min(width * 0.82, 330, heroH / 0.72);
    return (
      <View style={{ width, height, overflow: "hidden", backgroundColor: C.bg }}>
        <ScrutinMotif categorieId={categorieId} width={width} height={height} />
        <View style={{ flex: 1, paddingTop: topInset + S.s8 }}>
          <View style={{ paddingHorizontal: S.s16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: S.s6, backgroundColor: C.glass, borderRadius: RADIUS.pill, paddingHorizontal: S.s12, paddingVertical: 7, alignSelf: "flex-start" }}>
              <Feather name={adopte ? "check" : "x"} size={ICON.sm} color={adopte ? C.pour : C.contre} />
              <Text style={[T.small, tnum, { fontFamily: F.extra, color: adopte ? C.pour : C.contre }]}>
                {adopte ? "Adopté" : "Rejeté"} · {fmt(pour)}–{fmt(contre)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onDetail}
            onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h && Math.abs(h - heroH) > 1) setHeroH(h); }}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le détail du scrutin"
            style={{ flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center" }}
          >
            {detail && heroH > 0 ? <HemicyclePositions groupes={geo} positions={positions} size={heroSize} /> : null}
          </Pressable>
          <View style={{ paddingLeft: S.s16, paddingRight: S.s12, paddingBottom: S.s16, flexDirection: "row", alignItems: "flex-end", gap: S.s12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[T.micro, { fontFamily: F.extra, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: S.s8 }]}>{catLabel}</Text>
              <Pressable onPress={onDetail} accessibilityRole="button" accessibilityLabel={`Détail : ${titre}`}>
                <Text style={[T.title, { color: C.text }]} numberOfLines={4}>{titre}</Text>
              </Pressable>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.s6, marginTop: S.s8 }}>
                <CampChip label="Pour" position="pour" groupes={c.pour} />
                <CampChip label="Contre" position="contre" groupes={c.contre} />
              </View>
              <VerdictPastille verdict={verdict} onPress={onVerdict} style={{ marginTop: S.s8 }} />
              {annotation != null && <View style={{ marginTop: S.s6 }}>{annotation}</View>}
            </View>
            <View style={{ gap: S.s18, alignItems: "center" }}>
              <RailAction icon="info" label="Détail" onPress={onDetail} />
              <RailAction icon="bookmark" label={kept ? "Gardé" : "Garder"} active={kept} onPress={() => toggleKept()} />
              <RailAction icon="share-2" label="Partager" onPress={onShare} />
            </View>
          </View>
        </View>
        {isFirst && (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 2, alignItems: "center", zIndex: 2 }} pointerEvents="none">
            <View style={{ flexDirection: "row", alignItems: "center", gap: S.s6 }}>
              <Feather name="chevron-up" size={ICON.sm} color={C.textFaint} />
              <Text style={[T.micro, { color: C.textFaint }]}>Balaie vers le haut</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ width, height, overflow: "hidden", backgroundColor: C.bg }}>
      {/* Filigrane de fond par thème */}
      <ScrutinMotif categorieId={categorieId} width={width} height={height} />

      {/* Badge résultat, flottant en haut à gauche (sous la barre glassy) */}
      <View style={{ position: "absolute", top: topInset + S.s8, left: S.s16, zIndex: 3, flexDirection: "row", alignItems: "center", gap: S.s6, backgroundColor: C.glass, borderRadius: RADIUS.pill, paddingHorizontal: S.s12, paddingVertical: 7 }}>
        <Feather name={adopte ? "check" : "x"} size={ICON.sm} color={adopte ? C.pour : C.contre} />
        <Text style={[T.small, tnum, { fontFamily: F.extra, color: adopte ? C.pour : C.contre }]}>
          {adopte ? "Adopté" : "Rejeté"} · {fmt(pour)}–{fmt(contre)}
        </Text>
      </View>

      {/* Héros : hémicycle coloré par position (tap → détail) */}
      <Pressable
        onPress={onDetail}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le détail du scrutin"
        style={{ position: "absolute", left: 0, right: 0, top: topInset + availH * 0.07, height: availH * 0.46, alignItems: "center", justifyContent: "center" }}
      >
        {detail ? (
          <HemicyclePositions groupes={geo} positions={positions} size={Math.min(width * 0.82, 330)} />
        ) : null}
      </Pressable>

      {/* Bloc info + rail d'actions, ancrés en bas et alignés en bas : le rail tient dans la
          bande « catégorie → comme toi » (équilibre de la carte) au lieu de flotter vers l'hémicycle. */}
      <View style={{ position: "absolute", left: S.s16, right: S.s12, bottom: height * 0.06, zIndex: 4, flexDirection: "row", alignItems: "flex-end", gap: S.s12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.micro, { fontFamily: F.extra, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: S.s8 }]}>
            {catLabel}
          </Text>
          <Pressable onPress={onDetail} accessibilityRole="button" accessibilityLabel={`Détail : ${titre}`}>
            <Text style={[T.title, { color: C.text }]} numberOfLines={4}>{titre}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.s6, marginTop: S.s12 }}>
            <CampChip label="Pour" position="pour" groupes={c.pour} />
            <CampChip label="Contre" position="contre" groupes={c.contre} />
          </View>
          <VerdictPastille verdict={verdict} onPress={onVerdict} style={{ marginTop: S.s12 }} />
          {annotation != null && <View style={{ marginTop: S.s10 }}>{annotation}</View>}
        </View>
        <View style={{ gap: S.s18, alignItems: "center" }}>
          <RailAction icon="info" label="Détail" onPress={onDetail} />
          <RailAction icon="bookmark" label={kept ? "Gardé" : "Garder"} active={kept} onPress={() => toggleKept()} />
          <RailAction icon="share-2" label="Partager" onPress={onShare} />
        </View>
      </View>

      {/* Accroche « balaie vers le haut » (première carte) */}
      {isFirst && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: S.s8, alignItems: "center", zIndex: 2 }} pointerEvents="none">
          <View style={{ flexDirection: "row", alignItems: "center", gap: S.s6 }}>
            <Feather name="chevron-up" size={ICON.sm} color={C.textFaint} />
            <Text style={[T.micro, { color: C.textFaint }]}>Balaie vers le haut</Text>
          </View>
        </View>
      )}
    </View>
  );
}
