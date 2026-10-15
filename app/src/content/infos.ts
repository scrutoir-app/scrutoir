/**
 * Contenu de l'onglet Infos (« À propos et limites ») — SOURCE UNIQUE, sans React (testable
 * depuis pipeline/). Rangement validé le 15/10/2026 : « En bref » d'abord, puis les blocs
 * rangés en familles repliables. Les titres et textes des blocs sont ceux de l'écran
 * précédent, mot pour mot : on a changé leur rangement, pas leur texte.
 */

/** Nom d'icône Feather (`@expo/vector-icons`). */
export type IconeBref = "check-square" | "bar-chart-2" | "lock";

export interface PointBref {
  icone: IconeBref;
  texte: string;
}

export interface BlocInfos {
  titre: string;
  texte: string;
  /** Le bloc porte le mini-schéma de la barre de vote. */
  schemaBarre?: boolean;
}

export interface FamilleInfos {
  id: string;
  titre: string;
  sousTitre: string;
  blocs: BlocInfos[];
}

export const INFOS_TITRE = "À propos et limites";

export const EN_BREF: PointBref[] = [
  {
    icone: "check-square",
    texte: "Seuls les scrutins publics, où chaque vote est nominatif, sont montrés. La plupart des votes se font à main levée.",
  },
  {
    icone: "bar-chart-2",
    texte: "Les pourcentages sont des indicateurs, pas des jugements. Un vote se comprend avec son texte.",
  },
  {
    icone: "lock",
    texte: "Tes réponses au test restent sur ton appareil. Rien n'est envoyé.",
  },
];

export const FAMILLES_INFOS: FamilleInfos[] = [
  {
    id: "donnees",
    titre: "Les données",
    sousTitre: "Source, période, absences, thèmes, amendements",
    blocs: [
      {
        titre: "Seuls les scrutins publics nominatifs",
        texte:
          "L'Assemblée n'enregistre le vote individuel que pour les « scrutins publics ». La plupart " +
          "des votes ont lieu à main levée et ne sont pas attribués nominativement : ils sont absents " +
          "de l'application.",
      },
      {
        titre: "« Absent », « Non votant » et participation",
        texte:
          "Un député absent n'apparaît pas dans un scrutin : l'absence est déduite (scrutins d'un " +
          "thème moins les votes), et bornée aux dates réelles du mandat (pas d'absences « fantômes » " +
          "avant l'entrée en fonction). « Non votant » = présent mais n'ayant pas pris part (ex. la " +
          "présidence de séance) — distinct d'« Absent ». Le taux de participation est montré en relatif " +
          "(« plus assidu que X % ») car il est bas pour tout le monde.",
      },
      {
        titre: "Classification thématique approximative",
        texte:
          "L'Assemblée ne range pas les scrutins par thème. Le classement (Écologie, Sécurité…) est " +
          "calculé automatiquement à partir de l'intitulé. Il est imparfait : certains scrutins ne " +
          "sont pas classés, d'autres peuvent l'être par erreur.",
      },
      {
        titre: "Exposé des amendements",
        texte:
          "Quand un scrutin porte sur un amendement, on affiche son exposé. Le lien scrutin↔amendement " +
          "est reconstitué automatiquement (date + numéro + auteur) : il aboutit pour ~9 amendements " +
          "sur 10, sinon l'exposé n'est pas affiché.",
      },
      {
        titre: "Source & période",
        texte:
          "Open Data de l'Assemblée Nationale (licence Etalab, mise à jour quotidienne), 17ᵉ " +
          "législature (depuis juin 2024). Les amendements déposés sur les textes proviennent du même " +
          "Open Data de l'Assemblée nationale. Données non officielles, à titre informatif.",
      },
    ],
  },
  {
    id: "chiffres",
    titre: "Lire les chiffres",
    sousTitre: "Barre de vote, position du groupe, confrontation",
    blocs: [
      {
        titre: "Lecture de la barre de vote",
        schemaBarre: true,
        texte:
          "Sur chaque carte, le pour part vers la gauche, le contre vers la droite, et " +
          "l'abstention occupe le centre à sa taille réelle. La longueur colorée est rapportée " +
          "à la moitié de l'hémicycle, donc une barre courte sur piste longue signale une " +
          "faible participation. Comme l'abstention tient le centre, la largeur restante de " +
          "chaque camp se réduit quand l'abstention monte. Comparer la longueur des barres d'un " +
          "vote à forte abstention avec celle d'un vote à faible abstention n'est donc pas " +
          "fiable. Chaque carte se lit pour elle-même.",
      },
      {
        titre: "Un vote « Pour » ou « Contre » ne dit pas tout",
        texte:
          "Le sens d'un vote dépend du texte. On peut voter contre une loi parce qu'on la juge " +
          "insuffisante. Les pourcentages sont des indicateurs, pas des jugements.",
      },
      {
        // ⚠️ Point ouvert (non tranché) : les fiches député et parti affichent un pourcentage
        // de votes « avec son groupe », que ce texte dit ne pas montrer. Texte gardé tel quel.
        titre: "Position du groupe (pas de score de loyauté)",
        texte:
          "Plutôt qu'un score de loyauté agrégé — qui se prête à un jugement hâtif — on affiche la " +
          "position majoritaire du groupe à côté de chaque vote, et les écarts sont listés dans les " +
          "« dissidences ». Cette position est celle de la majorité des membres du groupe qui ont voté. " +
          "L'Assemblée publie aussi une « position majoritaire », mais elle contredit parfois son propre " +
          "décompte : on ne la reprend pas. À toi de lire l'écart.",
      },
      {
        titre: "Confronter deux élus",
        texte:
          "On compare deux députés sur les seuls scrutins nominatifs où les deux ont voté. Un thème " +
          "sans scrutin commun est « non couvert » (invérifiable) — un silence de données n'est pas un " +
          "désaccord.",
      },
      {
        titre: "Les amendements",
        texte:
          "Pour chaque texte de loi, Scrutoir indique combien d'amendements chaque groupe a déposés, et " +
          "ce qu'ils sont devenus : adoptés, rejetés, ou restés sans suite. Ces données proviennent du " +
          "même Open Data de l'Assemblée nationale. Un grand nombre d'amendements ne dit rien de la " +
          "qualité du travail. Selon les cas, c'est un texte réécrit en profondeur, ou un même amendement " +
          "répété de nombreuses fois pour ralentir le débat. Nous affichons le nombre, le sort et " +
          "l'article visé côte à côte, pour que vous fassiez la part des choses, sans porter de jugement " +
          "à votre place.",
      },
    ],
  },
  {
    id: "test",
    titre: "Le test de proximité",
    sousTitre: "Comment le spectre est calculé, où restent tes réponses",
    blocs: [
      {
        titre: "Le test de proximité",
        texte:
          "Le test te confronte à de vrais scrutins, choisis parce qu'ils portent sur un texte entier " +
          "et qu'ils ont divisé l'Assemblée (pas les votes quasi-unanimes ni les amendements de détail). " +
          "Pour chaque vote, on regarde si ta réponse rejoint la position de chaque groupe : on ne " +
          "compte que les votes où toi ET le groupe avez tranché « pour » ou « contre » (abstention et " +
          "« sans avis » sont exclus). Le résultat est un spectre — ta proximité avec tous les groupes, " +
          "thème par thème — et jamais un parti unique : on ne se résume pas à une étiquette.",
      },
      {
        titre: "Tes réponses restent chez toi",
        texte:
          "Tes réponses au test de proximité sont une opinion politique — une donnée sensible. Elles ne " +
          "sont ni envoyées ni stockées sur un serveur : tout le calcul se fait sur ton appareil. Ton " +
          "dernier résultat est gardé en local (sur ce navigateur) pour que tu puisses le revoir, et un " +
          "lien de partage encode tes réponses dans l'adresse elle-même — il recalcule tout à l'ouverture, " +
          "sans compte ni base de données.",
      },
    ],
  },
  {
    id: "vie-privee",
    titre: "Vie privée",
    sousTitre: "Mesure d'audience, pas de cookie",
    blocs: [
      {
        titre: "Mesure d'audience",
        texte:
          "Scrutoir mesure de façon anonyme ce qui est consulté sur l'application (élus, duels, " +
          "partis, thèmes), afin d'améliorer le service et de dégager des tendances d'intérêt " +
          "agrégées. Aucune donnée ne permet de t'identifier individuellement. Nous ne " +
          "profilons personne et nous ne vendons aucune donnée d'usage à des partis ou à des " +
          "candidats. Aucun compte n'est nécessaire pour utiliser Scrutoir.",
      },
      {
        titre: "Concrètement",
        texte:
          "Pas de cookie ni de traceur publicitaire. Aucune adresse IP ni identifiant n'est " +
          "conservé. Les mesures se limitent à des compteurs agrégés — « combien de fois tel " +
          "contenu est consulté ou suivi » — jamais reliés à une personne. Et la liste des " +
          "élus et partis que tu suis, elle, reste sur ton appareil : elle n'est " +
          "envoyée à personne.",
      },
    ],
  },
  {
    id: "scrutoir",
    titre: "Pourquoi « Scrutoir »",
    sousTitre: "À quoi sert l'appli, d'où vient le nom",
    blocs: [
      {
        titre: "À quoi sert Scrutoir ?",
        texte:
          "Scrutoir aide à comparer le discours des politiques à leurs actes. L'app rend lisibles les " +
          "votes réels des députés à l'Assemblée : cherche un élu et vois comment il ou elle a " +
          "voté par thème, ouvre un scrutin pour comprendre le texte, confronte deux élus sur leurs " +
          "accords et désaccords, ou retrouve ton député par commune. Le tout de façon neutre — " +
          "aucune couleur de parti n'est mise en avant, seul le vote parle.",
      },
      {
        titre: "Pourquoi Scrutoir ?",
        texte:
          "C'est un vieux mot français. L'escritoire était un bureau d'écriture, un meuble où l'on " +
          "consignait, archivait, gardait trace. Le mot a disparu au XVIIIᵉ siècle. On l'a repris parce " +
          "qu'il porte deux choses à la fois : la racine de scrutin, et l'idée d'un endroit où l'on " +
          "regarde de près. C'est exactement ce que fait l'app.",
      },
    ],
  },
];
