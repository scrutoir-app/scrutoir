// « Le chemin des N mesures » : le programme, ce qui se confronte à un vote, le verdict, puis le
// détail du neutre. Diagramme de flux calculé depuis les comptes ; image pour les lecteurs d'écran
// (tous les comptes dans le libellé). Le hors champ est en gris pâle, toujours doublé de son nombre.
import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { C, F } from "../../theme";
import type { Comptes } from "../../presidentielle/types";
import { neutres } from "../../presidentielle/logique";
import { nombre, pluriel } from "../../presidentielle/libelles";

const H = 236;
const BARRE = 8;
const ZONE_LIBELLES = 142; // place des libellés de la dernière colonne

type Noeud = { y: number; h: number };

function flux(x1: number, s: Noeud, x2: number, d: Noeud): string {
  const m = (x1 + x2) / 2;
  return `M${x1},${s.y.toFixed(1)} C${m},${s.y.toFixed(1)} ${m},${d.y.toFixed(1)} ${x2},${d.y.toFixed(1)} L${x2},${(d.y + d.h).toFixed(1)} C${m},${(d.y + d.h).toFixed(1)} ${m},${(s.y + s.h).toFixed(1)} ${x1},${(s.y + s.h).toFixed(1)} Z`;
}

export function libelleTamis(total: number, horsChamp: number, k: Comptes): string {
  const conf = total - horsChamp;
  return (
    `Du programme aux verdicts : ${nombre(total)} mesures, ${nombre(conf)} confrontables, ${nombre(horsChamp)} hors champ ; ` +
    `${nombre(k.c)} ${pluriel(k.c, "cohérente", "cohérentes")}, ${nombre(k.t)} en tension, ${nombre(neutres(k))} ${pluriel(neutres(k), "neutre", "neutres")}, ` +
    `dont ${nombre(k.s)} sans scrutin public, ${nombre(k.j)} à juger, ${nombre(k.r)} sans vote représentatif.`
  );
}

export function Tamis({ total, horsChamp, comptes: k }: { total: number; horsChamp: number; comptes: Comptes }) {
  const [w, setW] = useState(326);
  const conf = total - horsChamp;
  const n = neutres(k);
  const pas = Math.max(36, (w - BARRE - ZONE_LIBELLES - 4) / 3);
  const x = [0, pas, 2 * pas, 3 * pas];
  const e = (H - 10) / Math.max(1, total); // px par mesure
  const haut = (v: number) => (v > 0 ? Math.max(1.2, v * e) : 0);

  const n0: Noeud = { y: 0, h: haut(total) };
  const nConf: Noeud = { y: 0, h: haut(conf) };
  const nHors: Noeud = { y: nConf.h + 10, h: haut(horsChamp) };
  const nc: Noeud = { y: 0, h: haut(k.c) };
  const nt: Noeud = { y: nc.h + 6, h: haut(k.t) };
  const nn: Noeud = { y: nt.y + nt.h + 6, h: haut(n) };
  const ns: Noeud = { y: nn.y, h: haut(k.s) };
  const nj: Noeud = { y: ns.y + ns.h + 6, h: haut(k.j) };
  const nr: Noeud = { y: nj.y + nj.h + 6, h: haut(k.r) };
  // Sous-plages de départ dans une barre (empilées dans l'ordre des cibles).
  const sous = (src: Noeud, avant: number, v: number): Noeud => ({ y: src.y + avant * e, h: haut(v) });

  const fondFlux = C.surfaceAlt;
  const neutre = { fill: C.surface, stroke: C.verdictNeutreStroke, strokeWidth: 1.2 };
  const libelles: { x: number; y: number; t: string }[] = [];
  const centre = (nd: Noeud) => nd.y + nd.h / 2 + 4;
  libelles.push({ x: x[0] + BARRE + 4, y: centre(n0), t: nombre(total) });
  libelles.push({ x: x[1] + BARRE + 4, y: centre(nConf), t: nombre(conf) });
  if (horsChamp) libelles.push({ x: x[1] + BARRE + 4, y: centre(nHors), t: `${nombre(horsChamp)} hors champ` });
  if (k.c) libelles.push({ x: x[2] + BARRE + 4, y: centre(nc), t: `= ${nombre(k.c)}` });
  if (k.t) libelles.push({ x: x[2] + BARRE + 4, y: Math.max(centre(nt), centre(nc) + 13), t: `≠ ${nombre(k.t)}` });
  if (n) libelles.push({ x: x[2] + BARRE + 4, y: Math.max(centre(nn), centre(nt) + 26), t: `∅ ${nombre(n)}` });
  // Dernière colonne : libellés espacés d'au moins 12 px.
  let dernierY = -Infinity;
  for (const [nd, v, t] of [
    [ns, k.s, "sans scrutin"],
    [nj, k.j, "à juger"],
    [nr, k.r, "sans vote représentatif"],
  ] as [Noeud, number, string][]) {
    if (!v) continue;
    const y = Math.max(centre(nd), dernierY + 12);
    dernierY = y;
    libelles.push({ x: x[3] + BARRE + 4, y, t: `${nombre(v)} ${t}` });
  }

  return (
    <View
      onLayout={(ev) => setW(Math.round(ev.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={libelleTamis(total, horsChamp, k)}
      aria-label={libelleTamis(total, horsChamp, k)}
    >
      <Svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
        <Rect x={x[0]} y={n0.y} width={BARRE} height={n0.h} fill={C.accent} />
        <Path d={flux(x[0] + BARRE, sous(n0, 0, conf), x[1], nConf)} fill={fondFlux} />
        {horsChamp > 0 && <Path d={flux(x[0] + BARRE, sous(n0, conf, horsChamp), x[1], nHors)} fill={fondFlux} />}
        <Rect x={x[1]} y={nConf.y} width={BARRE} height={nConf.h} fill={C.accent} />
        {horsChamp > 0 && <Rect x={x[1]} y={nHors.y} width={BARRE} height={nHors.h} fill={C.horsChamp} />}
        {k.c > 0 && <Path d={flux(x[1] + BARRE, sous(nConf, 0, k.c), x[2], nc)} fill={fondFlux} />}
        {k.t > 0 && <Path d={flux(x[1] + BARRE, sous(nConf, k.c, k.t), x[2], nt)} fill={fondFlux} />}
        {n > 0 && <Path d={flux(x[1] + BARRE, sous(nConf, k.c + k.t, n), x[2], nn)} fill={fondFlux} />}
        {k.c > 0 && <Rect x={x[2]} y={nc.y} width={BARRE} height={nc.h} fill={C.verdictCoherent} />}
        {k.t > 0 && <Rect x={x[2]} y={nt.y} width={BARRE} height={nt.h} fill={C.verdictTension} />}
        {n > 0 && <Rect x={x[2]} y={nn.y} width={BARRE} height={nn.h} {...neutre} />}
        {k.s > 0 && <Path d={flux(x[2] + BARRE, sous(nn, 0, k.s), x[3], ns)} fill={fondFlux} />}
        {k.j > 0 && <Path d={flux(x[2] + BARRE, sous(nn, k.s, k.j), x[3], nj)} fill={fondFlux} />}
        {k.r > 0 && <Path d={flux(x[2] + BARRE, sous(nn, k.s + k.j, k.r), x[3], nr)} fill={fondFlux} />}
        {k.s > 0 && <Rect x={x[3]} y={ns.y} width={BARRE} height={ns.h} {...neutre} />}
        {k.j > 0 && <Rect x={x[3]} y={nj.y} width={BARRE} height={nj.h} {...neutre} />}
        {k.r > 0 && <Rect x={x[3]} y={nr.y} width={BARRE} height={nr.h} {...neutre} />}
        {libelles.map((l, i) => (
          <SvgText key={i} x={l.x} y={l.y} fontFamily={F.extra} fontSize={11} fill={C.text}>
            {l.t}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
