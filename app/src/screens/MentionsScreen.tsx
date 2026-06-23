import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { C, F, T } from "../theme";

const EMAIL = "contact@scrutoir.fr";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginBottom: 5 }]}>{titre}</Text>
      <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted }]}>{children}</Text>
    </View>
  );
}

function Mail() {
  return (
    <Text style={{ fontFamily: F.bold, color: C.accent }} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
      {EMAIL}
    </Text>
  );
}

export function MentionsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <Text style={[T.title, { color: C.text, marginBottom: 14 }]}>
        Mentions légales & confidentialité
      </Text>

      <Bloc titre="Éditeur">
        Scrutoir est édité par <Text style={{ fontFamily: F.bold, color: C.text }}>Seedger</Text>, Paris,
        France. Contact : <Mail />.
      </Bloc>

      <Bloc titre="Hébergement">
        Le site est hébergé par Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107,
        États-Unis.
      </Bloc>

      <Bloc titre="Données & source">
        Les données proviennent de l'Open Data de l'Assemblée nationale (licence Etalab), 17ᵉ
        législature. Informations non officielles, fournies à titre purement informatif.
      </Bloc>

      <Bloc titre="Vie privée & données personnelles">
        Scrutoir ne demande aucun compte et ne collecte aucune donnée personnelle. La mesure
        d'audience est strictement anonyme : pas de cookie, aucune adresse IP conservée, aucun
        profilage. Seules des statistiques agrégées (jamais reliées à une personne) sont produites,
        pour améliorer le service. La liste des élus et partis que vous suivez reste sur votre
        appareil et n'est transmise à personne. Nous ne vendons aucune donnée d'usage à des partis
        ou à des candidats. Pour toute question : <Mail />.
      </Bloc>

      <Bloc titre="Propriété">
        Le nom « Scrutoir », son logo et son habillage sont la propriété de Seedger. Les données de
        l'Assemblée nationale sont réutilisées sous licence Etalab.
      </Bloc>
    </ScrollView>
  );
}
