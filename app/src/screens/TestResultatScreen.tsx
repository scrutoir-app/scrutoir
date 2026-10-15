import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, couleurGroupe } from "../theme";
import { Card, Button } from "../components/ui";
import { getTestProximite, getPartis, getCategories } from "../api";
import { catUI } from "../categoryUI";
import { SEUIL_FIABILITE } from "../config";
import type { PartiResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { calculerProximite } from "../testProximite/score";
import { lignesSpectre, surNVotes, phraseBase, phraseMarge, type LigneSpectre } from "../testProximite/spectre";
import { nbNeuves, SEUIL_AFFINER } from "../testProximite/config";
import { useFollow, useFollows } from "../hooks/useFollows";
import { tourAccueilAFaire } from "../accueilTourPrefs";
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

// Nom court d'un groupe (1ʳᵉ partie avant « & » / « , ») pour les libellés « Suivre … ».
const nomCourt = (libelle: string) => libelle.split(/\s*[&,]\s*/)[0];

// Cloche « suivre » posée sur chaque ligne du spectre : SEULE voie de suivi depuis le résultat
// (plus aucun suivi silencieux). Câblée sur le VRAI état de suivi (`useFollow`, même store que
// la fiche parti et l'accueil). uid = PO… du groupe (depuis `getPartis`, abrev → uid). Mesure
// SANS uid (`sansUid`) : ici, le groupe suivi laisserait deviner le résultat du test.
function SuivreGroupe({ uid, nom }: { uid: string; nom: string }) {
  const [suivi, toggle] = useFollow(uid, { sansUid: true });
  if (!uid) return <View style={{ width: 44 }} />;
  return (
    <TouchableOpacity
      onPress={toggle}
      accessibilityRole="button"
      accessibilityState={{ selected: suivi }}
      accessibilityLabel={suivi ? `Ne plus suivre ${nom}` : `Suivre ${nom}`}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ width: 30, height: 30, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", backgroundColor: suivi ? C.accent : "transparent" }}>
        <Feather name="bell" size={18} color={suivi ? C.onAccent : C.textFaint} />
      </View>
    </TouchableOpacity>
  );
}

// Piste hachurée d'une ligne sous le seuil : pas de barre, pas de %, juste « pas assez ».
function PisteHachuree() {
  return (
    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceSunken, overflow: "hidden", flexDirection: "row", gap: 4 }}>
      {Array.from({ length: 30 }, (_, i) => <View key={i} style={{ width: 6, height: 8, backgroundColor: C.borderStrong }} />)}
    </View>
  );
}

/** Une ligne du spectre : pastille · nom + « sur N votes » · barre · % · cloche. Sous le seuil :
 *  ligne grise, piste hachurée et « pas assez de votes » à la place de la barre, du % et de la
 *  cloche (comme la maquette ; ces groupes restent suivables depuis l'onglet Partis). */
function LigneGroupe({ ligne, couleur, uid, nom, filet }: { ligne: LigneSpectre; couleur: string; uid: string; nom: string; filet: boolean }) {
  const fiable = ligne.pct != null;
  const pct = Math.round((ligne.pct ?? 0) * 100);
  return (
    <>
      {filet && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 38 }} />}
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingLeft: 14, paddingRight: fiable ? 6 : 12 }}>
        <View
          accessible
          accessibilityLabel={`${ligne.abrev} : ${fiable ? `${pct} %` : "pas assez de votes"}, ${surNVotes(ligne.votes)}`}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: fiable ? couleur : C.borderStrong }} />
          <View style={{ width: 86 }}>
            <Text style={[T.body, { fontFamily: F.bold, lineHeight: 20, color: fiable ? C.text : C.textFaint }]} numberOfLines={1}>{ligne.abrev}</Text>
            <Text style={[T.micro, tnum, { color: C.textFaint }]}>{surNVotes(ligne.votes)}</Text>
          </View>
          {fiable ? (
            <>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceSunken, overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: couleur }} />
              </View>
              <Text style={[T.body, tnum, { fontFamily: F.extra, color: C.text, width: 46, textAlign: "right" }]}>{pct} %</Text>
            </>
          ) : (
            <>
              <PisteHachuree />
              <Text style={[T.micro, { color: C.textFaint, textAlign: "right" }]} numberOfLines={1}>pas assez de votes</Text>
            </>
          )}
        </View>
        {fiable && <SuivreGroupe uid={uid} nom={nom} />}
      </View>
    </>
  );
}

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
  // Spectre : ≥ SEUIL_FIABILITE votes comparés → % ; en dessous → ligne grise en bas, sans %.
  const lignes = useMemo(() => (resultat ? lignesSpectre(resultat, groupes.map((g) => g.abrev)) : null), [resultat, groupes]);
  // Sortie de fin de parcours : si l'utilisateur suit déjà au moins un parti/député, son
  // accueil aura ses suivis → « Voir mon accueil » ; sinon « Découvrir l'appli ». Réactif :
  // suivre un groupe par sa cloche bascule le libellé.
  const aSuivi = useFollows().length > 0;
  const tourAFaire = useMemo(() => tourAccueilAFaire(), []);

  if (!resultat || !lignes) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const couleur = (abrev: string) => couleurGroupe(partis.find((p) => p.abrev === abrev)?.couleur ?? null);
  const uidDe = (abrev: string) => partis.find((p) => p.abrev === abrev)?.uid ?? "";
  const nomDe = (abrev: string) => nomCourt(partis.find((p) => p.abrev === abrev)?.libelle ?? abrev);
  const libelle = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  // Base de tout le résultat : les scrutins (encore au catalogue) où tu as tranché, pour ou contre.
  const nbTranches = jouees.filter((q) => reponses[q.id] === "pour" || reponses[q.id] === "contre").length;
  // « Affiner » seulement s'il reste assez de scrutins neufs (jamais pour un lien partagé).
  const peutAffiner = !partage && !!all && nbNeuves(all, reponses) >= SEUIL_AFFINER;

  // Message du partage, NEUTRE et honnête : le groupe le plus proche seulement s'il passe le
  // seuil (même règle que l'écran : pas de % sous SEUIL_FIABILITE votes comparés).
  const resumePartage = (): string => {
    const top = lignes.fiables[0];
    return top
      ? `Voici mon résultat : proche du groupe ${top.abrev} à ${Math.round(top.pct! * 100)} %. Et toi ?`
      : `Voici mon résultat au test de proximité Scrutoir. Et toi ?`;
  };

  // Partage : uniquement sur ce geste explicite (rien ne part avant).
  const onShare = async () => {
    const r = await partager(urlPartage(reponses, poids), resumePartage());
    setPartageMsg(r === "copied" ? "Lien copié !" : r === "shared" ? null : "Copie indisponible");
    if (r) setTimeout(() => setPartageMsg(null), 2500);
  };

  // Résultat replié : les TOP_N groupes au-dessus du seuil, puis les lignes grises ; le reste
  // derrière « Voir les N groupes ».
  const TOP_N = 4;
  const total = lignes.fiables.length + lignes.faibles.length;
  const visibles = [...(montrerTout ? lignes.fiables : lignes.fiables.slice(0, TOP_N)), ...lignes.faibles];
  const repliable = lignes.fiables.length > TOP_N;
  // Résumé de l'accordéon de pondérations (replié par défaut).
  const ajustes = themes.filter((t) => (poids[t] ?? 1) !== 1).length;
  const resumePoids = ajustes ? `${ajustes} thème${ajustes > 1 ? "s" : ""} ajusté${ajustes > 1 ? "s" : ""}` : "Tous les thèmes au même poids";
  // Liste des pondérations : premiers thèmes repliés, le reste derrière « Voir les N thèmes ».
  const POIDS_N = 5;
  const themesVisibles = themesTous ? themes : themes.slice(0, POIDS_N);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={[T.title, { color: C.text, marginHorizontal: 2 }]}>Ton point de départ</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 6, marginBottom: 14, marginHorizontal: 2 }]}>{phraseBase(nbTranches)}</Text>

      {/* Spectre : une carte, une ligne par groupe (« sur N votes » sous le nom). Sous le seuil,
          lignes grises en bas, sans %. Top-N replié. */}
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
        {visibles.map((l, i) => (
          <LigneGroupe key={l.abrev} ligne={l} couleur={couleur(l.abrev)} uid={uidDe(l.abrev)} nom={nomDe(l.abrev)} filet={i > 0} />
        ))}
        {repliable && (
          <TouchableOpacity
            onPress={() => setMontrerTout((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: montrerTout }}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: C.border }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{montrerTout ? "Réduire" : `Voir les ${total} groupes`}</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Marge d'erreur, dite en une phrase, puis de quoi l'élargir. */}
      <Text style={[T.small, { color: C.textMuted, marginTop: 10, marginHorizontal: 2 }]}>{phraseMarge(nbTranches, SEUIL_FIABILITE)}</Text>
      {peutAffiner && (
        <TouchableOpacity
          onPress={() => nav.push({ name: "test", mode: "affiner" })}
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginHorizontal: 2 }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Affiner mon spectre</Text>
        </TouchableOpacity>
      )}

      {/* Deux entrées en liste : trouver son député (action distincte, l'app ne le mémorise pas)
          et les pondérations par thème (accordéon replié, recalcul du spectre en direct). */}
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden", marginTop: peutAffiner ? 6 : 16 }}>
        <LigneListe icon="user" titre="Trouver ton député" sousTitre="Par code postal ou par commune" chevron="chevron-right" onPress={() => nav.push({ name: "monDepute" })} />
        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 60 }} />
        <LigneListe
          icon="sliders"
          titre="Ce qui compte pour toi"
          sousTitre={resumePoids}
          chevron={poidsOuvert ? "chevron-up" : "chevron-down"}
          expanded={poidsOuvert}
          onPress={() => setPoidsOuvert((v) => !v)}
        />
        {poidsOuvert && (
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
            <Text style={[T.small, { color: C.textMuted }]}>Donne plus ou moins de poids à un thème, le spectre se recalcule.</Text>
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
            {themes.length > POIDS_N && (
              <Button label={themesTous ? "Réduire" : `Voir les ${themes.length} thèmes`} onPress={() => setThemesTous((v) => !v)} variant="text" size="sm" fullWidth />
            )}
            <Button label="Réinitialiser les poids" onPress={reinitPoids} variant="text" size="sm" muted fullWidth />
          </View>
        )}
      </Card>

      {/* Sortie de fin de parcours : entrer dans l'appli, SANS suivi silencieux (on ne suit
          que par les cloches du spectre). Puis le partage, sur geste explicite, avec ce qu'il
          contient. « Repartir de zéro » en lien discret. */}
      <Button
        label={aSuivi ? "Voir mon accueil" : "Découvrir l'appli"}
        onPress={() => nav.reset({ name: "search" })}
        variant="primary"
        fullWidth
        iconLeft={<Feather name={aSuivi ? "home" : "compass"} size={18} />}
        style={{ marginTop: 20 }}
      />
      {!aSuivi && (
        <Text style={[T.micro, { color: C.textFaint, textAlign: "center", marginTop: 6, marginHorizontal: 4, lineHeight: 15 }]}>
          {tourAFaire ? "Une visite guidée de l'accueil t'attend. " : ""}Quand tu suis un élu ou un groupe, ce bouton devient « Voir mon accueil ».
        </Text>
      )}
      <Button
        label={partageMsg ?? "Partager mon résultat"}
        onPress={onShare}
        variant="outline"
        fullWidth
        iconLeft={<Feather name="share" size={18} />}
        style={{ marginTop: 10 }}
      />
      <Text style={[T.micro, { color: C.textFaint, textAlign: "center", marginTop: 6, marginHorizontal: 4, lineHeight: 15 }]}>
        Le lien contient tes réponses : toute personne qui l'ouvre les voit.
      </Text>
      <Button label="Repartir de zéro" onPress={repartirDeZero} variant="text" size="sm" muted fullWidth style={{ marginTop: 4 }} />
    </ScrollView>
  );
}

/** Entrée de liste : tuile-icône · titre + sous-titre · chevron (lien ou accordéon). */
function LigneListe({ icon, titre, sousTitre, chevron, expanded, onPress }: { icon: any; titre: string; sousTitre: string; chevron: any; expanded?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={expanded == null ? undefined : { expanded }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={18} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { fontFamily: F.bold, lineHeight: 20, color: C.text }]}>{titre}</Text>
        <Text style={[T.small, { color: C.textFaint }]}>{sousTitre}</Text>
      </View>
      <Feather name={chevron} size={16} color={C.textFaint} />
    </TouchableOpacity>
  );
}
