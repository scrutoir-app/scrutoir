import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, S, ICON, couleurPosition } from "../theme";
import { Card, Button } from "../components/ui";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { BarreDivergente } from "../components/BarreDivergente";
import {
  ProfilTabs, PctCard, ProfilAvatar, SectionTitle, AccordSection, StatCarte, CommeToiVerrou, CommeToiCarte,
  VoteTexteRow, PastilleVote, OngletLead, type LigneAccord,
} from "../components/profil";
import { catUI } from "../categoryUI";
import { getParti, getPartis, getCategories, getGrandsScrutins, getScrutin, getDeputesParti } from "../api";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import { estSitue } from "../testProximite/storage";
import { accordsParTheme, baseAccordGroupe } from "../testProximite/baseAccord";
import { decompteGroupe } from "../decompte";
import { useFollow } from "../hooks/useFollows";
import { positionMajoritaire, tailleGroupe } from "../testProximite/verdict";
import { partagerLien } from "../share";
import type { ProfilParti, PartiResume, CategorieRef, GroupeVentilation, DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";

/**
 * Fiche parti en PAGE PROFIL, même moule que la fiche député : identité (hémicycle du logo +
 * sigle + nom + sièges), deux cartes de chiffres (votes soudés + plus forte fracture,
 * participation + moyenne des groupes), « Comme toi ? » verrouillé (non situé) ou carte du
 * % comme toi en tête (situé), Suivre/Partager, puis onglets. Non situé : Votes d'abord ;
 * situé : Accord d'abord.
 *
 * Le % comme toi et l'accord par thème viennent du moteur officiel (`useJe` →
 * `calculerProximite`, `resultat.parTheme`, même source que le spectre), relus par
 * `testProximite/baseAccord` (pur, testé). Tout ce qui touche « toi » reste sur l'appareil.
 */

const NB_VOTES_CLES = 8; // derniers votes sur des textes entiers (affichés + base de la « fracture »)
type Onglet = "accord" | "votes" | "groupe";

// Scrutin clé + ventilation de CE groupe (position majoritaire + décompte interne).
type VoteCle = { s: ScrutinResume; g: GroupeVentilation };

// « Fracture » sur un scrutin = nb d'élus votant le camp TRANCHÉ opposé à la ligne majoritaire.
// Sans ligne (égalité en tête) : le plus petit des deux camps tranchés (10 pour, 10 contre → 10).
function fracture(g: GroupeVentilation): number {
  const maj = positionMajoritaire(g);
  if (maj === "pour") return g.contre || 0;
  if (maj === "contre") return g.pour || 0;
  if (maj === null) return Math.min(g.pour || 0, g.contre || 0);
  return Math.max(g.pour || 0, g.contre || 0);
}

/** Plus forte fracture parmi les votes clés : thème + nombre de voix contre la ligne (null si aucune). */
function plusForteFracture(votes: VoteCle[] | null): { theme: string; n: number } | null {
  if (!votes || !votes.length) return null;
  const pire = votes.reduce((best, v) => (fracture(v.g) > fracture(best.g) ? v : best), votes[0]);
  const n = fracture(pire.g);
  if (!n) return null;
  return { theme: catUI(pire.s.categorie ?? "").court ?? pire.s.categorie ?? "un texte", n };
}

export function PartiScreen({ uid, sansUid = false, nav }: { uid: string; sansUid?: boolean; nav: Nav }) {
  const [profil, setProfil] = useState<ProfilParti | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  // Situé = au moins une réponse pour/contre au test (lu au montage, sans attendre le calcul).
  const [situe] = useState(estSitue);
  const [onglet, setOnglet] = useState<Onglet>(situe ? "accord" : "votes");
  const je = useJe();

  // Votes clés (en-tête : fracture ; onglets Votes et Le groupe) ; membres (Le groupe, lazy).
  const [votesCles, setVotesCles] = useState<VoteCle[] | null>(null);
  const [membres, setMembres] = useState<DeputeResume[] | null>(null);

  // En-tête : chargé une seule fois par uid (ne se recharge PAS au changement d'onglet).
  useEffect(() => {
    setProfil(null); setVotesCles(null); setMembres(null);
    getParti(uid, "all").then(setProfil).catch(() => setProfil(null));
    getPartis().then(setPartis).catch(() => {});
    getCategories().then(setCats).catch(() => {});
  }, [uid]);

  const abrev = profil?.parti.abrev ?? null;

  // Votes clés : dès l'ouverture (la plus forte fracture est dans l'en-tête).
  useEffect(() => {
    if (votesCles != null || !abrev) return;
    let vivant = true;
    getGrandsScrutins()
      .then(async (grands) => {
        const details = await Promise.all(
          grands.slice(0, NB_VOTES_CLES).map((s) => getScrutin(s.uid).then((d) => ({ s, d })).catch(() => null))
        );
        const out: VoteCle[] = [];
        for (const item of details) {
          if (!item) continue;
          const g = item.d.groupes.find((x) => x.abrev === abrev);
          if (g && tailleGroupe(g) > 0) out.push({ s: item.s, g });
        }
        if (vivant) setVotesCles(out);
      })
      .catch(() => vivant && setVotesCles([]));
    return () => { vivant = false; };
  }, [abrev, votesCles]);

  // Membres : au 1er passage sur Le groupe.
  useEffect(() => {
    if (membres != null || onglet !== "groupe" || !profil) return;
    let vivant = true;
    getDeputesParti(profil.parti.uid).then((d) => vivant && setMembres(d)).catch(() => vivant && setMembres([]));
    return () => { vivant = false; };
  }, [onglet, profil, membres]);

  const pire = useMemo(() => plusForteFracture(votesCles), [votesCles]);

  if (!profil) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const p = profil.parti;
  const score = scoreGroupeJe(je, abrev);
  const seSituer = () => nav.push({ name: "testIntro" });

  // Contexte : rang par nombre de sièges (partis.json est nb_deputes desc).
  const rang = Math.max(1, partis.findIndex((x) => x.uid === p.uid) + 1);
  const contexte = `${p.nb_deputes} siège${p.nb_deputes > 1 ? "s" : ""}, ${rang === 1 ? "groupe le plus nombreux" : `${rang}e groupe par la taille`}`;

  // Base du % comme toi (situé) : sur combien de scrutins tranchés le groupe a pris position.
  let baseTexte: string | null = null;
  if (situe && je) {
    const n = abrev ? baseAccordGroupe(je.resultat, abrev).comparable : 0;
    baseTexte = n
      ? `Sur ${n > 1 ? `les ${n} scrutins` : "le scrutin"} que tu as tranché${n > 1 ? "s" : ""} et où le groupe a pris position.`
      : "Le groupe n'a pris position sur aucun des scrutins que tu as tranchés pour l'instant.";
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
      {/* ===== EN-TÊTE D'IDENTITÉ (fixe : hors du corps qui change) ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s14 }}>
          {/* Hémicycle du logo, sièges du groupe en couleur (conteneur calé sur w = size, h = size*0.72). */}
          <View style={{ width: 92, height: 92 * 0.72, alignItems: "center", justifyContent: "center" }}>
            <HemicyclePicto groupes={partis} activeAbrev={abrev} color={p.couleur ?? C.textFaint} size={92} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>{p.abrev ?? p.libelle}</Text>
            {!!p.abrev && <Text style={[T.small, { fontFamily: F.semibold, color: C.text, marginTop: 2 }]}>{p.libelle}</Text>}
            <Text style={[T.small, { color: C.textFaint, marginTop: 2 }]}>{contexte}</Text>
          </View>
        </View>

        {/* Situé : le % comme toi en tête */}
        {situe && (
          <View style={{ marginTop: S.s14 }}>
            <CommeToiCarte pct={score?.pct ?? null} base={baseTexte} />
          </View>
        )}

        {/* Deux chiffres : votes soudés (+ plus forte fracture) et participation (+ moyenne des groupes) */}
        <View style={{ flexDirection: "row", gap: S.s8, marginTop: situe ? S.s8 : S.s14 }}>
          <StatCarte
            compact={situe}
            valeur={profil.cohesion_pct != null ? `${profil.cohesion_pct} %` : "—"}
            label="de votes soudés"
            contexte={pire ? `Plus forte fracture : ${pire.theme}, ${pire.n} voix contre la ligne` : null}
          />
          <StatCarte
            compact={situe}
            valeur={profil.participation_moy_pct != null ? `${profil.participation_moy_pct} %` : "—"}
            label="des scrutins publics"
            contexte={profil.participation_moy != null ? `Moyenne des groupes : ${profil.participation_moy} %` : null}
          />
        </View>

        {/* Non situé : « Comme toi ? » verrouillé, cliquable */}
        {!situe && (
          <View style={{ marginTop: S.s8 }}>
            <CommeToiVerrou phrase="Situe-toi pour voir ton accord avec ce groupe" onPress={seSituer} />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 10, marginTop: S.s12, marginBottom: S.s12 }}>
          <SuivreBouton uid={p.uid} nom={p.abrev ?? p.libelle} sansUid={sansUid} />
          <Button
            label="Partager"
            variant="outline"
            size="md"
            style={{ flex: 1 }}
            iconLeft={<Feather name="share" size={ICON.sm} color={C.accent} />}
            onPress={() => {
              const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://scrutoir.fr";
              partagerLien(`${origin}/?open=parti:${p.uid}`, `${p.abrev ?? p.libelle} à l'Assemblée : ce qu'ils votent vraiment. Et toi ?`);
            }}
          />
        </View>
      </View>

      {/* ===== BARRE D'ONGLETS (index sticky = 1) ===== */}
      <ProfilTabs<Onglet>
        tabs={situe
          ? [{ key: "accord", label: "Accord" }, { key: "votes", label: "Votes" }, { key: "groupe", label: "Le groupe" }]
          : [{ key: "votes", label: "Votes" }, { key: "accord", label: "Accord" }, { key: "groupe", label: "Le groupe" }]}
        active={onglet}
        onChange={setOnglet}
      />

      {/* ===== CORPS (seul élément qui change) ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s4 }}>
        {onglet === "accord" && <OngletAccord abrev={p.abrev} je={je} cats={cats} situe={situe} onSituer={seSituer} />}
        {onglet === "votes" && <OngletVotes votes={votesCles} effectif={p.nb_deputes} nav={nav} />}
        {onglet === "groupe" && <OngletGroupe profil={profil} pire={pire} membres={membres} nav={nav} />}
      </View>
    </ScrollView>
  );
}

/** Bouton Suivre/Suivi (primaire), câblé sur le vrai état de suivi partagé. `sansUid` : fiche
 *  ouverte depuis la liste triée par affinité, le geste est mesuré sans dire quel groupe. */
function SuivreBouton({ uid, nom, sansUid = false }: { uid: string; nom: string; sansUid?: boolean }) {
  const [suivi, toggle] = useFollow(uid, sansUid ? { sansUid: true, contexte: "test" } : undefined);
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
  abrev, je, cats, situe, onSituer,
}: { abrev: string | null; je: ReturnType<typeof useJe>; cats: CategorieRef[]; situe: boolean; onSituer: () => void }) {
  const lignes = useMemo<LigneAccord[]>(() => {
    if (!je || !abrev) return [];
    const lib = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
    return accordsParTheme(je.resultat, abrev).map((l) => ({ ...l, libelle: lib(l.id) }));
  }, [je, abrev, cats]);
  if (situe && je == null) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  return (
    <AccordSection
      lignes={lignes}
      situe={situe}
      onSituer={onSituer}
      invitation="Réponds à quelques votes réels de l'Assemblée : on compare tes réponses aux positions de ce groupe, thème par thème."
      lead="Ton accord avec ce groupe, thème par thème."
      emptyMsg="Le groupe n'a pris position sur aucun des scrutins que tu as tranchés pour l'instant : rien à comparer par thème."
    />
  );
}

// ===== ONGLET VOTES =====
// La barre sans légende devient un décompte en clair : « Unanime : 23 pour » (tous les sièges),
// « 19 pour, aucun contre », « Divisé » + « 18 pour, 1 contre, 4 abst. » (`decompteGroupe`, testé).
function OngletVotes({ votes, effectif, nav }: { votes: VoteCle[] | null; effectif: number; nav: Nav }) {
  if (votes == null) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  if (!votes.length) return <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>Aucun vote de ce groupe sur les derniers textes entiers.</Text>;
  return (
    <View>
      <OngletLead>Ses positions sur les derniers textes entiers</OngletLead>
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
        {votes.map(({ s, g }, i) => {
          const dc = decompteGroupe(g, effectif);
          const etiquette = dc.etat === "divise" ? "Divisé" : dc.position === "pour" ? "Pour" : dc.position === "contre" ? "Contre" : dc.position === "abstention" ? "Abstention" : "Pas de vote";
          const point = dc.etat === "divise" ? C.loyalMoyen : dc.position ? couleurPosition(dc.position) : undefined;
          return (
            <VoteTexteRow key={s.uid} s={s} premier={i === 0} onPress={() => nav.push({ name: "scrutin", uid: s.uid })}>
              <PastilleVote label={etiquette} point={point} fg={C.text} />
              {dc.etat !== "aucun" && <PastilleVote label={dc.texte} />}
            </VoteTexteRow>
          );
        })}
      </Card>
    </View>
  );
}

// ===== ONGLET LE GROUPE =====
function OngletGroupe({
  profil, pire, membres, nav,
}: { profil: ProfilParti; pire: { theme: string; n: number } | null; membres: DeputeResume[] | null; nav: Nav }) {
  const p = profil.parti;
  const coh = profil.cohesion_pct;

  return (
    <View style={{ marginTop: S.s12 }}>
      {/* Président du groupe (vraie donnée, jamais codé en dur) */}
      {profil.president && (
        <Card
          onPress={() => nav.push({ name: "depute", uid: profil.president!.uid })}
          padding={12}
          accessibilityLabel={`Ouvrir la fiche de ${profil.president.nom_complet}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: S.s12 }}
        >
          <ProfilAvatar uri={profil.president.photo_url} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={[T.micro, { color: C.textFaint }]}>Président du groupe</Text>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 1 }]}>{profil.president.nom_complet}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </Card>
      )}

      {/* Cohésion (grand % + barre) + dissidence la plus forte, nommée */}
      <PctCard pct={coh} label="de votes soudés">
        {coh != null ? `Le groupe vote dans le même sens ${coh} % du temps.` : "Pas assez de votes pour mesurer la cohésion."}
        {pire && (
          <Text> Plus forte fracture interne : <Text style={{ fontFamily: F.bold, color: C.text }}>{pire.theme}</Text>, {pire.n} voix contre la ligne majoritaire.</Text>
        )}
      </PctCard>

      {/* Participation (même représentation que la cohésion : grand % + barre + note) */}
      {profil.participation_moy_pct != null && (
        <PctCard pct={profil.participation_moy_pct} label="des scrutins publics">
          Présence moyenne des élus du groupe aux scrutins publics nominatifs.
          {profil.participation_moy != null && ` Moyenne des groupes : ${profil.participation_moy} %.`}
        </PctCard>
      )}

      {/* Activité parlementaire (nombres + écart à la moyenne) — deux fiches côte à côte */}
      <SectionTitle>Activité parlementaire</SectionTitle>
      <View style={{ flexDirection: "row", gap: S.s12, marginBottom: S.s12 }}>
        <Card bordered style={{ flex: 1 }}>
          <ActiviteBloc total={profil.amendements} label="Amendements déposés" parElu={profil.amendements_par_elu} ratio={profil.amendements_ratio} />
        </Card>
        <Card bordered style={{ flex: 1 }}>
          <ActiviteBloc total={profil.propositions} label="Propositions de loi" parElu={profil.propositions_par_elu} ratio={profil.propositions_ratio} />
        </Card>
      </View>

      {/* Positions par thème (barres divergentes officielles, tap → votes du groupe) */}
      {profil.categories.length > 0 && (
        <>
          <SectionTitle>Positions par thème</SectionTitle>
          <Card bordered padding={0} style={{ paddingHorizontal: 14, marginBottom: S.s12 }}>
            {profil.categories.map((c, i) => (
              <View key={c.id} style={{ ...(i === profil.categories.length - 1 ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }) }}>
                <BarreDivergente
                  label={(catUI(c.id) as { court?: string }).court ?? c.libelle}
                  pour={c.pour}
                  contre={c.contre}
                  abstention={c.abstention}
                  onPress={() => nav.push({ name: "votesParti", uid: p.uid, libelle: p.abrev ?? p.libelle, categorie: c.id, categorieLibelle: c.libelle, position: c.pour >= c.contre ? "pour" : "contre", periode: "all" })}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Députés */}
      <SectionTitle>Députés</SectionTitle>
      {membres == null ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s8 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
          {membres.slice(0, 12).map((d) => (
            <TouchableOpacity
              key={d.uid}
              onPress={() => nav.push({ name: "depute", uid: d.uid })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir la fiche de ${d.nom_complet}`}
              style={{ width: 66, alignItems: "center" }}
            >
              <ProfilAvatar uri={d.photo_url} size={52} />
              <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted, marginTop: 5, textAlign: "center" }]} numberOfLines={1}>{prenomNom(d.nom_complet)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => nav.push({ name: "membresParti", uid: p.uid, libelle: p.abrev ?? p.libelle })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Voir les ${p.nb_deputes} députés du groupe`}
            style={{ width: 72, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
              <Feather name="arrow-right" size={20} color={C.accent} />
            </View>
            <Text style={[T.micro, { fontFamily: F.bold, color: C.accent, marginTop: 5 }]}>Voir {p.nb_deputes}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// Écart d'un ratio à la moyenne des groupes (1 = moyenne).
const ecartTxt = (r: number): string => (r >= 1.1 || r <= 0.9 ? `×${r.toLocaleString("fr-FR")} vs moyenne` : "≈ moyenne");
// Couleur de l'écart à la moyenne : vert = plus actif que la moyenne, ambre = moins actif,
// gris discret = dans la norme (« ≈ moyenne »). Signale d'un coup d'œil si l'activité est normale.
const ecartColor = (r: number): string => (r >= 1.1 ? C.pour : r <= 0.9 ? C.abstention : C.textFaint);

/** Un chiffre d'activité (amendements / propositions) + /élu + écart à la moyenne. */
function ActiviteBloc({ total, label, parElu, ratio }: { total: number; label: string; parElu: number | null; ratio: number | null }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[tnum, { fontFamily: F.extra, fontSize: 24, lineHeight: 26, color: C.text }]}>{total.toLocaleString("fr-FR")}</Text>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: 2 }]}>{label}</Text>
      {parElu != null && (
        <Text style={[T.micro, { color: C.textFaint, marginTop: 4 }]}>
          {parElu.toLocaleString("fr-FR")}/élu
          {ratio != null && (
            <Text>
              {" · "}
              <Text style={{ fontFamily: F.semibold, color: ecartColor(ratio) }}>{ecartTxt(ratio)}</Text>
            </Text>
          )}
        </Text>
      )}
    </View>
  );
}

// « Prénom N. » compact pour la rangée d'avatars.
function prenomNom(nom: string): string {
  const parts = nom.split(/\s+/);
  if (parts.length < 2) return nom;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
