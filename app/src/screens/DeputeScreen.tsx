import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, couleurGroupe, couleurPosition } from "../theme";
import { Card, Button } from "../components/ui";
import { HemicyclePicto } from "../components/HemicyclePicto";
import {
  ProfilTabs, PctCard, ProfilAvatar, SectionTitle, AccordSection, StatCarte, CommeToiVerrou, CommeToiCarte,
  VoteTexteRow, PastilleVote, OngletLead, type LigneAccord,
} from "../components/profil";
import { CategoryVoteCard } from "../components/CategoryVoteCard";
import { getProfil, getPartis, getCategories, getGrandsScrutins, getDissidences, getDeputeVotes, getDeputeMandat } from "../api";
import { useJe, useProximiteDepute } from "../testProximite/jeProximite";
import { estSitue } from "../testProximite/storage";
import {
  baseAccordVotant, resultatVotant, accordsParTheme, pctPondereDiffere, verdictVote, CLE_VOTANT,
} from "../testProximite/baseAccord";
import { useFollow } from "../hooks/useFollows";
import { partagerLien } from "../share";
import type { ProfilDepute, PartiResume, CategorieRef, Dissidence, ScrutinResume } from "../types";
import type { Nav } from "../nav";

/**
 * Fiche député en PAGE PROFIL (même moule que la fiche parti) : identité, deux cartes de
 * chiffres (scrutins publics + votes avec son groupe), « Comme toi ? » verrouillé (non situé)
 * ou carte du % comme toi en tête (situé), Suivre/Partager, puis onglets. Non situé : Votes
 * d'abord (du contenu dès l'arrivée) ; situé : Accord d'abord.
 *
 * Le % comme toi est celui du moteur officiel (`useProximiteDepute` → `scoreVotant`) ; sa base
 * (scrutins comparés, comme toi / à l'inverse) et l'accord par thème viennent de
 * `testProximite/baseAccord` (pur, testé). Tout ce qui touche « toi » reste sur l'appareil.
 */

const NB_VOTES = 8; // derniers votes sur des textes entiers (grands scrutins) dans l'onglet Votes
type Onglet = "accord" | "votes" | "mandat";
type DVotes = Record<string, [string, string | null]>; // scrutin_uid -> [position, consigne]

const EXPR = (p: string | null | undefined) => p === "pour" || p === "contre" || p === "abstention";
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisAnnee = (iso: string | null | undefined) => (iso ? `${MOIS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(0, 4)}` : null);
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// Suit / s'écarte de la ligne du groupe sur un scrutin (position du député vs position majoritaire
// du groupe, champ `consigne` ; null = égalité dans le groupe → ni l'un ni l'autre).
function ecartGroupe(pos: string, consigne: string | null): "suit" | "ecarte" | null {
  if (!EXPR(pos) || !EXPR(consigne)) return null;
  return pos === consigne ? "suit" : "ecarte";
}
function posTexte(pos: string): string {
  if (pos === "pour") return "A voté pour";
  if (pos === "contre") return "A voté contre";
  if (pos === "abstention") return "S'est abstenu·e";
  if (pos === "absent") return "Absent·e";
  return "Non-votant·e";
}

export function DeputeScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [profil, setProfil] = useState<ProfilDepute | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  // Situé = au moins une réponse pour/contre au test (lu au montage, sans attendre le calcul).
  const [situe] = useState(estSitue);
  const [onglet, setOnglet] = useState<Onglet>(situe ? "accord" : "votes");
  const je = useJe();
  const scoreGlobal = useProximiteDepute(uid); // % comme toi (moteur officiel)

  const [votes, setVotes] = useState<DVotes | null>(null);
  const [mandat, setMandat] = useState<{ mandat_debut: string | null; mandat_fin?: string | null } | null>(null);
  const [dissidences, setDissidences] = useState<Dissidence[] | null>(null);
  const [grands, setGrands] = useState<ScrutinResume[] | null>(null);

  // En-tête + accord : chargés une fois par uid (même fichier élu, mis en cache par l'API).
  useEffect(() => {
    setProfil(null); setVotes(null); setMandat(null); setDissidences(null);
    getProfil(uid, "all").then(setProfil).catch(() => setProfil(null));
    getPartis().then(setPartis).catch(() => {});
    getCategories().then(setCats).catch(() => {});
    getDeputeVotes(uid).then(setVotes).catch(() => setVotes({}));
    getDeputeMandat(uid).then(setMandat).catch(() => setMandat({ mandat_debut: null }));
    getDissidences(uid).then(setDissidences).catch(() => setDissidences([]));
  }, [uid]);

  // Lazy : grands scrutins (onglet Votes).
  useEffect(() => {
    if (grands == null && onglet === "votes") getGrandsScrutins().then(setGrands).catch(() => setGrands([]));
  }, [onglet, grands]);

  // Votes bruts { scrutin_uid: position } pour la base et l'accord par thème.
  const bruts = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [su, [pos]] of Object.entries(votes ?? {})) out[su] = pos;
    return out;
  }, [votes]);

  if (!profil) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const d = profil.depute;
  const seSituer = () => nav.push({ name: "testIntro" });
  const ouvrirGroupe = () => d.groupe_uid && nav.push({ name: "parti", uid: d.groupe_uid });
  const circo = d.departement && d.circo ? `${d.departement}, ${d.circo}${d.circo === "1" ? "re" : "e"} circonscription` : d.departement ?? null;
  const debut = moisAnnee(mandat?.mandat_debut);
  const fin = moisAnnee(mandat?.mandat_fin ?? d.mandat_fin);
  const nEcarts = dissidences?.length ?? null;

  // Base du % comme toi (situé) : sur combien de scrutins, dont comme toi / à l'inverse.
  let baseTexte: string | null = null;
  if (situe && je && votes) {
    const b = baseAccordVotant(je.questions, je.reponses, bruts);
    baseTexte = b.comparable
      ? `Sur ${b.comparable > 1 ? `les ${b.comparable} scrutins` : "le scrutin"} que tu as tranché${b.comparable > 1 ? "s" : ""} et où ce député a voté : ${b.accord} comme toi, ${b.inverse} à l'inverse.` +
        (scoreGlobal && pctPondereDiffere(scoreGlobal.pct, b) ? " Le pourcentage fait la moyenne de tes thèmes, chacun selon l'importance que tu lui donnes." : "")
      : "Ce député n'a voté sur aucun des scrutins que tu as tranchés pour l'instant.";
  }

  const participation = profil.participation_pct;
  const rang = profil.participation_rang_pct;
  const loyaute = profil.loyaute_globale_pct;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
      {/* ===== EN-TÊTE D'IDENTITÉ ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s14 }}>
          <ProfilAvatar uri={d.photo_url} size={54} ring={couleurGroupe(d.couleur)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>{d.nom_complet}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8, marginTop: 6, flexWrap: "wrap", rowGap: 6 }}>
              <TouchableOpacity
                onPress={ouvrirGroupe}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir la fiche du groupe ${d.abrev ?? d.groupe ?? ""}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleurGroupe(d.couleur) }} />
                <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{d.abrev ?? d.groupe ?? "—"}</Text>
              </TouchableOpacity>
              {circo && <Text style={[T.small, { color: C.textMuted }]}>{circo}</Text>}
            </View>
          </View>
        </View>
        {debut && (
          <Text style={[T.small, { color: C.textFaint, marginTop: S.s8, marginLeft: 78 }]}>
            {fin ? `A siégé de ${debut} à ${fin}` : `En mandat depuis ${debut}`}
          </Text>
        )}

        {/* Situé : le % comme toi en tête */}
        {situe && (
          <View style={{ marginTop: S.s14 }}>
            <CommeToiCarte pct={scoreGlobal?.pct ?? null} base={baseTexte} />
          </View>
        )}

        {/* Deux chiffres : participation aux scrutins publics + votes avec son groupe */}
        <View style={{ flexDirection: "row", gap: S.s8, marginTop: situe ? S.s8 : S.s14 }}>
          <StatCarte
            compact={situe}
            valeur={participation != null ? `${participation} %` : "—"}
            label="des scrutins publics"
            contexte={rang != null ? `Plus assidu·e que ${rang} % des députés` : null}
          />
          <StatCarte
            compact={situe}
            valeur={loyaute != null ? `${loyaute} %` : "—"}
            label={situe ? "avec son groupe" : "de ses votes avec son groupe"}
            contexte={nEcarts == null ? null : nEcarts ? `${pluriel(nEcarts, "vote")} à l'écart du groupe` : "Aucun vote à l'écart du groupe"}
          />
        </View>

        {/* Non situé : « Comme toi ? » verrouillé, cliquable */}
        {!situe && (
          <View style={{ marginTop: S.s8 }}>
            <CommeToiVerrou phrase="Situe-toi pour voir ton pourcentage d'accord" onPress={seSituer} />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 10, marginTop: S.s12, marginBottom: S.s12 }}>
          <SuivreBouton uid={uid} nom={d.nom_complet} />
          <Button
            label="Partager"
            variant="outline"
            size="md"
            style={{ flex: 1 }}
            iconLeft={<Feather name="share" size={ICON.sm} color={C.accent} />}
            onPress={() => {
              const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://scrutoir.fr";
              partagerLien(`${origin}/?open=depute:${uid}`, `${d.nom_complet} à l'Assemblée : ses votes réels. Et toi ?`);
            }}
          />
        </View>
      </View>

      {/* ===== ONGLETS (Votes d'abord si non situé, Accord d'abord si situé) ===== */}
      <ProfilTabs<Onglet>
        tabs={situe
          ? [{ key: "accord", label: "Accord" }, { key: "votes", label: "Votes" }, { key: "mandat", label: "Mandat" }]
          : [{ key: "votes", label: "Votes" }, { key: "accord", label: "Accord" }, { key: "mandat", label: "Mandat" }]}
        active={onglet}
        onChange={setOnglet}
      />

      {/* ===== CORPS ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s4 }}>
        {onglet === "accord" && (
          <OngletAccord je={je} votes={votes ? bruts : null} cats={cats} situe={situe} onSituer={seSituer} nom={d.nom_complet} />
        )}
        {onglet === "votes" && (
          <OngletVotes
            grands={grands}
            votes={votes}
            reponses={situe ? je?.reponses ?? {} : {}}
            nEcarts={nEcarts}
            onEcarts={() => nav.push({ name: "dissidences", uid: d.uid, nom: d.nom_complet })}
            nav={nav}
          />
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
      size="md"
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
}: { je: ReturnType<typeof useJe>; votes: Record<string, string> | null; cats: CategorieRef[]; situe: boolean; onSituer: () => void; nom: string }) {
  const lignes = useMemo<LigneAccord[]>(() => {
    if (!je || !votes) return [];
    const lib = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
    const res = resultatVotant(je.questions, je.reponses, je.poids, votes);
    return accordsParTheme(res, CLE_VOTANT).map((l) => ({ ...l, libelle: lib(l.id) }));
  }, [je, votes, cats]);
  if (situe && (je == null || votes == null)) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  return (
    <AccordSection
      lignes={lignes}
      situe={situe}
      onSituer={onSituer}
      invitation={`Réponds à quelques votes réels de l'Assemblée : on compare tes réponses aux votes de ${nom}, thème par thème.`}
      lead={`Ton accord avec ${nom}, thème par thème, d'après ses propres votes.`}
      emptyMsg={`${nom} n'a voté sur aucun des scrutins que tu as tranchés pour l'instant : rien à comparer par thème.`}
    />
  );
}

// ===== ONGLET VOTES =====
function OngletVotes({
  grands, votes, reponses, nEcarts, onEcarts, nav,
}: {
  grands: ScrutinResume[] | null; votes: DVotes | null; reponses: Record<number, string>;
  nEcarts: number | null; onEcarts: () => void; nav: Nav;
}) {
  if (grands == null || votes == null) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  const lignes = grands
    .map((s) => ({ s, v: votes[s.uid] }))
    .filter((x) => x.v && EXPR(x.v[0]))
    .slice(0, NB_VOTES);
  return (
    <View>
      {lignes.length ? (
        <>
          <OngletLead>Ses derniers votes sur des textes entiers</OngletLead>
          <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
            {lignes.map(({ s, v }, i) => {
              const [pos, consigne] = v!;
              const ecart = ecartGroupe(pos, consigne);
              const toi = s.numero != null ? verdictVote(reponses[s.numero] as any, pos) : null;
              return (
                <VoteTexteRow key={s.uid} s={s} premier={i === 0} onPress={() => nav.push({ name: "scrutin", uid: s.uid })}>
                  <PastilleVote label={posTexte(pos)} point={couleurPosition(pos)} fg={C.text} />
                  {ecart === "suit" && <PastilleVote label="Comme son groupe" />}
                  {ecart === "ecarte" && <PastilleVote label="S'écarte du groupe" fg={C.loyalMoyen} bg={C.loyalMoyenBg} />}
                  {toi === "comme" && <PastilleVote label="Comme toi" fg={C.adopteFg} bg={C.adopteBg} />}
                  {toi === "inverse" && <PastilleVote label="Pas comme toi" fg={C.rejeteFg} bg={C.rejeteBg} />}
                </VoteTexteRow>
              );
            })}
          </Card>
        </>
      ) : (
        <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>Aucun vote de ce député sur les derniers textes entiers.</Text>
      )}
      {!!nEcarts && (
        <TouchableOpacity
          onPress={onEcarts}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Voir ses ${pluriel(nEcarts, "vote")} à l'écart de son groupe`}
          style={{ flexDirection: "row", alignItems: "center", minHeight: 44, marginTop: S.s8, paddingHorizontal: 2 }}
        >
          <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.accent }]}>
            {nEcarts > 1 ? `Ses ${nEcarts} votes à l'écart de son groupe` : "Son vote à l'écart de son groupe"}
          </Text>
          <Feather name="chevron-right" size={ICON.base} color={C.accent} />
        </TouchableOpacity>
      )}
    </View>
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

      {/* Participation aux scrutins publics (+ rang parmi les députés) */}
      <SectionTitle>Participation aux scrutins publics</SectionTitle>
      <PctCard pct={part} label="des scrutins publics">
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
