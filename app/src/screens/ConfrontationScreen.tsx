import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking, Animated, Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, inputText, RADIUS, shadowCard, formatDate, positionLabel, couleurPosition } from "../theme";
import { SEUIL_FIABILITE, scrutinSourceUrl } from "../config";
import { catUI } from "../categoryUI";
import { rechercher, getConfrontation, getConfrontationShuffle } from "../api";
import { BarreDivergente } from "../components/BarreDivergente";
import { DuelDeputesBar } from "../components/DuelDeputesBar";
import { PositionCells } from "../components/PositionCells";
import { track } from "../analytics";
import type { DeputeResume, Confrontation, ConfrontationScrutin, ConfrontationTheme, Periode, AngleShuffle } from "../types";
import type { Nav } from "../nav";

const PERIODES: { v: Periode; label: string }[] = [
  { v: "all", label: "Depuis 2024" },
  { v: "12m", label: "12 mois" },
  { v: "6m", label: "6 mois" },
];

// Libellé du bandeau « Pourquoi ce duel » selon l'angle du tirage. Ton neutre,
// sobre, sans vocabulaire de combat — c'est ce qui écarte tout soupçon partisan.
const ANGLE_LABEL: Record<AngleShuffle, string> = {
  fracture_interne: "Même groupe, votes les plus éloignés.",
  alliance_contre_nature: "Groupes opposés, votes étonnamment proches.",
  faux_duel: "Ni alliés ni adversaires : ça se joue dossier par dossier.",
};
const ANGLE_ICON: Record<AngleShuffle, keyof typeof Feather.glyphMap> = {
  fracture_interne: "git-branch",
  alliance_contre_nature: "git-merge",
  faux_duel: "git-commit",
};
const ANGLES_SHUFFLE: AngleShuffle[] = ["fracture_interne", "alliance_contre_nature", "faux_duel"];

export function ConfrontationScreen({ a, b, periode: periodeInit, nav }: { a?: string; b?: string; periode?: Periode; nav: Nav }) {
  const [depA, setDepA] = useState<DeputeResume | null>(null);
  const [depB, setDepB] = useState<DeputeResume | null>(null);
  const [periode, setPeriode] = useState<Periode>(periodeInit ?? "all");
  const [data, setData] = useState<Confrontation | null>(null);
  const [loading, setLoading] = useState(false);
  // Angle du dernier tirage shuffle (null dès qu'un sélecteur est touché à la main).
  const [shuffleAngle, setShuffleAngle] = useState<AngleShuffle | null>(null);
  const [shuffling, setShuffling] = useState(false);

  // Barre sticky des deux élus : apparaît quand les sélecteurs ont défilé hors champ.
  const scrollY = useRef(new Animated.Value(0)).current;
  const barOpacity = scrollY.interpolate({ inputRange: [120, 190], outputRange: [0, 1], extrapolate: "clamp" });
  const barTranslate = scrollY.interpolate({ inputRange: [120, 190], outputRange: [-10, 0], extrapolate: "clamp" });

  // Sélection manuelle d'un élu → on quitte le contexte « tirage » (plus de bandeau).
  const choisirA = (d: DeputeResume) => { setDepA(d); setShuffleAngle(null); };
  const choisirB = (d: DeputeResume) => { setDepB(d); setShuffleAngle(null); };
  const viderA = () => { setDepA(null); setShuffleAngle(null); };
  const viderB = () => { setDepB(null); setShuffleAngle(null); };

  // Shuffle : pioche une paire dans un autre angle que le précédent (effet machine
  // à sous), remplit les deux sélecteurs → le useEffect ci-dessous charge le duel.
  async function lancerShuffle() {
    if (shuffling) return;
    setShuffling(true);
    try {
      const dispo = ANGLES_SHUFFLE.filter((a) => a !== shuffleAngle);
      const cible = dispo[Math.floor(Math.random() * dispo.length)];
      const res = await getConfrontationShuffle(cible);
      if (res) {
        setDepA(res.a);
        setDepB(res.b);
        setShuffleAngle(res.angle);
        track("shuffle", res.angle);
      }
    } catch {
      /* silencieux : un tirage raté ne casse pas l'écran */
    } finally {
      setShuffling(false);
    }
  }

  // Pré-sélection éventuelle (uid passés en route) → on récupère le résumé via une recherche légère.
  useEffect(() => {
    if (a && !depA) hydrate(a, setDepA);
    if (b && !depB) hydrate(b, setDepB);
  }, []);

  // Persiste le duel dans la route : en naviguant vers la liste détaillée puis en
  // revenant, l'écran est démonté/remonté ; les uids dans la route le restaurent
  // (via `hydrate` ci-dessus) au lieu de repartir d'une page vide.
  useEffect(() => {
    if (depA && depB) nav.replace({ name: "confrontation", a: depA.uid, b: depB.uid, periode });
  }, [depA?.uid, depB?.uid, periode]);

  useEffect(() => {
    if (!depA || !depB) { setData(null); return; }
    setLoading(true);
    getConfrontation(depA.uid, depB.uid, periode)
      .then(setData)
      .finally(() => setLoading(false));
  }, [depA?.uid, depB?.uid, periode]);

  // Analytics : un duel regardé (paire triée, une fois par paire).
  useEffect(() => {
    if (depA && depB) track("confront", [depA.uid, depB.uid].sort().join("|"));
  }, [depA?.uid, depB?.uid]);

  const pret = depA && depB;

  const tauxAccord = data && data.communs ? Math.round((data.accords / data.communs) * 100) : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Barre sticky : les deux élus + le taux d'accord, révélée au scroll. */}
      {pret && data && !loading && (
        <Animated.View
          style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, opacity: barOpacity, transform: [{ translateY: barTranslate }], pointerEvents: "none" }}
        >
          <DuelDeputesBar
            a={depA!}
            b={depB!}
            center={
              <View style={{ paddingVertical: 4, paddingHorizontal: 11, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.md, alignItems: "center" }}>
                <Text style={[tnum, { fontFamily: F.extra, fontSize: 17, lineHeight: 20, color: C.text }]}>{tauxAccord != null ? `${tauxAccord}%` : "—"}</Text>
                <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>d'accord</Text>
              </View>
            }
          />
        </Animated.View>
      )}

      <Animated.ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 44 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== "web" })}
      >
      <Text style={[T.title, { color: C.text }]}>Confronter deux élus</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
        Sur les seuls scrutins publics nominatifs où les deux ont voté. Un silence de données n'est pas un désaccord.
      </Text>

      {/* Sélecteurs symétriques */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <DeputeSlot depute={depA} onPick={choisirA} onClear={viderA} />
        <DeputeSlot depute={depB} onPick={choisirB} onClear={viderB} />
      </View>

      {/* Shuffle — juste sous la rangée des sélecteurs. Re-clic = nouveau tirage. */}
      <View style={{ alignItems: "center", marginTop: 14, gap: 9 }}>
        <Text style={[T.small, { color: C.textMuted }]}>Pas d'idée ? Laissez-vous surprendre.</Text>
        <TouchableOpacity
          onPress={lancerShuffle}
          disabled={shuffling}
          accessibilityLabel="Tirer une paire au hasard"
          style={{
            width: 46, height: 46, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: C.accent,
            backgroundColor: C.surface, alignItems: "center", justifyContent: "center", ...shadowCard,
          }}
        >
          {shuffling ? <ActivityIndicator size="small" color={C.accent} /> : <Feather name="shuffle" size={20} color={C.accent} />}
        </TouchableOpacity>
      </View>

      {/* Période */}
      {pret && (
        <View style={{ flexDirection: "row", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: 3, marginTop: 14 }}>
          {PERIODES.map((p) => {
            const actif = p.v === periode;
            return (
              <TouchableOpacity key={p.v} onPress={() => setPeriode(p.v)} style={{ flex: 1, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: actif ? C.surface : "transparent", alignItems: "center", ...(actif ? shadowCard : {}) }}>
                <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!pret && (
        <Text style={[T.body, { color: C.textFaint, marginTop: 28, textAlign: "center" }]}>
          Choisissez deux élus pour comparer leurs votes.
        </Text>
      )}

      {loading && <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />}

      {pret && data && !loading && <Resultats data={data} depA={depA!} depB={depB!} periode={periode} shuffleAngle={shuffleAngle} nav={nav} />}
      </Animated.ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ Sélecteur */

function DeputeSlot({ depute, onPick, onClear }: { depute: DeputeResume | null; onPick: (d: DeputeResume) => void; onClear: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<DeputeResume[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      try { const r = await rechercher(q.trim()); setRes(r.deputes.slice(0, 6)); } catch { setRes([]); }
    }, 220);
  }, [q]);

  if (depute) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 11, alignItems: "center", ...shadowCard }}>
        <Image source={{ uri: depute.photo_url ?? undefined }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.surfaceAlt }} />
        <Text style={[T.body, { fontFamily: F.bold, color: C.text, marginTop: 7, textAlign: "center" }]} numberOfLines={2}>{depute.nom_complet}</Text>
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted, marginTop: 1 }]}>{depute.abrev ?? "—"}</Text>
        <TouchableOpacity onPress={onClear} style={{ marginTop: 7 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Changer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 10, ...shadowCard }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, paddingHorizontal: 10, height: 38 }}>
        <Feather name="search" size={15} color={C.textFaint} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Un élu…"
          placeholderTextColor={C.textFaint}
          style={[inputText, { flex: 1, color: C.text, outlineStyle: "none" }] as any}
          autoCorrect={false}
        />
      </View>
      {res.map((d) => (
        <TouchableOpacity key={d.uid} onPress={() => { onPick(d); setQ(""); setRes([]); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 }}>
          <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceAlt }} />
          <View style={{ flex: 1 }}>
            <Text style={[T.small, { fontFamily: F.semibold, color: C.text }]} numberOfLines={1}>{d.nom_complet}</Text>
            <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted }]}>{d.abrev ?? "—"}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ Résultats */

function Resultats({ data, depA, depB, periode, shuffleAngle, nav }: { data: Confrontation; depA: DeputeResume; depB: DeputeResume; periode: Periode; shuffleAngle: AngleShuffle | null; nav: Nav }) {
  // Spectre : thèmes assez couverts, triés du plus divergent au plus convergent.
  const fiables = data.themes
    .filter((t) => t.communs >= SEUIL_FIABILITE)
    .sort((a, b) => b.desaccords.length / b.communs - a.desaccords.length / a.communs);
  // Non couverts = aucun scrutin commun ; insuffisants = trop peu pour conclure.
  const nonCouverts = data.themes.filter((t) => t.communs === 0);
  const insuffisants = data.themes.filter((t) => t.communs > 0 && t.communs < SEUIL_FIABILITE);
  const periodeLabel = PERIODES.find((p) => p.v === periode)?.label ?? "";
  const tauxAccord = data.communs ? Math.round((data.accords / data.communs) * 100) : null;

  return (
    <View style={{ marginTop: 18 }}>
      {/* Bandeau « Pourquoi ce duel » : présent uniquement sur un tirage shuffle,
          au-dessus de la synthèse. Explique l'angle, écarte tout soupçon partisan. */}
      {shuffleAngle && (
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10,
            backgroundColor: C.surfaceSunken, borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: 13,
          }}
        >
          <Feather name={ANGLE_ICON[shuffleAngle]} size={18} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.4, textTransform: "uppercase" }]}>
              Pourquoi ce duel
            </Text>
            <Text style={[T.small, { fontFamily: F.semibold, color: C.text, marginTop: 1 }]}>{ANGLE_LABEL[shuffleAngle]}</Text>
          </View>
        </View>
      )}

      {/* Carte de synthèse — honnête même sortie de l'app (capture d'écran) */}
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <Synthese n={data.desaccords} label="Désaccords" color={C.contre} />
          <Synthese n={data.accords} label="Accords" color={C.pour} />
          <Synthese n={tauxAccord != null ? `${tauxAccord}%` : "—"} label="Taux d'accord" color={C.text} />
        </View>
        {data.communs > 0 && (
          <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken, marginTop: 12 }}>
            <View style={{ flex: data.accords || 0.0001, backgroundColor: C.pour }} />
            <View style={{ flex: data.desaccords || 0.0001, backgroundColor: C.contre }} />
          </View>
        )}
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 11, textAlign: "center" }]}>
          {periodeLabel} · scrutins publics nominatifs (17ᵉ législature){"\n"}où {depA.nom_complet} et {depB.nom_complet} ont tous deux voté
        </Text>
      </View>

      {data.communs === 0 && (
        <Text style={[T.body, { color: C.textMuted, marginTop: 20, textAlign: "center" }]}>
          Aucun scrutin nominatif commun sur cette période. Leurs positions ne sont pas comparables par ce canal.
        </Text>
      )}

      {fiables.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Accord par thème</Text>
          <Text style={[T.small, { color: C.textFaint, marginTop: 2, marginBottom: 11 }]}>
            Du plus divergent au plus convergent. Touchez un thème pour le détail.
          </Text>
          <View style={{ gap: 9 }}>
            {fiables.map((t) => (
              <ThemeSpectrumRow key={t.id} theme={t} depA={depA} depB={depB} sousTitre={`${depA.nom_complet} vs ${depB.nom_complet}`} nav={nav} />
            ))}
          </View>
        </View>
      )}

      {(nonCouverts.length > 0 || insuffisants.length > 0) && (
        <View style={{ marginTop: 22 }}>
          <Text style={[T.body, { fontFamily: F.extra, color: C.textMuted }]}>Non couvert</Text>
          <Text style={[T.small, { color: C.textFaint, marginTop: 2, marginBottom: 9 }]}>
            Pas (ou trop peu) de scrutin nominatif commun — invérifiable par ce canal, ce n'est pas un désaccord.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {[...insuffisants, ...nonCouverts].map((t) => (
              <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 10 }}>
                <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{t.libelle}</Text>
                <Text style={[T.micro, tnum, { fontFamily: F.medium, color: C.textFaint }]}>{t.communs}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Synthese({ n, label, color }: { n: number | string; label: string; color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[T.title, tnum, { color }]}>{n}</Text>
      <Text style={[T.micro, { color: C.textMuted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

/** Ligne de spectre : thème + barre divergente accords/désaccords, dépliable. */
function ThemeSpectrumRow({ theme, depA, depB, sousTitre, nav }: { theme: ConfrontationTheme; depA: DeputeResume; depB: DeputeResume; sousTitre: string; nav: Nav }) {
  const [open, setOpen] = useState(false);
  const ui = catUI(theme.id);
  const d = theme.desaccords.length;
  const a = theme.accords.length;

  // Ouvre la liste filtrée sur une page dédiée (avec filtres année/mois).
  const ouvrir = (kind: "accord" | "desaccord") =>
    nav.push({
      name: "confrontationListe",
      kind,
      themeLibelle: theme.libelle,
      sousTitre,
      scrutins: kind === "accord" ? theme.accords : theme.desaccords,
      depA,
      depB,
      communs: theme.communs,
    });

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, overflow: "hidden", ...shadowCard }}>
      <TouchableOpacity activeOpacity={0.6} onPress={() => setOpen((o) => !o)} style={{ padding: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={ui.icon as any} size={16} color={ui.fg} />
          </View>
          <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{theme.libelle}</Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.textFaint} />
        </View>

        {/* Répartition accords / désaccords, axe central partagé (comme la fiche parti) :
            accords (vert) partent du centre vers la gauche, désaccords (rouge) vers la droite. */}
        <View style={{ marginTop: 10 }}>
          <BarreDivergente pour={a} contre={d} />
        </View>

        <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted, marginTop: 6 }]}>
          <Text style={{ fontFamily: F.bold, color: C.pour }}>{a} accord{a > 1 ? "s" : ""}</Text>
          {" · "}
          <Text style={{ fontFamily: F.bold, color: C.contre }}>{d} désaccord{d > 1 ? "s" : ""}</Text>
          {" sur "}{theme.communs} comparés
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal: 13, paddingBottom: 13 }}>
          {/* Mêmes boutons que Pour / Contre : Accord / Désaccord → page liste dédiée */}
          <PositionCells
            cells={[
              { pos: "accord", n: a, label: "Accord", color: C.pour },
              { pos: "desaccord", n: d, label: "Désaccord", color: C.contre },
            ]}
            onCell={(pos) => ouvrir(pos as "accord" | "desaccord")}
          />
        </View>
      )}
    </View>
  );
}

export function ScrutinLigne({ sc, nav }: { sc: ConfrontationScrutin; nav: Nav }) {
  const [voirTexte, setVoirTexte] = useState(false);
  const expose = (sc.resume || "").trim();
  const resume = expose || (sc.objet || "").trim();
  const labelOuvrir = expose ? "Voir le résumé ▾" : "Voir l'intitulé complet ▾";
  const url = scrutinSourceUrl(sc.numero);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9 }}>
      <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "scrutin", uid: sc.uid })}>
        <Text style={[T.body, { fontFamily: F.semibold, color: C.text }]} numberOfLines={2}>
          {sc.titre || sc.objet}
        </Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
        <PosChip pos={sc.posA} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Text style={[T.micro, tnum, { fontFamily: F.medium, color: C.textFaint }]}>
            {formatDate(sc.date)} · n° {sc.numero}
          </Text>
          {url && (
            <TouchableOpacity onPress={() => Linking.openURL(url)} hitSlop={8}>
              <Feather name="external-link" size={13} color={C.accent} />
            </TouchableOpacity>
          )}
        </View>
        <PosChip pos={sc.posB} />
      </View>
      {/* Résumé du texte : caché par défaut, à la demande (reco confrontation) */}
      {!!resume && (
        <>
          <TouchableOpacity onPress={() => setVoirTexte((v) => !v)} style={{ marginTop: 7 }} hitSlop={6}>
            <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>
              {voirTexte ? "Masquer ▴" : labelOuvrir}
            </Text>
          </TouchableOpacity>
          {voirTexte && (
            <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, marginTop: 5 }]}>
              {resume}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function PosChip({ pos }: { pos: string }) {
  const col = couleurPosition(pos);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: 8 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />
      <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]}>{positionLabel(pos)}</Text>
    </View>
  );
}

/** Récupère un DeputeResume à partir d'un uid (pré-sélection via route). */
async function hydrate(uid: string, set: (d: DeputeResume) => void) {
  try {
    const r = await getConfrontation(uid, uid, "all");
    if (r?.a) set(r.a);
  } catch {
    /* ignore */
  }
}
