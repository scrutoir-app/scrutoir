import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, CONTROL, ICON, MOTION, tnum, couleurGroupe } from "../theme";
import { Card, Chip } from "./ui";
import { getPartis, getScrutin } from "../api";
import { aujourdhuiParis } from "../hebdo";
import { decompteClair, type Compte } from "../decompte";
import { useCibleTour } from "../tourTargets";
import { useReduceMotion } from "./HeroScrutins";
import { ORDRE_HEMICYCLE } from "./hemicycleGeo";
import type { FocusSenat, GroupeSenat, IconeFocus, PositionGroupe } from "../content/focus";
import type { DetailScrutin, GroupeVentilation, PartiResume } from "../types";
import type { Nav } from "../nav";

type ScrutinLie = NonNullable<FocusSenat["scrutinANLie"]>;
type Etape = NonNullable<FocusSenat["parcours"]>[number];

/**
 * Focus actualité sur un vote du Sénat (content/focus.ts, chambre "Senat"). Tout est saisi à la
 * main, sauf « Déjà voté à l'Assemblée » : décomptes et groupes lus dans les données du scrutin
 * lié (bloc absent tant qu'il n'est pas chargé, ou s'il est introuvable). Pastilles des groupes
 * du Sénat : couleur du groupe équivalent à l'Assemblée (partis.json), neutre sans équivalent.
 * Rien hors période.
 */
export function FocusSenatBloc({ focus, nav }: { focus: FocusSenat; nav: Nav }) {
  // Cible de la visite guidée (le bloc entier), enregistrée seulement quand le focus s'affiche.
  const refTour = useCibleTour("actualite");
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [lie, setLie] = useState<DetailScrutin | null>(null);
  const idLie = focus.scrutinANLie?.scrutinId;

  useEffect(() => {
    let vivant = true;
    getPartis().then((p) => vivant && setPartis(p)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);
  useEffect(() => {
    if (!idLie) return;
    let vivant = true;
    getScrutin(idLie).then((d) => vivant && setLie(d)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [idLie]);

  const aujourdhui = aujourdhuiParis();
  if (aujourdhui < focus.du || aujourdhui > focus.au) return null;

  const couleurDe = (g: GroupeSenat) =>
    couleurGroupe(g.groupeANRef ? partis.find((p) => p.abrev === g.groupeANRef)?.couleur : null);
  const r = focus.resultat;

  return (
    <View ref={refTour} collapsable={false} style={{ marginTop: 22 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>Focus actu</Text>
          <Chip
            label="Vote du Sénat"
            bg={C.accentSoft}
            fg={C.accent}
            pv={4}
            gap={5}
            icon={<MaterialCommunityIcons name="bank" size={ICON.xs} color={C.accent} />}
          />
        </View>
        <Text style={[T.title, { color: C.text, letterSpacing: -0.5, marginTop: 10 }]} accessibilityRole="header">
          {focus.titre}
        </Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 5, lineHeight: 18 }]}>{focus.sousTitre}</Text>
      </View>

      <Carte>
        <Libelle>Ce que dit le texte</Libelle>
        {focus.points.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: i ? 8 : 9 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
              <Picto icone={p.icone} size={ICON.sm} color={C.text} />
            </View>
            <Text style={[T.small, { flex: 1, color: C.text, lineHeight: 18, paddingTop: 5 }]}>{p.texte}</Text>
          </View>
        ))}
      </Carte>

      <Carte>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <Text style={[T.body, { fontFamily: F.extra, color: C.text }]}>{r.pour > r.contre ? "Adopté" : "Rejeté"} au Sénat</Text>
          <Text style={[T.micro, tnum, { color: C.textFaint }]}>{r.dateLabel}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 18, marginTop: 10, marginBottom: 9 }}>
          <Chiffre n={r.pour} label="pour" couleur={C.pour} grand />
          <Chiffre n={r.contre} label="contre" couleur={C.contre} grand />
          {r.abstention != null && <Chiffre n={r.abstention} label="abstention" couleur={C.abstention} grand />}
        </View>
        <Barre pour={r.pour} contre={r.contre} abstention={r.abstention ?? 0} hauteur={8} />
      </Carte>

      {focus.groupesSenat && focus.groupesSenat.length > 0 && (
        <GroupesSenat groupes={focus.groupesSenat} note={focus.noteGroupes} couleurDe={couleurDe} />
      )}

      {focus.scrutinANLie && lie && (
        <DejaVoteAN lie={focus.scrutinANLie} detail={lie} onOuvrir={() => nav.push({ name: "scrutin", uid: lie.scrutin.uid })} />
      )}

      {focus.parcours && focus.parcours.length > 0 && <Parcours etapes={focus.parcours} procedure={focus.procedure} />}
    </View>
  );
}

/**
 * Groupes du Sénat, repliés par défaut : un résumé calculé (pastilles et nombre de groupes par
 * position). Dépliés : une ligne par groupe avec son équivalent à l'Assemblée et sa position
 * annoncée, le décompte officiel dessous quand il est publié (`voix`). État local, non persisté.
 */
function GroupesSenat({ groupes, note, couleurDe }: { groupes: GroupeSenat[]; note?: string; couleurDe: (g: GroupeSenat) => string }) {
  const [ouvert, setOuvert] = useState(false);
  const reduceMotion = useReduceMotion();
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rot, {
      toValue: ouvert ? 1 : 0,
      duration: reduceMotion ? 0 : MOTION.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [ouvert, reduceMotion, rot]);

  const de = (p: PositionGroupe) => groupes.filter((g) => g.position === p);
  const camps = [
    { groupes: de("pour"), libelle: "pour", couleur: C.pour },
    { groupes: de("contre"), libelle: "contre", couleur: C.contre },
    { groupes: de("abstention"), libelle: de("abstention").length > 1 ? "abstentions" : "abstention", couleur: C.abstention },
  ].filter((c) => c.groupes.length > 0);
  const nc = de("nc").length;
  const sansPosition = nc > 0 ? `${nc} ${nc > 1 ? "groupes" : "groupe"} sans position communiquée` : null;
  const resume = [...camps.map((c) => `${c.groupes.length} ${c.libelle}`), sansPosition].filter(Boolean).join(", ");

  return (
    <Carte>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOuvert((o) => !o)}
        accessibilityRole="button"
        aria-expanded={ouvert}
        accessibilityLabel={`Les groupes du Sénat : ${resume}`}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Libelle>Les groupes du Sénat</Libelle>
          <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
            <Feather name="chevron-down" size={ICON.base} color={C.textMuted} />
          </Animated.View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2, marginTop: 9 }}>
          {camps.map((c, i) => (
            <React.Fragment key={c.libelle}>
              {i > 0 && <Text style={[T.small, { color: C.textFaint }]}>·</Text>}
              <View style={{ flexDirection: "row", gap: 3 }}>
                {c.groupes.map((g) => <Pastille key={g.sigle} couleur={couleurDe(g)} />)}
              </View>
              <Text style={[T.small, tnum, { fontFamily: F.bold, color: c.couleur }]}>
                {c.groupes.length} {c.libelle}
              </Text>
            </React.Fragment>
          ))}
        </View>
        {sansPosition && <Text style={[T.micro, tnum, { color: C.textFaint, marginTop: 3 }]}>{sansPosition}</Text>}
      </TouchableOpacity>

      {ouvert && (
        <View>
          <Text style={[T.micro, { color: C.textFaint, marginTop: 12 }]}>
            Ce ne sont pas les groupes de l'Assemblée. En gris, leur équivalent chez les députés.
          </Text>
          {groupes.map((g, i) => {
            const pc = puce(g.position);
            return (
              <View
                key={g.sigle}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, ...(i ? { borderTopWidth: 1, borderTopColor: C.border } : { marginTop: 6 }) }}
              >
                <Pastille couleur={couleurDe(g)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>
                    {g.sigle} <Text style={[T.micro, { fontFamily: F.regular, color: C.textMuted }]}>{g.nom}</Text>
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 3 }}>
                    <Feather name="arrow-right" size={ICON.xs} color={C.textFaint} style={{ marginTop: 1 }} />
                    <Text style={[T.micro, { flex: 1, color: C.textFaint }]}>À l'Assemblée : {g.equivalentAN}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Chip label={pc.label} bg={pc.bg} fg={pc.fg} ph={9} />
                  {g.voix && <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 4 }]}>{decompteClair(g.voix)}</Text>}
                </View>
              </View>
            );
          })}
          {note && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              <Feather name="info" size={ICON.sm} color={C.textFaint} style={{ marginTop: 1 }} />
              <Text style={[T.micro, { flex: 1, color: C.textMuted }]}>{note}</Text>
            </View>
          )}
        </View>
      )}
    </Carte>
  );
}

/**
 * Le vote des députés sur une mesure proche : décomptes et groupes LUS dans les données du
 * scrutin (jamais saisis). Une ligne par groupe ayant voté, du plus « pour » au plus « contre »
 * (solde pour − contre rapporté aux voix du groupe ; à égalité, ordre de l'hémicycle).
 */
function DejaVoteAN({ lie, detail, onOuvrir }: { lie: ScrutinLie; detail: DetailScrutin; onOuvrir: () => void }) {
  const s = detail.scrutin;
  const groupes = detail.groupes
    .filter((g) => voix(g) > 0)
    .sort((a, b) => solde(b) - solde(a) || idxHemicycle(a.abrev) - idxHemicycle(b.abrev));

  return (
    <Carte>
      <Chip
        label="Déjà voté à l'Assemblée"
        bg={C.accentSoft}
        fg={C.accent}
        pv={4}
        gap={5}
        icon={<MaterialCommunityIcons name="history" size={ICON.xs} color={C.accent} />}
        style={{ alignSelf: "flex-start" }}
      />
      <Text style={[T.body, { fontFamily: F.extra, color: C.text, marginTop: 10 }]}>{lie.titre}</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 5, lineHeight: 18 }]}>{lie.description}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16, marginTop: 12, marginBottom: 9 }}>
        <Chiffre n={s.pour} label="pour" couleur={C.pour} />
        <Chiffre n={s.contre} label="contre" couleur={C.contre} />
        <Chiffre n={s.abstention} label="abstention" couleur={C.abstention} />
        <Text style={[T.micro, tnum, { marginLeft: "auto", color: C.textFaint }]}>{lie.dateLabel}</Text>
      </View>
      <Barre pour={s.pour} contre={s.contre} abstention={s.abstention} hauteur={8} />

      <View style={{ marginTop: 10 }}>
        {groupes.map((g) => (
          <View
            key={g.uid}
            accessible
            accessibilityLabel={`${g.libelle} : ${decompteClair(g)}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 6 }}
          >
            <Pastille couleur={couleurGroupe(g.couleur)} />
            <Text style={[T.small, { width: 74, fontFamily: F.bold, color: C.text }]} numberOfLines={1}>
              {g.abrev ?? g.libelle}
            </Text>
            <View style={{ flex: 1 }}>
              <Barre pour={g.pour} contre={g.contre} abstention={g.abstention} hauteur={6} />
            </View>
            <Text style={[T.micro, tnum, { width: 104, textAlign: "right", color: C.textMuted }]} numberOfLines={1}>
              {deuxPrincipaux(g)}
            </Text>
          </View>
        ))}
      </View>

      {lie.lecture && (
        <View style={{ marginTop: 10, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, paddingVertical: 10, paddingHorizontal: 11 }}>
          <Text style={[T.small, { color: C.text, lineHeight: 18 }]}>{lie.lecture}</Text>
        </View>
      )}
      {lie.avertissement && <Text style={[T.micro, { color: C.textFaint, marginTop: 8 }]}>{lie.avertissement}</Text>}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={onOuvrir}
        accessibilityRole="button"
        accessibilityLabel={`Voir le scrutin : ${lie.titre}`}
        style={{ alignSelf: "flex-start", minHeight: CONTROL.md, justifyContent: "center" }}
      >
        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le scrutin</Text>
      </TouchableOpacity>
    </Carte>
  );
}

/** Frise verticale du parcours du texte : fait (plein, coché), en cours (cerclé), à venir (cerclé clair). */
function Parcours({ etapes, procedure }: { etapes: Etape[]; procedure?: string }) {
  const etat = { fait: "fait", encours: "en cours", afaire: "à venir" } as const;
  return (
    <Carte>
      <Libelle>Où en est le texte</Libelle>
      {procedure && <Text style={[T.micro, { color: C.textFaint, marginTop: 3 }]}>{procedure}</Text>}
      <View style={{ marginTop: 12 }}>
        {etapes.map((e, i) => {
          const dernier = i === etapes.length - 1;
          return (
            <View key={e.etape} accessible accessibilityLabel={`${e.etape} : ${e.detail}, ${etat[e.etat]}`} style={{ flexDirection: "row", gap: 11 }}>
              <View style={{ width: 18, alignItems: "center" }}>
                <View
                  style={{
                    width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center",
                    ...(e.etat === "fait"
                      ? { backgroundColor: C.text }
                      : { borderWidth: 2, borderColor: e.etat === "encours" ? C.text : C.borderStrong, backgroundColor: C.surface }),
                  }}
                >
                  {e.etat === "fait" && <Feather name="check" size={11} color={C.surface} />}
                </View>
                {!dernier && <View style={{ flex: 1, width: 2, minHeight: 22, backgroundColor: C.borderStrong }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: dernier ? 0 : 8 }}>
                <Text style={[T.small, { fontFamily: F.bold, color: e.etat === "afaire" ? C.textMuted : C.text }]}>{e.etape}</Text>
                <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>{e.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Carte>
  );
}

// --- Briques ---------------------------------------------------------------------------------

function Carte({ children }: { children: React.ReactNode }) {
  return (
    <Card bordered raised={false} style={{ marginHorizontal: 16, marginTop: 12 }}>
      {children}
    </Card>
  );
}

function Libelle({ children }: { children: string }) {
  return <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>{children}</Text>;
}

function Pastille({ couleur }: { couleur: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleur }} />;
}

function Picto({ icone, size, color }: { icone: IconeFocus; size: number; color: string }) {
  return icone.famille === "feather" ? (
    <Feather name={icone.nom} size={size} color={color} />
  ) : (
    <MaterialCommunityIcons name={icone.nom} size={size} color={color} />
  );
}

function Chiffre({ n, label, couleur, grand }: { n: number; label: string; couleur: string; grand?: boolean }) {
  return (
    <View>
      <Text style={[grand ? T.title : T.heading, tnum, { fontFamily: F.extra, color: couleur }]}>{n}</Text>
      <Text style={[T.micro, { color: C.textMuted }]}>{label}</Text>
    </View>
  );
}

/** Barre horizontale proportionnelle pour / contre / abstention, sur piste neutre. */
function Barre({ pour, contre, abstention, hauteur }: Compte & { hauteur: number }) {
  return (
    <View style={{ flexDirection: "row", height: hauteur, borderRadius: RADIUS.pill, overflow: "hidden", backgroundColor: C.surfaceSunken }}>
      {pour > 0 && <View style={{ flex: pour, backgroundColor: C.pour }} />}
      {contre > 0 && <View style={{ flex: contre, backgroundColor: C.contre }} />}
      {abstention > 0 && <View style={{ flex: abstention, backgroundColor: C.abstention }} />}
    </View>
  );
}

/** Puce de position : mêmes couleurs que la ligne de groupe de la fiche scrutin. */
function puce(p: PositionGroupe): { label: string; bg: string; fg: string } {
  switch (p) {
    case "pour":
      return { label: "Pour", bg: C.adopteBg, fg: C.adopteFg };
    case "contre":
      return { label: "Contre", bg: C.rejeteBg, fg: C.rejeteFg };
    case "abstention":
      return { label: "Abstention", bg: C.surfaceSunken, fg: C.textMuted };
    default:
      return { label: "Non communiqué", bg: C.surfaceSunken, fg: C.textMuted };
  }
}

const voix = (g: GroupeVentilation) => g.pour + g.contre + g.abstention;
const solde = (g: GroupeVentilation) => (g.pour - g.contre) / voix(g);
const idxHemicycle = (ab: string | null) => {
  const i = ORDRE_HEMICYCLE.indexOf(ab ?? "");
  return i < 0 ? ORDRE_HEMICYCLE.length : i;
};

/** Les deux décomptes les plus nombreux du groupe, dans l'ordre pour · contre · abst. (« 10 pour · 18 contre »). */
function deuxPrincipaux(g: Compte): string {
  const parts = [
    { n: g.pour, l: "pour" },
    { n: g.contre, l: "contre" },
    { n: g.abstention, l: "abst." },
  ];
  const gardes = parts.filter((p) => p.n > 0).sort((a, b) => b.n - a.n).slice(0, 2);
  return parts.filter((p) => gardes.includes(p)).map((p) => `${p.n} ${p.l}`).join(" · ");
}
