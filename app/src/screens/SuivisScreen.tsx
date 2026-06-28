import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard, couleurGroupe } from "../theme";
import { getVotesSuivis, getVotesPartisSuivis, getPartis } from "../api";
import { useFollows, markSeen } from "../follows";
import { useJe } from "../testProximite/jeProximite";
import { CarteSuivi } from "../components/CarteSuivi";
import type { VoteSuivi, PartiResume } from "../types";
import type { Nav } from "../nav";

type Periode = "all" | "12m" | "6m";
type Issue = "all" | "adopte" | "rejete";

/** Borne de date (YYYY-MM-DD) d'une période, ou null pour « tout ». */
function borneDate(p: Periode): string | null {
  if (p === "all") return null;
  const d = new Date();
  d.setMonth(d.getMonth() - (p === "12m" ? 12 : 6));
  return d.toISOString().slice(0, 10);
}

interface Opt<T extends string> { v: T; label: string; bg?: string; fg?: string }

/** Segmented control (même langage que la période de DeputeScreen). */
function Segmented<T extends string>({ options, value, onChange }: { options: Opt<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12 }}>
      {options.map((o) => {
        const actif = value === o.v;
        return (
          <TouchableOpacity
            key={o.v}
            onPress={() => onChange(o.v)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9, backgroundColor: actif ? (o.bg ?? C.surface) : "transparent", ...(actif && !o.bg ? shadowCard : {}) }}
          >
            <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? (o.fg ?? C.text) : C.textMuted }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Écran Suivis = flux COMPLET et persistant des suivis (élus + partis), avec filtres
 * combinables (période / issue / par qui) pour rendre la masse navigable. `source` pré-filtre
 * sur une catégorie (depuis le « Voir tout » d'une section du digest d'accueil).
 */
export function SuivisScreen({ source, nav }: { source?: "deputes" | "partis"; nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const partiUids = follows.filter((u) => u.startsWith("PO"));
  const je = useJe();
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);

  const [periode, setPeriode] = useState<Periode>("all");
  const [issue, setIssue] = useState<Issue>("all");
  // Sélection « par qui » : vide = tout. Pré-remplie selon la source d'entrée.
  const [selected, setSelected] = useState<Set<string>>(() =>
    source === "deputes" ? new Set(deputeUids) : source === "partis" ? new Set(partiUids) : new Set()
  );

  useEffect(() => {
    let alive = true;
    setItems(null);
    getPartis().then((all) => { if (alive) setPartis(all); });
    Promise.all([getVotesSuivis(deputeUids, 200), getVotesPartisSuivis(partiUids, 200)]).then(([d, p]) => {
      if (!alive) return;
      const merged = [...d, ...p].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero ?? 0) - (a.numero ?? 0));
      setItems(merged);
    });
    return () => { alive = false; };
  }, [follows.join(",")]);

  useEffect(() => { markSeen(); }, []);

  const partisSuivis = partis.filter((p) => partiUids.includes(p.uid));

  // Entités sélectionnables : élus présents dans le feed + partis suivis.
  const entites: { uid: string; label: string; couleur: string | null }[] = [];
  const vus = new Set<string>();
  (items ?? []).forEach((v) => {
    if (v.deputeUid.startsWith("PA") && !vus.has(v.deputeUid)) { vus.add(v.deputeUid); entites.push({ uid: v.deputeUid, label: v.nom, couleur: v.couleur }); }
  });
  partisSuivis.forEach((p) => entites.push({ uid: p.uid, label: p.abrev ?? p.libelle, couleur: p.couleur }));

  const toggle = (uid: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
  });

  const borne = borneDate(periode);
  const filtered = (items ?? []).filter((v) => {
    if (borne && (v.date || "") < borne) return false;
    if (issue !== "all") {
      const adopte = (v.sort_code || "").toLowerCase().includes("adopt");
      if ((issue === "adopte") !== adopte) return false;
    }
    if (selected.size && !selected.has(v.deputeUid)) return false;
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Suivis</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          Les derniers votes des élus et groupes que tu suis.
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {follows.length === 0 ? (
        <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 20 }}>
          <MaterialCommunityIcons name="bell-outline" size={40} color={C.textFaint} />
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 14, textAlign: "center" }]}>
            Tu ne suis personne pour l'instant
          </Text>
          <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, marginTop: 6, textAlign: "center" }]}>
            Ouvre la fiche d'un député ou d'un groupe et touche la cloche « Suivre ».
            Ses derniers votes apparaîtront ici.
          </Text>
        </View>
      ) : (
        <>
          {/* Filtres combinables */}
          <View style={{ marginTop: 14, gap: 10 }}>
            <Segmented<Periode>
              value={periode}
              onChange={setPeriode}
              options={[{ v: "all", label: "Depuis 2024" }, { v: "12m", label: "12 mois" }, { v: "6m", label: "6 mois" }]}
            />
            <Segmented<Issue>
              value={issue}
              onChange={setIssue}
              options={[
                { v: "all", label: "Toutes issues" },
                { v: "adopte", label: "Adoptés", bg: C.adopteBg, fg: C.adopteFg },
                { v: "rejete", label: "Rejetés", bg: C.rejeteBg, fg: C.rejeteFg },
              ]}
            />
            {entites.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                {entites.map((e) => {
                  const sel = selected.has(e.uid);
                  return (
                    <TouchableOpacity
                      key={e.uid}
                      activeOpacity={0.7}
                      onPress={() => toggle(e.uid)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: sel ? C.accent : C.borderStrong, backgroundColor: sel ? C.accentSoft : C.surface }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleurGroupe(e.couleur) }} />
                      <Text style={[T.small, { fontFamily: sel ? F.bold : F.medium, color: C.text }]} numberOfLines={1}>{e.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {items === null ? (
            <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
          ) : filtered.length === 0 ? (
            <Text style={[T.small, { color: C.textMuted, marginTop: 28, textAlign: "center" }]}>
              {items.length === 0 ? "Aucun vote nominatif récent pour tes suivis." : "Aucun vote ne correspond à ces filtres."}
            </Text>
          ) : (
            <View style={{ marginTop: 16, gap: 9 }}>
              {filtered.map((v) => (
                <CarteSuivi key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />
              ))}
            </View>
          )}
        </>
      )}
      </ScrollView>
    </View>
  );
}
