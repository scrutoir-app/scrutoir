import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, shadowCard } from "../theme";
import { Button } from "./ui";

/**
 * Overlay pédagogique du deck d'AFFINITÉ (« Trouver un député » → Par affinité). Réutilise le
 * MÊME langage que l'onboarding du deck de scrutins (cf. `OnboardingFil`) : voile + carte
 * centrée + picto de cartes inclinées. Ici : droite = suivre, gauche = passer ; rappelle que
 * c'est privé, à sens unique, et annulable. S'affiche au premier passage en affinité et se
 * rouvre via le bouton « ? » de l'en-tête.
 */
export function OnboardingAffinite({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 60, alignItems: "center", justifyContent: "center", padding: S.s20 }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.scrim }}
      />
      <View
        style={{
          width: "100%",
          maxWidth: 390,
          backgroundColor: C.surface,
          borderRadius: RADIUS.xl,
          padding: S.s24,
          alignItems: "center",
          ...shadowCard,
        }}
      >
        {/* Picto « cartes inclinées » — même motif que l'onboarding du deck : ici passer / suivre. */}
        <View style={{ flexDirection: "row", gap: S.s8, marginBottom: S.s16 }}>
          {[
            { ic: "x", col: C.textFaint },
            { ic: "bell", col: C.pour },
          ].map((c, i) => (
            <View
              key={i}
              style={{
                width: 48,
                height: 62,
                borderRadius: RADIUS.sm,
                borderWidth: 2,
                borderColor: c.col,
                backgroundColor: C.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ rotate: i === 0 ? "-10deg" : "10deg" }],
              }}
            >
              <Feather name={c.ic as any} size={ICON.lg} color={c.col} />
            </View>
          ))}
        </View>

        <Text style={[T.heading, { color: C.text, textAlign: "center" }]}>
          Balaie pour choisir qui suivre
        </Text>
        <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s10, lineHeight: 20 }]}>
          Voici les députés qui votent le plus comme toi, du plus proche au moins proche. Chaque
          carte montre votre part de votes en commun et les scrutins où vous avez voté pareil.
        </Text>

        {/* Deux règles du geste, alignées sur les lignes de l'onboarding du deck. */}
        <View style={{ alignSelf: "stretch", marginTop: S.s16 }}>
          <Ligne
            ic="bell"
            fg={C.pour}
            bg={C.loyalHautBg}
            texte="À droite, tu suis le député. Tu retrouves ses votes sur ton accueil."
            premier
          />
          <Ligne
            ic="x"
            fg={C.textMuted}
            bg={C.surfaceAlt}
            texte="À gauche, tu passes. Il ne réapparaît plus dans le deck."
          />
        </View>

        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, textAlign: "center", marginTop: S.s12, lineHeight: 16 }]}>
          Ton choix est privé et à sens unique. Tu peux revenir en arrière avec « Annuler ».
        </Text>

        <Button
          label="Commencer"
          variant="primary"
          size="md"
          fullWidth
          onPress={onClose}
          style={{ marginTop: S.s16 }}
        />
      </View>
    </View>
  );
}

function Ligne({ ic, fg, bg, texte, premier }: { ic: any; fg: string; bg: string; texte: string; premier?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: S.s10,
        paddingVertical: 9,
        ...(premier ? {} : { borderTopWidth: 1, borderTopColor: C.border }),
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: RADIUS.pill, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Feather name={ic} size={ICON.md} color={fg} />
      </View>
      <Text style={[T.small, { flex: 1, color: C.textMuted, lineHeight: 18 }]}>{texte}</Text>
    </View>
  );
}
