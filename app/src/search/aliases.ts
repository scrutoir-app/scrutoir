/**
 * Dictionnaire d'ALIAS / SYNONYMES curé à la main pour la recherche.
 *
 * Rôle : rattraper le JARGON, les SIGLES et les formulations courantes là où les
 * embeddings sont faibles (« PMA », « 49.3 », « fin de vie »…). Chaque entrée associe
 * des déclencheurs à une EXPANSION en langage naturel injectée dans la requête avant
 * vectorisation (le texte indexé, lui, utilise les intitulés officiels complets).
 *
 * ⚠️ NEUTRALITÉ ABSOLUE (règle Scrutoir) : les expansions sont purement FACTUELLES et
 * DESCRIPTIVES (vocabulaire administratif/juridique), jamais militantes ni orientées.
 * On décrit le SUJET d'un texte, on ne prend pas parti. À relire à chaque ajout.
 *
 * Partagé navigateur (moteur de recherche) ET Node (tests, futur enrichissement).
 */
import { aplatir, normaliser } from "./normalize";

export interface Alias {
  /** Concept canonique (debug / affichage). */
  concept: string;
  /** Déclencheurs : sigles, jargon, formulations courtes (normalisés à la volée). */
  cles: string[];
  /** Termes en langage naturel ajoutés à la requête avant embedding (factuels). */
  expansion: string;
  /** Thème associé (id de pipeline/src/categories.ts), si univoque. */
  theme?: string;
}

/** Liste curée — neutre, factuelle. Ordre sans importance (scan exhaustif). */
export const ALIASES: Alias[] = [
  // — Santé / bioéthique —
  { concept: "PMA", cles: ["pma"], theme: "sante",
    expansion: "procréation médicalement assistée assistance médicale à la procréation bioéthique" },
  { concept: "GPA", cles: ["gpa"], theme: "sante",
    expansion: "gestation pour autrui" },
  { concept: "IVG", cles: ["ivg", "avortement"], theme: "sante",
    expansion: "interruption volontaire de grossesse droit à l'avortement" },
  { concept: "Fin de vie", cles: ["fin de vie", "euthanasie", "aide a mourir", "suicide assiste", "soins palliatifs"], theme: "sante",
    expansion: "fin de vie aide à mourir euthanasie soins palliatifs" },

  // — Institutions / libertés —
  { concept: "Article 49.3", cles: ["49.3", "49 3", "article 49 alinea 3", "article 49.3"], theme: "institutions",
    expansion: "article 49 alinéa 3 de la Constitution engagement de responsabilité du gouvernement adoption sans vote" },
  { concept: "Motion de censure", cles: ["motion de censure", "censure du gouvernement"], theme: "institutions",
    expansion: "motion de censure responsabilité du gouvernement" },
  { concept: "Droits des personnes LGBT", cles: ["lgbt", "lgbtq", "lgbti", "lgbtqia"], theme: "institutions",
    expansion: "droits des personnes LGBT orientation sexuelle identité de genre thérapies de conversion discriminations" },
  { concept: "Mariage des couples de même sexe", cles: ["mariage pour tous", "mariage homosexuel", "mariage gay"], theme: "institutions",
    expansion: "ouverture du mariage et de l'adoption aux couples de même sexe" },
  { concept: "Proportionnelle", cles: ["proportionnelle", "scrutin proportionnel"], theme: "institutions",
    expansion: "mode de scrutin représentation proportionnelle élections législatives" },
  { concept: "Référendum", cles: ["rip", "referendum d initiative partagee"], theme: "institutions",
    expansion: "référendum d'initiative partagée consultation des citoyens" },

  // — Économie / budget / fiscalité —
  { concept: "Pouvoir d'achat", cles: ["pouvoir d achat", "cout de la vie", "vie chere", "inflation"], theme: "economie",
    expansion: "pouvoir d'achat inflation prix coût de la vie" },
  { concept: "Impôt sur la fortune", cles: ["isf", "impot fortune", "impot sur la fortune", "ifi"], theme: "economie",
    expansion: "impôt sur la fortune patrimoine impôt sur la fortune immobilière" },
  { concept: "Niches fiscales", cles: ["niche fiscale", "niches fiscales"], theme: "economie",
    expansion: "niches fiscales avantages fiscaux dépenses fiscales" },
  { concept: "Flat tax", cles: ["flat tax", "pfu", "prelevement forfaitaire unique"], theme: "economie",
    expansion: "prélèvement forfaitaire unique imposition des revenus du capital" },
  { concept: "Taxe sur les superprofits", cles: ["superprofits", "super profits", "taxe sur les superprofits"], theme: "economie",
    expansion: "taxation exceptionnelle des bénéfices des grandes entreprises" },
  { concept: "Budget de l'État", cles: ["plf", "loi de finances", "budget de l etat"], theme: "economie",
    expansion: "projet de loi de finances budget de l'État" },
  { concept: "Budget de la Sécurité sociale", cles: ["plfss", "budget secu", "budget de la securite sociale"], theme: "economie",
    expansion: "projet de loi de financement de la sécurité sociale" },

  // — Travail / emploi / retraites —
  { concept: "Réforme des retraites", cles: ["retraite", "retraites", "reforme des retraites", "age de depart", "64 ans"], theme: "travail",
    expansion: "réforme des retraites âge de départ durée de cotisation système de retraite" },
  { concept: "Salaire minimum", cles: ["smic", "salaire minimum"], theme: "travail",
    expansion: "salaire minimum interprofessionnel de croissance rémunération" },
  { concept: "Assurance chômage", cles: ["assurance chomage", "chomage", "france travail"], theme: "travail",
    expansion: "assurance chômage indemnisation des demandeurs d'emploi" },

  // — Écologie / énergie / climat —
  { concept: "Énergie nucléaire", cles: ["nucleaire", "epr", "reacteur", "reacteurs"], theme: "ecologie",
    expansion: "énergie nucléaire réacteurs production d'électricité" },
  { concept: "Énergies renouvelables", cles: ["enr", "eolien", "eoliennes", "solaire", "energies renouvelables"], theme: "ecologie",
    expansion: "énergies renouvelables éolien solaire transition énergétique" },
  { concept: "Zones à faibles émissions", cles: ["zfe", "zone a faibles emissions"], theme: "ecologie",
    expansion: "zones à faibles émissions mobilité circulation des véhicules qualité de l'air" },
  { concept: "Pesticides", cles: ["pesticides", "glyphosate", "neonicotinoides"], theme: "agriculture",
    expansion: "produits phytosanitaires pesticides usage agricole santé environnement" },

  // — Immigration / asile —
  { concept: "Aide médicale d'État", cles: ["ame", "aide medicale d etat"], theme: "immigration",
    expansion: "aide médicale d'État accès aux soins des personnes étrangères" },
  { concept: "Obligation de quitter le territoire", cles: ["oqtf"], theme: "immigration",
    expansion: "obligation de quitter le territoire français éloignement des étrangers" },
  { concept: "Droit du sol", cles: ["droit du sol"], theme: "immigration",
    expansion: "acquisition de la nationalité française droit du sol" },
  { concept: "Regroupement familial", cles: ["regroupement familial"], theme: "immigration",
    expansion: "regroupement familial conditions de séjour des familles étrangères" },

  // — Sécurité / justice —
  { concept: "Légitime défense / armes", cles: ["port d arme", "legitime defense"], theme: "securite-justice",
    expansion: "usage des armes légitime défense forces de l'ordre" },
  { concept: "Cannabis", cles: ["cannabis", "legalisation du cannabis", "stupefiants"], theme: "securite-justice",
    expansion: "cannabis usage de stupéfiants politique des drogues" },
  { concept: "Peines planchers", cles: ["peines planchers", "peine plancher"], theme: "securite-justice",
    expansion: "peines minimales automatiques peines planchers" },

  // — Solidarités / protection sociale —
  { concept: "Revenu de solidarité active", cles: ["rsa"], theme: "solidarites",
    expansion: "revenu de solidarité active minima sociaux conditions d'attribution" },
  { concept: "Allocations familiales", cles: ["allocations familiales", "apl", "aides au logement"], theme: "solidarites",
    expansion: "prestations sociales allocations familiales aides au logement" },
  { concept: "Personnes handicapées", cles: ["aah", "handicap"], theme: "solidarites",
    expansion: "allocation aux adultes handicapés droits des personnes en situation de handicap" },

  // — Agriculture / alimentation —
  { concept: "Souveraineté agricole", cles: ["souverainete agricole", "souverainete alimentaire"], theme: "agriculture",
    expansion: "souveraineté alimentaire agriculture production nationale" },

  // — International / défense —
  { concept: "Soutien à l'Ukraine", cles: ["ukraine"], theme: "international-defense",
    expansion: "guerre en Ukraine soutien militaire et financier relations internationales" },
  { concept: "Programmation militaire", cles: ["lpm", "loi de programmation militaire"], theme: "international-defense",
    expansion: "loi de programmation militaire budget des armées défense nationale" },
];

/** Alias usuels de PARTIS → sigle de groupe (centralisé ici, importé par api.ts). */
export const ALIAS_PARTIS: Record<string, string> = {
  lr: "DR", "les republicains": "DR", republicains: "DR",
  renaissance: "EPR", macron: "EPR", ensemble: "EPR",
  modem: "DEM", democrate: "DEM", democrates: "DEM",
  ps: "SOC", socialiste: "SOC", socialistes: "SOC",
  lfi: "LFI-NFP", insoumis: "LFI-NFP", melenchon: "LFI-NFP", nfp: "LFI-NFP", "france insoumise": "LFI-NFP",
  rn: "RN", "rassemblement national": "RN", "le pen": "RN", bardella: "RN",
  eelv: "ECOS", verts: "ECOS", ecologiste: "ECOS", ecologistes: "ECOS",
  pcf: "GDR", communiste: "GDR", communistes: "GDR",
  horizons: "HOR", philippe: "HOR",
  liot: "LIOT", udr: "UDDPLR", ciotti: "UDDPLR",
};

export interface CorrespondanceAlias {
  concept: string;
  cle: string; // déclencheur trouvé (normalisé)
  expansion: string;
  theme?: string;
}

/**
 * Étend une requête : repère les déclencheurs d'alias (au mot près) et renvoie une
 * requête ENRICHIE = requête d'origine + expansions factuelles (dédupliquées), prête
 * à être vectorisée. `correspondances` sert au routage/affichage (« recherche sur PMA »).
 */
export function etendreRequete(q: string): {
  enrichi: string;
  correspondances: CorrespondanceAlias[];
} {
  const plat = aplatir(q); // « l'ensemble » → « ensemble », encadré d'espaces
  const correspondances: CorrespondanceAlias[] = [];
  const vues = new Set<string>();

  for (const a of ALIASES) {
    for (const cle of a.cles) {
      const nc = normaliser(cle).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      if (!nc) continue;
      if (plat.includes(" " + nc + " ")) {
        if (!vues.has(a.concept)) {
          vues.add(a.concept);
          correspondances.push({ concept: a.concept, cle: nc, expansion: a.expansion, theme: a.theme });
        }
        break; // un seul déclencheur par concept suffit
      }
    }
  }

  const enrichi = correspondances.length
    ? [q.trim(), ...correspondances.map((c) => c.expansion)].join(". ")
    : q.trim();
  return { enrichi, correspondances };
}
