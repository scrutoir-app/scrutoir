import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { C, F, T, tnum, couleurGroupe } from "../theme";
import { markGeo, coupolePoints, ownersFor, type GroupeGeo } from "./hemicycleGeo";

// Hémicycle VENTILÉ « à deux camps » : tous les sièges placés par la géométrie partagée
// (`coupolePoints` + `ownersFor`, EXACTEMENT le placement du picto/mark), mais colorés selon
// le CAMP du groupe sur CE scrutin face à ta réponse :
//   comme toi  → couleur d'identité du parti (plein)
//   en face    → gris neutre (C.siege)
//   neutre     → gris neutre aussi (abstention / partagé / sans position) — jamais compté
// Jamais de siège blanc ici (il appartient au logo). Le foyer central reste gris neutre.
// Réutilisé par : résultat du test, file « à trancher », vue scrutin/texte.

export type Camp = "comme" | "face" | "neutre";

export interface GroupeCamp extends GroupeGeo {
  couleur: string | null;
  camp: Camp;
}

/** Camp d'un groupe : sa position (majorité/consigne) comparée à ta réponse, abstention exclue. */
export function campDe(positionGroupe: string | null | undefined, taReponse: string | null | undefined): Camp {
  const tranche = (p: unknown): p is "pour" | "contre" => p === "pour" || p === "contre";
  if (!tranche(positionGroupe) || !tranche(taReponse)) return "neutre";
  return positionGroupe === taReponse ? "comme" : "face";
}

export function HemicycleCamps({
  groupes,
  size = 300,
  commeLabel = "Comme toi",
  faceLabel = "En face",
  showAxe = true,
  selectedAbrev = null,
  onPickParty,
}: {
  groupes: GroupeCamp[];
  size?: number;
  commeLabel?: string;
  faceLabel?: string;
  showAxe?: boolean;
  // Vue texte/scrutin : entoure d'un anneau les sièges du parti ouvert dans la fiche,
  // et rend les sièges tactiles pour changer de parti au doigt.
  selectedAbrev?: string | null;
  onPickParty?: (abrev: string) => void;
}) {
  const { w, h, cx, cy, dotR } = markGeo(size);
  const geo: GroupeGeo[] = useMemo(() => groupes.map((g) => ({ abrev: g.abrev, nb_deputes: g.nb_deputes })), [groupes]);
  const owners = useMemo(() => ownersFor(geo), [geo]);
  const points = useMemo(() => coupolePoints(size), [size]);

  const campByAbrev = useMemo(() => {
    const m = new Map<string, Camp>();
    groupes.forEach((g) => { if (g.abrev) m.set(g.abrev, g.camp); });
    return m;
  }, [groupes]);
  const couleurByAbrev = useMemo(() => {
    const m = new Map<string, string | null>();
    groupes.forEach((g) => { if (g.abrev) m.set(g.abrev, g.couleur); });
    return m;
  }, [groupes]);

  // Effectifs par camp (vrais nombres de députés, jamais le nombre de sièges symboliques).
  const { commeN, faceN } = useMemo(() => {
    let commeN = 0, faceN = 0;
    groupes.forEach((g) => {
      if (g.camp === "comme") commeN += g.nb_deputes || 0;
      else if (g.camp === "face") faceN += g.nb_deputes || 0;
    });
    return { commeN, faceN };
  }, [groupes]);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={w} height={h}>
        {points.map((d, i) => {
          const ab = owners[i];
          const camp = ab ? campByAbrev.get(ab) : undefined;
          const fill = camp === "comme" ? couleurGroupe(couleurByAbrev.get(ab!) ?? undefined) : C.siege;
          const on = !!ab && ab === selectedAbrev;
          return (
            <Circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={dotR}
              fill={fill}
              stroke={on ? C.text : undefined}
              strokeWidth={on ? 2.4 : 0}
              onPress={ab && onPickParty ? () => onPickParty(ab) : undefined}
            />
          );
        })}
        <Circle cx={cx} cy={cy} r={size * 0.1} fill={C.siegeFocal} />
      </Svg>

      {showAxe && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", width: w * 0.82, marginTop: 1 }}>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>Gauche</Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>Droite</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.text }} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{commeLabel}</Text>
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{commeN}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.siege }} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>{faceLabel}</Text>
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textFaint }]}>{faceN}</Text>
        </View>
      </View>
    </View>
  );
}
