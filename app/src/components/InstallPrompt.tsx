import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../theme";
import { Button } from "./ui";
import { ScrutoirMark } from "./ScrutoirMark";
import { InstallGuide } from "./InstallGuide";
import { useCopierEtInstaller } from "./installation";
import { track } from "../analytics";
import { contexteArrivee, nomNavigateurIOS, onPromptChange, promptInstall } from "../pwa";
import { abonnerTest, chargerTest } from "../testProximite/storage";
import { CLE_PALIER_INSTALL, bandeauReparu, palierDe } from "../bandeauInstall";

const DISMISS_KEY = "scrutoir_install_dismissed";

function lire(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null; // localStorage indispo → on tente d'afficher quand même
  }
}
function ecrire(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

const nbReponses = () => Object.keys(chargerTest()?.reponses ?? {}).length;

/**
 * Bandeau d'installation, en bas de l'Accueil. Affiché si l'app n'est pas installée et n'a pas
 * été rejetée. Android/Chromium : bouton déclenchant la pop-up native. iPhone / iPad : sans
 * réponse, notice manuelle (guide) ; avec des réponses, « Tes N réponses vivent dans Safari »,
 * dont le geste copie le lien de transfert puis ouvre le guide (comme « Copier et installer »).
 * Rien dans un navigateur intégré (Instagram…), où l'installation est impossible.
 */
export function InstallPrompt({ ecran }: { ecran?: string } = {}) {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [n, setN] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const transfert = useCopierEtInstaller("bandeau");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const compute = () => {
      const r = nbReponses();
      setN(r);
      const c = contexteArrivee();
      const m = c === "android-installable" ? "android" : c === "ios" ? "ios" : null;
      if (lire(DISMISS_KEY) === "1") {
        // Refusé : ne revient que sur iPhone, quand les réponses franchissent un nouveau palier.
        const reparu = m === "ios" && bandeauReparu(r, Number(lire(CLE_PALIER_INSTALL)) || 0);
        return setMode(reparu ? "ios" : null);
      }
      return setMode(m);
    };
    compute();
    const off1 = onPromptChange(compute);
    const off2 = abonnerTest(compute);
    return () => {
      off1();
      off2();
    };
  }, []);

  // Sur l'écran du résultat, la carte « Garde ton spectre » porte déjà ce geste (iPhone).
  if (!mode || (mode === "ios" && ecran === "testResultat")) return null;

  const close = () => {
    ecrire(DISMISS_KEY, "1");
    if (mode === "ios") ecrire(CLE_PALIER_INSTALL, String(palierDe(n)));
    setMode(null);
  };

  const install = async () => {
    track("installer_clic", "bandeau", "android-installable");
    const ok = await promptInstall();
    if (ok) {
      track("installer_ok", "bandeau", "android-installable");
      setMode(null);
    }
  };

  const guide = () => {
    track("installer_clic", "bandeau", "ios");
    setGuideOpen(true);
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

  const navIOS = nomNavigateurIOS();
  const ligneIOS =
    n > 0
      ? { titre: `${n > 1 ? `Tes ${n} réponses vivent` : "Ta réponse vit"} dans ${navIOS}`, action: `Installe l'app pour ${n > 1 ? "les" : "la"} garder`, onPress: transfert.copier }
      : { titre: "Installer Scrutoir", action: "Voir comment faire", onPress: guide };

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
          // iOS : pas de déclenchement auto possible → tap = guide illustré (avec transfert s'il y a des réponses).
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={ligneIOS.onPress}
            accessibilityRole="button"
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 11, minHeight: 44 }}
          >
            {mark}
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{ligneIOS.titre}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1 }}>
                <Text style={[T.small, { fontFamily: F.semibold, color: C.accent }]}>{ligneIOS.action}</Text>
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

        <TouchableOpacity
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Masquer le bandeau d'installation"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 4 }}
        >
          <Feather name="x" size={18} color={C.textFaint} />
        </TouchableOpacity>
      </View>

      <InstallGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
      <InstallGuide visible={transfert.guide} onClose={transfert.fermerGuide} transfert={transfert.transfert} onRecopier={transfert.recopier} />
    </>
  );
}
