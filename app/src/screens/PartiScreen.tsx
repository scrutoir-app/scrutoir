import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, S, ICON, couleurPosition } from "../theme";
import { Card, Button } from "../components/ui";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { BarreDivergente } from "../components/BarreDivergente";
import { StatCol, ProfilTabs, PctCard, ProfilAvatar, SectionTitle, AccordSection, SEUIL_COMME, type LigneAccord } from "../components/profil";
import { catUI } from "../categoryUI";
import { getParti, getPartis, getCategories, getGrandsScrutins, getScrutin, getDeputesParti } from "../api";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import { useFollow } from "../follows";
import { positionMajoritaire, tailleGroupe } from "../testProximite/verdict";
import { partagerLien } from "../share";
import type { ProfilParti, PartiResume, CategorieRef, GroupeVentilation, DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";

/**
 * Fiche parti en PAGE PROFIL (façon réseau social) : en-tête d'identité fixe (hémicycle-avatar +
 * 3 stats + Suivre/Partager) puis une barre d'onglets Accord / Votes / Le groupe qui découpe le
 * contenu (l'en-tête ne se recharge pas au changement d'onglet). Répond à : ce parti me
 * ressemble-t-il (Accord), et tient-il sa ligne (Le groupe) ?
 *
 * Réutilise les moteurs officiels — proximité GLOBALE + PAR THÈME via `useJe`/`calculerProximite`
 * (`resultat.parTheme`, MÊME source que le spectre) — et les primitives profil partagées
 * (`components/profil`). Couleurs via `C`/`couleurGroupe`/`couleurPosition` uniquement. Tout ce
 * qui touche « toi » est 100 % client (rien envoyé au serveur, aucun compteur/like).
 */

const NB_VOTES_CLES = 8; // grands scrutins échantillonnés (affichés + base de la « fracture »)
type Onglet = "accord" | "votes" | "groupe";

// Accord de l'utilisateur avec CE groupe, ventilé par thème (catégorie), depuis le moteur global.
function accordParTheme(je: ReturnType<typeof useJe>, abrev: string | null, cats: CategorieRef[]): LigneAccord[] {
  if (!je || !abrev) return [];
  const lib = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  const out: LigneAccord[] = [];
  for (const [theme, parGroupe] of Object.entries(je.resultat.parTheme)) {
    const sc = parGroupe[abrev];
    if (!sc || sc.pct == null || sc.comparable < 1) continue;
    out.push({ id: theme, libelle: lib(theme), pct: sc.pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// Scrutin clé + ventilation de CE groupe (position majoritaire + décompte interne).
type VoteCle = { s: ScrutinResume; g: GroupeVentilation };

// « Fracture » sur un scrutin = nb d'élus votant le camp TRANCHÉ opposé à la ligne majoritaire.
function fracture(g: GroupeVentilation): number {
  const maj = positionMajoritaire(g);
  if (maj === "pour") return g.contre || 0;
  if (maj === "contre") return g.pour || 0;
  return Math.max(g.pour || 0, g.contre || 0);
}

export function PartiScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [profil, setProfil] = useState<ProfilParti | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [onglet, setOnglet] = useState<Onglet>("accord");
  const je = useJe();

  // Lazy : scrutins clés (onglets Votes / Le groupe) et membres (onglet Le groupe).
  const [votesCles, setVotesCles] = useState<VoteCle[] | null>(null);
  const [membres, setMembres] = useState<DeputeResume[] | null>(null);

  // En-tête : chargé une seule fois par uid (ne se recharge PAS au changement d'onglet).
  useEffect(() => {
    setProfil(null);
    getParti(uid, "all").then(setProfil).catch(() => setProfil(null));
    getPartis().then(setPartis).catch(() => {});
    getCategories().then(setCats).catch(() => {});
  }, [uid]);

  const abrev = profil?.parti.abrev ?? null;

  // Scrutins clés : au 1er passage sur Votes OU Le groupe (les deux en ont besoin : la fracture).
  useEffect(() => {
    if (votesCles != null || !abrev || (onglet !== "votes" && onglet !== "groupe")) return;
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
  }, [onglet, abrev, votesCles]);

  // Membres : au 1er passage sur Le groupe.
  useEffect(() => {
    if (membres != null || onglet !== "groupe" || !profil) return;
    let vivant = true;
    getDeputesParti(profil.parti.uid).then((d) => vivant && setMembres(d)).catch(() => vivant && setMembres([]));
    return () => { vivant = false; };
  }, [onglet, profil, membres]);

  if (!profil) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const p = profil.parti;
  const situe = je != null;
  const score = scoreGroupeJe(je, abrev);
  const seSituer = () => nav.push({ name: "testIntro" });

  // Contexte : rang par nombre de sièges (partis.json est nb_deputes desc).
  const rang = Math.max(1, partis.findIndex((x) => x.uid === p.uid) + 1);
  const contexte = rang === 1 ? "groupe le plus nombreux" : `${rang}ᵉ groupe par la taille`;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
      {/* ===== EN-TÊTE D'IDENTITÉ (fixe : hors du corps qui change) ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
          {/* Conteneur calé sur les dimensions réelles du picto (w = size, h = size*0.72). */}
          <View style={{ width: 116, height: 116 * 0.72, alignItems: "center", justifyContent: "center" }}>
            <HemicyclePicto groupes={partis} activeAbrev={abrev} color={p.couleur ?? C.textFaint} size={116} />
          </View>
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
            <StatCol n={String(p.nb_deputes)} label="sièges" />
            <StatCol
              n={situe && score ? `${Math.round(score.pct * 100)}%` : "—"}
              label="comme toi"
              color={situe && score ? (score.pct >= SEUIL_COMME ? C.pour : C.contre) : undefined}
            />
            <StatCol n={profil.cohesion_pct != null ? `${profil.cohesion_pct}%` : "—"} label="cohésion" />
          </View>
        </View>
        <Text style={[T.title, { color: C.text, marginTop: S.s10 }]}>{p.abrev ?? p.libelle}</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]} numberOfLines={2}>{p.libelle} · {contexte}</Text>
        <View style={{ flexDirection: "row", gap: 9, marginTop: S.s12, marginBottom: S.s12 }}>
          <SuivreBouton uid={p.uid} nom={p.abrev ?? p.libelle} />
          <Button
            label="Partager"
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
            iconLeft={<Feather name="share-2" size={ICON.sm} color={C.accent} />}
            onPress={() => {
              const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://scrutoir.fr";
              partagerLien(`${origin}/?open=parti:${p.uid}`, `${p.abrev ?? p.libelle} à l'Assemblée : ce qu'ils votent vraiment. Et toi ?`);
            }}
          />
        </View>
      </View>

      {/* ===== BARRE D'ONGLETS (index sticky = 1) ===== */}
      <ProfilTabs<Onglet>
        tabs={[{ key: "accord", label: "Accord" }, { key: "votes", label: "Votes" }, { key: "groupe", label: "Le groupe" }]}
        active={onglet}
        onChange={setOnglet}
      />

      {/* ===== CORPS (seul élément qui change) ===== */}
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s4 }}>
        {onglet === "accord" && <OngletAccord abrev={p.abrev} je={je} cats={cats} situe={situe} onSituer={seSituer} />}
        {onglet === "votes" && <OngletVotes votes={votesCles} abrev={p.abrev ?? ""} nav={nav} />}
        {onglet === "groupe" && <OngletGroupe profil={profil} votes={votesCles} membres={membres} nav={nav} />}
      </View>
    </ScrollView>
  );
}

/** Bouton Suivre/Suivi (primaire), câblé sur le vrai état de suivi partagé. */
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
  abrev, je, cats, situe, onSituer,
}: { abrev: string | null; je: ReturnType<typeof useJe>; cats: CategorieRef[]; situe: boolean; onSituer: () => void }) {
  const lignes = useMemo(() => accordParTheme(je, abrev, cats), [je, abrev, cats]);
  return (
    <AccordSection
      lignes={lignes}
      situe={situe}
      onSituer={onSituer}
      catsPreview={cats}
      lead="Ton accord avec ce groupe, thème par thème — vert tu les rejoins, rouge tu diverges."
      leadLocked="Ton accord avec ce groupe, thème par thème."
      emptyMsg="Pas encore assez de scrutins comparés avec ce groupe pour ventiler par thème."
    />
  );
}

// ===== ONGLET VOTES =====
function OngletVotes({ votes, abrev, nav }: { votes: VoteCle[] | null; abrev: string; nav: Nav }) {
  if (votes == null) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />;
  if (!votes.length) return <Text style={[T.small, { color: C.textMuted, marginTop: S.s16 }]}>Aucun scrutin clé pour ce groupe.</Text>;
  return (
    <View>
      <Text style={[T.small, { color: C.textFaint, marginTop: S.s12, marginBottom: S.s10, paddingHorizontal: 2 }]}>
        Comment le groupe s'est prononcé sur des scrutins clés.
      </Text>
      <Card bordered padding={0}>
        {votes.map(({ s, g }, i) => (
          <VoteRow key={s.uid} s={s} g={g} abrev={abrev} dernier={i === votes.length - 1} onPress={() => nav.push({ name: "scrutin", uid: s.uid })} />
        ))}
      </Card>
    </View>
  );
}

function VoteRow({ s, g, abrev, dernier, onPress }: { s: ScrutinResume; g: GroupeVentilation; abrev: string; dernier: boolean; onPress: () => void }) {
  const ui = catUI(s.categorie ?? "");
  const maj = positionMajoritaire(g);
  const posLabel = maj === "pour" ? "a voté Pour" : maj === "contre" ? "a voté Contre" : "s'est abstenu";
  const col = couleurPosition(maj);
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
          <Text style={[T.micro, { fontFamily: F.bold, color: col }]}>{abrev} {posLabel}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <VoteBarDivergenteCentree pour={g.pour} contre={g.contre} abstention={g.abstention} siegesTotal={tailleGroupe(g)} height={9} />
        </View>
        <Feather name="chevron-right" size={16} color={C.textFaint} />
      </View>
    </TouchableOpacity>
  );
}

// ===== ONGLET LE GROUPE =====
function OngletGroupe({
  profil, votes, membres, nav,
}: { profil: ProfilParti; votes: VoteCle[] | null; membres: DeputeResume[] | null; nav: Nav }) {
  const p = profil.parti;
  const pire = useMemo(() => {
    if (!votes || !votes.length) return null;
    return votes.reduce((best, v) => (fracture(v.g) > fracture(best.g) ? v : best), votes[0]);
  }, [votes]);
  const pireN = pire ? fracture(pire.g) : 0;
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
            <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }]}>Président du groupe</Text>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 1 }]}>{profil.president.nom_complet}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </Card>
      )}

      {/* Cohésion (grand % + barre) + dissidence la plus forte, nommée */}
      <PctCard pct={coh} label="de vote soudé">
        {coh != null ? `Le groupe vote dans le même sens ${coh} % du temps.` : "Pas assez de votes pour mesurer la cohésion."}
        {pire && pireN > 0 && (
          <Text> Plus forte fracture interne : <Text style={{ fontFamily: F.bold, color: C.text }}>{(catUI(pire.s.categorie ?? "") as { court?: string }).court ?? pire.s.categorie ?? "un texte"}</Text>, {pireN} voix contre la ligne majoritaire.</Text>
        )}
      </PctCard>

      {/* Participation (même représentation que la cohésion : grand % + barre + note) */}
      {profil.participation_moy_pct != null && (
        <PctCard pct={profil.participation_moy_pct} label="de participation">
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
