import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  C, F, T, tnum, RADIUS, shadowCard, formatDate, positionLabel, couleurPosition,
} from "../theme";
import { scrutinSourceUrl, dossierSourceUrl } from "../config";
import { getScrutin, getPartis } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { track } from "../analytics";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import type { ContexteJe } from "../testProximite/jeProximite";
import type { DetailScrutin, GroupeVentilation, AmendGroupe, AmendInstitutionnel, PartiResume } from "../types";
import type { Nav } from "../nav";
import { ParcoursLoi } from "../components/ParcoursLoi";

// ⓘ Encart amendements. Version DESCRIPTIVE retenue par défaut (sans le mot « blocage ») ;
// la variante explicite est gardée pour basculer d'un seul réglage si décidé plus tard.
const NOTE_AMENDEMENTS_DESCRIPTIF =
  "Le nombre d'amendements reflète des stratégies parlementaires différentes, pas la qualité du travail. Un fort volume concentré sur un même article, avec peu d'adoptions, va souvent de pair avec un dépôt répétitif.";
const NOTE_AMENDEMENTS_EXPLICITE =
  "Le nombre d'amendements reflète des stratégies parlementaires différentes, pas la qualité du travail. Un fort volume concentré sur un même article, avec peu d'adoptions, traduit souvent une stratégie de blocage.";
const NOTE_AMENDEMENTS = NOTE_AMENDEMENTS_DESCRIPTIF; // ← basculer ici (descriptif ↔ explicite)

const PICTO_SIZE = 38; // dérivé du picto de groupe de la fiche Partis (HemicyclePicto), réduit pour la densité

// Index hémicycle gauche→droite (groupes hors ordre, ex. NI → en fin de liste).
const idxHemicycle = (ab: string | null) => {
  const i = ORDRE_HEMICYCLE.indexOf(ab ?? "");
  return i < 0 ? ORDRE_HEMICYCLE.length : i;
};
/**
 * Ordre d'affichage des groupes : si l'utilisateur a fait le test de proximité (« je »),
 * du plus proche au plus éloigné (cohérent avec l'onglet Partis) ; sinon ordre hémicycle
 * neutre. Départage par l'hémicycle à proximité égale / inconnue.
 */
function ordreParti(je: ContexteJe | null, a: string | null, b: string | null): number {
  if (je) {
    const pa = scoreGroupeJe(je, a)?.pct ?? -1;
    const pb = scoreGroupeJe(je, b)?.pct ?? -1;
    if (pb !== pa) return pb - pa;
  }
  return idxHemicycle(a) - idxHemicycle(b);
}

// --- Formatage -------------------------------------------------------------
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 1 312
function artShort(raw: string | null): string {
  return raw ? raw.toLowerCase().replace(/\s+/g, " ").trim() : ""; // "ART. 4" → "art. 4"
}
function artLong(raw: string | null): string {
  const s = artShort(raw);
  if (!s) return "";
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/^Art\./, "Article"); // "Article 4"
}
const SEUIL_CONCENTRE = 0.5; // part sur un même article au-delà de laquelle on parle de concentration

/** Texte de concentration affiché sous la barre (ligne repliée). */
function concentration(a: { articleTop: string | null; articleTopN: number; articlesDistincts: number; total: number }): string {
  const part = a.total ? a.articleTopN / a.total : 0;
  if (a.articleTop && part >= SEUIL_CONCENTRE) return `${Math.round(part * 100)} % sur ${artShort(a.articleTop)}`;
  if (a.articlesDistincts > 1) return `réparti sur ${a.articlesDistincts} articles`;
  return a.articleTop ? `sur ${artShort(a.articleTop)}` : "";
}
/** Répartition par article affichée au dépli. */
function repartitionArticles(a: { articleTop: string | null; articleTopN: number; articlesDistincts: number; total: number }): string {
  const part = a.total ? a.articleTopN / a.total : 0;
  if (a.articleTop && part >= SEUIL_CONCENTRE) {
    const autres = a.total - a.articleTopN;
    return `${artLong(a.articleTop)} : ${fmt(a.articleTopN)}${autres > 0 ? ` · autres : ${fmt(autres)}` : ""}`;
  }
  if (a.articlesDistincts > 1) return `Répartis sur ${a.articlesDistincts} articles`;
  return a.articleTop ? `${artLong(a.articleTop)} : ${fmt(a.articleTopN)}` : "";
}

export function ScrutinScreen({ uid, nav }: { uid: string; nav: Nav }) {
  // `partis` (picto hémicycle) est décoratif : son échec ne bloque pas l'écran.
  const { data: charge, loading, error, retry } = useData(
    () => Promise.all([getScrutin(uid), getPartis().catch(() => [] as PartiResume[])]),
    [uid]
  );
  const data = charge?.[0] ?? null;
  const partis = charge?.[1] ?? [];
  const [briefOuvert, setBriefOuvert] = useState(false);
  const [parcours, setParcours] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set()); // plis ouverts (sections + lignes)
  const [triNombre, setTriNombre] = useState(false); // tri amendements : false = par groupe, true = par nombre
  const je = useJe(); // résultat du test de proximité (pour ordonner les groupes au plus proche)

  useEffect(() => {
    setOpen(new Set());
    setBriefOuvert(false);
  }, [uid]);

  const am = data?.amendements ?? null;

  // Position par groupe : ordonnée au plus proche (« je ») sinon hémicycle.
  const groupesPos = useMemo(
    () => (data ? [...data.groupes].sort((a, b) => ordreParti(je, a.abrev, b.abrev)) : []),
    [data, je]
  );

  // Lignes d'amendements : par groupe (proximité « je » sinon hémicycle) ou par nombre.
  // Les lignes institutionnelles (gouv, commission) ferment la liste en mode « par groupe »,
  // et s'intègrent au classement en mode « par nombre ».
  const lignesAmend = useMemo(() => {
    if (!am) return [] as Array<{ kind: "groupe"; g: AmendGroupe } | { kind: "instit"; g: AmendInstitutionnel }>;
    const groupes = [...am.groupes].sort((a, b) => ordreParti(je, a.abrev, b.abrev));
    const grp = groupes.map((g) => ({ kind: "groupe" as const, g }));
    const inst = am.institutionnels.map((g) => ({ kind: "instit" as const, g }));
    let list = [...grp, ...inst];
    if (triNombre) list = [...list].sort((a, b) => b.g.total - a.g.total);
    return list;
  }, [am, triNombre, je]);

  // Toutes les clés de plis (pour « Tout déplier »).
  const allKeys = useMemo(() => {
    if (!data) return [] as string[];
    const k = ["sec:position", ...data.groupes.map((g) => `pos:${g.uid}`)];
    if (am) {
      k.push("sec:amend");
      lignesAmend.forEach((l) => k.push(`am:${l.kind === "groupe" ? l.g.groupe : l.g.kind}`));
    }
    return k;
  }, [data, am, lignesAmend]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!data) return error ? <ErreurChargement onRetry={retry} /> : null;

  const s = data.scrutin;
  const adopte = s.sort_code === "adopte";
  const titreCourt = (s.titre || s.objet || "").slice(0, 80);
  const amObjet = data.amendement;

  const isOpen = (key: string) => open.has(key);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const tousOuverts = allKeys.length > 0 && allKeys.every((k) => open.has(k));
  const toutDeplier = () => setOpen(tousOuverts ? new Set() : new Set(allKeys));
  // Déplie / replie d'un coup un sous-ensemble de lignes (une section).
  const toutPlier = (keys: string[], ouvrir: boolean) =>
    setOpen((prev) => {
      const n = new Set(prev);
      keys.forEach((k) => (ouvrir ? n.add(k) : n.delete(k)));
      return n;
    });

  const goVotants = (position: string, groupe?: string, groupeLibelle?: string) =>
    nav.push({ name: "votants", scrutinUid: uid, titre: titreCourt, position, groupe, groupeLibelle });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* Tout déplier / Tout replier — pilote tous les plis ci-dessous */}
      {allKeys.length > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
          <TouchableOpacity
            onPress={toutDeplier}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={tousOuverts ? "Tout replier" : "Tout déplier"}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32,
              backgroundColor: C.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6,
            }}
          >
            <Feather name={tousOuverts ? "chevrons-up" : "chevrons-down"} size={13} color={C.accent} />
            <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>
              {tousOuverts ? "Tout replier" : "Tout déplier"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1) RÉSULTAT (toujours visible) — barre de vote standard de l'app
          (divergente centrée, abstention sur l'axe, « écart de N voix » + décompte animés). */}
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: RADIUS.sm,
            paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14, backgroundColor: adopte ? C.adopteBg : C.rejeteBg,
          }}
        >
          <Feather name={adopte ? "check" : "x"} size={15} color={adopte ? C.adopteFg : C.rejeteFg} />
          <Text style={[T.callout, { fontFamily: F.extra, color: adopte ? C.adopteFg : C.rejeteFg }]}>
            {adopte ? "Adopté" : "Rejeté"}
          </Text>
        </View>
        <VoteBarDivergenteCentree pour={s.pour} contre={s.contre} abstention={s.abstention} ecart decompte />
      </View>

      {/* 2) OBJET DU TEXTE (toujours visible) */}
      <View style={{ marginTop: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 8 }]}>
          {s.dossier_titre || s.titre || s.objet}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Text style={[T.micro, tnum, { color: C.textFaint }]}>{formatDate(s.date)} · scrutin n° {s.numero}</Text>
          <TouchableOpacity
            onPress={() => setParcours(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Qu'est-ce qu'un scrutin ? Voir le parcours d'une loi"
          >
            <Feather name="info" size={14} color={C.accent} />
          </TouchableOpacity>
        </View>

        {/* Résumé : exposé de l'amendement si ce scrutin en porte un, sinon intitulé du dossier */}
        {amObjet && (amObjet.expose || amObjet.dispositif) ? (
          <View style={{ marginTop: 6, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: 12 }}>
            <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.4, marginBottom: 5 }]}>
              EXPOSÉ DE L'AMENDEMENT{amObjet.numero ? ` N° ${amObjet.numero}` : ""}
            </Text>
            {!briefOuvert ? (
              <>
                <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted }]} numberOfLines={5}>
                  {amObjet.expose || amObjet.dispositif}
                </Text>
                {((amObjet.expose || "").length > 220 || !!amObjet.dispositif) && (
                  <TouchableOpacity onPress={() => setBriefOuvert(true)} style={{ marginTop: 8 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Lire la suite ▾</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {!!amObjet.dispositif && <Bloc titre="Ce que l'amendement modifie" texte={amObjet.dispositif} />}
                {!!amObjet.expose && <Bloc titre="Justification de l'auteur" texte={amObjet.expose} />}
                <TouchableOpacity onPress={() => setBriefOuvert(false)} style={{ marginTop: 10 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Replier ▴</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : !!s.dossier_titre ? (
          <View style={{ marginTop: 6, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: 12 }}>
            <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.4, marginBottom: 5 }]}>
              OBJET DU TEXTE
            </Text>
            <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted }]}>
              Intitulé officiel du dossier législatif.
            </Text>
          </View>
        ) : null}
      </View>

      {/* 3) POSITION PAR GROUPE (pliable, repliée par défaut) */}
      <SectionFold
        icon="users"
        titre="Position par groupe"
        teaser={`${data.groupes.length} groupes · ${je ? "ordre selon ta proximité" : "comment chacun a voté et ses consignes"}`}
        open={isOpen("sec:position")}
        onToggle={() => toggle("sec:position")}
      >
        <SousToggle
          keys={groupesPos.map((g) => `pos:${g.uid}`)}
          open={open}
          onToutPlier={toutPlier}
        />
        {groupesPos.map((g) => (
          <PosRow
            key={g.uid}
            g={g}
            partis={partis}
            open={isOpen(`pos:${g.uid}`)}
            onToggle={() => toggle(`pos:${g.uid}`)}
            onVotants={(pos) => goVotants(pos, g.uid, g.abrev ?? g.libelle)}
          />
        ))}
      </SectionFold>

      {/* 4) AMENDEMENTS SUR CE TEXTE (pliable, repliée ; absente si pas de dossier amendé) */}
      {am && (
        <SectionFold
          icon="edit-3"
          titre="Amendements sur ce texte"
          teaser={teaserAmend(am)}
          open={isOpen("sec:amend")}
          onToggle={() => toggle("sec:amend")}
        >
          {/* Sous-titre + tri */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 6, gap: 8 }}>
            <Text style={[T.small, { fontFamily: F.medium, color: C.textMuted, flex: 1 }]} numberOfLines={2}>
              {fmt(am.total)} déposés · {am.nbGroupes} groupes · {fmt(am.adoptes)} adoptés
            </Text>
            <TriToggle triNombre={triNombre} onToggle={() => setTriNombre((v) => !v)} />
          </View>

          {/* Encart ⓘ */}
          <View style={{ flexDirection: "row", gap: 8, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, padding: 12, marginBottom: 8 }}>
            <Feather name="info" size={15} color={C.textFaint} style={{ marginTop: 1 }} />
            <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, flex: 1, lineHeight: 18 }]}>
              {NOTE_AMENDEMENTS}
            </Text>
          </View>

          <SousToggle
            keys={lignesAmend.map((l) => `am:${l.kind === "groupe" ? l.g.groupe : l.g.kind}`)}
            open={open}
            onToutPlier={toutPlier}
          />

          {lignesAmend.map((l) => (
            <AmendRow
              key={l.kind === "groupe" ? l.g.groupe : l.g.kind}
              row={l}
              partis={partis}
              moyenne={am.moyenne}
              dossierRef={am.dossierRef}
              open={isOpen(`am:${l.kind === "groupe" ? l.g.groupe : l.g.kind}`)}
              onToggle={() => toggle(`am:${l.kind === "groupe" ? l.g.groupe : l.g.kind}`)}
            />
          ))}

          {/* Légende des trois couleurs de barre */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            <Legende couleur={C.pour} label="Adoptés" />
            <Legende couleur={C.contre} label="Rejetés" />
            <Legende couleur={C.absent} label="Sans suite (tombés, retirés…)" />
          </View>
        </SectionFold>
      )}

      {/* 5) LIEN SOURCE AN (toujours visible) */}
      {scrutinSourceUrl(s.numero) && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { track("source", String(s.numero ?? "")); Linking.openURL(scrutinSourceUrl(s.numero)!); }}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, minHeight: 44,
            backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, ...shadowCard,
          }}
        >
          <Feather name="external-link" size={15} color={C.accent} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le scrutin sur assemblee-nationale.fr</Text>
        </TouchableOpacity>
      )}

      <ParcoursLoi visible={parcours} onClose={() => setParcours(false)} source="scrutin" />
    </ScrollView>
  );
}

// --- Section pliable (1er niveau) ------------------------------------------
function SectionFold({
  icon, titre, teaser, open, onToggle, children,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  titre: string;
  teaser: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, ...shadowCard }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 12 }}
      >
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
          <Feather name={icon} size={16} color={C.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{titre}</Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 2 }]} numberOfLines={2}>{teaser}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6, minHeight: 32 }}>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>{open ? "Replier" : "Déplier"}</Text>
          <Feather name="chevron-down" size={14} color={C.accent} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </View>
      </TouchableOpacity>
      {open && <View style={{ paddingBottom: 12 }}>{children}</View>}
    </View>
  );
}

// --- Ligne « position d'un groupe » (2e niveau) ----------------------------
function PosRow({
  g, partis, open, onToggle, onVotants,
}: {
  g: GroupeVentilation;
  partis: PartiResume[];
  open: boolean;
  onToggle: () => void;
  onVotants: (position: string) => void;
}) {
  const nom = g.abrev ?? g.libelle;
  const votants = g.pour + g.contre + g.abstention + g.absent;
  const exprimes = g.pour + g.contre + g.abstention;
  const majorite =
    g.pour >= g.contre && g.pour >= g.abstention ? "pour" : g.contre >= g.abstention ? "contre" : "abstention";
  const posValue = g.consigne ?? (exprimes > 0 ? majorite : null);
  const libre = !g.consigne;
  // Dissidence : votes exprimés différents de la consigne.
  const dissidents = g.consigne
    ? exprimes - (g.consigne === "pour" ? g.pour : g.consigne === "contre" ? g.contre : g.abstention)
    : 0;
  const dissTexte = libre
    ? "Vote libre, pas de consigne"
    : dissidents === 0
    ? "Aucune dissidence"
    : `${dissidents} vote${dissidents > 1 ? "s" : ""} contraire${dissidents > 1 ? "s" : ""} à la consigne`;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingVertical: 8 }}
      >
        <HemicyclePicto groupes={partis} activeAbrev={g.abrev} color={g.couleur ?? C.textFaint} size={PICTO_SIZE} />
        <Text style={[T.small, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{nom}</Text>
        <Text style={[T.micro, tnum, { color: C.textFaint }]}>{votants} votants</Text>
        <Text style={[T.small, { fontFamily: F.extra, color: posValue ? couleurPosition(posValue) : C.textFaint, marginLeft: "auto" }]}>
          {posValue ? positionLabel(posValue) : "—"}
        </Text>
        <View style={{ backgroundColor: libre ? C.surfaceSunken : C.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={[T.micro, { fontFamily: F.semibold, color: libre ? C.textFaint : C.textMuted }]}>{libre ? "vote libre" : "consigne"}</Text>
        </View>
        <Feather name="chevron-down" size={16} color={C.textFaint} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingLeft: 2, paddingBottom: 12 }}>
          {/* Les 4 décomptes tiennent sur UNE ligne (colonnes d'égale largeur, sans retour). */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <CountChip label="Pour" n={g.pour} color={C.pour} onPress={() => onVotants("pour")} />
            <CountChip label="Contre" n={g.contre} color={C.contre} onPress={() => onVotants("contre")} />
            <CountChip label="Abst." n={g.abstention} color={C.abstention} onPress={() => onVotants("abstention")} />
            <CountChip label="Non votant" n={g.absent} color={C.textFaint} onPress={() => onVotants("nonvotant")} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Feather name="flag" size={12} color={C.textMuted} />
            <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>{dissTexte}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// --- Ligne « amendements d'un groupe / institution » (2e niveau) -----------
function AmendRow({
  row, partis, moyenne, dossierRef, open, onToggle,
}: {
  row: { kind: "groupe"; g: AmendGroupe } | { kind: "instit"; g: AmendInstitutionnel };
  partis: PartiResume[];
  moyenne: number;
  dossierRef: string;
  open: boolean;
  onToggle: () => void;
}) {
  const a = row.g;
  const nom = row.kind === "groupe" ? (a as AmendGroupe).abrev ?? (a as AmendGroupe).libelle
    : (a as AmendInstitutionnel).kind === "gouv" ? "Gouvernement" : "Commission";
  const sansSuite = Math.max(0, a.total - a.adoptes - a.rejetes);
  const w = (n: number): `${number}%` => `${(n / (a.total || 1)) * 100}%`;
  // Écart à la moyenne : SEULEMENT pour les groupes parlementaires (la moyenne est calculée
  // sur eux). Badge neutre, jamais une couleur de parti.
  const facteur = row.kind === "groupe" && moyenne > 0 ? a.total / moyenne : null;
  const dir = facteur == null ? 0 : facteur >= 1.15 ? 1 : facteur <= 0.87 ? -1 : 0;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ minHeight: 44, paddingVertical: 9 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {row.kind === "groupe" ? (
            <HemicyclePicto groupes={partis} activeAbrev={(a as AmendGroupe).abrev} color={(a as AmendGroupe).couleur ?? C.textFaint} size={PICTO_SIZE} />
          ) : (
            <View style={{ width: PICTO_SIZE, height: PICTO_SIZE * 0.72, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
                <Feather name={(a as AmendInstitutionnel).kind === "gouv" ? "briefcase" : "file-text"} size={15} color={C.textMuted} />
              </View>
            </View>
          )}
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{nom}</Text>
          {facteur != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto", backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
              {dir !== 0 && <Feather name={dir > 0 ? "arrow-up-right" : "arrow-down-right"} size={11} color={C.textMuted} />}
              <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }]}>
                {facteur.toFixed(1).replace(".", ",")}× moy.
              </Text>
            </View>
          )}
          <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text, marginLeft: facteur != null ? 0 : "auto" }]}>{fmt(a.total)}</Text>
          <Feather name="chevron-down" size={16} color={C.textFaint} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </View>
        {/* Barre de sort empilée : adoptés / rejetés / sans suite */}
        <View style={{ flexDirection: "row", height: 8, borderRadius: RADIUS.pill, overflow: "hidden", marginTop: 8, marginBottom: 6, backgroundColor: C.surfaceSunken }}>
          <View style={{ width: w(a.adoptes), backgroundColor: C.pour }} />
          <View style={{ width: w(a.rejetes), backgroundColor: C.contre }} />
          <View style={{ width: w(sansSuite), backgroundColor: C.absent }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {!!concentration(a) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="crosshair" size={13} color={C.textFaint} />
              <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted }]}>{concentration(a)}</Text>
            </View>
          )}
          <Text style={[T.micro, { color: C.textFaint }]}>·</Text>
          <Text style={[T.micro, tnum, { fontFamily: F.medium, color: C.textMuted }]}>{fmt(a.adoptes)} adoptés</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={{ paddingLeft: PICTO_SIZE + 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, columnGap: 12, marginBottom: 6 }}>
            <KV label="Adoptés" n={a.adoptes} color={C.pour} />
            <KV label="Rejetés" n={a.rejetes} color={C.contre} />
            <KV label="Tombés" n={a.tombes} color={C.textMuted} />
            <KV label="Retirés" n={a.retires} color={C.textMuted} />
            <KV label="Irrecevables" n={a.irrecevables} color={C.textMuted} />
          </View>
          {!!repartitionArticles(a) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <Feather name="crosshair" size={13} color={C.textFaint} />
              <Text style={[T.small, { fontFamily: F.medium, color: C.textMuted }]}>{repartitionArticles(a)}</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { const u = dossierSourceUrl(dossierRef); if (u) Linking.openURL(u); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32, alignSelf: "flex-start" }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="external-link" size={14} color={C.accent} />
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
              Voir les {fmt(a.total)} amendements{row.kind === "groupe" ? " du groupe" : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// --- Petits composants -----------------------------------------------------
// Déplie / replie d'un coup toutes les lignes d'une section (2e niveau de plis).
function SousToggle({
  keys, open, onToutPlier,
}: {
  keys: string[];
  open: Set<string>;
  onToutPlier: (keys: string[], ouvrir: boolean) => void;
}) {
  if (keys.length < 2) return null;
  const tout = keys.every((k) => open.has(k));
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4, marginBottom: 2 }}>
      <TouchableOpacity
        onPress={() => onToutPlier(keys, !tout)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={tout ? "Tout replier" : "Tout déplier"}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, paddingHorizontal: 4 }}
      >
        <Feather name={tout ? "chevrons-up" : "chevrons-down"} size={12} color={C.accent} />
        <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>{tout ? "Tout replier" : "Tout déplier"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function TriToggle({ triNombre, onToggle }: { triNombre: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={triNombre ? "Trier par groupe" : "Trier par nombre"}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 }}
    >
      <Feather name={triNombre ? "bar-chart-2" : "list"} size={12} color={C.textMuted} />
      <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>{triNombre ? "Par nombre" : "Par groupe"}</Text>
    </TouchableOpacity>
  );
}

function CountChip({ label, n, color, onPress }: { label: string; n: number; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      disabled={n === 0}
      onPress={onPress}
      activeOpacity={0.6}
      style={{ flex: 1, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center", opacity: n === 0 ? 0.5 : 1 }}
    >
      <Text style={[T.callout, tnum, { fontFamily: F.extra, color }]}>{fmt(n)}</Text>
      <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function KV({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <Text style={[T.small, { color }]}>
      {label} <Text style={[tnum, { fontFamily: F.extra }]}>{fmt(n)}</Text>
    </Text>
  );
}

function Legende({ couleur, label }: { couleur: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: couleur }} />
      <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>{label}</Text>
    </View>
  );
}

function Bloc({ titre, texte }: { titre: string; texte: string }) {
  return (
    <>
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, marginTop: 12, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }]}>
        {titre}
      </Text>
      <Text style={[T.small, { fontFamily: F.regular, color: C.text }]}>{texte}</Text>
    </>
  );
}

// Teaser de la section amendements : garde le signal en surface (section repliée).
function teaserAmend(am: NonNullable<DetailScrutin["amendements"]>): string {
  const top = [...am.groupes].sort((a, b) => b.total - a.total)[0];
  let t = `${fmt(am.total)} déposés`;
  if (top && am.total > 0 && top.total / am.total >= 0.25) {
    t += `, dont ${fmt(top.total)} par ${top.abrev ?? top.libelle}`;
    if (top.total > 0 && top.articleTopN / top.total >= SEUIL_CONCENTRE) t += " concentrés sur un article";
  } else {
    t += ` · ${am.nbGroupes} groupes`;
  }
  return t;
}
