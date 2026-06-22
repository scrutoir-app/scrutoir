import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS } from "../theme";
import { ScrutoirMark } from "./ScrutoirMark";
import { getDeferredPrompt, onPromptChange, promptInstall, isStandalone, isIOS } from "../pwa";

const DISMISS_KEY = "scrutoir_install_dismissed";

/**
 * Bandeau d'installation, en bas de l'Accueil. Affiché tout de suite si l'app n'est
 * pas déjà installée et n'a pas été rejetée. Android/Chromium : bouton déclenchant la
 * pop-up native. iOS/Safari : notice manuelle (Apple n'autorise rien d'automatique).
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

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

  return (
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

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: C.text }}>Installer Scrutoir</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>
          {mode === "android"
            ? "Accès en un tap, hors-ligne, sans passer par un store."
            : "Appuyez sur « Partager », puis « Sur l'écran d'accueil »."}
        </Text>
      </View>

      {mode === "android" ? (
        <TouchableOpacity
          onPress={install}
          style={{ backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill }}
        >
          <Text style={{ color: "#fff", fontFamily: F.semibold, fontSize: 13 }}>Installer</Text>
        </TouchableOpacity>
      ) : (
        <Feather name="share" size={19} color={C.accent} style={{ marginRight: 2 }} />
      )}

      <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
        <Feather name="x" size={18} color={C.textFaint} />
      </TouchableOpacity>
    </View>
  );
}
