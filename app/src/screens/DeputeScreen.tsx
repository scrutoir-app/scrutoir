import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, S, ICON, couleurGroupe, couleurPosition } from "../theme";
import { Card, Chip, Button } from "../components/ui";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { StatCol, ProfilTabs, PctCard, ProfilAvatar, SectionTitle, AccordSection, SEUIL_COMME, type LigneAccord } from "../components/profil";
import { CategoryVoteCard } from "../components/CategoryVoteCard";
import { catUI } from "../categoryUI";
import { getProfil, getPartis, getCategories, getGrandsScrutins, getDissidences, getDeputeVotes, getDeputeMandat } from "../api";
import { useJe, useProximiteDepute } from "../testProximite/jeProximite";
import { useFollow } from "../follows";
import { calculerProximite, scrutinUidDeId, type PositionGroupe } from "../testProximite/score";
import { partagerLien } from "../share";
import type { ProfilDepute, PartiResume, CategorieRef, Dissidence, ScrutinResume } from "../types";
import type { Nav } from "../nav";

/**
 * Fiche député en PAGE PROFIL (même moule que la fiche parti) : en-tête d'identité fixe
 * (avatar cerclé de la couleur du groupe + 3 stats + Suivre/Partager) puis onglets
 * Accord / Votes / Mandat. Répond à : ce député me ressemble-t-il, est-il présent, suit-il
 * ou casse-t-il la ligne de son groupe ?
 *
 * Réutilise les primitives profil partagées (`components/profil`) et les moteurs officiels :
 * proximité GLOBALE + PAR THÈME via `calculerProximite` appliqué aux VOTES INDIVIDUELS du
 * député (même moteur que le global) ; suit/écart via la consigne portée par chaque vote ;
 * présence/loyauté depuis `ProfilDepute`. Couleurs via `C`/`couleurGroupe`/`couleurPosition`
 * uniquement (le tag « s'écarte » = token `C.loyalMoyen`). 100 % client, aucun compteur.
 */

const NB_VOTES = 8; // grands scrutins échantillonnés pour l'onglet Votes
type Onglet = "accord" | "votes" | "mandat";
type DVotes = Record<string, [string, string | null]>; // scrutin_uid -> [position, consigne]

const EXPR = (p: string | null | undefined) => p === "pour" || p === "contre" || p === "abstention";

// Accord user ↔ député PAR THÈME, depuis ses votes individuels (même moteur `calculerProximite`).
function accordDeputeParTheme(je: ReturnType<typeof useJe>, votes: DVotes, cats: CategorieRef[]): LigneAccord[] {
  if (!je) return [];
  const CLE = "__moi";
  const lib = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  const qs = je.questions.map((q) => {
    const v = votes[scrutinUidDeId(q.id)]?.[0];
    const pos: PositionGroupe = v === "pour" || v === "contre" ? v : "abstention"; // non comparable sinon
    return { ...q, positions: { [CLE]: pos } };
  });
  const res = calculerProximite(qs, je.reponses, je.poids, [{ abrev: CLE }]);
  const out: LigneAccord[] = [];
  for (const [theme, parG] of Object.entries(res.parTheme)) {
    const sc = parG[CLE];
    if (!sc || sc.pct == null || sc.comparable < 1) continue;
    out.push({ id: theme, libelle: lib(theme), pct: sc.pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// Suit / s'écarte de la ligne du groupe sur un scrutin (position du député vs consigne).
function ecartGroupe(pos: string, consigne: string | null): "suit" | "ecarte" | null {
  if (!EXPR(pos) || !EXPR(consigne)) return null;
  return pos === consigne ? "suit" : "ecarte";
}
function posTexte(pos: string): string {
  if (pos === "pour") return "A voté Pour";
  if (pos === "contre") return "A voté Contre";
  if (pos === "abstention") return "S'est abstenu·e";
  if (pos === "absent") return "Absent·e";
  return "Non-votant·e";
}

export function DeputeScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [profil, setProfil] = useState<ProfilDepute | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [onglet, setOnglet] = useState<Onglet>("accord");
  const je = useJe();
  const scoreGlobal = useProximiteDepute(uid); // proximité globale à CE député (charge ses votes)

  const [votes, setVotes] = useState<DVotes | null>(null);
  const [mandat, setMandat] = useState<{ mandat_debut: string | null } | null>(null);
  const [dissidences, setDissidences] = useState<Dissidence[] | null>(null);
  const [grands, setGrands] = useState<ScrutinResume[] | null>(null);

  // En-tête + accord : chargés une fois par uid (ne se rechargent pas au changement d'onglet).
  useEffect(() => {
    setProfil(null); setVotes(null); setMandat(null);
    getProfil(uid, "all").then(setProfil).catch(() => setProfil(null));
    getPartis().then(setPartis).catch(() => {});
    getCategories().then(setCats).catch(() => {});
    getDeputeVotes(uid).then(setVotes).catch(() => setVotes({}));
    getDeputeMandat(uid).then(setMandat).catch(() => setMandat({ mandat_debut: null }));
  }, [uid]);

  // Lazy : grands scrutins (onglet Votes) et dissidences (onglet Mandat).
  useEffect(() => {
    if (grands == null && onglet === "votes") getGrandsScrutins().then(setGrands).catch(() => setGrands([]));
    if (dissidences == null && onglet === "mandat") getDissidences(uid).then(setDissidences).catch(() => setDissidences([]));
  }, [onglet, uid, grands, dissidences]);

  if (!profil) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const d = profil.depute;
  const situe = je != null;
  const seSituer = () => nav.push({ name: "testIntro" });
  const ouvrirGroupe = () => d.groupe_uid && nav.push({ name: "parti", uid: d.groupe_uid });
  const circo = d.departement && d.circo ? `${d.departement}, ${d.circo}ᵉ circ.` : d.departement ?? null;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
      {/* ===== EN-TÊTE D'IDENTITÉ ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <ProfilAvatar uri={d.photo_url} size={72} ring={couleurGroupe(d.couleur)} />
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
            <StatCol
              n={situe && scoreGlobal ? `${Math.round(scoreGlobal.pct * 100)}%` : "—"}
              label="comme toi"
              color={situe && scoreGlobal ? (scoreGlobal.pct >= SEUIL_COMME ? C.pour : C.contre) : undefined}
            />
            <StatCol n={profil.participation_pct != null ? `${profil.participation_pct}%` : "—"} label="présence" />
            <StatCol n={profil.loyaute_globale_pct != null ? `${profil.loyaute_globale_pct}%` : "—"} label={"avec son\ngroupe"} />
          </View>
        </View>
        <Text style={[T.title, { color: C.text, marginTop: S.s12 }]} numberOfLines={1}>{d.nom_complet}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap", rowGap: 6 }}>
          <TouchableOpacity
            onPress={ouvrirGroupe}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir la fiche du groupe ${d.abrev ?? d.groupe ?? ""}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleurGroupe(d.couleur) }} />
            <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]}>{d.abrev ?? d.groupe ?? "—"}</Text>
          </TouchableOpacity>
          {circo && <Text style={[T.small, { color: C.textMuted }]}>· {circo}</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: 9, marginTop: S.s12, marginBottom: S.s12 }}>
          <SuivreBouton uid={uid} nom={d.nom_complet} />
          <Button
            label="Partager"
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
            iconLeft={<Feather name="share-2" size={ICON.sm} color={C.accent} />}
            onPress={() => {
              const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://scrutoir.fr";
              partagerLien(`${origin}/?open=depute:${uid}`, `${d.nom_complet} à l'Assemblée : ses votes réels. Et toi ?`);
            }}
          />
        </View>
      </View>

      {/* ===== ONGLETS ===== */}
      <ProfilTabs<Onglet>
        tabs={[{ key: "accord", label: "Accord" }, { key: "votes", label: "Votes" }, { key: "mandat", label: "Mandat" }]}
        active={onglet}
        onChange={setOnglet}
      />

      {/* ===== CORPS ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s4 }}>
        {onglet === "accord" && (
          <OngletAccord je={je} votes={votes} cats={cats} situe={situe} onSituer={seSituer} nom={d.nom_complet} />
        )}
        {onglet === "votes" && (
          <OngletVotes grands={grands} votes={votes} reponses={je?.reponses ?? {}} situe={situe} nav={nav} />
        )}
        {onglet === "mandat" && (
          <OngletMandat profil={profil} partis={partis} mandat={mandat} dissidences={dissidences} circo={circo} onGroupe={ouvrirGroupe} nav={nav} />
        )}
      </View>
    </ScrollView>
  );
}

/** Bouton Suivre/Suivi (primaire), câblé sur le vrai état de suivi du DÉPUTÉ. */
function SuivreBouton({ uid, nom }: { uid: string; nom: string }) {
  const [suivi, toggle] = useFollow(uid);
  return (
    <Button
      label={suivi ? "Suivi" : "Suivre"}
      variant="primary"
      size="sm"
      style={{ flex: 1 }}
      onPress={toggle}
      accessibilityLabel={suivi ? `Ne plus suivre ${nom}` : `Suivre ${nom}`}
      iconLeft={<Feather name={suivi ? "check" : "bell"} size={ICON.sm} color={C.onAccent} />}
    />
  );
}

// ===== ONGLET ACCORD =====
function OngletAccord({
  je, votes, cats, situe, onSituer, nom,
}: { je: ReturnType<typeof useJe>; votes: DVotes | null; cats: CategorieRef[]; situe: boolean; onSituer: () => void; nom: string }) {
  const lignes = useMemo(() => (votes ? accordDeputeParTheme(je, votes, cats) : []), [je, votes, cats]);
  if (situe && votes == null) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  return (
    <AccordSection
      lignes={lignes}
      situe={situe}
      onSituer={onSituer}
      catsPreview={cats}
      lead={`Ton accord avec ${nom}, d'après ses propres votes — vert tu le rejoins, rouge tu diverges.`}
      leadLocked={`Ton accord avec ${nom}, thème par thème.`}
      emptyMsg={`Pas encore assez de scrutins comparés avec ${nom} pour ventiler par thème.`}
    />
  );
}

// ===== ONGLET VOTES =====
function OngletVotes({
  grands, votes, reponses, situe, nav,
}: { grands: ScrutinResume[] | null; votes: DVotes | null; reponses: Record<number, string>; situe: boolean; nav: Nav }) {
  if (grands == null || votes == null) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  const lignes = grands
    .map((s) => ({ s, v: votes[s.uid] }))
    .filter((x) => x.v && EXPR(x.v[0]))
    .slice(0, NB_VOTES);
  if (!lignes.length) return <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>Aucun scrutin clé pour ce député.</Text>;
  return (
    <View>
      <Text style={[T.small, { color: C.textFaint, marginTop: S.s12, marginBottom: S.s10, paddingHorizontal: 2 }]}>
        Ses votes personnels, et s'il suit ou s'écarte de son groupe.
      </Text>
      <Card bordered padding={0}>
        {lignes.map(({ s, v }, i) => (
          <VoteRow
            key={s.uid}
            s={s}
            pos={v![0]}
            consigne={v![1]}
            commeToi={situe && s.numero != null && EXPR(reponses[s.numero]) ? reponses[s.numero] === v![0] : null}
            dernier={i === lignes.length - 1}
            onPress={() => nav.push({ name: "scrutin", uid: s.uid })}
          />
        ))}
      </Card>
    </View>
  );
}

function VoteRow({
  s, pos, consigne, commeToi, dernier, onPress,
}: { s: ScrutinResume; pos: string; consigne: string | null; commeToi: boolean | null; dernier: boolean; onPress: () => void }) {
  const ui = catUI(s.categorie ?? "");
  const col = couleurPosition(pos);
  const ecart = ecartGroupe(pos, consigne);
  const titre = s.dossier_titre ?? s.titre ?? s.objet ?? "Scrutin";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le scrutin : ${titre}`}
      style={{ paddingHorizontal: S.s14, paddingVertical: 13, ...(dernier ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }) }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <MaterialCommunityIcons name={ui.icon as any} size={13} color={C.textMuted} />
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.3 }]} numberOfLines={1}>
          {(ui as { court?: string }).court ?? s.categorie ?? "—"}
        </Text>
      </View>
      <Text style={[T.small, { fontFamily: F.bold, color: C.text, lineHeight: 18 }]} numberOfLines={2}>{titre}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, rowGap: 6, marginTop: 9 }}>
        {/* Position individuelle (point coloré + libellé, fond neutre) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
          <Text style={[T.micro, { fontFamily: F.bold, color: col }]}>{posTexte(pos)}</Text>
        </View>
        {/* Suit / s'écarte de son groupe (token ambre de loyauté pour l'écart) */}
        {ecart === "suit" && <Chip label="Comme son groupe" bg={C.surfaceAlt} fg={C.textMuted} ph={9} pv={3} />}
        {ecart === "ecarte" && <Chip label="S'écarte du groupe" bg={C.loyalMoyenBg} fg={C.loyalMoyen} ph={9} pv={3} />}
        {/* Comme toi / pas comme toi (si situé et scrutin tranché par l'utilisateur) */}
        {commeToi === true && <Chip label="comme toi" bg={C.adopteBg} fg={C.adopteFg} ph={9} pv={3} />}
        {commeToi === false && <Chip label="pas comme toi" bg={C.rejeteBg} fg={C.rejeteFg} ph={9} pv={3} />}
        <Feather name="chevron-right" size={16} color={C.textFaint} style={{ marginLeft: "auto" }} />
      </View>
    </TouchableOpacity>
  );
}

// ===== ONGLET MANDAT =====
function OngletMandat({
  profil, partis, mandat, dissidences, circo, onGroupe, nav,
}: {
  profil: ProfilDepute; partis: PartiResume[]; mandat: { mandat_debut: string | null } | null;
  dissidences: Dissidence[] | null; circo: string | null; onGroupe: () => void; nav: Nav;
}) {
  const d = profil.depute;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groupe = partis.find((p) => p.uid === d.groupe_uid);
  const anneeDebut = mandat?.mandat_debut ? mandat.mandat_debut.slice(0, 4) : null;
  const part = profil.participation_pct;
  const rang = profil.participation_rang_pct;
  const loy = profil.loyaute_globale_pct;
  const nEcarts = dissidences?.length ?? null;
  const notables = (dissidences ?? []).slice(0, 2).map((x) => x.titre).filter(Boolean) as string[];

  return (
    <View style={{ marginTop: S.s12 }}>
      {/* Carte Groupe (picto hémicycle + nom, tap → fiche parti) + infos de mandat */}
      <Card
        onPress={onGroupe}
        padding={0}
        accessibilityLabel={`Ouvrir la fiche du groupe ${groupe?.libelle ?? d.groupe ?? ""}`}
        style={{ marginBottom: S.s12, overflow: "hidden" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 }}>
          <View style={{ width: 46, height: 46 * 0.72, alignItems: "center", justifyContent: "center" }}>
            <HemicyclePicto groupes={partis} activeAbrev={d.abrev} color={d.couleur ?? C.textFaint} size={46} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{groupe?.libelle ?? d.groupe ?? "Groupe"}</Text>
            <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>Membre du groupe · voir la fiche</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </View>
        {/* Infos : circonscription, mandat depuis (commission indisponible côté données) */}
        {circo && <InfoRow k="Circonscription" v={circo} />}
        {anneeDebut && <InfoRow k="Mandat depuis" v={anneeDebut} />}
      </Card>

      {/* Présence (+ rang parmi les députés) */}
      <SectionTitle>Présence</SectionTitle>
      <PctCard pct={part} label="de participation aux scrutins">
        {part != null ? `A pris part à ${part} % des scrutins publics nominatifs.` : "Participation non mesurée."}
        {rang != null && <Text> Plus assidu·e que <Text style={{ fontFamily: F.bold, color: C.text }}>{rang} %</Text> des députés.</Text>}
      </PctCard>

      {/* Loyauté au groupe + écarts notables nommés + accès aux dissidences */}
      <SectionTitle>Loyauté au groupe</SectionTitle>
      <PctCard pct={loy} label="votes dans le sens du groupe">
        {loy != null ? `Vote dans le sens de son groupe ${loy} % du temps.` : "Loyauté non mesurée."}
        {nEcarts != null && nEcarts > 0 && (
          <Text>
            {" "}S'est écarté·e de la ligne <Text style={{ fontFamily: F.bold, color: C.text }}>{nEcarts} fois</Text>
            {notables.length > 0 && <Text>, notamment sur « {notables.join(" » et « ")} »</Text>}.
          </Text>
        )}
      </PctCard>
      {nEcarts != null && nEcarts > 0 && (
        <Card
          onPress={() => nav.push({ name: "dissidences", uid: d.uid, nom: d.nom_complet })}
          padding={13}
          accessibilityLabel={`Voir les ${nEcarts} dissidences de ${d.nom_complet}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: S.s12 }}
        >
          <Feather name="git-branch" size={ICON.base} color={C.accent} />
          <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.text }]}>Voir ses {nEcarts} dissidences</Text>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </Card>
      )}

      {/* Ses votes par thème (répartition pour/contre/abst/absent, dépli → listes filtrées) */}
      {profil.categories.length > 0 && (
        <>
          <SectionTitle>Ses votes par thème</SectionTitle>
          <View style={{ gap: 10 }}>
            {profil.categories.map((c) => (
              <CategoryVoteCard
                key={c.id}
                cat={c}
                ouvert={!!expanded[c.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
                onTitle={() => nav.push({ name: "votesCategorie", uid: d.uid, nom: d.nom_complet, categorie: c.id, categorieLibelle: c.libelle, periode: "all" })}
                onCell={(position) => nav.push({ name: "votesDepute", uid: d.uid, nom: d.nom_complet, categorie: c.id, categorieLibelle: c.libelle, position })}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border }}>
      <Text style={[T.small, { color: C.textMuted, width: 120 }]}>{k}</Text>
      <Text style={[T.small, { fontFamily: F.bold, color: C.text, flex: 1 }]}>{v}</Text>
    </View>
  );
}
