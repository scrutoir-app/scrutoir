import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, S, ICON, RADIUS, formatDate } from "../theme";
import { Card, Button } from "./ui";
import { catUI } from "../categoryUI";
import { SEUIL_FIABILITE } from "../config";
import type { ScrutinResume } from "../types";

/**
 * Primitives PARTAGÉES des fiches « profil » (parti, député), même moule pour les deux :
 * cartes de chiffres (% en avant, base en petit), « Comme toi ? » verrouillé ou carte du
 * % comme toi, barre d'onglets, ligne de vote sur un texte entier, accord par thème avec
 * seuil de fiabilité, avatar. Couleurs via `C` uniquement (aucun hex en dur), sans capitales.
 */

// Seuil « comme toi / pas comme toi » : point neutre du taux d'accord (aligné spectre / grille).
export const SEUIL_COMME = 0.5;

/** Une stat compacte (grand nombre + libellé court) — utilisée par « Trouver ton député ». */
export function StatCol({ n, label, color }: { n: string; label: string; color?: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[T.heading, tnum, { fontFamily: F.extra, color: color ?? C.text }]}>{n}</Text>
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, marginTop: 3, textAlign: "center" }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/** Carte de chiffre de l'en-tête : % en avant, ce qu'il mesure, puis sa base/contexte en petit. */
export function StatCarte({ valeur, label, contexte, compact }: { valeur: string; label: string; contexte?: string | null; compact?: boolean }) {
  return (
    <Card padding={0} radius={RADIUS.lg} style={{ flex: 1, paddingHorizontal: S.s14, paddingVertical: S.s12 }}>
      <Text style={[compact ? T.heading : T.title, tnum, { fontFamily: F.extra, color: C.text }]}>{valeur}</Text>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.text, marginTop: 2 }]}>{label}</Text>
      {!!contexte && <Text style={[T.micro, { color: C.textFaint, marginTop: 4 }]}>{contexte}</Text>}
    </Card>
  );
}

/** « Comme toi ? » verrouillé (non situé) : ligne cliquable qui invite à se situer. */
export function CommeToiVerrou({ phrase, onPress }: { phrase: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Comme toi ? ${phrase}`}
      style={{ flexDirection: "row", alignItems: "center", gap: S.s10, minHeight: 44, paddingHorizontal: S.s14, paddingVertical: S.s10, borderRadius: RADIUS.lg, backgroundColor: C.surfaceAlt }}
    >
      <Feather name="lock" size={ICON.sm} color={C.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[T.callout, { fontFamily: F.bold, color: C.accent }]}>Comme toi ?</Text>
        <Text style={[T.small, { color: C.textMuted }]}>{phrase}</Text>
      </View>
      <Feather name="chevron-right" size={ICON.base} color={C.accent} />
    </TouchableOpacity>
  );
}

/** Barre d'accord : part « comme toi » (vert) puis le reste (rouge). */
function BarreAccord({ pct, hauteur }: { pct: number; hauteur: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct * 100)));
  return (
    <View style={{ flexDirection: "row", height: hauteur, borderRadius: hauteur / 2, overflow: "hidden", backgroundColor: C.surfaceSunken }}>
      <View style={{ width: `${p}%`, backgroundColor: C.pour }} />
      <View style={{ width: `${100 - p}%`, backgroundColor: C.contre }} />
    </View>
  );
}

/**
 * Carte « % comme toi » (situé) : le pourcentage du moteur en avant, sa base en dessous.
 * `pct` null + `base` fournie = rien de comparable (on le dit) ; `base` null = calcul en cours.
 */
export function CommeToiCarte({ pct, base }: { pct: number | null; base: string | null }) {
  if (base == null) {
    return (
      <Card padding={S.s14} radius={RADIUS.lg}>
        <Text style={[T.small, { color: C.textMuted }]}>Calcul de ton accord…</Text>
      </Card>
    );
  }
  return (
    <Card padding={S.s14} radius={RADIUS.lg} accessibilityLabel={pct != null ? `${Math.round(pct * 100)} % comme toi. ${base}` : base}>
      {pct != null && (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: S.s8 }}>
            <Text style={[T.title, tnum, { color: C.text }]}>{Math.round(pct * 100)} %</Text>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>comme toi</Text>
          </View>
          <View style={{ marginTop: S.s8 }}>
            <BarreAccord pct={pct} hauteur={8} />
          </View>
        </>
      )}
      <Text style={[T.small, { color: C.textMuted, marginTop: pct != null ? 6 : 0 }]}>{base}</Text>
    </Card>
  );
}

/** Barre d'onglets profil (l'actif souligné). L'en-tête au-dessus ne change pas. */
export function ProfilTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
      {tabs.map(({ key, label }) => {
        const actif = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={`Onglet ${label}`}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 44 }}
          >
            <Text style={[T.callout, { fontFamily: actif ? F.bold : F.semibold, color: actif ? C.text : C.textFaint }]}>{label}</Text>
            <View style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 2, backgroundColor: actif ? C.text : "transparent" }} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Carte « grand pourcentage + barre + note » — détail des onglets (cohésion, participation, loyauté). */
export function PctCard({ pct, label, children }: { pct: number | null; label: string; children?: React.ReactNode }) {
  return (
    <Card bordered style={{ marginBottom: S.s12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text style={[tnum, { fontFamily: F.extra, fontSize: 30, lineHeight: 32, color: C.text }]}>{pct != null ? `${pct} %` : "—"}</Text>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, flex: 1 }]}>{label}</Text>
      </View>
      <View style={{ height: 9, borderRadius: 5, backgroundColor: C.surfaceSunken, overflow: "hidden", marginTop: 11 }}>
        <View style={{ height: 9, borderRadius: 5, width: `${pct ?? 0}%`, backgroundColor: C.accent }} />
      </View>
      {children != null && <Text style={[T.small, { color: C.textMuted, marginTop: 11, lineHeight: 20 }]}>{children}</Text>}
    </Card>
  );
}

/** Titre de section (sans capitales). */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={[T.small, { fontFamily: F.bold, color: C.textMuted, marginTop: S.s8, marginBottom: S.s10 }]}>
      {children}
    </Text>
  );
}

/** Phrase d'introduction d'un onglet (« Ses derniers votes sur des textes entiers »). */
export function OngletLead({ children }: { children: React.ReactNode }) {
  return <Text style={[T.small, { color: C.textMuted, marginTop: S.s12, marginBottom: S.s8, paddingHorizontal: 2 }]}>{children}</Text>;
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
    <View style={{ padding: 2, borderRadius: (size + 10) / 2, borderWidth: 3, borderColor: ring, alignItems: "center", justifyContent: "center" }}>
      {inner}
    </View>
  );
}

/** Pastille d'une ligne de vote (fond neutre) : point de couleur optionnel + libellé. */
export function PastilleVote({ label, point, fg, bg }: { label: string; point?: string; fg?: string; bg?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: bg ?? C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
      {!!point && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: point }} />}
      <Text style={[T.micro, { fontFamily: F.bold, color: fg ?? C.textMuted }]}>{label}</Text>
    </View>
  );
}

/**
 * Ligne « vote sur un texte entier » (onglet Votes) : picto du thème, méta (thème · date ·
 * issue et décompte), intitulé officiel du texte, puis les pastilles passées par l'appelant.
 */
export function VoteTexteRow({ s, premier, onPress, children }: { s: ScrutinResume; premier: boolean; onPress: () => void; children: React.ReactNode }) {
  const ui = catUI(s.categorie ?? "");
  const titre = s.dossier_titre ?? s.titre ?? s.objet ?? "Scrutin";
  const issue = s.sort_code === "adopte" ? "adopté" : s.sort_code === "rejete" ? "rejeté" : null;
  const meta = [
    ui.court ?? null,
    formatDate(s.date) || null,
    issue && s.pour != null && s.contre != null ? `${issue}, ${s.pour} pour, ${s.contre} contre` : issue,
  ].filter(Boolean).join(" · ");
  return (
    <>
      {!premier && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 60 }} />}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le scrutin : ${titre}`}
        style={{ flexDirection: "row", gap: S.s12, paddingHorizontal: S.s14, paddingVertical: S.s12 }}
      >
        <View style={{ width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={ICON.base} color={C.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.micro, tnum, { color: C.textFaint }]}>{meta}</Text>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 2 }]} numberOfLines={2}>{titre}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 }}>{children}</View>
        </View>
      </TouchableOpacity>
    </>
  );
}

/** Ligne d'accord par thème : `pct` (0..1) + nombre de votes comparés ; grisée sous le seuil. */
export type LigneAccord = { id: string; libelle: string; pct: number; comparable: number; fiable: boolean };

function AccordRow({ ligne, premier }: { ligne: LigneAccord; premier: boolean }) {
  const ui = catUI(ligne.id);
  const label = ui.court ?? ligne.libelle;
  const pct = Math.round(ligne.pct * 100);
  const n = ligne.comparable;
  const votes = `${n} vote${n > 1 ? "s" : ""} comparé${n > 1 ? "s" : ""}`;
  return (
    <>
      {!premier && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 60 }} />}
      <View
        accessible
        accessibilityLabel={ligne.fiable ? `${label} : ${pct} % comme toi, sur ${votes}` : `${label} : ${votes}, trop peu pour conclure`}
        style={{ flexDirection: "row", alignItems: "center", gap: S.s12, paddingHorizontal: S.s14, paddingVertical: S.s12 }}
      >
        <View style={{ width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={ICON.base} color={ui.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: S.s8 }}>
            <Text style={[T.callout, { fontFamily: F.bold, color: ligne.fiable ? C.text : C.textFaint, flexShrink: 1 }]} numberOfLines={1}>{label}</Text>
            {ligne.fiable ? (
              <Text style={[T.callout, tnum, { fontFamily: F.extra, color: C.text }]}>{pct} %</Text>
            ) : (
              <Text style={[T.small, { fontFamily: F.semibold, color: C.textFaint }]}>pas assez de votes</Text>
            )}
          </View>
          {ligne.fiable ? (
            <BarreAccord pct={ligne.pct} hauteur={6} />
          ) : (
            // Piste en pointillés : rien à conclure, donc pas de barre.
            <View style={{ flexDirection: "row", gap: 4, height: 6, borderRadius: 3, overflow: "hidden" }}>
              {Array.from({ length: 40 }, (_, i) => (
                <View key={i} style={{ width: 6, height: 6, backgroundColor: C.borderStrong }} />
              ))}
            </View>
          )}
          <Text style={[T.micro, { color: C.textFaint }]}>
            {ligne.fiable ? `Sur ${votes}` : `${votes} : trop peu pour conclure`}
          </Text>
        </View>
      </View>
    </>
  );
}

/**
 * Onglet « Accord » : invitation à se situer (non situé) · message (rien de comparable) ·
 * lignes par thème, « sur N votes comparés », grisées sous le seuil de fiabilité.
 */
export function AccordSection({
  lignes, situe, onSituer, invitation, lead, emptyMsg,
}: {
  lignes: LigneAccord[]; situe: boolean; onSituer: () => void;
  invitation: string; lead: string; emptyMsg: string;
}) {
  if (!situe) {
    return (
      <Card padding={S.s16} radius={RADIUS.lg} style={{ marginTop: S.s12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
          <Feather name="lock" size={ICON.sm} color={C.accent} />
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, flex: 1 }]}>Ton accord, thème par thème</Text>
        </View>
        <Text style={[T.small, { color: C.textMuted, marginTop: 6 }]}>{invitation}</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 6 }]}>Tes réponses restent sur ton téléphone.</Text>
        <Button
          label="Me situer"
          variant="primary"
          size="md"
          onPress={onSituer}
          style={{ marginTop: S.s14, alignSelf: "flex-start" }}
          iconLeft={<Feather name="check-circle" size={ICON.sm} color={C.onAccent} />}
        />
      </Card>
    );
  }
  if (!lignes.length) {
    return <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>{emptyMsg}</Text>;
  }
  return (
    <View>
      <OngletLead>{lead} Sous {SEUIL_FIABILITE} votes comparés, on ne conclut pas.</OngletLead>
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
        {lignes.map((l, i) => <AccordRow key={l.id} ligne={l} premier={i === 0} />)}
      </Card>
    </View>
  );
}
