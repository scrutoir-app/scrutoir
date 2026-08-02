import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, shadowCard } from "../theme";
import { Button } from "./ui";

/**
 * Invitation « situe-toi » du Fil (utilisateur pas encore situé). Se propose de lui-même à la
 * première arrivée sur le Fil, et au tap sur une pastille verrouillée. Explique le principe,
 * lance le deck au swipe (« Faire le test ») ou referme pour continuer à consulter. Pas de
 * relance insistante ensuite (piloté par un flag côté écran).
 */
export function OnboardingFil({
  visible,
  onStart,
  onClose,
}: {
  visible: boolean;
  onStart: () => void;
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
            maxWidth: 380,
            backgroundColor: C.surface,
            borderRadius: RADIUS.xl,
            padding: S.s24,
            alignItems: "center",
            ...shadowCard,
          }}
        >
          {/* Mini-illustration : trois cartes (contre / neutre / pour) */}
          <View style={{ flexDirection: "row", gap: S.s8, marginBottom: S.s16 }}>
            {[
              { ic: "x", col: C.contre },
              { ic: "minus", col: C.textFaint },
              { ic: "check", col: C.pour },
            ].map((c, i) => (
              <View
                key={i}
                style={{
                  width: 44,
                  height: 58,
                  borderRadius: RADIUS.sm,
                  borderWidth: 2,
                  borderColor: c.col,
                  backgroundColor: C.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: i === 0 ? "-9deg" : i === 2 ? "9deg" : "0deg" }],
                }}
              >
                <Feather name={c.ic as any} size={ICON.lg} color={c.col} />
              </View>
            ))}
          </View>

          <Text style={[T.heading, { color: C.text, textAlign: "center" }]}>
            Situe-toi pour voir ce qui vote comme toi
          </Text>
          <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s10, lineHeight: 20 }]}>
            Balaie quelques scrutins, pour ou contre, pour situer ton profil. Ensuite, chaque vote
            t'indique s'il a été tranché comme toi ou à l'inverse. Ton avis reste privé.
          </Text>

          <Button
            label="Faire le test"
            variant="primary"
            size="md"
            fullWidth
            iconLeft={<Feather name="play" size={ICON.md} />}
            onPress={onStart}
            style={{ marginTop: S.s20 }}
          />
          <Button
            label="Plus tard, juste consulter"
            variant="text"
            size="md"
            muted
            fullWidth
            onPress={onClose}
            style={{ marginTop: S.s4 }}
          />
        </View>
      </View>
  );
}
