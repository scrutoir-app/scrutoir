import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { C, F, T, RADIUS, S, shadowCard } from "../theme";
import { Button } from "./ui";
import { VerdictPastille } from "./VerdictPastille";

/**
 * Légende explicative du verdict, en DEUX pages, non bloquante (fermeture possible) et
 * rattrapable partout (un tap sur n'importe quelle pastille l'ouvre). Page 1 : les scrutins
 * que tu as VOTÉS (pastille pleine). Page 2 : les scrutins DÉDUITS (pointillés) + note
 * d'honnêteté. Points de progression + Suivant / Retour / J'ai compris.
 */
export function LegendeVerdict({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (visible) setPage(0);
  }, [visible]);

  const P1 = (
    <>
      <Text style={[T.heading, { color: C.text, textAlign: "center" }]}>Ce que tu as tranché</Text>
      <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s8, lineHeight: 20 }]}>
        Sur les scrutins que tu as tranchés au test, on compare ta vraie réponse au résultat.
        Pastille pleine, avec une coche.
      </Text>
      <View style={{ gap: S.s8, marginTop: S.s16, alignItems: "center" }}>
        <VerdictPastille verdict={{ niveau: "vote", sens: "align" }} />
        <VerdictPastille verdict={{ niveau: "vote", sens: "oppose" }} />
      </View>
    </>
  );

  const P2 = (
    <>
      <Text style={[T.heading, { color: C.text, textAlign: "center" }]}>Ce qu'on déduit de ton profil</Text>
      <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s8, lineHeight: 20 }]}>
        Sur les autres, on estime de quel côté tu penches à partir de ton profil. Contour en
        pointillés.
      </Text>
      <View style={{ gap: S.s8, marginTop: S.s16, alignItems: "center" }}>
        <VerdictPastille verdict={{ niveau: "deduit", sens: "align" }} />
        <VerdictPastille verdict={{ niveau: "deduit", sens: "oppose" }} />
        <VerdictPastille verdict={{ niveau: "deduit", sens: "partage" }} />
      </View>
      <Text style={[T.micro, { color: C.textFaint, textAlign: "center", marginTop: S.s16, lineHeight: 17 }]}>
        Le niveau déduit est calculé à partir de tes réponses au test. Ce n'est pas un vote que tu
        as posé sur cette loi.
      </Text>
    </>
  );

  if (!visible) return null;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 60, alignItems: "center", justifyContent: "center", padding: S.s18 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer la légende"
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.scrim }}
        />
        <View
          style={{
            width: "100%",
            maxWidth: 380,
            backgroundColor: C.surface,
            borderRadius: RADIUS.xl,
            padding: S.s24,
            ...shadowCard,
          }}
        >
          {page === 0 ? P1 : P2}

          {/* Points de progression */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: S.s8, marginTop: S.s24 }}>
            {[0, 1].map((i) => (
              <View
                key={i}
                style={{
                  width: i === page ? 20 : 7,
                  height: 7,
                  borderRadius: RADIUS.pill,
                  backgroundColor: i === page ? C.accent : C.borderStrong,
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: S.s8, marginTop: S.s16 }}>
            {page === 1 && (
              <Button label="Retour" variant="outline" size="md" onPress={() => setPage(0)} style={{ flex: 1 }} />
            )}
            <Button
              label={page === 0 ? "Suivant" : "J'ai compris"}
              variant="primary"
              size="md"
              onPress={() => (page === 0 ? setPage(1) : onClose())}
              style={{ flex: 1 }}
            />
          </View>
        </View>
    </View>
  );
}
