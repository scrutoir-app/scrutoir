import React from "react";
import { View, Text, ScrollView } from "react-native";
import { C, F, RADIUS } from "../theme";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text, marginBottom: 5 }}>{titre}</Text>
      <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.textMuted, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function AProposScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontFamily: F.extra, fontSize: 23, color: C.text, letterSpacing: -0.6 }}>À propos & limites</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, lineHeight: 20, marginTop: 6, marginBottom: 18 }}>
        Hémicycle montre les scrutins publics nominatifs de l'Assemblée Nationale (17ᵉ législature) —
        les seuls votes attribués nominativement à chaque député·e. Pour rester honnête, voici
        précisément ce que l'app couvre — et ce qu'elle ne couvre pas.
      </Text>

      <View style={{ backgroundColor: C.loyalMoyenBg, borderRadius: RADIUS.md, padding: 13, marginBottom: 20 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.loyalMoyen, lineHeight: 19 }}>
          ⚠️ Les chiffres ne reflètent qu'une partie de l'activité d'un·e député·e. À lire avec
          nuance, sans en tirer de conclusion hâtive.
        </Text>
      </View>

      <Bloc titre="Seuls les scrutins publics nominatifs">
        L'Assemblée n'enregistre le vote individuel que pour les « scrutins publics ». La plupart
        des votes ont lieu à main levée et ne sont pas attribués nominativement : ils sont absents
        de l'application.
      </Bloc>

      <Bloc titre="« Absent », « Non votant » et participation">
        Un·e député·e absent·e n'apparaît pas dans un scrutin : l'absence est déduite (scrutins d'un
        thème moins les votes), et bornée aux dates réelles du mandat (pas d'absences « fantômes »
        avant l'entrée en fonction). « Non votant » = présent·e mais n'ayant pas pris part (ex. la
        présidence de séance) — distinct d'« Absent ». Le taux de participation est montré en relatif
        (« plus assidu·e que X % ») car il est bas pour tout le monde.
      </Bloc>

      <Bloc titre="Classification thématique approximative">
        L'Assemblée ne range pas les scrutins par thème. Le classement (Écologie, Sécurité…) est
        calculé automatiquement à partir de l'intitulé. Il est imparfait : certains scrutins ne
        sont pas classés, d'autres peuvent l'être par erreur.
      </Bloc>

      <Bloc titre="Un vote « Pour » ou « Contre » ne dit pas tout">
        Le sens d'un vote dépend du texte. On peut voter contre une loi parce qu'on la juge
        insuffisante. Les pourcentages sont des indicateurs, pas des jugements.
      </Bloc>

      <Bloc titre="Consigne du groupe (pas de score de loyauté)">
        Plutôt qu'un score de loyauté agrégé — qui se prête à un jugement hâtif — on affiche la
        consigne du groupe (position majoritaire fournie par l'Assemblée) à côté de chaque vote, et
        les écarts sont listés dans les « dissidences ». À vous de lire l'écart.
      </Bloc>

      <Bloc titre="Confronter deux élu·e·s">
        On compare deux député·e·s sur les seuls scrutins nominatifs où les deux ont voté. Un thème
        sans scrutin commun est « non couvert » (invérifiable) — un silence de données n'est pas un
        désaccord.
      </Bloc>

      <Bloc titre="Exposé des amendements">
        Quand un scrutin porte sur un amendement, on affiche son exposé. Le lien scrutin↔amendement
        est reconstitué automatiquement (date + numéro + auteur) : il aboutit pour ~9 amendements
        sur 10, sinon l'exposé n'est pas affiché.
      </Bloc>

      <Bloc titre="Source & période">
        Open Data de l'Assemblée Nationale (licence Etalab, mise à jour quotidienne), 17ᵉ
        législature (depuis juin 2024). Données non officielles, à titre informatif.
      </Bloc>
    </ScrollView>
  );
}
