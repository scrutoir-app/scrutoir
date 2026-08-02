import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, S, ICON } from "../theme";
import { Card, Button } from "./ui";
import { catUI } from "../categoryUI";
import type { CategorieRef } from "../types";

/**
 * Primitives PARTAGÉES des fiches « profil » (parti, député) : en-tête à stats, barre d'onglets,
 * carte « grand % + barre », lignes d'accord par thème, avatar. Une seule source pour ces briques,
 * réutilisée par `PartiScreen` et `DeputeScreen`. Couleurs via `C` uniquement (aucun hex en dur).
 */

// Seuil « comme toi / pas comme toi » : point neutre du taux d'accord (aligné spectre / grille).
export const SEUIL_COMME = 0.5;

/** Une stat de l'en-tête profil (grand nombre + libellé court). */
export function StatCol({ n, label, color }: { n: string; label: string; color?: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[T.heading, tnum, { fontFamily: F.extra, color: color ?? C.text }]}>{n}</Text>
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, marginTop: 3, textAlign: "center" }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/** Barre d'onglets profil (l'actif souligné). L'en-tête au-dessus ne change pas. */
export function ProfilTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
      {tabs.map(({ key, label }) => {
        const actif = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={`Onglet ${label}`}
            style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}
          >
            <Text style={[T.small, { fontFamily: F.extra, color: actif ? C.text : C.textFaint }]}>{label}</Text>
            <View style={{ position: "absolute", bottom: -1, left: "22%", right: "22%", height: 2.5, borderRadius: 2, backgroundColor: actif ? C.text : "transparent" }} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Carte « grand pourcentage + barre + note » — cohésion, participation, loyauté, présence. */
export function PctCard({ pct, label, children }: { pct: number | null; label: string; children?: React.ReactNode }) {
  return (
    <Card bordered style={{ marginBottom: S.s12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text style={[tnum, { fontFamily: F.extra, fontSize: 30, lineHeight: 32, color: C.text }]}>{pct != null ? `${pct}%` : "—"}</Text>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, flex: 1 }]}>{label}</Text>
      </View>
      <View style={{ height: 9, borderRadius: 5, backgroundColor: C.surfaceSunken, overflow: "hidden", marginTop: 11 }}>
        <View style={{ height: 9, borderRadius: 5, width: `${pct ?? 0}%`, backgroundColor: C.accent }} />
      </View>
      {children != null && <Text style={[T.small, { color: C.textMuted, marginTop: 11, lineHeight: 20 }]}>{children}</Text>}
    </Card>
  );
}

/** Titre de section (majuscules discrètes). */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginTop: S.s8, marginBottom: S.s10 }]}>
      {children}
    </Text>
  );
}

/** Avatar rond : photo réelle si dispo, sinon pastille neutre (picto profil).
 *  `ring` = couleur d'anneau (déjà passée à `couleurGroupe` par l'appelant) ; absent = sans anneau. */
export function ProfilAvatar({ uri, size, ring }: { uri: string | null; size: number; ring?: string }) {
  const inner = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceAlt }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
      <Feather name="user" size={Math.round(size * 0.42)} color={C.textMuted} />
    </View>
  );
  if (!ring) return inner;
  return (
    <View style={{ padding: 3, borderRadius: (size + 6) / 2, borderWidth: 3, borderColor: ring, alignItems: "center", justifyContent: "center" }}>
      {inner}
    </View>
  );
}

export type LigneAccord = { id: string; libelle: string; pct: number };

/** Une ligne d'accord par thème (icône catégorie + nom + barre + %) — vert ≥ 50 %, rouge sinon. */
function AccordRow({ ligne, dernier, masque }: { ligne: LigneAccord; dernier: boolean; masque?: boolean }) {
  const ui = catUI(ligne.id);
  const label = ui.court ?? ligne.libelle;
  const pct = Math.round(ligne.pct * 100);
  const comme = ligne.pct >= SEUIL_COMME;
  const teinte = comme ? C.pour : C.contre;
  return (
    <View
      accessibilityLabel={masque ? undefined : `${label} : ${comme ? "d'accord" : "en désaccord"}, ${pct} %`}
      style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: S.s14, paddingVertical: 11, ...(dernier ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }) }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={ui.icon as any} size={16} color={ui.fg} />
      </View>
      <Text style={[T.small, { fontFamily: F.bold, color: C.text, width: 104 }]} numberOfLines={1}>{label}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 5, backgroundColor: C.surfaceSunken, overflow: "hidden" }}>
        {!masque && <View style={{ height: 8, borderRadius: 5, width: `${pct}%`, backgroundColor: teinte }} />}
      </View>
      <Text style={[T.small, tnum, { fontFamily: F.extra, color: masque ? C.textFaint : teinte, width: 42, textAlign: "right" }]}>
        {masque ? "··" : `${pct}%`}
      </Text>
    </View>
  );
}

/** Onglet « Accord » complet : verrouillé (pas situé) · vide · carte de lignes triées. */
export function AccordSection({
  lignes, situe, onSituer, catsPreview, lead, leadLocked, emptyMsg,
}: {
  lignes: LigneAccord[]; situe: boolean; onSituer: () => void; catsPreview: CategorieRef[];
  lead: string; leadLocked: string; emptyMsg: string;
}) {
  if (!situe) {
    const apercu = catsPreview.slice(0, 6).map((c) => ({ id: c.id, libelle: c.libelle, pct: 0 }));
    return (
      <View>
        <Text style={[T.small, { color: C.textFaint, marginTop: S.s12, marginBottom: S.s10, paddingHorizontal: 2 }]}>{leadLocked}</Text>
        <View>
          <View style={{ opacity: 0.4, ...({ filter: "blur(3px)" } as any) }} pointerEvents="none">
            <Card bordered padding={0}>
              {apercu.map((l, i) => <AccordRow key={l.id} ligne={l} dernier={i === apercu.length - 1} masque />)}
            </Card>
          </View>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Button label="Situe-toi pour voir" variant="primary" size="sm" onPress={onSituer}
              iconLeft={<Feather name="lock" size={ICON.sm} color={C.onAccent} />} />
          </View>
        </View>
      </View>
    );
  }
  if (!lignes.length) {
    return <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>{emptyMsg}</Text>;
  }
  return (
    <View>
      <Text style={[T.small, { color: C.textFaint, marginTop: S.s12, marginBottom: S.s10, paddingHorizontal: 2 }]}>{lead}</Text>
      <Card bordered padding={0}>
        {lignes.map((l, i) => <AccordRow key={l.id} ligne={l} dernier={i === lignes.length - 1} />)}
      </Card>
    </View>
  );
}
