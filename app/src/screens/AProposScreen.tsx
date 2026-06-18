import React from "react";
import { View, Text, ScrollView } from "react-native";
import { C } from "../theme";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 15, fontWeight: "500", color: C.text, marginBottom: 5 }}>{titre}</Text>
      <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function AProposScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: "500", color: C.text, marginBottom: 4 }}>
        À propos & limites
      </Text>
      <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 20, marginBottom: 18 }}>
        Cette application montre comment votent réellement les députés, à partir des données
        publiques de l'Assemblée Nationale. Pour qu'elle reste honnête, voici précisément ce
        qu'elle couvre — et ce qu'elle ne couvre pas.
      </Text>

      <View
        style={{
          backgroundColor: C.loyalMoyenBg, borderRadius: 10, padding: 12, marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 13, color: C.loyalMoyen, lineHeight: 19 }}>
          ⚠️ Les chiffres ne reflètent qu'une partie de l'activité d'un·e député·e. À lire avec
          nuance, sans en tirer de conclusion hâtive.
        </Text>
      </View>

      <Bloc titre="Seuls les scrutins publics nominatifs">
        L'Assemblée n'enregistre le vote individuel de chaque député que pour les « scrutins
        publics ». La plupart des votes ont lieu à main levée et ne sont pas attribués
        nominativement : ils sont donc absents de l'application.
      </Bloc>

      <Bloc titre="Classification thématique approximative">
        L'Assemblée ne range pas les scrutins par thème. Le classement (Écologie, Sécurité…) est
        calculé automatiquement à partir de l'intitulé du scrutin. Il est imparfait : certains
        scrutins ne sont pas classés, d'autres peuvent l'être par erreur.
      </Bloc>

      <Bloc titre="Un vote « Pour » ou « Contre » ne dit pas tout">
        Le sens d'un vote dépend du texte. On peut voter contre une loi parce qu'on la juge
        insuffisante, et non parce qu'on s'oppose à son objectif. Les pourcentages sont des
        indicateurs, pas des jugements.
      </Bloc>

      <Bloc titre="Indicateur de loyauté">
        Pourcentage de votes conformes à la consigne du groupe (la position majoritaire de chaque
        groupe est fournie par l'Assemblée). Les abstentions et absences sont exclues de ce calcul.
      </Bloc>

      <Bloc titre="Exposé des amendements">
        Quand un scrutin porte sur un amendement, on affiche son exposé (ce qu'il modifie et
        sa justification). Le lien entre le scrutin et l'amendement est reconstitué
        automatiquement (date + numéro + auteur) : il aboutit pour ~9 amendements sur 10 ;
        sinon l'exposé n'est pas affiché.
      </Bloc>

      <Bloc titre="« Grands scrutins »">
        Le fil d'accueil regroupe les scrutins solennels et les motions de censure — les votes les
        plus marquants de la législature.
      </Bloc>

      <Bloc titre="Source & période">
        Open Data de l'Assemblée Nationale (licence Etalab, mise à jour quotidienne), 17ᵉ
        législature (depuis juin 2024). Données non officielles, restituées à titre informatif.
      </Bloc>
    </ScrollView>
  );
}
