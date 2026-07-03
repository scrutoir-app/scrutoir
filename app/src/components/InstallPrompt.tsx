import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../theme";
import { Button } from "./ui";
import { ScrutoirMark } from "./ScrutoirMark";
import { InstallGuide } from "./InstallGuide";
import { getDeferredPrompt, onPromptChange, promptInstall, isStandalone, isIOS } from "../pwa";

const DISMISS_KEY = "scrutoir_install_dismissed";

/**
 * Bandeau d'installation, en bas de l'Accueil. Affiché tout de suite si l'app n'est
 * pas déjà installée et n'a pas été rejetée. Android/Chromium : bouton déclenchant la
 * pop-up native. iOS/Safari : notice manuelle (Apple n'autorise rien d'automatique).
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* localStorage indispo → on tente d'afficher quand même */
    }
    if (dismissed) return;

    const compute = () => {
      if (isStandalone()) return setMode(null);
      if (getDeferredPrompt()) return setMode("android");
      if (isIOS()) return setMode("ios");
      return setMode(null);
    };
    compute();
    return onPromptChange(compute);
  }, []);

  if (!mode) return null;

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setMode(null);
  };

  const install = async () => {
    const ok = await promptInstall();
    if (ok) setMode(null);
  };

  const mark = (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: C.accentSoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ScrutoirMark size={26} />
    </View>
  );

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: C.surface,
          borderTopWidth: 1,
          borderTopColor: C.border,
        }}
      >
        {mode === "ios" ? (
          // iOS : pas de déclenchement auto possible → tap = guide illustré.
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setGuideOpen(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 11 }}
          >
            {mark}
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Installer Scrutoir</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1 }}>
                <Text style={[T.small, { fontFamily: F.semibold, color: C.accent }]}>Voir comment faire</Text>
                <Feather name="chevron-right" size={15} color={C.accent} style={{ marginLeft: 1 }} />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {mark}
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Installer Scrutoir</Text>
              <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, marginTop: 1 }]}>
                Accès en un tap, hors-ligne, sans passer par un store.
              </Text>
            </View>
            <Button label="Installer" onPress={install} variant="primary" size="sm" />
          </>
        )}

        <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Feather name="x" size={18} color={C.textFaint} />
        </TouchableOpacity>
      </View>

      <InstallGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
