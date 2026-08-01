import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, shadowCard, formatDate } from "../theme";
import { Card, Chip } from "../components/ui";
import { catUI } from "../categoryUI";
import { PositionCells } from "../components/PositionCells";
import { BarreDivergente } from "../components/BarreDivergente";
import { campDe } from "../components/HemicycleCamps";
import { getParti, getPartis, getTextesSituesApercu } from "../api";
import type { TexteSitue } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { useFollow } from "../follows";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import { BadgeProximite } from "../components/BadgeProximite";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { PartyLogo, aLogoOfficiel } from "../components/PartyLogo";
import { usePartyLogos } from "../prefs";
import type { PartiResume } from "../types";
import type { ProfilParti, PartiCategorie, Periode } from "../types";
import type { Nav } from "../nav";

const PERIODES: { id: Periode; label: string }[] = [
  { id: "all", label: "Depuis 2024" },
  { id: "12m", label: "12 mois" },
  { id: "6m", label: "6 mois" },
];

export function PartiScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [periode, setPeriode] = useState<Periode>("all");
  const { data, loading, error, retry } = useData(() => getParti(uid, periode), [uid, periode]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [followed, toggleFollow] = useFollow(uid);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [logosOn] = usePartyLogos();
  const je = useJe();

  // Décoratif (picto hémicycle) : un échec ne bloque pas l'écran.
  useEffect(() => { getPartis().then(setPartis).catch(() => {}); }, []);

  if (loading && !data)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!data) return error ? <ErreurChargement onRetry={retry} /> : null;

  const p = data.parti;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* En-tête parti */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 16 }}>
        {logosOn && aLogoOfficiel(p.abrev) ? (
          <PartyLogo abrev={p.abrev} couleur={p.couleur} size={64} />
        ) : (
          <HemicyclePicto groupes={partis} activeAbrev={p.abrev} color={p.couleur ?? C.textFaint} size={64} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[T.title, { color: C.text }]}>{p.abrev ?? p.libelle}</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]} numberOfLines={2}>
            {p.libelle} · {p.nb_deputes} élus
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleFollow}
          activeOpacity={0.7}
          style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: followed ? C.accent : C.surfaceAlt }}
        >
          <Feather name="bell" size={18} color={followed ? "#fff" : C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* « Tu votes comme X% » — issu du test de proximité (rien sans « je »). */}
      <BadgeProximite score={scoreGroupeJe(je, p.abrev)} couleur={p.couleur} />

      {/* Lentille « comme toi » : les VOTES FINAUX du groupe sur tes textes, en clair. */}
      {je && p.abrev && <LentilleComme abrev={p.abrev} reponses={je.reponses} nav={nav} />}

      {/* Président du groupe */}
      {data.president && (
        <Card
          onPress={() => nav.push({ name: "depute", uid: data.president!.uid })}
          padding={12}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 }}
        >
          <Image source={{ uri: data.president.photo_url ?? undefined }} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
          <View style={{ flex: 1 }}>
            <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }]}>Président du groupe</Text>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 1 }]}>{data.president.nom_complet}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </Card>
      )}

      {/* Accès à tous les élus du groupe */}
      <Card
        onPress={() => nav.push({ name: "membresParti", uid: p.uid, libelle: p.abrev ?? p.libelle })}
        padding={13}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Feather name="users" size={18} color={C.accent} />
        </View>
        <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]}>Voir les {p.nb_deputes} élus du groupe</Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </Card>

      {/* Test de proximité (mode complet) */}
      <Card
        onPress={() => nav.push({ name: "testIntro" })}
        padding={13}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Feather name="help-circle" size={18} color={C.accent} />
        </View>
        <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]}>Es-tu proche de ce groupe ?</Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </Card>

      {/* Cohésion & participation, expliquées + repère moyenne des groupes */}
      <StatRow
        valeur={data.cohesion_pct}
        moy={data.cohesion_moy ?? null}
        label="Cohésion du groupe"
        phrase={data.cohesion_pct != null ? `Les élus du groupe votent dans le même sens ${data.cohesion_pct} % du temps.` : "Pas assez de votes pour mesurer la cohésion."}
        detail="Part des votes des membres conformes à la consigne du groupe. Élevée = groupe très uni / discipliné ; basse = votes plus libres ou divisions internes."
      />
      <StatRow
        valeur={data.participation_moy_pct}
        moy={data.participation_moy ?? null}
        label="Participation aux votes"
        phrase="Présence moyenne des élus du groupe aux scrutins publics nominatifs."
        detail="Moyenne des taux de participation des membres. Seuls les scrutins publics nominatifs sont comptés : les votes à main levée ne sont pas disponibles."
      />

      {/* Activité parlementaire */}
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 6, marginBottom: 12 }]}>Activité parlementaire</Text>
      <View style={{ flexDirection: "row", gap: 11, marginBottom: 6 }}>
        <ActiviteCard total={data.amendements} label="Amendements déposés" parElu={data.amendements_par_elu} ratio={data.amendements_ratio} unite="amendement" />
        <ActiviteCard total={data.propositions} label="Propositions de loi" parElu={data.propositions_par_elu} ratio={data.propositions_ratio} unite="proposition" />
      </View>
      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginBottom: 16 }]}>
        L'écart à la moyenne des groupes est toujours indiqué. Très au-dessus = activité intense… ou obstruction ; en-dessous = le groupe dépose peu.
      </Text>

      {/* Période */}
      <View style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12, marginBottom: 16 }}>
        {PERIODES.map((pe) => {
          const actif = pe.id === periode;
          return (
            <TouchableOpacity key={pe.id} onPress={() => setPeriode(pe.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}>
              <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{pe.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 4 }]}>Positions par thème</Text>
      <Text style={[T.small, { color: C.textMuted, marginBottom: 12 }]}>Touche un thème pour le détail des votes du groupe</Text>
      <View style={{ gap: 9 }}>
        {data.categories.map((c) => (
          <PartiThemeRow
            key={c.id}
            cat={c}
            ouvert={!!expanded[c.id]}
            onToggle={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
            onOpenTheme={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })}
            onOpenPosition={(position) => nav.push({ name: "votesParti", uid: p.uid, libelle: p.abrev ?? p.libelle, categorie: c.id, categorieLibelle: c.libelle, position, periode })}
          />
        ))}
      </View>

      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 20 }]}>
        Positions = répartition des votes du groupe par thème. Scrutins publics nominatifs, 17ᵉ législature.
      </Text>
    </ScrollView>
  );
}

const LENS_MAX = 12; // on affiche tes textes les plus récents (un fetch dossier par texte) — le reste est annoncé.

/**
 * Lentille « comme toi » : sur le VOTE FINAL des textes où tu t'es situé, comment CE groupe a voté
 * face à toi, en langage clair + compteur. La proximité reste par SCRUTIN (cf. jeProximite) — ici on
 * lit le vote d'ensemble de chaque texte, jamais un agrégat inventé. Chaque ligne ouvre le texte.
 */
function LentilleComme({ abrev, reponses, nav }: { abrev: string; reponses: Record<number, string>; nav: Nav }) {
  const [textes, setTextes] = useState<TexteSitue[] | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let vivant = true;
    getTextesSituesApercu(reponses, LENS_MAX)
      .then((r) => { if (vivant) { setTextes(r.textes); setTotal(r.total); } })
      .catch(() => vivant && setTextes([]));
    return () => { vivant = false; };
  }, [reponses]);

  if (textes == null) return null; // en cours de chargement → rien (pas de saut de mise en page)
  const lignes = textes.filter((t) => t.voteFinal).map((t) => ({ t, camp: campDe(t.voteFinal!.positions[abrev], t.tonVoteFinal) }));
  if (!lignes.length) return null;
  const nC = lignes.filter((l) => l.camp === "comme").length;
  const nF = lignes.filter((l) => l.camp === "face").length;
  const nN = lignes.length - nC - nF;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 2 }]}>Sur les votes finaux, {abrev} a…</Text>
      <Text style={[T.small, { color: C.textMuted, marginBottom: 11 }]}>Le vote d'ensemble de chaque texte, comparé à ta réponse. Touche un texte pour l'ouvrir.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <Chip label={`${nC} comme toi`} bg={C.adopteBg} fg={C.adopteFg} ph={9} pv={3} />
        <Chip label={`${nF} à l’inverse`} bg={C.rejeteBg} fg={C.rejeteFg} ph={9} pv={3} />
        {nN > 0 && <Chip label={`${nN} partagé / sans avis`} bg={C.surfaceAlt} fg={C.textMuted} ph={9} pv={3} />}
      </View>
      <View style={{ gap: 9 }}>
        {lignes.map(({ t, camp }) => (
          <LigneVoteFinal key={t.dossier.ref} texte={t} abrev={abrev} camp={camp} onPress={() => nav.push({ name: "texte", uid: t.dossier.ref })} />
        ))}
      </View>
      {total > lignes.length && (
        <Text style={[T.micro, { color: C.textFaint, marginTop: 9 }]}>Tes {lignes.length} textes les plus récents (sur {total} au total).</Text>
      )}
    </View>
  );
}

/** Une ligne de la lentille : verdict en langage clair (comme toi / à l'inverse / partagé) + résultat. */
function LigneVoteFinal({ texte, abrev, camp, onPress }: { texte: TexteSitue; abrev: string; camp: "comme" | "face" | "neutre"; onPress: () => void }) {
  const vf = texte.voteFinal!;
  const pos = vf.positions[abrev];
  const phrase =
    camp === "comme" ? `${abrev} a voté comme toi`
    : camp === "face" ? `${abrev} a voté à l’inverse`
    : texte.tonVoteFinal == null ? "tu ne t’es pas situé sur le vote final"
    : pos === "abstention" ? `${abrev} s’est abstenu`
    : `${abrev} était partagé`;
  const vBg = camp === "comme" ? C.adopteBg : camp === "face" ? C.rejeteBg : C.surfaceAlt;
  const vFg = camp === "comme" ? C.adopteFg : camp === "face" ? C.rejeteFg : C.textMuted;
  const cat = texte.dossier.categorie ?? "";
  const cui = catUI(cat);
  const catLabel = (cui as { court?: string }).court ?? cat;
  return (
    <Card onPress={onPress} padding={12} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Chip label={catLabel} bg={C.surfaceAlt} fg={C.textMuted} radius={7} ph={7} pv={2} />
          <Text style={[T.micro, tnum, { color: C.textFaint }]}>{formatDate(vf.date)}</Text>
        </View>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 18 }]} numberOfLines={2}>{texte.dossier.titre}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap", rowGap: 6 }}>
          <Chip label={phrase} bg={vBg} fg={vFg} ph={9} pv={2} />
          {vf.sort_code && (
            <Chip label={vf.sort_code === "adopte" ? "Adopté" : "Rejeté"} bg={vf.sort_code === "adopte" ? C.adopteBg : C.rejeteBg} fg={vf.sort_code === "adopte" ? C.adopteFg : C.rejeteFg} ph={7} pv={2} />
          )}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={C.textFaint} />
    </Card>
  );
}

/** Carte stat (cohésion / participation) : chiffre + phrase en clair + repère moyenne + ⓘ. */
function StatRow({ valeur, moy, label, phrase, detail }: { valeur: number | null; moy: number | null; label: string; phrase: string; detail: string }) {
  const [open, setOpen] = useState(false);
  const above = valeur != null && moy != null && valeur >= moy;
  return (
    <Card style={{ marginBottom: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{label}</Text>
        <TouchableOpacity onPress={() => setOpen((o) => !o)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="info" size={15} color={C.textFaint} />
        </TouchableOpacity>
      </View>
      <Text style={[T.title, tnum, { color: C.accent, marginTop: 2 }]}>
        {valeur ?? "—"}<Text style={[T.small, { fontFamily: F.bold, color: C.textFaint }]}>%</Text>
      </Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 3 }]}>{phrase}</Text>
      {moy != null && (
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, marginTop: 9, backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Feather name={above ? "arrow-up-right" : "arrow-down-right"} size={13} color={C.textMuted} />
          <Text style={[T.micro, { color: C.textMuted }]}>moyenne des groupes : {moy} %</Text>
        </View>
      )}
      {open && (
        <Text style={[T.small, { color: C.textFaint, marginTop: 10 }]}>{detail}</Text>
      )}
    </Card>
  );
}

/** Chip d'écart à la moyenne, TOUJOURS affiché (au-dessus, autour, en-dessous). */
function EcartChip({ ratio }: { ratio: number | null }) {
  if (ratio == null) return null;
  let fg = C.textMuted, bg = C.surfaceAlt, txt: string;
  if (ratio >= 1.5) { fg = C.loyalBas; bg = C.loyalBasBg; txt = `×${fmt(ratio)} vs moy.`; }
  else if (ratio > 1.1) { fg = C.loyalMoyen; bg = C.loyalMoyenBg; txt = `×${fmt(ratio)} vs moy.`; }
  else if (ratio >= 0.9) { txt = "≈ moyenne"; }
  else { txt = `×${fmt(ratio)} vs moy.`; }
  return <Chip label={txt} bg={bg} fg={fg} radius={7} ph={7} pv={2} />;
}
const fmt = (n: number) => n.toLocaleString("fr-FR");

/** Carte d'activité (amendements / propositions) avec /élu + écart toujours montré. */
function ActiviteCard({ total, label, parElu, ratio, unite }: { total: number; label: string; parElu: number | null; ratio: number | null; unite: string }) {
  const color = ratio == null ? C.text : ratio >= 1.5 ? C.loyalBas : ratio > 1.1 ? C.loyalMoyen : C.text;
  return (
    <Card style={{ flex: 1 }}>
      <Text style={[T.title, tnum, { color }]}>{total.toLocaleString("fr-FR")}</Text>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: 2 }]}>{label}</Text>
      {parElu != null && (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          <Text style={[T.small, { color: C.textFaint }]}>{fmt(parElu)}/élu</Text>
          <EcartChip ratio={ratio} />
        </View>
      )}
    </Card>
  );
}

/** Ligne thème repliable : barre (toujours visible) + dépli avec Pour/Contre/Abstention cliquables. */
function PartiThemeRow({ cat, ouvert, onToggle, onOpenTheme, onOpenPosition }: { cat: PartiCategorie; ouvert: boolean; onToggle: () => void; onOpenTheme: () => void; onOpenPosition: (position: string) => void }) {
  const ui = catUI(cat.id);
  return (
    <Card padding={13}>
      <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={16} color={ui.fg} />
        </View>
        <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]}>{cat.libelle}</Text>
        <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={18} color={C.textFaint} />
      </TouchableOpacity>

      {/* Barre divergente : Pour part du centre vers la gauche, Contre vers la droite
          (part relative aux exprimés). Axe central aligné d'une carte à l'autre. */}
      <View style={{ marginTop: 10 }}>
        <BarreDivergente pour={cat.pour} contre={cat.contre} abstention={cat.abstention} />
      </View>

      {!ouvert ? (
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted, marginTop: 6 }]}>
          {cat.pour} pour · {cat.contre} contre · {cat.abstention} abst.
        </Text>
      ) : (
        <View style={{ marginTop: 11 }}>
          <PositionCells
            cells={[
              { pos: "pour", n: cat.pour, label: "Pour", color: C.pour },
              { pos: "contre", n: cat.contre, label: "Contre", color: C.contre },
              { pos: "abstention", n: cat.abstention, label: "Abst.", color: C.abstention },
            ]}
            onCell={onOpenPosition}
          />
          <TouchableOpacity onPress={onOpenTheme} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 11 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir tous les scrutins du thème</Text>
            <Feather name="chevron-right" size={15} color={C.accent} />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}
