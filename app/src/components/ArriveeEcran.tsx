import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, S, ICON, CONTROL } from "../theme";
import { Button } from "./ui";
import { ScrutoirLogo } from "./brand/ScrutoirLogo";
import { InstallGuide } from "./InstallGuide";
import { CarteSombre, Fort, LigneCadenas, NoteInfo, PROMESSE_REPONSES, TexteSombre } from "./installation";
import { useReduceMotion } from "./HeroScrutins";
import { track } from "../analytics";
import { arriveeForcee, lienOuvrirNavigateur, sourceVisite } from "../arrivee";
import {
  appliHote,
  envNavigateur,
  nomAppareilIOS,
  nomNavigateurAndroid,
  nomNavigateurIOS,
  navigateurIOS,
  promptInstall,
  type ContexteArrivee,
} from "../pwa";

/**
 * Écran d'arrivée d'un nouveau visiteur, selon le contexte (pwa.ts, `contexteArrivee`) :
 *  · navigateur intégré (Instagram…) : sortir vers Safari ou Chrome pour garder ses réponses ;
 *  · iPhone / iPad : installer AVANT le test (l'app a son propre stockage, séparé de Safari) ;
 *  · Android avec invite : installer en un toucher (Chrome et l'app partagent le stockage).
 * Les autres contextes gardent `OnboardingOverlay`. Le test n'est JAMAIS bloqué : il reste à un
 * toucher sur chaque variante. Jamais d'avertissement de perte de données hors iOS.
 * Plein écran opaque, comme l'onboarding ; visibilité et persistance pilotées par onboardingPrefs.
 */
export type VarianteArrivee = Extract<ContexteArrivee, "integre-ios" | "integre-android" | "ios" | "android-installable">;

export function estVarianteArrivee(c: ContexteArrivee | null): c is VarianteArrivee {
  return c === "integre-ios" || c === "integre-android" || c === "ios" || c === "android-installable";
}

const TITRE = "Et toi, tu votes comment ?";
const ACCROCHE = "Réponds à de vrais votes de l'Assemblée. On te situe face à chaque groupe, thème par thème.";

/** « Sors d'Instagram », « Sors de TikTok », « Sors de cette appli ». */
function sorsDe(nom: string | null | undefined): string {
  if (!nom) return "Sors de cette appli";
  return /^[AEIOUY]/i.test(nom) ? `Sors d'${nom}` : `Sors de ${nom}`;
}

/** Lien discret, cible tactile de 44 px. */
function Lien({ label, onPress, souligne }: { label: string; onPress: () => void; souligne?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{ alignSelf: "center", minHeight: CONTROL.md, justifyContent: "center", paddingHorizontal: S.s8 }}
    >
      <Text style={[T.callout, { fontFamily: F.bold, color: C.textMuted, textDecorationLine: souligne ? "underline" : "none" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** « Plus tard », en haut à droite (cible de 44 px). */
function PlusTard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Plus tard"
      style={{ minHeight: CONTROL.md, minWidth: CONTROL.md, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: S.s4 }}
    >
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>Plus tard</Text>
      <Feather name="x" size={ICON.md} color={C.textMuted} />
    </TouchableOpacity>
  );
}

/** Une étape résumée de l'installation iOS (pastille numérotée). */
function EtapeResumee({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: S.s12 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.heroGhost, alignItems: "center", justifyContent: "center" }}>
        <Text style={[T.small, { fontFamily: F.extra, color: C.onHero }]}>{n}</Text>
      </View>
      <Text style={[T.small, { flex: 1, lineHeight: 19, color: C.onHeroMuted }]}>{children}</Text>
    </View>
  );
}

export function ArriveeEcran({
  visible,
  contexte,
  onStart,
  onClose,
}: {
  visible: boolean;
  contexte: VarianteArrivee;
  /** Lance le test (« Faire le test ici quand même », « Faire le test dans Safari »…). */
  onStart: () => void;
  /** « Plus tard » : ferme, l'accueil s'affiche. */
  onClose: () => void;
}) {
  const reduceMotion = useReduceMotion();
  // La variante est figée à l'ouverture : après « Installer », l'invite disparaît mais l'écran reste.
  const [variante] = useState<VarianteArrivee>(contexte);
  const [guide, setGuide] = useState(false);
  const [install, setInstall] = useState<"idle" | "ok" | "refus">("idle");
  const env = envNavigateur();

  const testSansInstaller = () => {
    track("test_sans_installer", variante);
    onStart();
  };

  const ouvrirNavigateur = () => {
    const plateforme = variante === "integre-ios" ? "ios" : "android";
    track("ouvrir_navigateur", variante, sourceVisite());
    try {
      window.location.href = lienOuvrirNavigateur(plateforme, window.location, sourceVisite(), appliHote(env.ua), arriveeForcee());
    } catch {
      /* l'instruction de secours reste affichée sous le bouton */
    }
  };

  const installer = async () => {
    track("installer_clic", "arrivee", variante);
    const ok = await promptInstall();
    if (ok) track("installer_ok", "arrivee", variante);
    setInstall(ok ? "ok" : "refus");
  };

  const montrerGuide = () => {
    track("installer_clic", "arrivee", variante);
    setGuide(true);
  };

  let contenu: React.ReactNode;
  if (variante === "integre-ios" || variante === "integre-android") {
    // Écran 1 : sortir du navigateur intégré.
    const nom = appliHote(env.ua);
    const ios = variante === "integre-ios";
    const menu = ios ? "•••" : "⋮";
    contenu = (
      <>
        <View style={{ alignItems: "flex-end" }}>
          <PlusTard onPress={onClose} />
        </View>
        <View style={{ alignItems: "center", marginTop: S.s8 }}>
          <ScrutoirLogo variant="vertical" wordHeight={24} />
        </View>
        <Text accessibilityRole="header" style={[T.title, { color: C.text, textAlign: "center", fontSize: 26, lineHeight: 31, marginTop: S.s28 }]}>
          {TITRE}
        </Text>
        <Text style={[T.body, { color: C.textMuted, textAlign: "center", marginTop: S.s10 }]}>{ACCROCHE}</Text>
        <View style={{ marginTop: S.s24 }}>
          <CarteSombre etiquette="ÉTAPE 1 SUR 2" titre={`${sorsDe(nom)} pour garder tes réponses`}>
            <TexteSombre>
              Dans ce navigateur, Scrutoir ne s'installe pas et tes réponses restent coincées dans {nom ?? "cette appli"}.
            </TexteSombre>
            <Button
              label={ios ? "Ouvrir dans Safari" : "Ouvrir dans Chrome"}
              onPress={ouvrirNavigateur}
              variant="hero"
              fullWidth
              iconLeft={<Feather name="external-link" size={ICON.base} />}
              style={{ minHeight: CONTROL.lg }}
            />
            <TexteSombre petit>
              Rien ne se passe ? Touche <Fort>{menu}</Fort> en haut à droite, puis « Ouvrir dans le navigateur ».
            </TexteSombre>
          </CarteSombre>
        </View>
        <LigneCadenas texte={PROMESSE_REPONSES} style={{ marginTop: S.s14 }} />
        <View style={{ flex: 1, minHeight: S.s24 }} />
        <Lien label="Faire le test ici quand même" onPress={testSansInstaller} souligne />
        <Text style={[T.micro, { fontFamily: F.medium, lineHeight: 16, color: C.textMuted, textAlign: "center", marginTop: S.s2 }]}>
          Tes réponses ne te suivront pas ailleurs.
        </Text>
      </>
    );
  } else if (variante === "ios") {
    // Écran 2 : iPhone / iPad dans Safari (ou Chrome iOS) : installer avant le test.
    const nav = navigateurIOS(env.ua);
    const nomNav = nomNavigateurIOS(env.ua);
    const appareil = nomAppareilIOS(env);
    const note =
      nav === "safari"
        ? `Sur ${appareil}, Safari et l'app gardent leurs réponses chacun de leur côté, et Safari efface celles d'un site où tu ne reviens pas pendant une semaine. À la fin du test, un bouton les transfère dans l'app.`
        : `Sur ${appareil}, ${nav === "chrome" ? "Chrome" : "ce navigateur"} et l'app gardent leurs réponses chacun de leur côté. À la fin du test, un bouton les transfère dans l'app.`;
    contenu = (
      <>
        <EnTete onClose={onClose} />
        <Text accessibilityRole="header" style={[T.title, { color: C.text, fontSize: 26, lineHeight: 31, marginTop: S.s20 }]}>{TITRE}</Text>
        <Text style={[T.body, { color: C.textMuted, marginTop: S.s8 }]}>{ACCROCHE}</Text>
        <View style={{ marginTop: S.s20 }}>
          <CarteSombre etiquette="AVANT LE TEST · 30 SECONDES" titre="Installe Scrutoir, ton test y sera gardé">
            <View style={{ gap: S.s10 }}>
              <EtapeResumee n={1}>
                {nav === "chrome" ? (
                  <>Touche <Fort>Partager</Fort> dans la barre d'adresse</>
                ) : nav === "safari" ? (
                  <>Touche <Fort>•••</Fort> ou <Fort>Partager</Fort> dans Safari</>
                ) : (
                  <>Touche <Fort>Partager</Fort> dans le menu du navigateur</>
                )}
              </EtapeResumee>
              <EtapeResumee n={2}>
                Choisis <Fort>Sur l'écran d'accueil</Fort>
              </EtapeResumee>
              <EtapeResumee n={3}>
                Touche <Fort>Ajouter</Fort>, puis ouvre l'icône Scrutoir
              </EtapeResumee>
            </View>
            <Button
              label="Me montrer pas à pas"
              onPress={montrerGuide}
              variant="citron"
              fullWidth
              iconLeft={<Feather name="download" size={ICON.base} />}
              style={{ minHeight: CONTROL.lg }}
            />
          </CarteSombre>
        </View>
        <LigneCadenas texte={PROMESSE_REPONSES} style={{ marginTop: S.s14 }} />
        <View style={{ flex: 1, minHeight: S.s24 }} />
        <Button
          label={nomNav === "ce navigateur" ? "Faire le test dans ce navigateur" : `Faire le test dans ${nomNav}`}
          onPress={testSansInstaller}
          variant="outline"
          fullWidth
          style={{ minHeight: CONTROL.lg, backgroundColor: C.surface, borderColor: C.borderStrong }}
        />
        <NoteInfo texte={note} style={{ marginTop: S.s12 }} />
      </>
    );
  } else {
    // Écran 3 : Android avec invite d'installation.
    const nomNav = nomNavigateurAndroid(env.ua);
    contenu = (
      <>
        <EnTete onClose={onClose} />
        <Text accessibilityRole="header" style={[T.title, { color: C.text, fontSize: 26, lineHeight: 31, marginTop: S.s20 }]}>{TITRE}</Text>
        <Text style={[T.body, { color: C.textMuted, marginTop: S.s8 }]}>{ACCROCHE}</Text>
        <View style={{ marginTop: S.s20 }}>
          <CarteSombre etiquette="EN UN TOUCHER" titre="Installe Scrutoir sur ton téléphone">
            <TexteSombre>Une icône sur ton écran d'accueil, sans store, sans compte.</TexteSombre>
            {install === "ok" ? (
              <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: S.s10, minHeight: CONTROL.lg }}>
                <Feather name="check-circle" size={ICON.lg} color={C.citron} />
                <Text style={[T.callout, { flex: 1, fontFamily: F.bold, color: C.onHero }]}>Ouvre Scrutoir depuis ton écran d'accueil</Text>
              </View>
            ) : install === "refus" ? null : (
              <Button
                label="Installer Scrutoir"
                onPress={installer}
                variant="citron"
                fullWidth
                iconLeft={<Feather name="download" size={ICON.base} />}
                style={{ minHeight: CONTROL.lg }}
              />
            )}
            <TexteSombre petit>
              {install === "refus"
                ? `Installation annulée. Le menu ⋮ de ${nomNav} la propose aussi.`
                : "Une fois installée, ouvre l'app et lance le test depuis l'icône."}
            </TexteSombre>
          </CarteSombre>
        </View>
        <LigneCadenas texte={PROMESSE_REPONSES} style={{ marginTop: S.s14 }} />
        <View style={{ flex: 1, minHeight: S.s24 }} />
        <Button
          label="Commencer le test ici · 2 min"
          onPress={testSansInstaller}
          variant="outline"
          fullWidth
          style={{ minHeight: CONTROL.lg, backgroundColor: C.surface, borderColor: C.borderStrong }}
        />
        <NoteInfo texte={`Sur Android, ${nomNav} et l'app partagent tes réponses. Rien ne se perd si tu installes après.`} style={{ marginTop: S.s12 }} />
      </>
    );
  }

  return (
    <Modal visible={visible} animationType={reduceMotion ? "none" : "fade"} transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: S.s20, paddingTop: S.s12, paddingBottom: S.s24, maxWidth: 480, width: "100%", alignSelf: "center" }}
          showsVerticalScrollIndicator={false}
        >
          {contenu}
        </ScrollView>
      </SafeAreaView>
      <InstallGuide visible={guide} onClose={() => setGuide(false)} />
    </Modal>
  );
}

/** Logo à gauche, « Plus tard » à droite (écrans 2 et 3). */
function EnTete({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <ScrutoirLogo variant="horizontal" wordHeight={19} />
      <PlusTard onPress={onClose} />
    </View>
  );
}
