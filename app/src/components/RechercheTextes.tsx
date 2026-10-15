import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL, tnum, shadowCard, inputText } from "../theme";
import { Card, Button } from "./ui";
import { TexteLigne, Filet, LienListe } from "./texteUI";
import { ErreurChargement } from "./ErreurChargement";
import { rechercher } from "../api";
import { rechercherSujet } from "../search/fusion";
import { routerIntention } from "../search/intent";
import { motsCles, normaliser } from "../search/normalize";
import { suggererThemes } from "../search/suggestions";
import { embedderEstPret } from "../search/embedder";
import { useSemantique } from "../hooks/useSemantique";
import { rechercherTextes, phraseResultats, statutCarte, dateCourte } from "../textes";
import { aujourdhuiParis, type IndexTextes, type TexteFil } from "../hebdo";
import { track } from "../analytics";
import type { CategorieRef, DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";

// Sous-onglet « Recherche » de l'onglet Scrutins (par défaut). Maquette validée le 15/10/2026
// (`maquette-onglet-scrutins-recherche-textes.html`, écrans D1 et A2) : la barre seule dans un
// bloc sombre ; ce qu'on tape donne les résultats REGROUPÉS PAR TEXTE, puis les députés. La
// recherche par sujet (sémantique + mot-clé, consentement au modèle) reste, rangée par texte.

const EXEMPLES = ["Pouvoir d'achat", "Santé", "Europe", "Médicaments", "Logement", "Écologie"];
const TEXTES_VISIBLES = 8; // textes affichés avant « Voir les N autres »
const DEPUTES_VISIBLES = 5;
const MO = (n: number) => Math.max(1, Math.round(n / 1048576));

type Sujet = { terme: string; textes: { t: TexteFil; motCle: string | null }[]; chargement: boolean; optin: boolean };
const SUJET_VIDE: Sujet = { terme: "", textes: [], chargement: false, optin: false };

// Dernière saisie mesurée, au niveau du MODULE : l'onglet est démonté quand on ouvre un texte et
// remonté au retour avec la même saisie (mémoire de session) ; elle ne doit pas compter deux fois.
let dernierSuivi = "";

export function RechercheTextes({
  q,
  onQ,
  index,
  erreur,
  onRetry,
  cats,
  nav,
}: {
  q: string;
  onQ: (q: string) => void;
  index: IndexTextes | null;
  erreur: boolean;
  onRetry: () => void;
  cats: CategorieRef[];
  nav: Nav;
}) {
  const [focus, setFocus] = useState(false);
  // Saisie « posée » (250 ms) : la liste ne clignote pas à chaque frappe.
  const [terme, setTerme] = useState(q.trim());
  useEffect(() => {
    const id = setTimeout(() => setTerme(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const vide = !q.trim();

  const exact = useMemo(() => (index && terme.length >= 2 ? rechercherTextes(terme, index) : null), [index, terme]);
  // Résultats asynchrones ÉTIQUETÉS par leur saisie : ceux d'une saisie précédente ne se mêlent
  // jamais à la nouvelle (affichage, mesure d'audience).
  const [deputesDe, setDeputesDe] = useState<{ terme: string; liste: DeputeResume[] } | null>(null);
  useEffect(() => {
    if (terme.length < 2) return;
    let vivant = true;
    rechercher(terme)
      .then((r) => vivant && setDeputesDe({ terme, liste: r.deputes }))
      .catch(() => vivant && setDeputesDe({ terme, liste: [] }));
    return () => {
      vivant = false;
    };
  }, [terme]);
  const deputes = deputesDe?.terme === terme ? deputesDe.liste : null;

  // Mesure d'audience : même événement que la recherche de l'accueil, une fois par saisie posée.
  useEffect(() => {
    if (!exact || deputes == null || dernierSuivi === terme) return;
    dernierSuivi = terme;
    track(exact.textes.length + deputes.length ? "search" : "search_empty", terme.toLowerCase().slice(0, 40));
  }, [exact, deputes, terme]);

  // Recherche par sujet (sémantique si le modèle est accepté, sinon mot-clé seul), rangée par texte,
  // sans les textes déjà trouvés par l'intitulé.
  const sem = useSemantique();
  const [sujetDe, setSujet] = useState<Sujet>(SUJET_VIDE);
  const sujet = sujetDe.terme === terme ? sujetDe : SUJET_VIDE;
  const [nbTextes, setNbTextes] = useState(TEXTES_VISIBLES);
  const [tousDeputes, setTousDeputes] = useState(false);
  useEffect(() => {
    setNbTextes(TEXTES_VISIBLES);
    setTousDeputes(false);
  }, [terme]);
  useEffect(() => {
    setSujet(SUJET_VIDE);
    if (!index || !exact || terme.length < 2 || sem.active === null) return;
    let vivant = true;
    const avecModele = sem.active === true;
    if (avecModele) setSujet({ ...SUJET_VIDE, terme, chargement: true });
    const dejaVus = new Set(exact.textes.map((x) => x.texte.cle));
    const parCle = new Map(index.textes.map((t) => [t.cle, t]));
    rechercherSujet(terme, exact.scrutins as ScrutinResume[], { sansModele: !avecModele })
      .then(({ sujet: scrs, lexicalUids }) => {
        if (!vivant) return;
        const lex = new Set(lexicalUids);
        const mot = motsCles(terme).join(", ");
        const textes: Sujet["textes"] = [];
        for (const s of scrs) {
          const cle = index.cleDe.get(s.uid);
          const t = cle ? parCle.get(cle) : undefined;
          if (!t || dejaVus.has(t.cle)) continue;
          dejaVus.add(t.cle);
          textes.push({ t, motCle: lex.has(s.uid) && mot ? mot : null });
        }
        setSujet({ terme, textes, chargement: false, optin: !avecModele && routerIntention(terme).type === "sujet" });
      })
      .catch(() => vivant && setSujet({ ...SUJET_VIDE, terme }));
    return () => {
      vivant = false;
    };
  }, [index, exact, terme, sem.active]);

  const auj = aujourdhuiParis();
  const correction = useMemo(() => {
    const s = routerIntention(q.trim()).suggestion;
    return s && s !== q.trim() ? s : null;
  }, [q]);
  const themes = suggererThemes(q.trim(), cats);
  const ouvrir = (t: TexteFil) => nav.push({ name: "dossierScrutins", ref: t.cle, titre: t.titre });
  const nomTrouve = !!deputes?.some((d) => normaliser(d.nom_complet).includes(normaliser(terme)));
  // « Rien de probant » seulement une fois TOUT revenu pour cette saisie (sujet compris).
  const rien = !!exact && !exact.textes.length && deputes?.length === 0 && sujetDe.terme === terme && !sujet.textes.length && !sujet.chargement && !sujet.optin;

  const blocTextes = exact && exact.textes.length > 0 && (
    <View key="textes">
      <Text accessibilityRole="header" style={[T.heading, { color: C.text, marginTop: S.s20, marginBottom: S.s10 }]}>Les textes</Text>
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
        {exact.textes.slice(0, nbTextes).map(({ texte: t, citations }, i) => (
          <View key={t.cle}>
            {i > 0 && <Filet />}
            <TexteLigne
              t={t}
              statut={statutCarte(t, auj)}
              date={dateCourte(t.derniereDate, null)}
              barre
              note={citations > 0 && citations < t.nb ? `${citations} de ses scrutins ${citations > 1 ? "citent" : "cite"} « ${terme} »` : null}
              onPress={() => ouvrir(t)}
            />
          </View>
        ))}
      </Card>
      {exact.textes.length > nbTextes && (
        <Button label={`Voir les ${exact.textes.length - nbTextes} autres textes`} variant="text" size="sm" onPress={() => setNbTextes((n) => n + 20)} style={{ alignSelf: "flex-start", marginTop: S.s4 }} />
      )}
      {exact.scrutins.length > 0 && (
        <LienListe
          label={`${exact.scrutins.length > 1 ? `Les ${exact.scrutins.length} scrutins qui citent` : "Le scrutin qui cite"} « ${terme} »`}
          onPress={() => nav.push({ name: "scrutinsListe", q: terme })}
        />
      )}
    </View>
  );

  const blocDeputes = !!deputes?.length && (
    <View key="deputes">
      <Text accessibilityRole="header" style={[T.heading, { color: C.text, marginTop: S.s20, marginBottom: S.s10 }]}>Les députés</Text>
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
        {(tousDeputes ? deputes : deputes.slice(0, DEPUTES_VISIBLES)).map((d, i) => (
          <View key={d.uid}>
            {i > 0 && <Filet retrait={66} />}
            <TouchableOpacity
              onPress={() => nav.push({ name: "depute", uid: d.uid })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Voir la fiche de ${d.nom_complet}${d.abrev ? `, ${d.abrev}` : ""}`}
              style={{ flexDirection: "row", alignItems: "center", gap: S.s12, paddingHorizontal: S.s14, paddingVertical: S.s10, minHeight: 60 }}
            >
              <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: C.surfaceAlt }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{d.nom_complet}</Text>
                <Text style={[T.small, { color: C.textMuted }]} numberOfLines={1}>{d.abrev ?? "Sans groupe"}</Text>
              </View>
              <Feather name="chevron-right" size={ICON.base} color={C.textFaint} />
            </TouchableOpacity>
          </View>
        ))}
      </Card>
      {deputes.length > DEPUTES_VISIBLES && !tousDeputes && (
        <Button label={`Voir les ${deputes.length - DEPUTES_VISIBLES} autres députés`} variant="text" size="sm" onPress={() => setTousDeputes(true)} style={{ alignSelf: "flex-start", marginTop: S.s4 }} />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* UN SEUL arbre : le champ reste monté au même endroit (sinon il perd le focus à la 1re
          lettre). Seuls son habillage et ce qui l'entoure changent entre l'accueil et les résultats. */}
      {vide && <View style={{ flex: 1 }} />}
      <View
        style={
          vide
            ? { marginHorizontal: S.s16, backgroundColor: C.heroBg, borderRadius: RADIUS.xl, paddingHorizontal: S.s18, paddingTop: S.s20, paddingBottom: S.s18 }
            : { paddingHorizontal: S.s16, paddingTop: S.s12 }
        }
      >
        {vide && (
          <Text accessibilityRole="header" style={[T.title, { color: C.onHero }]}>Sur quoi ils ont voté ?</Text>
        )}
        {vide && <Text style={[T.small, { color: C.onHeroMuted, marginTop: S.s4 }]}>Tape ce que tu veux : un sujet, une loi ou un nom</Text>}
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: S.s10, height: 52, marginTop: vide ? S.s14 : 0,
            backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: S.s14,
            borderWidth: vide ? 0 : 1, borderColor: focus ? C.accent : C.borderStrong,
            ...(vide ? null : shadowCard),
          }}
        >
          <Feather name="search" size={ICON.lg} color={C.text} />
          <TextInput
            value={q}
            onChangeText={onQ}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            placeholder="Retraites, budget, nucléaire…"
            placeholderTextColor={C.textFaint}
            accessibilityLabel="Rechercher un vote"
            returnKeyType="search"
            autoCorrect={false}
            style={[inputText, { flex: 1, minWidth: 0, color: C.text, outlineStyle: "none" }] as any}
          />
          {!vide && (
            <TouchableOpacity onPress={() => onQ("")} hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
              <Feather name="x" size={ICON.base} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {vide && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.s8, marginTop: S.s12 }}>
            {EXEMPLES.map((e) => (
              <TouchableOpacity
                key={e}
                onPress={() => onQ(e)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Chercher : ${e}`}
                style={{ minHeight: CONTROL.sm, justifyContent: "center", paddingHorizontal: S.s14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.heroTrack }}
              >
                <Text style={[T.small, { fontFamily: F.bold, color: C.onHero }]}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {vide ? (
        <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s14, paddingHorizontal: S.s32 }]}>
          Les résultats sont regroupés par texte de loi, puis les députés.
        </Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.s16, paddingBottom: S.s40 }}>
          {correction && (
            <TouchableOpacity onPress={() => onQ(correction)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: "center", marginTop: S.s6 }}>
              <Text style={[T.small, { color: C.textMuted }]}>
                Tu voulais dire : <Text style={{ fontFamily: F.bold, color: C.accent }}>{correction}</Text> ?
              </Text>
            </TouchableOpacity>
          )}
          {themes.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.s8, marginTop: S.s10 }}>
              {themes.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => nav.push({ name: "categorie", id: t.id, libelle: t.libelle })}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir le thème ${t.libelle}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: S.s6, minHeight: CONTROL.sm, paddingHorizontal: S.s12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface }}
                >
                  <Feather name="grid" size={ICON.xs} color={C.accent} />
                  <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Thème : {t.libelle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {erreur && !index ? (
            <ErreurChargement onRetry={onRetry} compact />
          ) : q.trim().length < 2 ? (
            <Text style={[T.small, { color: C.textMuted, marginTop: S.s12 }]}>Tape au moins deux lettres.</Text>
          ) : !exact ? (
            <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s32 }} />
          ) : (
            <>
              <Text style={[T.small, tnum, { color: C.textMuted, marginTop: S.s12 }]}>
                {phraseResultats(exact.textes.length, exact.scrutins.length, terme, deputes?.length)}
              </Text>
              {/* Un nom de député : les députés d'abord. Sinon les textes, puis les députés. */}
              {nomTrouve ? [blocDeputes, blocTextes] : [blocTextes, blocDeputes]}

              {(sujet.textes.length > 0 || sujet.chargement) && (
                <View>
                  <Text accessibilityRole="header" style={[T.heading, { color: C.text, marginTop: S.s24 }]}>Sur le même sujet</Text>
                  <Text style={[T.small, { color: C.textMuted, marginTop: 2, marginBottom: S.s10 }]}>Textes liés, même sans le mot dans leur intitulé</Text>
                  {sujet.chargement ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
                      <ActivityIndicator size="small" color={C.textFaint} />
                      <Text style={[T.small, { color: C.textMuted }]}>
                        {embedderEstPret()
                          ? "Recherche par sujet…"
                          : sem.progres && sem.progres.loaded < sem.progres.total
                            ? `Téléchargement du modèle… ${MO(sem.progres.loaded)} / ${MO(sem.progres.total)} Mo`
                            : "Préparation de la recherche par sujet (une seule fois)…"}
                      </Text>
                    </View>
                  ) : (
                    <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
                      {sujet.textes.map(({ t, motCle }, i) => (
                        <View key={t.cle}>
                          {i > 0 && <Filet />}
                          <TexteLigne t={t} statut={statutCarte(t, auj)} date={dateCourte(t.derniereDate, null)} note={motCle ? `Mentionne « ${motCle} »` : null} onPress={() => ouvrir(t)} />
                        </View>
                      ))}
                    </Card>
                  )}
                </View>
              )}

              {sujet.optin && (
                <Card padding={S.s16} radius={RADIUS.lg} bordered style={{ marginTop: S.s24 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
                    <Feather name="compass" size={ICON.sm} color={C.accent} />
                    <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>Recherche par sujet</Text>
                  </View>
                  <Text style={[T.small, { color: C.textMuted, marginTop: S.s6 }]}>
                    Trouve les textes liés à ton sujet, même sans le mot exact. Nécessite le téléchargement d'un modèle d'environ 120 Mo, une seule fois, Wi-Fi conseillé.
                  </Text>
                  {sem.stockKo ? (
                    <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: S.s10 }]}>
                      Espace de stockage insuffisant sur cet appareil (~300 Mo nécessaires).
                    </Text>
                  ) : (
                    <Button
                      label="Activer"
                      onPress={sem.activer}
                      variant="primary"
                      size="sm"
                      accessibilityLabel="Activer la recherche par sujet (téléchargement d'environ 120 mégaoctets)"
                      style={{ alignSelf: "flex-start", marginTop: S.s12 }}
                    />
                  )}
                </Card>
              )}

              {rien && (
                <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s32 }]}>
                  Rien de probant. Reformule, ou essaie un thème plus large.
                </Text>
              )}
            </>
          )}
        </ScrollView>
      )}
      {vide && <View style={{ flex: 1.4 }} />}
    </View>
  );
}
