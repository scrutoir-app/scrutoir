import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard, formatDate, positionLabel, couleurPosition } from "../theme";
import { SEUIL_FIABILITE, scrutinSourceUrl } from "../config";
import { catUI } from "../categoryUI";
import { rechercher, getConfrontation } from "../api";
import { track } from "../analytics";
import type { DeputeResume, Confrontation, ConfrontationScrutin, ConfrontationTheme, Periode } from "../types";
import type { Nav } from "../nav";

const PERIODES: { v: Periode; label: string }[] = [
  { v: "all", label: "Depuis 2024" },
  { v: "12m", label: "12 mois" },
  { v: "6m", label: "6 mois" },
];

export function ConfrontationScreen({ a, b, nav }: { a?: string; b?: string; nav: Nav }) {
  const [depA, setDepA] = useState<DeputeResume | null>(null);
  const [depB, setDepB] = useState<DeputeResume | null>(null);
  const [periode, setPeriode] = useState<Periode>("all");
  const [data, setData] = useState<Confrontation | null>(null);
  const [loading, setLoading] = useState(false);

  // Pré-sélection éventuelle (uid passés en route) → on récupère le résumé via une recherche légère.
  useEffect(() => {
    if (a && !depA) hydrate(a, setDepA);
    if (b && !depB) hydrate(b, setDepB);
  }, []);

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

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontFamily: F.extra, fontSize: 20, color: C.text, letterSpacing: -0.4 }}>Confronter deux élus</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 18 }}>
        Sur les seuls scrutins publics nominatifs où les deux ont voté. Un silence de données n'est pas un désaccord.
      </Text>

      {/* Sélecteurs symétriques */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <DeputeSlot depute={depA} onPick={setDepA} onClear={() => setDepA(null)} />
        <DeputeSlot depute={depB} onPick={setDepB} onClear={() => setDepB(null)} />
      </View>

      {/* Période */}
      {pret && (
        <View style={{ flexDirection: "row", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: 3, marginTop: 14 }}>
          {PERIODES.map((p) => {
            const actif = p.v === periode;
            return (
              <TouchableOpacity key={p.v} onPress={() => setPeriode(p.v)} style={{ flex: 1, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: actif ? C.surface : "transparent", alignItems: "center", ...(actif ? shadowCard : {}) }}>
                <Text style={{ fontFamily: actif ? F.bold : F.medium, fontSize: 12, color: actif ? C.text : C.textMuted }}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!pret && (
        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textFaint, marginTop: 28, textAlign: "center" }}>
          Choisissez deux élus pour comparer leurs votes.
        </Text>
      )}

      {loading && <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />}

      {pret && data && !loading && <Resultats data={data} depA={depA!} depB={depB!} periode={periode} nav={nav} />}
    </ScrollView>
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
        <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.text, marginTop: 7, textAlign: "center" }} numberOfLines={2}>{depute.nom_complet}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textMuted, marginTop: 1 }}>{depute.abrev ?? "—"}</Text>
        <TouchableOpacity onPress={onClear} style={{ marginTop: 7 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: C.accent }}>Changer</Text>
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
          style={{ flex: 1, fontSize: 13, color: C.text, fontFamily: F.medium, outlineStyle: "none" } as any}
          autoCorrect={false}
        />
      </View>
      {res.map((d) => (
        <TouchableOpacity key={d.uid} onPress={() => { onPick(d); setQ(""); setRes([]); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 }}>
          <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceAlt }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semibold, fontSize: 12.5, color: C.text }} numberOfLines={1}>{d.nom_complet}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.textMuted }}>{d.abrev ?? "—"}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ Résultats */

function Resultats({ data, depA, depB, periode, nav }: { data: Confrontation; depA: DeputeResume; depB: DeputeResume; periode: Periode; nav: Nav }) {
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
        <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.textFaint, marginTop: 11, textAlign: "center", lineHeight: 15 }}>
          {periodeLabel} · scrutins publics nominatifs (17ᵉ législature){"\n"}où {depA.nom_complet} et {depB.nom_complet} ont tous deux voté
        </Text>
      </View>

      {data.communs === 0 && (
        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 20, textAlign: "center", lineHeight: 19 }}>
          Aucun scrutin nominatif commun sur cette période. Leurs positions ne sont pas comparables par ce canal.
        </Text>
      )}

      {fiables.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 16, color: C.text }}>Accord par thème</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint, marginTop: 2, marginBottom: 11 }}>
            Du plus divergent au plus convergent. Touchez un thème pour le détail.
          </Text>
          <View style={{ gap: 9 }}>
            {fiables.map((t) => (
              <ThemeSpectrumRow key={t.id} theme={t} nav={nav} />
            ))}
          </View>
        </View>
      )}

      {(nonCouverts.length > 0 || insuffisants.length > 0) && (
        <View style={{ marginTop: 22 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 14, color: C.textMuted }}>Non couvert</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint, marginTop: 2, marginBottom: 9, lineHeight: 16 }}>
            Pas (ou trop peu) de scrutin nominatif commun — invérifiable par ce canal, ce n'est pas un désaccord.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {[...insuffisants, ...nonCouverts].map((t) => (
              <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 11.5, color: C.textMuted }}>{t.libelle}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.textFaint }}>{t.communs}</Text>
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
      <Text style={{ fontFamily: F.extra, fontSize: 24, color, letterSpacing: -0.5 }}>{n}</Text>
      <Text style={{ fontFamily: F.semibold, fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/** Ligne de spectre : thème + barre accord/désaccord, dépliable vers le détail. */
function ThemeSpectrumRow({ theme, nav }: { theme: ConfrontationTheme; nav: Nav }) {
  const [open, setOpen] = useState(false);
  const ui = catUI(theme.id);
  const d = theme.desaccords.length;
  const a = theme.accords.length;
  const pctDesaccord = Math.round((d / theme.communs) * 100);

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, overflow: "hidden", ...shadowCard }}>
      <TouchableOpacity activeOpacity={0.6} onPress={() => setOpen((o) => !o)} style={{ padding: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={ui.icon as any} size={16} color={ui.fg} />
          </View>
          <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.text }} numberOfLines={1}>{theme.libelle}</Text>
          <Text style={{ fontFamily: F.extra, fontSize: 14, color: pctDesaccord >= 50 ? C.contre : C.text }}>{pctDesaccord}%</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint }}>désac.</Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={17} color={C.textFaint} />
        </View>
        <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken }}>
          <View style={{ flex: a || 0.0001, backgroundColor: C.pour }} />
          <View style={{ flex: d || 0.0001, backgroundColor: C.contre }} />
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.textFaint, marginTop: 6 }}>
          {d} désaccord{d > 1 ? "s" : ""} · {a} accord{a > 1 ? "s" : ""} sur {theme.communs} comparés
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal: 13, paddingBottom: 13, gap: 9 }}>
          {[...theme.desaccords, ...theme.accords].map((sc) => (
            <ScrutinLigne key={sc.uid} sc={sc} nav={nav} />
          ))}
        </View>
      )}
    </View>
  );
}

function ScrutinLigne({ sc, nav }: { sc: ConfrontationScrutin; nav: Nav }) {
  const [voirTexte, setVoirTexte] = useState(false);
  const expose = (sc.resume || "").trim();
  const resume = expose || (sc.objet || "").trim();
  const labelOuvrir = expose ? "Voir le résumé ▾" : "Voir l'intitulé complet ▾";
  const url = scrutinSourceUrl(sc.numero);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9 }}>
      <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "scrutin", uid: sc.uid })}>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text, lineHeight: 18 }} numberOfLines={2}>
          {sc.titre || sc.objet}
        </Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 }}>
        <PosChip pos={sc.posA} />
        <PosChip pos={sc.posB} />
        <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.textFaint, flex: 1 }}>
          {formatDate(sc.date)} · n° {sc.numero}
        </Text>
        {url && (
          <TouchableOpacity onPress={() => Linking.openURL(url)} hitSlop={8}>
            <Feather name="external-link" size={13} color={C.accent} />
          </TouchableOpacity>
        )}
      </View>
      {/* Résumé du texte : caché par défaut, à la demande (reco confrontation) */}
      {!!resume && (
        <>
          <TouchableOpacity onPress={() => setVoirTexte((v) => !v)} style={{ marginTop: 7 }} hitSlop={6}>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.accent }}>
              {voirTexte ? "Masquer ▴" : labelOuvrir}
            </Text>
          </TouchableOpacity>
          {voirTexte && (
            <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.textMuted, marginTop: 5, lineHeight: 17 }}>
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
      <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.text }}>{positionLabel(pos)}</Text>
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
