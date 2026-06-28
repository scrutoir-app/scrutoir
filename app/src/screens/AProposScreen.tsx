import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { APP_VERSION } from "../config";
import type { Nav } from "../nav";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginBottom: 5 }]}>{titre}</Text>
      <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted }]}>{children}</Text>
    </View>
  );
}

export function AProposScreen({ nav }: { nav: Nav }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>À propos & limites</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>

      {/* Accès Paramètres (déménagé ici depuis l'en-tête d'accueil, devenu la cloche Suivis). */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => nav.push({ name: "parametres" })}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginTop: 6, marginBottom: 18, borderWidth: 1, borderColor: C.border, ...shadowCard }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Feather name="settings" size={18} color={C.accent} />
        </View>
        <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]}>Paramètres</Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </TouchableOpacity>

      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 6 }]}>
        À quoi sert Scrutoir ?
      </Text>
      <Text style={[T.body, { color: C.text, marginTop: 6 }]}>
        Scrutoir aide à comparer le discours des politiques à leurs actes. L'app rend lisibles les
        votes réels des députés à l'Assemblée : cherche un élu et vois comment il ou elle a
        voté par thème, ouvre un scrutin pour comprendre le texte, confronte deux élus sur leurs
        accords et désaccords, ou retrouve ton député par commune. Le tout de façon neutre —
        aucune couleur de parti n'est mise en avant, seul le vote parle.
      </Text>

      <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 18 }]}>
        Pourquoi Scrutoir ?
      </Text>
      <Text style={[T.body, { color: C.text, marginTop: 6 }]}>
        C'est un vieux mot français. L'escritoire était un bureau d'écriture, un meuble où l'on
        consignait, archivait, gardait trace. Le mot a disparu au XVIIIᵉ siècle. On l'a repris parce
        qu'il porte deux choses à la fois : la racine de scrutin, et l'idée d'un endroit où l'on
        regarde de près. C'est exactement ce que fait l'app.
      </Text>

      <Text style={[T.small, { color: C.textMuted, marginTop: 16, marginBottom: 18 }]}>
        Scrutoir s'appuie sur les scrutins publics nominatifs de l'Assemblée Nationale (17ᵉ législature) —
        les seuls votes attribués nominativement à chaque député. Pour rester honnête, voici
        précisément ce que l'app couvre — et ce qu'elle ne couvre pas.
      </Text>

      <View style={{ backgroundColor: C.loyalMoyenBg, borderRadius: RADIUS.md, padding: 13, marginBottom: 20 }}>
        <Text style={[T.small, { color: C.loyalMoyen }]}>
          ⚠️ Les chiffres ne reflètent qu'une partie de l'activité d'un député. À lire avec
          nuance, sans en tirer de conclusion hâtive.
        </Text>
      </View>

      <Bloc titre="Seuls les scrutins publics nominatifs">
        L'Assemblée n'enregistre le vote individuel que pour les « scrutins publics ». La plupart
        des votes ont lieu à main levée et ne sont pas attribués nominativement : ils sont absents
        de l'application.
      </Bloc>

      <Bloc titre="« Absent », « Non votant » et participation">
        Un député absent n'apparaît pas dans un scrutin : l'absence est déduite (scrutins d'un
        thème moins les votes), et bornée aux dates réelles du mandat (pas d'absences « fantômes »
        avant l'entrée en fonction). « Non votant » = présent mais n'ayant pas pris part (ex. la
        présidence de séance) — distinct d'« Absent ». Le taux de participation est montré en relatif
        (« plus assidu que X % ») car il est bas pour tout le monde.
      </Bloc>

      <Bloc titre="Lecture de la barre de vote">
        Sur chaque carte, le pour part vers la gauche, le contre vers la droite, et
        l'abstention occupe le centre à sa taille réelle. La longueur colorée est rapportée
        à la moitié de l'hémicycle, donc une barre courte sur piste longue signale une
        faible participation. Comme l'abstention tient le centre, la largeur restante de
        chaque camp se réduit quand l'abstention monte. Comparer la longueur des barres d'un
        vote à forte abstention avec celle d'un vote à faible abstention n'est donc pas
        fiable. Chaque carte se lit pour elle-même.
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
        les écarts sont listés dans les « dissidences ». À toi de lire l'écart.
      </Bloc>

      <Bloc titre="Confronter deux élus">
        On compare deux députés sur les seuls scrutins nominatifs où les deux ont voté. Un thème
        sans scrutin commun est « non couvert » (invérifiable) — un silence de données n'est pas un
        désaccord.
      </Bloc>

      <Bloc titre="Le test de proximité">
        Le test te confronte à de vrais scrutins, choisis parce qu'ils portent sur un texte entier
        et qu'ils ont divisé l'Assemblée (pas les votes quasi-unanimes ni les amendements de détail).
        Pour chaque vote, on regarde si ta réponse rejoint la position de chaque groupe : on ne
        compte que les votes où toi ET le groupe avez tranché « pour » ou « contre » (abstention et
        « sans avis » sont exclus). Le résultat est un spectre — ta proximité avec tous les groupes,
        thème par thème — et jamais un parti unique : on ne se résume pas à une étiquette.
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

      <Bloc titre="Tes réponses restent chez toi">
        Tes réponses au test de proximité sont une opinion politique — une donnée sensible. Elles ne
        sont ni envoyées ni stockées sur un serveur : tout le calcul se fait sur ton appareil. Ton
        dernier résultat est gardé en local (sur ce navigateur) pour que tu puisses le revoir, et un
        lien de partage encode tes réponses dans l'adresse elle-même — il recalcule tout à l'ouverture,
        sans compte ni base de données.
      </Bloc>

      <Bloc titre="Mesure d'audience">
        Scrutoir mesure de façon anonyme ce qui est consulté sur l'application (élus, duels,
        partis, thèmes), afin d'améliorer le service et de dégager des tendances d'intérêt
        agrégées. Aucune donnée ne permet de t'identifier individuellement. Nous ne
        profilons personne et nous ne vendons aucune donnée d'usage à des partis ou à des
        candidats. Aucun compte n'est nécessaire pour utiliser Scrutoir.
      </Bloc>

      <Bloc titre="Concrètement">
        Pas de cookie ni de traceur publicitaire. Aucune adresse IP ni identifiant n'est
        conservé. Les mesures se limitent à des compteurs agrégés — « combien de fois tel
        contenu est consulté ou suivi » — jamais reliés à une personne. Et la liste des
        élus et partis que tu suis, elle, reste sur ton appareil : elle n'est
        envoyée à personne.
      </Bloc>

      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => nav.push({ name: "mentions" })}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.accentSoft }}
      >
        <Text style={[T.body, { fontFamily: F.bold, color: C.accent }]}>Mentions légales & confidentialité</Text>
        <Text style={[T.callout, { fontFamily: F.bold, color: C.accent }]}>›</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.accentSoft }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>
          Scrutoir · version {APP_VERSION}
        </Text>
        <Text style={[T.small, { fontFamily: F.regular, color: C.textFaint, marginTop: 2 }]}>
          Indique ce numéro avec tes retours pour situer la version concernée.
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}
