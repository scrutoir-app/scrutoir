import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, T, S, RADIUS, CONTROL, inputText } from "../theme";
import { Button, Card } from "./ui";
import { envNavigateur, navigateurIOS, nomAppareilIOS } from "../pwa";
import type { EtatTransfert } from "./installation";

/**
 * Guide illustré « Installer Scrutoir sur iPhone ». Ouvert depuis le bandeau d'installation,
 * l'écran d'arrivée et la carte « Garde ton spectre » (iOS), où Apple n'autorise aucun
 * déclenchement automatique : on montre, étape par étape, le parcours Safari « ••• » → Partager
 * → « Sur l'écran d'accueil » → Ajouter. Chrome iOS (depuis iOS 16.4) : Partager est dans la
 * barre d'adresse, trois étapes. Avec un transfert (« Copier et installer »), le guide dit en
 * tête que les réponses sont copiées, ou montre le lien et un bouton « Copier » de secours.
 * 100 % statique (Views + icônes), thème clair/sombre via `C`.
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
        <Text style={{ color: C.onAccent, fontFamily: F.bold, fontSize: 13 }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.small, { color: C.text, fontFamily: F.medium, lineHeight: 19 }]}>{children}</Text>
        {demo}
      </View>
    </View>
  );
}

/** En tête du guide, après « Copier et installer » : réponses copiées, ou lien à copier à la main. */
function BlocTransfert({ transfert, onRecopier }: { transfert: EtatTransfert; onRecopier?: () => void }) {
  const n = transfert.n;
  const quoi = n > 1 ? `Tes ${n} réponses sont copiées.` : "Ta réponse est copiée.";
  if (transfert.etat === "copie") {
    return (
      <View style={{ flexDirection: "row", gap: S.s8, alignItems: "flex-start", backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: S.s10, marginBottom: S.s14 }}>
        <Feather name="check-circle" size={16} color={C.pour} style={{ marginTop: 1 }} />
        <Text style={[T.small, { flex: 1, color: C.text, lineHeight: 18 }]}>
          <Text style={{ fontFamily: F.bold }}>{quoi}</Text> Installe Scrutoir, ouvre l'app, puis touche « Coller mes réponses ».
        </Text>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: S.s10, marginBottom: S.s14, gap: S.s8 }}>
      <Text style={[T.small, { color: C.text, lineHeight: 18 }]}>
        <Text style={{ fontFamily: F.bold }}>La copie n'a pas marché.</Text> Copie ce lien, puis installe Scrutoir : l'app te propose de le coller à l'ouverture.
      </Text>
      <TextInput
        value={transfert.url}
        editable={false}
        selectTextOnFocus
        accessibilityLabel="Lien de tes réponses"
        style={[inputText, { fontSize: 16, color: C.textMuted, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, paddingHorizontal: S.s10, minHeight: CONTROL.md }]}
      />
      {onRecopier ? (
        <Button label="Copier" onPress={onRecopier} variant="primary" size="sm" iconLeft={<Feather name="copy" size={15} />} style={{ alignSelf: "flex-start", minHeight: CONTROL.md }} />
      ) : null}
    </View>
  );
}

export function InstallGuide({
  visible,
  onClose,
  transfert,
  onRecopier,
}: {
  visible: boolean;
  onClose: () => void;
  /** Après « Copier et installer » : l'état de la copie (sinon, guide seul). */
  transfert?: EtatTransfert | null;
  onRecopier?: () => void;
}) {
  // react-native-web rend le contenu du Modal même avec visible={false} → on
  // court-circuite explicitement quand c'est fermé (sinon le guide s'ouvre tout seul).
  if (!visible) return null;
  const nav = navigateurIOS(envNavigateur().ua);
  const appareil = nomAppareilIOS();
  const chrome = nav === "chrome";
  const autre = nav === "autre";
  const nomNav = chrome ? "Chrome" : autre ? "ton navigateur" : "Safari";
  // Chrome iOS : Partager est dans la barre d'adresse (pas d'étape « ••• »).
  const k = chrome ? 0 : 1;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: C.scrim, justifyContent: "center", padding: 20 }}
      >
        {/* Carte : onPress vide pour ne pas fermer quand on tape dedans. */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignSelf: "center", width: "100%", maxWidth: 380 }}>
          <Card radius={20} padding={18}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <Text style={[T.heading, { color: C.text, flex: 1 }]}>Installer sur {appareil}</Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 2 }}
              >
                <Feather name="x" size={20} color={C.textFaint} />
              </TouchableOpacity>
            </View>
            <Text style={[T.small, { color: C.textMuted, marginBottom: 16, lineHeight: 18 }]}>
              Dans {nomNav}, en quelques touches. Ensuite Scrutoir s'ouvre comme une vraie app.
            </Text>

            <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
              {transfert ? <BlocTransfert transfert={transfert} onRecopier={onRecopier} /> : null}
              {chrome ? (
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
                          <MaterialCommunityIcons name="export-variant" size={18} color={C.accent} />
                        </View>
                      </View>
                    </Demo>
                  }
                >
                  Touche l'icône <Text style={{ fontFamily: F.bold }}>« Partager »</Text> à droite de la barre d'adresse.
                </Step>
              ) : (
              <>
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
                {autre ? (
                  <>Ouvre le menu de ton navigateur (<Text style={{ fontFamily: F.bold }}>« ••• »</Text> ou <Text style={{ fontFamily: F.bold }}>« ≡ »</Text>).</>
                ) : (
                  <>Touche <Text style={{ fontFamily: F.bold }}>« ••• »</Text> à droite de la barre d'adresse.</>
                )}
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
                Dans le menu, touche <Text style={{ fontFamily: F.bold }}>« Partager »</Text>.
              </Step>
              </>
              )}

              <Step
                n={2 + k}
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
                Fais défiler la liste, puis touche <Text style={{ fontFamily: F.bold }}>« Sur l'écran d'accueil »</Text>.
              </Step>

              <Step
                n={3 + k}
                demo={
                  <Demo>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[T.small, { color: C.textFaint }]}>Annuler</Text>
                      <Text style={[T.small, { color: C.text, fontFamily: F.bold }]}>Écran d'accueil</Text>
                      <View style={{ backgroundColor: C.accent, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={[T.small, { color: C.onAccent, fontFamily: F.bold }]}>Ajouter</Text>
                      </View>
                    </View>
                  </Demo>
                }
              >
                Touche <Text style={{ fontFamily: F.bold }}>« Ajouter »</Text> en haut à droite, puis ouvre l'icône Scrutoir.
              </Step>

              <View style={{ flexDirection: "row", gap: 7, marginTop: 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                <Feather name="info" size={14} color={C.textFaint} style={{ marginTop: 1 }} />
                <Text style={[T.micro, { flex: 1, color: C.textFaint, lineHeight: 16 }]}>
                  {chrome
                    ? "Sur un iPhone d'avant iOS 16.4, ouvre scrutoir.fr dans Safari pour l'installer."
                    : `Selon ton ${appareil}, « Partager » est aussi dans la barre du bas de ${nomNav} (icône carré et flèche ↑).`}
                </Text>
              </View>
            </ScrollView>
          </Card>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
