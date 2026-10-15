import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, CONTROL, shadowCard } from "../theme";
import { Card } from "../components/ui";
import { APP_VERSION } from "../config";
import { useThemeMode } from "../themeMode";
import { usePartyLogos } from "../prefs";
import { useFollows } from "../hooks/useFollows";
import {
  lireDonneesLocales,
  lireEtatModele,
  effacerReponsesTest,
  effacerScrutinsGardes,
  supprimerModele,
  toutEffacer,
} from "../donneesLocales";
import type { SchemePref } from "../theme";
import type { Nav } from "../nav";

// PARAMÈTRES (maquette validée le 15/10/2026) : « Affichage » (apparence + avatars, une
// carte) puis « Sur cet appareil » (chaque donnée locale, son compteur, son action) et le
// pied (À propos et limites + version). Seul accès : la roue dentée du masthead de l'accueil.
// Tout effacement est local, demande une confirmation et n'envoie rien (cf. donneesLocales).

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Sélecteur segmenté (piste + pastille active). Partagé par Apparence et Avatars. */
function Segmented<V extends string | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: V; label: string; icon?: React.ComponentProps<typeof Feather>["name"] }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: "row", gap: 4, padding: 4, marginTop: 10, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md }}
    >
      {options.map((o) => {
        const actif = value === o.v;
        return (
          <TouchableOpacity
            key={String(o.v)}
            onPress={() => onChange(o.v)}
            accessibilityRole="radio"
            // RN Web ne traduit pas accessibilityState.checked : prop ARIA directe.
            aria-checked={actif}
            accessibilityLabel={`${label} : ${o.label}`}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
              minHeight: 40, borderRadius: RADIUS.sm,
              backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : null),
            }}
          >
            {o.icon && <Feather name={o.icon} size={15} color={actif ? C.text : C.textMuted} />}
            <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Titre de réglage + consigne courte alignée à droite. */
function TitreReglage({ titre, consigne }: { titre: string; consigne: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{titre}</Text>
      <Text style={[T.micro, { color: C.textFaint }]}>{consigne}</Text>
    </View>
  );
}

function Affichage() {
  const { pref, setPref } = useThemeMode();
  const [logosOn, setLogosOn] = usePartyLogos();
  return (
    <Card radius={RADIUS.lg}>
      <TitreReglage titre="Apparence" consigne="Auto suit ton appareil" />
      <Segmented<SchemePref>
        label="Apparence"
        value={pref}
        onChange={setPref}
        options={[
          { v: "light", label: "Clair", icon: "sun" },
          { v: "dark", label: "Sombre", icon: "moon" },
          { v: "auto", label: "Auto", icon: "smartphone" },
        ]}
      />
      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
      <TitreReglage titre="Avatars des groupes" consigne="Sur tes suivis" />
      <Segmented<boolean>
        label="Avatars des groupes"
        value={logosOn}
        onChange={setLogosOn}
        options={[
          { v: false, label: "Sigles" },
          { v: true, label: "Logos officiels" },
        ]}
      />
    </Card>
  );
}

/** Lien d'action d'une ligne (Effacer, Gérer…) : texte gras, cible tactile 44 px. */
function Action({ label, onPress, destructive, a11y }: { label: string; onPress: () => void; destructive?: boolean; a11y: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ minHeight: CONTROL.md, paddingHorizontal: 4, justifyContent: "center" }}
    >
      <Text style={[T.small, { fontFamily: F.bold, color: destructive ? C.rejeteFg : C.accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Confirmation en ligne (sous la ligne concernée) : rien ne s'efface sans ce second geste. */
function Confirmation({ question, confirmer, onConfirmer, onAnnuler }: { question: string; confirmer: string; onConfirmer: () => void; onAnnuler: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
      <Text style={[T.small, { color: C.textMuted }]}>{question}</Text>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16 }}>
        <Action label="Annuler" onPress={onAnnuler} a11y="Annuler" />
        <Action label={confirmer} onPress={onConfirmer} destructive a11y={`Confirmer : ${confirmer.toLowerCase()}`} />
      </View>
    </View>
  );
}

function Ligne({ titre, detail, action, enConfirmation, premiere }: { titre: string; detail: string; action?: React.ReactNode; enConfirmation?: React.ReactNode; premiere?: boolean }) {
  return (
    <View>
      {!premiere && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6, paddingHorizontal: 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{titre}</Text>
          <Text style={[T.small, { color: C.textFaint }]}>{detail}</Text>
        </View>
        {/* En confirmation, l'action de la ligne s'efface : seuls « Annuler / Effacer » restent. */}
        {!enConfirmation && action}
      </View>
      {enConfirmation}
    </View>
  );
}

type Cible = "test" | "gardes" | "modele" | "tout";

function SurCetAppareil({ nav }: { nav: Nav }) {
  useFollows(); // re-rendu si les suivis changent
  const [, rafraichir] = useState(0);
  const [modele, setModele] = useState<"cache" | "autorise" | null>(null);
  const [confirme, setConfirme] = useState<Cible | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const d = lireDonneesLocales();

  const relireModele = useCallback(() => {
    let vivant = true;
    lireEtatModele().then((m) => vivant && setModele(m));
    return () => { vivant = false; };
  }, []);
  useEffect(relireModele, [relireModele]);

  const demander = (c: Cible) => { setFait(null); setConfirme(c); };
  const annuler = () => setConfirme(null);
  const apres = (message: string) => {
    setConfirme(null);
    setFait(message);
    rafraichir((n) => n + 1);
    relireModele();
  };

  const confirmation = (c: Cible, question: string, confirmer: string, effacer: () => void | Promise<void>, message: string) =>
    confirme === c ? (
      <Confirmation
        question={question}
        confirmer={confirmer}
        onAnnuler={annuler}
        onConfirmer={async () => { await effacer(); apres(message); }}
      />
    ) : null;

  const rien = !d.test && !d.suivis && !d.gardes && !modele;

  return (
    <>
      <View style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 2, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>Sur cet appareil</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Feather name="lock" size={12} color={C.textFaint} />
          <Text style={[T.micro, { color: C.textFaint }]}>Rien de ceci n'est envoyé</Text>
        </View>
      </View>

      <Card radius={RADIUS.lg} padding={0} style={{ paddingVertical: 4 }}>
        <Ligne
          premiere
          titre="Tes réponses au test"
          detail={d.reponses ? pluriel(d.reponses, "réponse", "réponses") : "Aucune réponse"}
          action={d.test ? <Action label="Effacer" destructive onPress={() => demander("test")} a11y="Effacer tes réponses au test" /> : undefined}
          enConfirmation={confirmation(
            "test",
            d.reponses
              ? `Effacer ${d.reponses > 1 ? `tes ${d.reponses} réponses` : "ta réponse"} au test ? Ta proximité repartira de zéro.`
              : "Effacer tes réglages du test ?",
            "Effacer",
            effacerReponsesTest,
            "Tes réponses au test sont effacées."
          )}
        />
        <Ligne
          titre="Tes suivis"
          detail={d.suivis ? pluriel(d.suivis, "élu ou groupe", "élus ou groupes") : "Aucun suivi"}
          action={<Action label="Gérer" onPress={() => nav.push({ name: "suivis" })} a11y="Gérer tes suivis" />}
        />
        <Ligne
          titre="Scrutins gardés"
          detail={d.gardes ? pluriel(d.gardes, "scrutin", "scrutins") : "Aucun scrutin"}
          action={d.gardes ? <Action label="Effacer" destructive onPress={() => demander("gardes")} a11y="Effacer tes scrutins gardés" /> : undefined}
          enConfirmation={confirmation(
            "gardes",
            `Effacer ${d.gardes > 1 ? `tes ${d.gardes} scrutins gardés` : "ton scrutin gardé"} ?`,
            "Effacer",
            effacerScrutinsGardes,
            "Tes scrutins gardés sont effacés."
          )}
        />
        {modele && (
          <Ligne
            titre="Modèle de recherche"
            detail={modele === "cache" ? "Environ 120 Mo téléchargés" : "Téléchargement autorisé"}
            action={<Action label="Supprimer" destructive onPress={() => demander("modele")} a11y="Supprimer le modèle de recherche" />}
            enConfirmation={confirmation(
              "modele",
              "Supprimer le modèle de recherche ? La recherche par sujet repassera aux mots-clés, tu pourras la réactiver.",
              "Supprimer",
              supprimerModele,
              "Le modèle de recherche est supprimé."
            )}
          />
        )}
      </Card>

      {!rien && (
        confirme === "tout" ? (
          <Card radius={RADIUS.lg} padding={0} style={{ marginTop: 10, paddingTop: 12 }}>
            {confirmation(
              "tout",
              "Tout effacer ? Tes réponses au test, tes suivis, tes scrutins gardés et le modèle de recherche. Ton affichage reste tel quel.",
              "Tout effacer",
              toutEffacer,
              "Tout est effacé sur cet appareil."
            )}
          </Card>
        ) : (
          <TouchableOpacity
            onPress={() => demander("tout")}
            accessibilityRole="button"
            accessibilityLabel="Tout effacer sur cet appareil"
            style={{ marginTop: 10, minHeight: CONTROL.md, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: C.rejeteFg }]}>Tout effacer sur cet appareil</Text>
          </TouchableOpacity>
        )
      )}

      {fait && (
        <View accessibilityLiveRegion="polite" style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Feather name="check" size={14} color={C.textFaint} />
          <Text style={[T.small, { color: C.textFaint }]}>{fait}</Text>
        </View>
      )}
    </>
  );
}

export function ParametresScreen({ nav }: { nav: Nav }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginHorizontal: 2, marginBottom: 8 }]}>Affichage</Text>
      <Affichage />

      <SurCetAppareil nav={nav} />

      <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity
          onPress={() => nav.reset({ name: "apropos" })}
          accessibilityRole="link"
          accessibilityLabel="À propos et limites, dans l'onglet Infos"
          style={{ minHeight: CONTROL.md, justifyContent: "center" }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>À propos et limites</Text>
        </TouchableOpacity>
        <Text style={[T.micro, { color: C.textFaint }]}>Version {APP_VERSION}</Text>
      </View>
    </ScrollView>
  );
}
