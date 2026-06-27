import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, T, shadowCard } from "../theme";

/**
 * Guide illustré « Installer Scrutoir sur iPhone ». Ouvert depuis le bandeau
 * d'installation (mode iOS), où Apple n'autorise aucun déclenchement automatique :
 * on montre, étape par étape, le parcours Safari « ••• » → Partager → « Sur l'écran
 * d'accueil » → Ajouter. 100 % statique (Views + icônes), thème clair/sombre via `C`.
 */
function Demo({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: C.surfaceSunken,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 10,
        paddingVertical: 9,
        marginTop: 8,
      }}
    >
      {children}
    </View>
  );
}

function Step({ n, children, demo }: { n: number; children: React.ReactNode; demo: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: C.accent,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <Text style={{ color: "#fff", fontFamily: F.bold, fontSize: 13 }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.small, { color: C.text, fontFamily: F.medium, lineHeight: 19 }]}>{children}</Text>
        {demo}
      </View>
    </View>
  );
}

export function InstallGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // react-native-web rend le contenu du Modal même avec visible={false} → on
  // court-circuite explicitement quand c'est fermé (sinon le guide s'ouvre tout seul).
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(10,12,15,0.5)", justifyContent: "center", padding: 20 }}
      >
        {/* Carte : onPress vide pour ne pas fermer quand on tape dedans. */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignSelf: "center", width: "100%", maxWidth: 380 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 20, padding: 18, ...shadowCard }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <Text style={[T.heading, { color: C.text, flex: 1 }]}>Installer sur iPhone ou iPad</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 2 }}>
                <Feather name="x" size={20} color={C.textFaint} />
              </TouchableOpacity>
            </View>
            <Text style={[T.small, { color: C.textMuted, marginBottom: 16, lineHeight: 18 }]}>
              Dans Safari, en quelques touches — ensuite Scrutoir s'ouvre comme une vraie app.
            </Text>

            <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
              <Step
                n={1}
                demo={
                  <Demo>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: C.surface,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: C.border,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                      }}
                    >
                      <Feather name="lock" size={12} color={C.textFaint} />
                      <Text style={[T.small, { flex: 1, color: C.textMuted }]}>scrutoir.fr</Text>
                      <View style={{ backgroundColor: C.accentSoft, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Feather name="more-horizontal" size={18} color={C.accent} />
                      </View>
                    </View>
                  </Demo>
                }
              >
                Touche <Text style={{ fontFamily: F.bold }}>« ••• »</Text> à droite de la barre d'adresse.
              </Step>

              <Step
                n={2}
                demo={
                  <Demo>
                    <View style={{ backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.accentSoft, overflow: "hidden" }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: C.border,
                        }}
                      >
                        <Text style={[T.small, { color: C.textFaint }]}>Copier</Text>
                        <MaterialCommunityIcons name="content-copy" size={16} color={C.textFaint} />
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8 }}>
                        <Text style={[T.small, { color: C.text, fontFamily: F.medium }]}>Partager…</Text>
                        <MaterialCommunityIcons name="export-variant" size={18} color={C.accent} />
                      </View>
                    </View>
                  </Demo>
                }
              >
                Dans le menu, touche <Text style={{ fontFamily: F.bold }}>« Partager »</Text>.
              </Step>

              <Step
                n={3}
                demo={
                  <Demo>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: C.surface,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: C.accentSoft,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={[T.small, { color: C.text, fontFamily: F.medium }]}>Sur l'écran d'accueil</Text>
                      <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="plus" size={18} color={C.accent} />
                      </View>
                    </View>
                  </Demo>
                }
              >
                Fais défiler la liste, puis touche <Text style={{ fontFamily: F.bold }}>« Sur l'écran d'accueil »</Text>.
              </Step>

              <Step
                n={4}
                demo={
                  <Demo>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[T.small, { color: C.textFaint }]}>Annuler</Text>
                      <Text style={[T.small, { color: C.text, fontFamily: F.bold }]}>Écran d'accueil</Text>
                      <View style={{ backgroundColor: C.accent, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={[T.small, { color: "#fff", fontFamily: F.bold }]}>Ajouter</Text>
                      </View>
                    </View>
                  </Demo>
                }
              >
                Touche <Text style={{ fontFamily: F.bold }}>« Ajouter »</Text> en haut à droite.
              </Step>

              <View style={{ flexDirection: "row", gap: 7, marginTop: 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                <Feather name="info" size={14} color={C.textFaint} style={{ marginTop: 1 }} />
                <Text style={[T.micro, { flex: 1, color: C.textFaint, lineHeight: 16 }]}>
                  Selon ton iPhone, « Partager » peut aussi se trouver directement dans la barre du bas de Safari (icône carré + flèche ↑).
                </Text>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
