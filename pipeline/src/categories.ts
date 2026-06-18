/**
 * Taxonomie thematique + classifieur par mots-cles (fallback sans cle API).
 * Un scrutin peut appartenir a plusieurs categories.
 */

export interface Categorie {
  id: string;
  libelle: string;
  emoji: string;
  couleur: string;
  motsCles: string[];
}

// Normalise: minuscules + suppression des accents, pour un matching robuste.
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export const CATEGORIES: Categorie[] = [
  {
    id: "ecologie",
    libelle: "Écologie & Climat",
    emoji: "🌱",
    couleur: "#2E7D32",
    motsCles: [
      "environnement", "climat", "ecolog", "carbone", "energie renouvelable",
      "transition energetique", "biodiversite", "pollution", "pesticide",
      "gaz a effet de serre", "emission", "dechet", "recyclage", "nucleaire",
      "eolien", "solaire", "rechauffement", "eau potable", "littoral",
    ],
  },
  {
    id: "securite-justice",
    libelle: "Sécurité & Justice",
    emoji: "🛡️",
    couleur: "#1565C0",
    motsCles: [
      "securite", "police", "gendarmerie", "delinquance", "terroris",
      "ordre public", "prison", "penitentiaire", "justice", "penal",
      "magistrat", "crime", "delit", "violences", "stupefiant",
      "garde a vue", "tribunal", "peine", "recidive",
    ],
  },
  {
    id: "economie",
    libelle: "Économie, Budget & Fiscalité",
    emoji: "💶",
    couleur: "#6A1B9A",
    motsCles: [
      "budget", "fiscal", "impot", "taxe", "finances publiques", "deficit",
      "dette", "economie", "entreprise", "croissance", "tva", "investissement",
      "banque", "loi de finances", "depense publique", "cotisation",
      "pouvoir d'achat", "inflation", "commerce",
    ],
  },
  {
    id: "travail",
    libelle: "Travail & Emploi",
    emoji: "👷",
    couleur: "#E65100",
    motsCles: [
      "travail", "emploi", "chomage", "salaire", "retraite", "syndic",
      "licenciement", "smic", "temps de travail", "formation professionnelle",
      "code du travail", "assurance chomage", "penibilite", "apprentissage",
    ],
  },
  {
    id: "sante",
    libelle: "Santé",
    emoji: "🏥",
    couleur: "#C2185B",
    motsCles: [
      "sante", "hopital", "medic", "soin", "securite sociale", "maladie",
      "soignant", "medecin", "pharmac", "vaccin", "psychiatr", "ehpad",
      "fin de vie", "hospital", "deser medic", "ameli", "assurance maladie",
    ],
  },
  {
    id: "education",
    libelle: "Éducation & Recherche",
    emoji: "🎓",
    couleur: "#00838F",
    motsCles: [
      "education", "ecole", "enseignement", "universite", "etudiant",
      "recherche", "scolaire", "professeur", "eleve", "baccalaureat",
      "college", "lycee", "apprentissage scolaire", "savoir", "pedagog",
    ],
  },
  {
    id: "immigration",
    libelle: "Immigration & Asile",
    emoji: "🌍",
    couleur: "#4E342E",
    motsCles: [
      "immigration", "asile", "etranger", "titre de sejour", "frontiere",
      "refugie", "naturalisation", "expulsion", "oqtf", "visa", "migrant",
      "regroupement familial", "aide medicale d'etat", "ame", "clandestin",
    ],
  },
  {
    id: "solidarites",
    libelle: "Protection sociale & Solidarités",
    emoji: "🤝",
    couleur: "#AD1457",
    motsCles: [
      "solidarite", "pauvrete", "handicap", "famille", "allocation",
      "rsa", "minima sociaux", "aide sociale", "precarite", "prestation",
      "caf", "dependance", "grand age", "enfance", "egalite femmes hommes",
    ],
  },
  {
    id: "institutions",
    libelle: "Institutions, Démocratie & Libertés",
    emoji: "🏛️",
    couleur: "#283593",
    motsCles: [
      "constitution", "referendum", "election", "democratie", "collectivite",
      "decentralisation", "laicite", "liberte", "vie privee", "numerique",
      "presse", "scrutin", "suffrage", "institution", "deontologie",
      "donnees personnelles", "reseaux sociaux", "transparence",
    ],
  },
  {
    id: "agriculture",
    libelle: "Agriculture & Alimentation",
    emoji: "🚜",
    couleur: "#558B2F",
    motsCles: [
      "agricult", "agriculteur", "alimentation", "peche", "elevage",
      "foncier agricole", "pac", "viticult", "bio", "rural", "ferme",
      "produit phytosanitaire", "souverainete alimentaire",
    ],
  },
  {
    id: "international-defense",
    libelle: "International & Défense",
    emoji: "✈️",
    couleur: "#37474F",
    motsCles: [
      "defense", "armee", "militaire", "international", "traite", "otan",
      "union europeenne", "ukraine", "diplomat", "guerre", "affaires etrangeres",
      "operation exterieure", "ratification", "accord", "conflit", "geopolit",
    ],
  },
  {
    id: "logement",
    libelle: "Logement & Territoires",
    emoji: "🏠",
    couleur: "#5D4037",
    motsCles: [
      "logement", "urbanisme", "habitat", "loyer", "construction", "foncier",
      "amenagement du territoire", "ville", "hlm", "bail", "copropriete",
      "transport", "mobilite", "outre-mer", "zone rurale",
    ],
  },
];

export interface ResultatClassif {
  categorieId: string;
  confiance: number; // 0..1 (nb de mots-cles distincts touches, normalise)
}

/**
 * Classifieur par mots-cles. Renvoie les categories dont au moins un
 * mot-cle apparait dans le titre/objet, triees par nb de correspondances.
 */
export function classifierParMotsCles(titre: string, objet: string): ResultatClassif[] {
  const texte = normalize(`${titre} ${objet}`);
  const resultats: ResultatClassif[] = [];
  for (const cat of CATEGORIES) {
    let hits = 0;
    for (const mc of cat.motsCles) {
      if (texte.includes(normalize(mc))) hits++;
    }
    if (hits > 0) {
      resultats.push({ categorieId: cat.id, confiance: Math.min(1, hits / 3) });
    }
  }
  return resultats.sort((a, b) => b.confiance - a.confiance);
}
