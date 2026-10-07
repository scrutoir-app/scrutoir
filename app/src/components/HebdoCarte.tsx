import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Platform, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, CONTROL, ICON, tnum } from "../theme";
import { catUI } from "../categoryUI";
import { useSemaineAccueil } from "../hooks/useHebdo";
import { getEditionLue, marquerEditionLue } from "../hebdoPrefs";
import { libelleFenetre, libelleReprise, libelleScrutins, type ThemeHebdo, type TexteHebdo } from "../hebdo";
import type { Nav } from "../nav";

const SIDE = 16;
const GAP = 10;
const VISIBLES = 2; // textes visibles par carte avant « Voir … »
// Web : React Native Web ignore snapToInterval ; le calage sur une carte passe par le CSS
// scroll-snap (la marge de gauche du contenu est reprise par scrollPaddingLeft).
const SNAP_LISTE = (Platform.OS === "web" ? { scrollSnapType: "x mandatory", scrollPaddingLeft: SIDE } : {}) as unknown as ViewStyle;
const SNAP_CARTE = (Platform.OS === "web" ? { scrollSnapAlign: "start" } : {}) as unknown as ViewStyle;

/** Teintes d'un thème (tokens categoryUI, clair/sombre) ; neutre pour « Autres textes ». */
function teinte(categorie: string | null) {
  if (categorie) {
    const ui = catUI(categorie);
    return { bg: ui.bg, fg: ui.fg, icon: ui.icon, nom: ui.court ?? categorie };
  }
  return { bg: C.surfaceSunken, fg: C.textMuted, icon: "file-document-outline", nom: "Autres textes" };
}

/** « Proposition de loi, 24 scrutins publics » (genre omis s'il ouvre déjà le titre). */
function meta(t: TexteHebdo): string {
  const genre = t.genre === "autre" || t.titre.toLowerCase().startsWith(t.genreLabel.toLowerCase()) ? null : t.genreLabel;
  return genre ? `${genre}, ${libelleScrutins(t.nb)}` : capitalise(libelleScrutins(t.nb));
}
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Répartition de la semaine : un segment par thème, largeur proportionnelle au nombre de
 * scrutins publics. Sert AUSSI de pagination du carrousel (segment actif plein, les autres
 * estompés) : toucher un segment amène sa carte.
 */
function Repartition({ themes, total, actif, onSelect }: { themes: ThemeHebdo[]; total: number; actif: number; onSelect: (i: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, height: 26, alignItems: "center", paddingHorizontal: SIDE }}>
      {themes.map((t, i) => {
        const tt = teinte(t.categorie);
        return (
          <TouchableOpacity
            key={t.categorie ?? "autres"}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={`${tt.nom}, ${libelleScrutins(t.nb)}`}
            aria-selected={i === actif}
            // Cible tactile de 44 px dans une barre de 26 px : marges négatives plutôt que hitSlop,
            // que React Native Web ignore.
            style={{ flexGrow: t.nb / total, flexBasis: 0, minWidth: 8, height: CONTROL.md, marginVertical: -(CONTROL.md - 26) / 2, justifyContent: "center" }}
          >
            <View style={{ height: i === actif ? 8 : 6, borderRadius: RADIUS.pill, backgroundColor: tt.fg, opacity: i === actif ? 1 : 0.32 }} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CarteTheme({ t, width, nav, onHauteur }: { t: ThemeHebdo; width: number; nav: Nav; onHauteur: (h: number) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const tt = teinte(t.categorie);
  const textes = ouvert ? t.textes : t.textes.slice(0, VISIBLES);
  const reste = t.textes.length - VISIBLES;
  const ouvrir = (x: TexteHebdo) =>
    x.dossierRef ? nav.push({ name: "dossierScrutins", ref: x.dossierRef, titre: x.titre }) : nav.push({ name: "scrutin", uid: x.scrutinUid });

  return (
    <View onLayout={(ev) => onHauteur(ev.nativeEvent.layout.height)} style={{ ...SNAP_CARTE, width, alignSelf: "flex-start", backgroundColor: tt.bg, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <View style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={tt.icon as any} size={17} color={tt.fg} />
        </View>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text, flex: 1 }]} numberOfLines={1}>{tt.nom}</Text>
        <Text style={[T.micro, tnum, { color: C.textMuted }]}>{t.textes.length > 1 ? `${t.textes.length} textes` : "1 texte"}</Text>
      </View>

      {textes.map((x, i) => (
        <TouchableOpacity key={x.cle} activeOpacity={0.6} onPress={() => ouvrir(x)} accessibilityRole="button" style={{ paddingVertical: 11 }}>
          {i > 0 && <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: tt.fg, opacity: 0.16 }} />}
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={3}>{x.titre}</Text>
          <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 4 }]}>{meta(x)}</Text>
        </TouchableOpacity>
      ))}

      {reste > 0 && (
        <TouchableOpacity
          onPress={() => setOuvert((o) => !o)}
          accessibilityRole="button"
          aria-expanded={ouvert}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: CONTROL.md }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
            {ouvert ? "Réduire" : reste === 1 ? "Voir l'autre texte" : `Voir les ${reste} autres textes`}
          </Text>
          <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={ICON.sm} color={C.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Module d'accueil « La semaine à l'Assemblée » : chaque vendredi, les textes soumis à un
 * scrutin public pendant les sept jours précédents, par thème. Dit SUR QUOI on a voté, jamais
 * ce que ça veut dire : ni résultat, ni camp, ni « comme toi ». Semaine sans scrutin public :
 * on montre la dernière semaine qui en a eu, en le disant. Rien pendant le chargement.
 */
export function HebdoCarte({ nav }: { nav: Nav }) {
  const s = useSemaineAccueil();
  const [boxW, setBoxW] = useState(0);
  const [actif, setActif] = useState(0);
  // Hauteur du carrousel = celle de la carte affichée (les cartes gardent leur hauteur
  // naturelle : pas de vide sous une carte courte, la voisine plus haute est rognée).
  const [hauteurs, setHauteurs] = useState<Record<number, number>>({});
  const listRef = useRef<FlatList<ThemeHebdo>>(null);
  const e = s.edition;
  // Pastille « Nouvelle » : on lit la dernière édition vue AVANT de marquer celle-ci comme lue,
  // pour que la pastille reste affichée pendant cette visite et disparaisse à la suivante.
  const lueAvant = useRef<string | null>(null);
  if (lueAvant.current === null) lueAvant.current = getEditionLue();
  const nouvelle = !!e && s.estCourante && lueAvant.current < e.vendredi;
  useEffect(() => {
    if (e && s.estCourante) marquerEditionLue(e.vendredi);
  }, [e?.vendredi, s.estCourante]);

  const onViewRef = useRef((info: { viewableItems: Array<{ index: number | null }> }) => {
    const first = info.viewableItems[0];
    if (first && first.index != null) setActif(first.index);
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 60 });

  if (!e) return null;

  // La carte suivante dépasse à droite ; une carte seule prend toute la largeur.
  const cardW = Math.max(240, (boxW || 360) - SIDE * 2 - (e.themes.length > 1 ? 34 : 0));
  const interval = cardW + GAP;
  const aller = (i: number) => {
    listRef.current?.scrollToOffset({ offset: i * interval, animated: true });
    setActif(i);
  };
  const fenetre = libelleFenetre(e.vendredi, s.annee);
  const volume = `${libelleScrutins(e.nbScrutins)} sur ${e.nbTextes > 1 ? `${e.nbTextes} textes` : "1 texte"}`;

  return (
    <View onLayout={(ev: LayoutChangeEvent) => setBoxW(ev.nativeEvent.layout.width)}>
      <View style={{ paddingHorizontal: SIDE }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>La semaine à l'Assemblée</Text>
          {nouvelle && (
            <View style={{ backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={[T.micro, { fontFamily: F.bold, color: C.onAccent }]}>Nouvelle</Text>
            </View>
          )}
        </View>
        <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 2 }]}>
          {s.estCourante
            ? `${fenetre} : ${volume}`
            : `${fenetre} : ${volume}. Aucun scrutin public depuis.`}
        </Text>
        {/* Après une longue interruption (vacances), on le dit : sinon une semaine d'un seul
            jour de votes laisse croire que l'Assemblée a siégé toute la semaine. */}
        {e.reprise && (
          <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 2 }]}>{libelleReprise(e.reprise, s.annee)}</Text>
        )}
      </View>

      {e.themes.length > 1 && <View style={{ marginTop: 8 }}><Repartition themes={e.themes} total={e.nbScrutins} actif={actif} onSelect={aller} /></View>}

      <FlatList
        ref={listRef}
        style={[SNAP_LISTE, { marginTop: e.themes.length > 1 ? 4 : 10, height: hauteurs[actif] }]}
        data={e.themes}
        keyExtractor={(t) => t.categorie ?? "autres"}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={interval}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        renderItem={({ item, index }) => (
          <CarteTheme
            t={item}
            width={cardW}
            nav={nav}
            onHauteur={(h) => setHauteurs((m) => (m[index] === h ? m : { ...m, [index]: h }))}
          />
        )}
      />
    </View>
  );
}
