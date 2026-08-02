import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, shadowCard } from "../theme";
import { Chip, Button } from "./ui";
import { partagerLien, urlScrutin } from "../share";
import type { ScrutinResume } from "../types";

/**
 * Feuille de partage d'un scrutin. Réutilise le mécanisme de « Partager mon résultat »
 * (navigator.share → presse-papier). Partage UNIQUEMENT le vote public (lien scrutoir.fr +
 * titre + résultat). Le verdict « comme toi » N'est JAMAIS partagé — une note le rappelle.
 */
export function ScrutinShareSheet({
  scrutin,
  onClose,
}: {
  scrutin: ScrutinResume | null;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  if (!scrutin) return null;

  const adopte = scrutin.sort_code === "adopte";
  const resultat = adopte ? "Adopté" : "Rejeté";
  const titre = scrutin.dossier_titre || scrutin.titre || "Scrutin";
  const texte = `${titre} — ${resultat} à l'Assemblée (${scrutin.pour ?? "?"}–${scrutin.contre ?? "?"}). Via Scrutoir.`;

  const partager = async () => {
    const r = await partagerLien(urlScrutin(scrutin.uid), texte, "Scrutoir — scrutin");
    setMsg(r === "copied" ? "Lien copié !" : r === "shared" ? null : "Copie indisponible");
  };

  return (
      <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 60, justifyContent: "flex-end" }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer le partage"
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.scrim }}
        />
        <View
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            padding: S.s18,
            paddingBottom: S.s32,
            ...shadowCard,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: "center", marginBottom: S.s16 }} />
          <Text style={[T.heading, { color: C.text }]}>Partager ce scrutin</Text>

          {/* Aperçu du lien */}
          <View style={{ flexDirection: "row", gap: S.s12, alignItems: "center", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, padding: S.s12, marginTop: S.s12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.small, { fontFamily: F.bold, color: C.text }]} numberOfLines={2}>{titre}</Text>
              <Text style={[T.micro, { color: C.textFaint, marginTop: 3 }]}>{scrutin.categorie ?? "scrutin"} · scrutoir.fr</Text>
            </View>
            <Chip label={resultat} bg={adopte ? C.adopteBg : C.rejeteBg} fg={adopte ? C.adopteFg : C.rejeteFg} />
          </View>

          {/* Confidentialité : le verdict ne part jamais */}
          <View style={{ flexDirection: "row", gap: S.s8, alignItems: "flex-start", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, padding: S.s12, marginTop: S.s10 }}>
            <Feather name="lock" size={ICON.md} color={C.pour} style={{ marginTop: 1 }} />
            <Text style={[T.small, { color: C.textMuted, flex: 1, lineHeight: 19 }]}>
              Ton verdict « comme toi » reste privé. Seul le vote public est partagé.
            </Text>
          </View>

          <Button
            label={msg ?? "Partager le lien"}
            variant="primary"
            size="md"
            fullWidth
            iconLeft={<Feather name="share-2" size={ICON.md} />}
            onPress={partager}
            style={{ marginTop: S.s16 }}
          />
          <Button label="Annuler" variant="text" size="md" muted fullWidth onPress={onClose} style={{ marginTop: S.s4 }} />
        </View>
      </View>
  );
}
