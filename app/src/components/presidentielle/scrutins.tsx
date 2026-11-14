// Scrutins confrontés à une mesure : barre du vote du groupe (seules couleurs de vote de la
// rubrique), carte complète d'un écart, faits d'un « à juger », ligne compacte et lot dépliable.
// Intitulés officiels mot pour mot ; aucun commentaire ne relie deux scrutins entre eux.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum } from "../../theme";
import type { Nav } from "../../nav";
import type { ScrutinConfronte } from "../../presidentielle/types";
import { regrouper, type GroupeScrutins } from "../../presidentielle/logique";
import {
  PHRASE_NON_PARTICIPATION, TEXTE_ALERTE, dateLongue, decompteEnLettres, intituleAffiche, nombre, phraseGroupe, phraseSansEffet,
  pluriel, sensLibelle, sortLibelle, sortsDuLot, titreLot,
} from "../../presidentielle/libelles";
import { Bloc, Kicker, Pression } from "./primitives";

function BadgeSort({ sort }: { sort: ScrutinConfronte["sort"] }) {
  const a = sort === "adopte";
  return (
    <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: "center", backgroundColor: a ? C.adopteBg : C.rejeteBg }}>
      <Text style={[T.micro, { fontFamily: F.extra, color: a ? C.adopteFg : C.rejeteFg }]}>{sortLibelle(sort)}</Text>
    </View>
  );
}

function EnTete({ s, long }: { s: ScrutinConfronte; long: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Text style={[T.small, tnum, { fontFamily: F.extra, color: C.text }]}>{long ? "Scrutin n° " : "N° "}{s.numero}</Text>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>· {dateLongue(s.date)}</Text>
      <BadgeSort sort={s.sort} />
    </View>
  );
}

/** Barre + décompte du vote du groupe (couleurs de vote). Aucun votant : barre en pointillés. */
export function BarreVoteGroupe({ s, avecLegende = true }: { s: Pick<ScrutinConfronte, "pour" | "contre" | "abstention" | "votants">; avecLegende?: boolean }) {
  if (s.votants === 0) {
    return (
      <View style={{ gap: 6 }}>
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 8, borderRadius: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.textFaint }} />
        <Text style={[T.small, { fontFamily: F.extra, color: C.text }]}>Aucun député du groupe n’a pris part au vote</Text>
      </View>
    );
  }
  const segs = [
    { n: s.pour, c: C.pour },
    { n: s.contre, c: C.contre },
    { n: s.abstention, c: C.abstention },
  ].filter((x) => x.n > 0);
  return (
    <View style={{ gap: 6 }} accessible accessibilityRole="image" accessibilityLabel={decompteEnLettres(s)} aria-label={decompteEnLettres(s)}>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {segs.map((x, i) => (
          <View key={i} style={{ flexGrow: x.n, flexBasis: 0, height: 8, borderRadius: 4, backgroundColor: x.c }} />
        ))}
      </View>
      {avecLegende && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
          {[
            ["Pour", s.pour, C.pour],
            ["Contre", s.contre, C.contre],
            ["Abstention", s.abstention, C.abstention],
          ].map(([l, n, c]) => (
            <View key={l as string} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c as string }} />
              <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text }]}>{l as string} {nombre(n as number)}</Text>
            </View>
          ))}
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{nombre(s.votants)} {pluriel(s.votants, "votant", "votants")}</Text>
        </View>
      )}
    </View>
  );
}

function Alertes({ s }: { s: ScrutinConfronte }) {
  if (!s.alertes.length) return null;
  return (
    <>
      {s.alertes.map((a) => (
        <Text key={a} style={[T.micro, { fontFamily: F.bold, color: C.text, lineHeight: 15 }]}>{TEXTE_ALERTE[a]}</Text>
      ))}
    </>
  );
}

function Ecart({ s }: { s: ScrutinConfronte }) {
  const texte = s.ecart ?? s.note;
  if (!texte) return null;
  return (
    <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 19 }]}>
      <Text style={{ fontFamily: F.extra }}>Écart relevé par Scrutoir : </Text>
      {texte}
      {s.ecart && s.note ? ` (${s.note})` : ""}
    </Text>
  );
}

function LienScrutin({ s, nav, libelle = "Voir le scrutin et le vote de chaque député" }: { s: ScrutinConfronte; nav: Nav; libelle?: string }) {
  return (
    <Pression
      accessibilityRole="link"
      accessibilityLabel={`${libelle}, scrutin n° ${s.numero}`}
      onPress={() => nav.push({ name: "scrutin", uid: s.uid })}
      style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{libelle}</Text>
      <Feather name="chevron-right" size={16} color={C.accent} />
    </Pression>
  );
}

/** Carte complète d'un scrutin qui s'écarte de la mesure. */
export function CarteEcart({ s, nav, groupe }: { s: ScrutinConfronte; nav: Nav; groupe: string }) {
  return (
    <Bloc style={{ padding: 16, gap: 10 }}>
      <EnTete s={s} long />
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{sensLibelle(s.sens)}</Text>
      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, lineHeight: 21 }]}>{intituleAffiche(s)}</Text>
      <Alertes s={s} />
      <View style={{ gap: 6, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.bg, borderRadius: 12 }}>
        <Kicker>Vote du groupe {groupe}</Kicker>
        <BarreVoteGroupe s={s} />
      </View>
      {s.votants === 0 && (
        <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 19 }]}>
          {PHRASE_NON_PARTICIPATION} La méthode compte ce cas en tension.
        </Text>
      )}
      <Ecart s={s} />
      <LienScrutin s={s} nav={nav} />
    </Bloc>
  );
}

/** Faits d'un scrutin « à juger » : extrait du texte voté, vote du groupe, écart. Aucune pastille. */
export function CarteAJuger({ s, nav, groupe }: { s: ScrutinConfronte; nav: Nav; groupe: string }) {
  return (
    <Bloc style={{ padding: 16, gap: 14 }}>
      <View style={{ gap: 6 }}>
        <EnTete s={s} long />
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{sensLibelle(s.sens)}</Text>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 19 }]}>{intituleAffiche(s)}</Text>
        <Alertes s={s} />
      </View>
      {!!s.extrait && (
        <View style={{ gap: 4 }}>
          <Kicker>Extrait du texte voté</Kicker>
          <Text style={[T.body, { fontFamily: F.semibold, color: C.text, lineHeight: 22 }]}>« {s.extrait} »</Text>
        </View>
      )}
      <View style={{ gap: 6 }}>
        <Kicker>Le vote du groupe {groupe}</Kicker>
        <BarreVoteGroupe s={s} />
        {s.votants === 0 && <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 19 }]}>{PHRASE_NON_PARTICIPATION}</Text>}
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{`${/^(l[’']amendement|le sous-amendement|les amendements|l[’']ensemble des amendements)/i.test(s.intitule.trim()) ? "Amendement" : "Texte"} ${s.sort === "adopte" ? "adopté" : "rejeté"}.`}</Text>
      </View>
      {!!(s.ecart || s.note) && (
        <View style={{ gap: 4 }}>
          <Kicker>Écart relevé par Scrutoir</Kicker>
          <Text style={[T.body, { fontFamily: F.semibold, color: C.text, lineHeight: 22 }]}>
            {s.ecart ?? s.note}
            {s.ecart && s.note ? ` (${s.note})` : ""}
          </Text>
        </View>
      )}
      {!!s.raisonAJuger && (
        <View style={{ gap: 4 }}>
          <Kicker>Pourquoi le même sens se discute</Kicker>
          <Text style={[T.body, { fontFamily: F.semibold, color: C.text, lineHeight: 22 }]}>{s.raisonAJuger}</Text>
        </View>
      )}
      <LienScrutin s={s} nav={nav} />
    </Bloc>
  );
}

/** Ligne compacte d'un scrutin (vers la fiche scrutin existante). */
export function LigneScrutin({ s, nav, dernier }: { s: ScrutinConfronte; nav: Nav; dernier?: boolean }) {
  const sansEffet = phraseSansEffet(s);
  return (
    <Pression
      accessibilityRole="link"
      accessibilityLabel={`Scrutin n° ${s.numero} du ${dateLongue(s.date)}, ${sortLibelle(s.sort).toLowerCase()}. ${intituleAffiche(s)} ${sensLibelle(s.sens)}. ${decompteEnLettres(s)}.`}
      onPress={() => nav.push({ name: "scrutin", uid: s.uid })}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: dernier ? 0 : 1, borderBottomColor: C.border }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <EnTete s={s} long={false} />
        <Text numberOfLines={3} style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 18 }]}>{intituleAffiche(s)}</Text>
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{sensLibelle(s.sens)}</Text>
        <Alertes s={s} />
        <BarreVoteGroupe s={s} />
        {!!sansEffet && <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 15 }]}>{sansEffet}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color={C.textFaint} />
    </Pression>
  );
}

/** Lot dépliable : scrutins d'un même texte, d'un même jour, tous du même effet. */
function LigneLot({ g, nav, dernier }: { g: GroupeScrutins; nav: Nav; dernier?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const s0 = g.scrutins[0];
  const total = g.scrutins.reduce(
    (a, s) => ({ pour: a.pour + s.pour, contre: a.contre + s.contre, abstention: a.abstention + s.abstention, votants: a.votants + s.votants }),
    { pour: 0, contre: 0, abstention: 0, votants: 0 },
  );
  const commun = g.communFin ? g.communFin[0].toUpperCase() + g.communFin.slice(1).replace(/\.\s*$/, "") + "." : null;
  const titre = titreLot(g.scrutins);
  const resume = `${sensLibelle(s0.sens)}, ${sortsDuLot(g.scrutins)}.`;
  return (
    <View style={{ borderBottomWidth: dernier ? 0 : 1, borderBottomColor: C.border }}>
      <Pression
        onPress={() => setOuvert((o) => !o)}
        accessibilityLabel={`${titre}. ${commun ?? ""} ${resume} ${phraseGroupe(s0.position, g.scrutins.length)}. ${ouvert ? "Replier" : "Déplier"} la liste.`}
        accessibilityState={{ expanded: ouvert }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={[T.small, tnum, { fontFamily: F.extra, color: C.text }]}>{titre}</Text>
          <Text style={[T.small, { fontFamily: F.semibold, color: C.text, lineHeight: 18 }]}>
            {commun ? `${commun} ` : ""}
            {resume}
          </Text>
          <BarreVoteGroupe s={total} avecLegende={false} />
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text }]}>{phraseGroupe(s0.position, g.scrutins.length)}</Text>
          {!!phraseSansEffet(s0) && <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 15 }]}>{phraseSansEffet(s0)}</Text>}
        </View>
        <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={18} color={C.textFaint} />
      </Pression>
      {ouvert && (
        <View style={{ marginLeft: 14, borderLeftWidth: 2, borderLeftColor: C.border }}>
          {g.scrutins.map((s, i) => (
            <LigneScrutin key={s.uid} s={s} nav={nav} dernier={i === g.scrutins.length - 1} />
          ))}
        </View>
      )}
    </View>
  );
}

/** Liste compacte (avec regroupement des lots). */
export function ListeCompacte({ scrutins, nav }: { scrutins: ScrutinConfronte[]; nav: Nav }) {
  const el = regrouper(scrutins);
  return (
    <Bloc style={{ overflow: "hidden" }}>
      {el.map((e, i) =>
        "seul" in e ? (
          <LigneScrutin key={e.seul.uid} s={e.seul} nav={nav} dernier={i === el.length - 1} />
        ) : (
          <LigneLot key={e.groupe.cle} g={e.groupe} nav={nav} dernier={i === el.length - 1} />
        ),
      )}
    </Bloc>
  );
}

/** Intertitre de section : « S'écartent de la mesure 3 ». */
export function TitreSection({ titre, n }: { titre: string; n: number }) {
  return (
    <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 }}>
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{titre}</Text>
      <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{nombre(n)}</Text>
    </View>
  );
}
