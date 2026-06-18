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
      "regroupement familial", "aide medicale d'etat", "clandestin",
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
  confiance: number; // 0..1
}

/**
 * Cle identifiant le dossier legislatif a partir de l'intitule du scrutin.
 * "l'ensemble du projet de loi X" et "l'amendement n° 4 ... du projet de loi X"
 * renvoient la meme cle => on peut propager le theme aux amendements.
 */
export function cleDossier(titre: string | null): string | null {
  if (!titre) return null;
  const t = normalize(titre);
  const m = t.match(/(projet de loi|proposition de loi|proposition de resolution)(.*)$/);
  if (!m) return null;
  const cle = (m[1] + m[2]).replace(/\(.*$/, "").trim();
  return cle.length >= 20 ? cle.slice(0, 90) : null;
}

// Nombre max de categories attribuees a un meme scrutin.
const MAX_CATEGORIES = 3;
// Score minimal pour retenir une categorie (evite les matchs trop faibles).
const SCORE_MIN = 1;

// Cache des regex par mot-cle. On matche des MOTS ENTIERS (limites de mots)
// pour eviter qu'un token court ("ame") matche un sous-mot ("amendement").
const regexCache = new Map<string, RegExp>();
function regexMot(mc: string): RegExp {
  let r = regexCache.get(mc);
  if (!r) {
    const esc = normalize(mc).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Cle >= 5 lettres : on autorise le prefixe (gere pluriels et derives,
    // ex: "ecolog" -> ecologie/ecologique, "travail" -> travailleur).
    // Cle plus courte : mot exact, pour eviter qu'un token court matche un
    // sous-mot frequent (ex: "visa" dans "visant").
    const noyau = normalize(mc).replace(/\s/g, "");
    const fin = noyau.length >= 5 ? "" : "(?![a-z0-9])";
    r = new RegExp(`(?<![a-z0-9])${esc}${fin}`);
    regexCache.set(mc, r);
  }
  return r;
}

/**
 * Classifieur par mots-cles. Matche des mots entiers ; un mot-cle compose
 * (avec espace) pese davantage car plus specifique. Renvoie au plus
 * MAX_CATEGORIES categories, triees par score.
 */
export function classifierParMotsCles(titre: string, objet: string): ResultatClassif[] {
  const texte = normalize(`${titre} ${objet}`);
  const resultats: ResultatClassif[] = [];
  for (const cat of CATEGORIES) {
    let score = 0;
    for (const mc of cat.motsCles) {
      if (regexMot(mc).test(texte)) score += mc.includes(" ") ? 2 : 1;
    }
    if (score >= SCORE_MIN) {
      resultats.push({ categorieId: cat.id, confiance: Math.min(1, score / 3) });
    }
  }
  return resultats.sort((a, b) => b.confiance - a.confiance).slice(0, MAX_CATEGORIES);
}
