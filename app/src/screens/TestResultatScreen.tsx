import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, couleurGroupe } from "../theme";
import { getTestProximite, getPartis, getCategories } from "../api";
import { catUI } from "../categoryUI";
import type { PartiResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { calculerProximite } from "../testProximite/score";
import { ScrutoirMark } from "../components/ScrutoirMark";
import { useFollow } from "../follows";
import { chargerTest, chargerPoids, sauverPoids, effacerTest, urlPartage } from "../testProximite/storage";

const NIVEAUX = [
  { label: "Peu", v: 0.5 },
  { label: "Normal", v: 1 },
  { label: "Fort", v: 2 },
];

// Libellé du cran courant (valeur affichée à droite du thème).
const NIV_LABEL = (v: number): string => (v <= 0.5 ? "Peu" : v >= 2 ? "Fort" : "Normal");

/**
 * Curseur « écart au neutre » d'un thème : 3 crans Peu / Normal / Fort sur un rail divergent.
 * Normal au centre (aucun remplissage). Vers Peu, le rail se remplit du centre vers la gauche ;
 * vers Fort, du centre vers la droite — même logique d'écart au neutre que `BarreDivergente`.
 * Repère central discret, pouce ardoise cerclé de la surface. Couleur = ardoise neutre (chrome,
 * pas une donnée). Cibles tactiles : 3 zones plein-hauteur (≥ 44 px) superposées au visuel.
 */
function CurseurPoids({ valeur, onChange }: { valeur: number; onChange: (v: number) => void }) {
  const niveau = valeur <= 0.5 ? 1 : valeur >= 2 ? 3 : 2;
  const th = [16, 50, 84][niveau - 1]; // position % du pouce
  const fill = niveau === 1 ? { left: th, width: 50 - th } : niveau === 3 ? { left: 50, width: th - 50 } : null;
  return (
    <View style={{ marginTop: 8 }}>
      {/* Visuel non interactif : rail, remplissage divergent, repère central, pouce. */}
      <View pointerEvents="none" style={{ height: 24, justifyContent: "center" }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surfaceSunken }} />
        {fill && <View style={{ position: "absolute", left: `${fill.left}%`, width: `${fill.width}%`, top: "50%", marginTop: -3, height: 6, borderRadius: 3, backgroundColor: C.accent }} />}
        <View style={{ position: "absolute", left: "50%", marginLeft: -1, top: "50%", marginTop: -6.5, width: 2, height: 13, borderRadius: 1, backgroundColor: C.borderStrong }} />
        <View style={{ position: "absolute", left: `${th}%`, marginLeft: -9, top: "50%", marginTop: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, borderWidth: 3, borderColor: C.surface }} />
      </View>
      {/* Libellés des crans (≥ 12 px ; l'actif en ardoise). */}
      <View pointerEvents="none" style={{ flexDirection: "row", marginTop: 4 }}>
        {NIVEAUX.map((n, i) => (
          <Text key={n.label} style={[T.small, { flex: 1, textAlign: i === 0 ? "left" : i === 2 ? "right" : "center", fontFamily: niveau === i + 1 ? F.bold : F.semibold, color: niveau === i + 1 ? C.accent : C.textFaint }]}>{n.label}</Text>
        ))}
      </View>
      {/* Cibles tactiles : 3 zones égales plein-hauteur, par-dessus le visuel. */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
        {NIVEAUX.map((n) => (
          <TouchableOpacity key={n.label} activeOpacity={0.7} onPress={() => onChange(n.v)} accessibilityRole="button" accessibilityLabel={`Poids ${n.label}`} style={{ flex: 1 }} />
        ))}
      </View>
    </View>
  );
}

// Nom court d'un groupe (1ʳᵉ partie avant « & » / « , ») pour le CTA « Suivre … ».
const nomCourt = (libelle: string) => libelle.split(/\s*[&,]\s*/)[0];

// Bloc « Et maintenant, explore » : 4 portes de sortie vers les autres lectures.
const EXPLORE: { label: string; icon?: string; picto?: boolean; route: { name: string } }[] = [
  { label: "Par thème", icon: "grid", route: { name: "testParTheme" } },
  { label: "Par scrutin", icon: "file-text", route: { name: "themes" } },
  { label: "Par parti", picto: true, route: { name: "partis" } },
  { label: "Par député", icon: "user", route: { name: "monDepute" } },
];

// Partage 100 % client (geste explicite de l'utilisateur). Le message vu côté destinataire
// est « Voici mon résultat … et toi ? » : le « et toi ? » est le ressort qui invite à faire
// le test. Style neutre, aucune couleur de parti, aucune donnée d'usage dans le lien (l'URL
// n'encode que les réponses/poids, recalculés à l'ouverture — cf. urlPartage/encoderPartage).
async function partager(url: string, texte: string): Promise<"shared" | "copied" | "manual"> {
  try {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) { await nav.share({ title: "Test de proximité — Scrutoir", text: texte, url }); return "shared"; }
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(`${texte}\n${url}`); return "copied"; }
  } catch { /* annulé / indisponible */ }
  return "manual";
}

export function TestResultatScreen({
  reponses: reponsesProp,
  poids: poidsProp,
  partage = false,
  nav,
}: {
  reponses?: Record<number, Reponse>;
  themesJoues?: string[];
  poids?: Record<string, number>;
  partage?: boolean;
  nav: Nav;
}) {
  const [all, setAll] = useState<QuestionProximite[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [partageMsg, setPartageMsg] = useState<string | null>(null);
  // Refonte « proposition 1 » : résultat replié au top-N, pondérations en accordéon replié.
  const [montrerTout, setMontrerTout] = useState(false);
  const [poidsOuvert, setPoidsOuvert] = useState(false);
  const [themesTous, setThemesTous] = useState(false);

  // Source des réponses : lien PARTAGÉ → la prop (lecture seule) ; sinon → MES réponses
  // accumulées dans le stockage local. Figées au montage (le résultat ne se réécrit pas seul).
  const reponses = useMemo(() => (partage ? reponsesProp ?? {} : chargerTest()?.reponses ?? {}), [partage, reponsesProp]);
  // Poids : partagé → ceux du lien ; sinon → MES poids persistés (jamais remis à zéro ici).
  const [poids, setPoids] = useState<Record<string, number>>(() => (partage ? { ...(poidsProp ?? {}) } : { ...chargerPoids() }));

  useEffect(() => {
    Promise.all([getTestProximite(), getPartis(), getCategories()]).then(([qs, ps, cs]) => {
      setAll(qs); setPartis(ps); setCats(cs);
    });
  }, []);

  // Questions réellement répondues + thèmes joués (dérivés → vaut pour un lien partagé aussi).
  const jouees = useMemo(() => (all ? all.filter((q) => reponses[q.id] != null) : []), [all, reponses]);
  const themes = useMemo(() => [...new Set(jouees.map((q) => q.theme))].sort(), [jouees]);

  // Complète les poids des thèmes pas encore réglés (défaut « Normal » = 1) SANS jamais
  // toucher aux thèmes déjà pondérés. Un passage de test ne réinitialise donc rien.
  useEffect(() => {
    if (!themes.length) return;
    setPoids((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of themes) if (next[t] == null) { next[t] = (partage ? poidsProp?.[t] : undefined) ?? 1; changed = true; }
      return changed ? next : prev;
    });
  }, [themes.join("|")]);

  // Changer un poids = choix utilisateur : on le persiste seul (hors mode partagé).
  const changerPoids = (theme: string, v: number) => {
    setPoids((prev) => {
      const next = { ...prev, [theme]: v };
      if (!partage) sauverPoids(next);
      return next;
    });
  };

  // « Réinitialiser les poids » : remet tous les thèmes joués sur Normal (les réponses, elles,
  // ne bougent pas). Distinct de « Repartir de zéro » qui efface tout.
  const reinitPoids = () => {
    setPoids((prev) => {
      const next = { ...prev };
      themes.forEach((t) => { next[t] = 1; });
      if (!partage) sauverPoids(next);
      return next;
    });
  };

  // « Repartir de zéro » : SEUL geste qui efface réponses + poids (jamais en sortie de test).
  const repartirDeZero = () => { effacerTest(); nav.push({ name: "testIntro" }); };

  const groupes = useMemo(() => partis.filter((p) => p.abrev).map((p) => ({ abrev: p.abrev! })), [partis]);
  const resultat = useMemo(
    () => (jouees.length && groupes.length ? calculerProximite(jouees, reponses, poids, groupes) : null),
    [jouees, reponses, poids, groupes]
  );

  // Groupe le plus proche (FIABLE : ≥ 2 votes comparés) — cible du CTA « Suivre ».
  const topAbrev = useMemo(() => {
    if (!resultat) return null;
    const comparable = (abrev: string) =>
      Object.values(resultat.parTheme).reduce((s, t) => s + (t[abrev]?.comparable ?? 0), 0);
    const fiables = resultat.global.filter((g) => comparable(g.abrev) >= 2);
    return (fiables[0] ?? resultat.global[0])?.abrev ?? null;
  }, [resultat]);
  const topParti = topAbrev ? partis.find((p) => p.abrev === topAbrev) : null;
  const [suiviTop, toggleSuiviTop] = useFollow(topParti?.uid ?? "");

  if (!resultat) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const couleur = (abrev: string) => partis.find((p) => p.abrev === abrev)?.couleur ?? C.textFaint;
  const libelle = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  const comparableTotal = (abrev: string) =>
    themes.reduce((s, t) => s + (resultat.parTheme[t]?.[abrev]?.comparable ?? 0), 0);
  const nbVotes = Object.values(reponses).filter((r) => r === "pour" || r === "contre").length;

  // Résumé NEUTRE et honnête : le groupe le plus proche, seulement s'il est fiable
  // (≥ 2 votes comparés, comme la matrice). Sinon, message sans groupe (pas de faux verdict).
  const resumePartage = (): string => {
    const top = [...resultat.global]
      .filter((g) => comparableTotal(g.abrev) >= 2)
      .sort((a, b) => b.pct - a.pct)[0];
    return top
      ? `Voici mon résultat : proche du groupe ${top.abrev} à ${Math.round(top.pct * 100)} %. Et toi ?`
      : `Voici mon résultat au test de proximité Scrutoir. Et toi ?`;
  };

  const onShare = async () => {
    const r = await partager(urlPartage(reponses, poids), resumePartage());
    setPartageMsg(r === "copied" ? "Lien copié !" : r === "shared" ? null : "Copie indisponible");
    if (r) setTimeout(() => setPartageMsg(null), 2500);
  };

  // Résultat replié : top-N parties, le reste derrière « Voir les N partis ».
  const TOP_N = 4;
  const total = resultat.global.length;
  const visibles = montrerTout ? resultat.global : resultat.global.slice(0, TOP_N);
  // Résumé de l'accordéon de pondérations (replié par défaut).
  const ajustes = themes.filter((t) => (poids[t] ?? 1) !== 1).length;
  const resumePoids = ajustes
    ? `${ajustes} thème${ajustes > 1 ? "s" : ""} ajusté${ajustes > 1 ? "s" : ""} · recalcul en direct`
    : "Tout sur Normal · ajuste pour recalculer";
  // Liste des pondérations : premiers thèmes repliés, le reste derrière « Voir les N thèmes ».
  const POIDS_N = 5;
  const themesVisibles = themesTous ? themes : themes.slice(0, POIDS_N);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <Text style={[T.title, { fontFamily: F.extra, color: C.text }]}>Ton point de départ</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 6, marginBottom: 16 }]}>
        De qui tu es proche, selon leurs votes — sur les {nbVotes} où tu t'es prononcé·e. Un spectre, pas un verdict.
      </Text>

      {/* Résultat : une carte, des rangées compactes (pastille · nom · barre · %). Top-N replié,
          le reste derrière « Voir les N partis ». Pastille discrète = échantillon faible (< 7). */}
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, overflow: "hidden", ...shadowCard }}>
        {visibles.map((g, i) => {
          const n = comparableTotal(g.abrev);
          const fiable = n >= 2;
          const faible = fiable && n < 7;
          const col = couleurGroupe(couleur(g.abrev));
          const dernier = i === visibles.length - 1;
          return (
            <View key={g.abrev} style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 11, paddingHorizontal: 12, ...(dernier ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }) }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fiable ? col : C.textFaint }} />
              <Text style={[T.small, { fontFamily: F.bold, color: C.text, width: 62 }]} numberOfLines={1}>{g.abrev}</Text>
              <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: C.surfaceSunken, overflow: "hidden" }}>
                {fiable && <View style={{ height: 7, borderRadius: 4, width: `${Math.round(g.pct * 100)}%`, backgroundColor: col }} />}
              </View>
              {/* Compteur de votes comparés : visible en liste dépliée (transparence) ou
                  toujours pour un échantillon faible (< 7), signalé par une pastille discrète. */}
              {fiable && (montrerTout || faible) && (
                <View style={faible ? { backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 } : undefined}>
                  <Text style={[T.micro, tnum, { color: faible ? C.textMuted : C.textFaint }]}>{n}</Text>
                </View>
              )}
              <Text style={[tnum, { fontFamily: F.extra, fontSize: 15, color: fiable ? C.text : C.textFaint, width: 44, textAlign: "right" }]}>
                {fiable ? `${Math.round(g.pct * 100)}%` : "—"}
              </Text>
            </View>
          );
        })}
        {total > TOP_N && (
          <TouchableOpacity onPress={() => setMontrerTout((v) => !v)} activeOpacity={0.7} style={{ paddingVertical: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: C.border }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
              {montrerTout ? "Réduire" : `Voir les ${total} partis ›`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reste au courant (suivi, version A) : relie explicitement le suivi au digest d'accueil. */}
      <View style={{ marginTop: 14, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 16, ...shadowCard }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
            <Feather name="bell" size={18} color={C.accent} />
          </View>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Reste au courant</Text>
        </View>
        <Text style={[T.small, { color: C.textMuted, marginTop: 9 }]}>
          Suis le parti dont tu es proche ou ton député pour retrouver leurs nouveaux votes sur ton accueil.
        </Text>
        {topParti && (
          <TouchableOpacity
            onPress={toggleSuiviTop}
            activeOpacity={0.85}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 13, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: suiviTop ? C.surfaceAlt : C.accent, borderWidth: suiviTop ? 1 : 0, borderColor: C.borderStrong }}
          >
            <Feather name={suiviTop ? "check" : "bell"} size={17} color={suiviTop ? C.text : "#fff"} />
            <Text style={[T.small, { fontFamily: F.bold, color: suiviTop ? C.text : "#fff" }]}>
              {suiviTop ? `Tu suis ${nomCourt(topParti.libelle)}` : `Suivre ${nomCourt(topParti.libelle)}`}
            </Text>
          </TouchableOpacity>
        )}
        {/* L'app ne mémorise pas le député de l'utilisateur → « Trouver ton député » vers monDepute. */}
        <TouchableOpacity
          onPress={() => nav.push({ name: "monDepute" })}
          activeOpacity={0.8}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.accent }}
        >
          <Feather name="user" size={17} color={C.accent} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Trouver ton député</Text>
        </TouchableOpacity>
      </View>

      {/* Bloc explore : prolonge le « je » vers les autres lectures. */}
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 24, marginBottom: 12 }]}>Et maintenant, explore</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {EXPLORE.map((e) => (
          <TouchableOpacity
            key={e.label}
            activeOpacity={0.8}
            onPress={() => nav.push(e.route as any)}
            style={{ width: "47.8%", flexGrow: 1, alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 18, borderWidth: 1, borderColor: C.border, ...shadowCard }}
          >
            {e.picto ? (
              <ScrutoirMark size={26} color={C.text} accent={C.accent} />
            ) : (
              <Feather name={e.icon as any} size={22} color={C.accent} />
            )}
            <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ce qui compte pour toi : accordéon REPLIÉ par défaut (réglage ponctuel, ne doit pas
          occuper la page). À l'ouverture : segmentés Peu/Normal/Fort, recalcul du global en direct. */}
      <View style={{ marginTop: 24 }}>
        <TouchableOpacity
          onPress={() => setPoidsOuvert((v) => !v)}
          activeOpacity={0.8}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 14, ...shadowCard }}
        >
          <Feather name="sliders" size={19} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Ce qui compte pour toi</Text>
            <Text style={[T.micro, { color: C.textMuted, marginTop: 2 }]}>{resumePoids}</Text>
          </View>
          <Feather name={poidsOuvert ? "chevron-up" : "chevron-down"} size={18} color={C.textFaint} />
        </TouchableOpacity>
        {poidsOuvert && (
          <View style={{ marginTop: 12 }}>
            <Text style={[T.small, { color: C.textMuted, marginBottom: 8 }]}>Donne plus ou moins de poids à un thème, le classement se recalcule.</Text>
            <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, ...shadowCard }}>
              {themesVisibles.map((t, i) => {
                const dernier = i === themesVisibles.length - 1;
                return (
                  <View key={t} style={{ flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12, ...(dernier ? {} : { borderBottomWidth: 1, borderBottomColor: C.surfaceSunken }) }}>
                    {/* Tuile icône de catégorie, teinte NEUTRE (le chrome n'encode pas de donnée). */}
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name={catUI(t).icon as any} size={17} color={C.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                        <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: C.text }]} numberOfLines={2}>{libelle(t)}</Text>
                        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{NIV_LABEL(poids[t] ?? 1)}</Text>
                      </View>
                      <CurseurPoids valeur={poids[t] ?? 1} onChange={(v) => changerPoids(t, v)} />
                    </View>
                  </View>
                );
              })}
            </View>
            {themes.length > POIDS_N && (
              <TouchableOpacity onPress={() => setThemesTous((v) => !v)} activeOpacity={0.7} style={{ alignItems: "center", paddingVertical: 11 }}>
                <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{themesTous ? "Réduire" : `Voir les ${themes.length} thèmes ›`}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={reinitPoids} activeOpacity={0.7} style={{ alignItems: "center", paddingVertical: 6, marginTop: themes.length > POIDS_N ? 0 : 8 }}>
              <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Réinitialiser les poids</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Partage (100 % client) + recommencer */}
      <TouchableOpacity onPress={onShare} activeOpacity={0.85} style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9, marginTop: 22, backgroundColor: C.accent, borderRadius: RADIUS.md, paddingVertical: 14, ...shadowCard }}>
        <Feather name="share-2" size={18} color="#fff" />
        <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>{partageMsg ?? "Partager mon résultat"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={repartirDeZero} activeOpacity={0.7} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Repartir de zéro</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
