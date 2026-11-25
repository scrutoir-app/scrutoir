import React, { useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, S, RADIUS, ICON } from "../theme";
import { Card } from "./ui";
import { track } from "../analytics";
import { getFollows } from "../follows";
import { chargerTest } from "../testProximite/storage";
import { urlTransfertCourant } from "../testProximite/transfert";
import type { IssueCopie, LieuInstall } from "../mesureListes";

/**
 * Briques communes des écrans d'installation (arrivée, reprise, carte du résultat, bandeau) :
 * le bloc sombre « une seule chose forte » (`heroBg`), son étiquette à pastille citron, la ligne
 * cadenas sur les réponses, la note d'information, et le geste « Copier et installer ».
 */

/** Pastille citron + libellé en capitales (« ÉTAPE 1 SUR 2 », « EN UN TOUCHER »). */
export function EtiquetteEtape({ texte }: { texte: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: S.s10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.citron }} />
      <Text style={[T.micro, { fontFamily: F.bold, letterSpacing: 1, color: C.citron }]}>{texte}</Text>
    </View>
  );
}

/** Bloc sombre des écrans d'installation : étiquette, titre, puis le contenu (texte, étapes, bouton). */
export function CarteSombre({ etiquette, titre, children }: { etiquette?: string; titre: string; children?: React.ReactNode }) {
  return (
    <Card radius={RADIUS.xl} padding={S.s20} style={{ backgroundColor: C.heroBg, gap: S.s14 }}>
      {etiquette ? <EtiquetteEtape texte={etiquette} /> : null}
      <Text accessibilityRole="header" style={[T.heading, { fontFamily: F.extra, lineHeight: 24, color: C.onHero }]}>
        {titre}
      </Text>
      {children}
    </Card>
  );
}

/** Texte courant posé sur le bloc sombre. */
export function TexteSombre({ children, petit }: { children: React.ReactNode; petit?: boolean }) {
  return (
    <Text style={[petit ? T.micro : T.small, { fontFamily: F.medium, lineHeight: petit ? 16 : 19, color: C.onHeroMuted }]}>{children}</Text>
  );
}

/** Mot en gras blanc dans un texte du bloc sombre (« ••• », « Partager »). */
export function Fort({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: F.bold, color: C.onHero }}>{children}</Text>;
}

/** Ligne cadenas : la promesse sur les réponses (jamais « rien n'est envoyé » : la mesure anonyme envoie des événements). */
export function LigneCadenas({ texte, style }: { texte: string; style?: object }) {
  return (
    <View style={[{ flexDirection: "row", gap: S.s8, alignItems: "flex-start", paddingHorizontal: S.s2 }, style]}>
      <Feather name="lock" size={ICON.md} color={C.textMuted} style={{ marginTop: 1 }} />
      <Text style={[T.small, { flex: 1, fontFamily: F.semibold, lineHeight: 18, color: C.textMuted }]}>{texte}</Text>
    </View>
  );
}

/** Note d'information en pied d'écran (icône « i »). */
export function NoteInfo({ texte, style }: { texte: string; style?: object }) {
  return (
    <View style={[{ flexDirection: "row", gap: S.s8, alignItems: "flex-start" }, style]}>
      <Feather name="info" size={ICON.sm} color={C.textFaint} style={{ marginTop: 1 }} />
      <Text style={[T.micro, { flex: 1, fontFamily: F.medium, lineHeight: 16, color: C.textMuted }]}>{texte}</Text>
    </View>
  );
}

/** « Tes 12 réponses » / « Ta réponse ». */
export function tesReponses(n: number): string {
  return n > 1 ? `tes ${n} réponses` : "ta réponse";
}

export const PROMESSE_REPONSES = "Tes réponses restent sur ton téléphone. Elles ne sont jamais envoyées à Scrutoir.";

// --- « Copier et installer » ----------------------------------------------------------------

/** État du transfert montré dans le guide d'installation : lien copié, ou à copier à la main. */
export interface EtatTransfert {
  etat: "copie" | "manuel";
  url: string;
  n: number;
}

/**
 * Copie dans le presse-papiers, appelée DANS le geste (Safari refuse sinon) : aucun `await`
 * avant l'appel. Le texte ne part nulle part : le presse-papiers reste sur le téléphone.
 */
export function copierTexte(texte: string): Promise<boolean> {
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : undefined;
    if (nav?.clipboard?.writeText) return nav.clipboard.writeText(texte).then(() => true, () => false);
  } catch {
    /* repli plus bas */
  }
  return Promise.resolve(false);
}

/**
 * Geste « Copier et installer » (carte du résultat, bandeau de l'Accueil, iPhone hors app) :
 * le lien de transfert (réponses, poids, origines, suivis, dans le hash) part au presse-papiers,
 * puis le guide d'installation s'ouvre. Si la copie échoue, le guide montre le lien et un
 * bouton « Copier » de secours. Mesure : le lieu et l'issue, jamais le lien ni son contenu.
 */
export function useCopierEtInstaller(lieu: Extract<LieuInstall, "bandeau" | "resultat">) {
  const [transfert, setTransfert] = useState<EtatTransfert | null>(null);
  const [guide, setGuide] = useState(false);

  const copier = () => {
    const url = urlTransfertCourant(getFollows());
    const n = Object.keys(chargerTest()?.reponses ?? {}).length;
    if (!url) {
      setTransfert(null);
      setGuide(true);
      return;
    }
    copierTexte(url).then((ok) => {
      const issue: IssueCopie = ok ? "copied" : "manual";
      track("transfert_copie", lieu, issue);
      setTransfert({ etat: ok ? "copie" : "manuel", url, n });
      setGuide(true);
    });
  };

  /** Bouton « Copier » de secours, dans le guide. */
  const recopier = () => {
    if (!transfert) return;
    copierTexte(transfert.url).then((ok) => {
      if (ok) {
        track("transfert_copie", lieu, "copied");
        setTransfert({ ...transfert, etat: "copie" });
      }
    });
  };

  return { copier, recopier, transfert, guide, fermerGuide: () => setGuide(false) };
}
