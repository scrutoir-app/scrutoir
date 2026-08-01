import React, { useMemo } from "react";
import { View, Text, Platform } from "react-native";
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
  survolAbrev = null,
  onHoverParty,
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
  // Desktop (web) : survol d'un groupe → ses sièges ressortent, les autres s'atténuent,
  // et son nom s'affiche en infobulle. `survolAbrev` est piloté par l'écran via `onHoverParty`.
  survolAbrev?: string | null;
  onHoverParty?: (abrev: string | null) => void;
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

  const survolG = survolAbrev ? groupes.find((g) => g.abrev === survolAbrev) : null;
  const web = Platform.OS === "web";

  // Survol (desktop) : react-native-svg ne propage pas les events souris sur <Circle>. On écoute
  // donc le mouvement sur le conteneur (dimensionné EXACTEMENT à la coupole → offsetX/Y = coords SVG),
  // et on associe le curseur au siège le plus proche → son groupe s'illumine, les autres s'atténuent.
  const survolHandlers = web && onHoverParty
    ? {
        onMouseMove: (e: { nativeEvent?: { offsetX?: number; offsetY?: number } }) => {
          const x = e?.nativeEvent?.offsetX, y = e?.nativeEvent?.offsetY;
          if (x == null || y == null) return;
          let best = -1, bd = Infinity;
          for (let i = 0; i < points.length; i++) {
            const dx = points[i].x - x, dy = points[i].y - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
          }
          const seuil = dotR * 2.4;
          const ab = best >= 0 && bd <= seuil * seuil ? owners[best] : null;
          if ((ab ?? null) !== (survolAbrev ?? null)) onHoverParty(ab ?? null);
        },
        onMouseLeave: () => { if (survolAbrev != null) onHoverParty(null); },
      }
    : {};

  return (
    <View style={{ alignItems: "center" }}>
      {/* Conteneur à la taille de la coupole : porte l'écoute du survol + l'infobulle. */}
      <View style={{ width: w, height: h }} {...(survolHandlers as object)}>
        {/* Infobulle de survol (desktop) : nom du groupe survolé, sans décaler la mise en page. */}
        {survolG && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", zIndex: 5 }} pointerEvents="none">
            <View style={{ backgroundColor: C.text, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.bg }]}>{survolG.abrev} · {survolG.nb_deputes} élus</Text>
            </View>
          </View>
        )}
        <Svg width={w} height={h}>
          {points.map((d, i) => {
            const ab = owners[i];
            const camp = ab ? campByAbrev.get(ab) : undefined;
            const fill = camp === "comme" ? couleurGroupe(couleurByAbrev.get(ab!) ?? undefined) : C.siege;
            const on = !!ab && ab === selectedAbrev;
            const survole = !!ab && ab === survolAbrev;
            const attenue = survolAbrev != null && ab !== survolAbrev;
            return (
              <Circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={dotR}
                fill={fill}
                opacity={attenue ? 0.3 : 1}
                stroke={on ? C.text : survole ? C.text : undefined}
                strokeWidth={on ? 2.4 : survole ? 1.6 : 0}
                onPress={ab && onPickParty ? () => onPickParty(ab) : undefined}
              />
            );
          })}
          <Circle cx={cx} cy={cy} r={size * 0.1} fill={C.siegeFocal} />
        </Svg>
      </View>

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
