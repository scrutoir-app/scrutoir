// Classification d'un scrutin par son INTITULÉ (`titre`), 100 % côté client (aucun champ ni
// requête ajoutés). Même heuristique que le pipeline `pipeline/src/linkAmendements.ts` :
// l'ORDRE des tests compte — l'amendement d'abord, car son intitulé cite souvent le texte
// visé (« amendement n°… à la proposition de loi … »). Générique sur `{ titre?: string | null }`
// pour accepter aussi bien `ScrutinResume` que `VoteScrutin`.

export type TypeScrutin = "tous" | "projet" | "proposition" | "amendement";

/** Classe concrète d'un scrutin (jamais "tous" ; "autre" = motions, déclarations, etc.). */
export type TypeScrutinConcret = "projet" | "proposition" | "amendement" | "autre";

export function classerScrutin(s: { titre?: string | null }): TypeScrutinConcret {
  const t = (s.titre ?? "").toLowerCase();
  if (t.includes("amendement")) return "amendement"; // 1. amendement / sous-amendement
  if (t.includes("projet de loi")) return "projet"; // 2. projet de loi
  if (t.includes("proposition de loi")) return "proposition"; // 3. proposition de loi
  return "autre"; // 4. le reste
}

/** "tous" → liste inchangée ; sinon les scrutins du type demandé. Les "autre" ne sortent que sous "tous". */
export function filtrerParType<T extends { titre?: string | null }>(liste: T[], type: TypeScrutin): T[] {
  if (type === "tous") return liste;
  return liste.filter((s) => classerScrutin(s) === type);
}

export interface ComptesType {
  projet: number;
  proposition: number;
  amendement: number;
}

/** Compte les scrutins par type nommé (sert à savoir quels chips afficher). Les "autre" ne sont pas comptés. */
export function compterParType<T extends { titre?: string | null }>(liste: T[]): ComptesType {
  const c: ComptesType = { projet: 0, proposition: 0, amendement: 0 };
  for (const s of liste) {
    const k = classerScrutin(s);
    if (k !== "autre") c[k] += 1;
  }
  return c;
}

/**
 * N'affiche le filtre que si AU MOINS DEUX des trois types nommés sont présents : un seul
 * type (ou zéro) → rien à trier.
 */
export function doitAfficherFiltreType(c: ComptesType): boolean {
  const presents = (c.projet > 0 ? 1 : 0) + (c.proposition > 0 ? 1 : 0) + (c.amendement > 0 ? 1 : 0);
  return presents >= 2;
}

/**
 * Garde-fou : si le filtre est masqué (moins de 2 types présents), la valeur d'état ne doit
 * pas continuer de filtrer en silence → on la neutralise en "tous". À utiliser côté écran
 * pour dériver le type RÉELLEMENT appliqué.
 */
export function typeEffectif(type: TypeScrutin, c: ComptesType): TypeScrutin {
  return doitAfficherFiltreType(c) ? type : "tous";
}

// --- Ce qui a été voté ------------------------------------------------------------
// Lecture MÉCANIQUE de l'intitulé officiel AN (`titre`) : on découpe, on ne reformule jamais.
// Forme générale : « <objet voté> [du | de la] <texte visé> (<précisions>) ». L'objet voté
// devient le titre de la fiche scrutin (« Amendement n° 3919 de M. Sansu, à l'article 2 »),
// le texte visé passe en lien au-dessus, les parenthèses finales (lecture, base légale…)
// vont sur la ligne de méta. Seules retouches : déterminant de tête retiré + majuscule, une
// virgule avant le lieu d'un amendement (« , à l'article 2 ») et, pour un vote sur
// l'ensemble, la formule fixe « Vote sur l'ensemble du projet de loi ».

/** Nature de ce qui a été voté, lue en TÊTE de l'intitulé (jamais par simple présence d'un mot). */
export type NatureVote =
  | "amendement"
  | "sous-amendement"
  | "article"
  | "ensemble"
  | "partie"
  | "motion"
  | "censure"
  | "declaration"
  | "procedure"
  | "autre";

/** Étiquette affichée au-dessus du titre (type de vote). */
export const ETIQUETTE_NATURE: Record<NatureVote, string> = {
  amendement: "Amendement",
  "sous-amendement": "Sous-amendement",
  article: "Article",
  ensemble: "Vote sur l'ensemble",
  partie: "Partie du texte",
  motion: "Motion",
  censure: "Motion de censure",
  declaration: "Déclaration du Gouvernement",
  procedure: "Procédure",
  autre: "Scrutin",
};

export interface CeQuiEstVote {
  nature: NatureVote;
  etiquette: string;
  /** Ce qui a été voté (jamais vide : à défaut, l'intitulé entier). */
  titre: string;
  /** Texte visé tel qu'écrit dans l'intitulé (« Projet de loi de finances pour 2027 »), ou null. */
  texte: string | null;
  /** Parenthèses finales, dans l'ordre (« Première lecture », « Article 34-1 de la Constitution »). */
  precisions: string[];
}

const DESIGNATION = /(projet de loi|proposition de loi|proposition de résolution)/i;
const capitale = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Retire le groupe parenthésé FINAL (équilibré) : [avant, contenu] ou null. */
function dernierGroupe(s: string): [string, string] | null {
  if (!s.endsWith(")")) return null;
  let prof = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ")") prof++;
    else if (s[i] === "(" && --prof === 0) return [s.slice(0, i).trimEnd(), s.slice(i + 1, -1).trim()];
  }
  return null;
}

// Mots de liaison laissés en fin d'objet quand on en détache le texte visé.
const LIAISON = /(?:\s*[,(]|\s+(?:du|de la|de l'|des|de|sur le|sur la))\s*$/i;

function natureDe(t: string, typeVote: string): NatureVote {
  if (typeVote.includes("censure") || /^(sur )?la motion de censure/.test(t)) return "censure";
  if (/^(sur )?(le |les )?sous-amend/.test(t)) return "sous-amendement";
  if (/^(sur )?(l'|les )amen/.test(t)) return "amendement"; // aussi la coquille AN « amenedement »
  if (/^(l'|les )(articles?|aticle|annexe)\b/.test(t)) return "article"; // « aticle » : coquille AN
  if (/^(l'ensemble de )?la (première|deuxième|troisième|quatrième) partie\b/.test(t)) return "partie";
  if (/^l'ensemble\b/.test(t)) return "ensemble";
  if (/^(sur )?la motion\b/.test(t)) return "motion";
  // PIÈGE : le vote solennel est intitulé « la proposition de loi … (première lecture) », sans
  // « l'ensemble » — c'est bien le vote sur le texte entier (idem projet de loi, résolution).
  if (/^(le projet de loi|la proposition de loi|la proposition de résolution)\b/.test(t)) return "ensemble";
  if (/^la déclaration\b/.test(t)) return "declaration";
  if (/^(la demande|la proposition du gouvernement)\b/.test(t)) return "procedure";
  return "autre";
}

/** Découpe l'intitulé officiel d'un scrutin en « ce qui a été voté » + texte visé + précisions. */
export function ceQuiEstVote(s: { titre?: string | null; type_vote?: string | null }): CeQuiEstVote {
  let reste = (s.titre ?? "").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim().replace(/[\s.;]+$/, "");

  // 1. Parenthèses finales : précisions (lecture, base légale…) OU texte visé entre parenthèses
  //    (« la demande de suspension de séance … (proposition de loi …) (première lecture) »).
  const precisions: string[] = [];
  let texte: string | null = null;
  for (let g = dernierGroupe(reste); g; g = dernierGroupe(reste)) {
    reste = g[0];
    if (DESIGNATION.test(g[1])) { texte = g[1]; break; }
    precisions.unshift(capitale(g[1]));
  }
  // 2. Sinon, le texte visé commence à sa première désignation dans l'intitulé.
  if (texte == null) {
    const m = DESIGNATION.exec(reste);
    if (m) { texte = reste.slice(m.index); reste = reste.slice(0, m.index); }
  }
  let objet = reste.trim();
  for (let prec = ""; prec !== objet; ) { prec = objet; objet = objet.replace(LIAISON, "").trim(); }

  const t = (s.titre ?? "").replace(/[’`]/g, "'").trim().toLowerCase();
  const nature = natureDe(t, (s.type_vote ?? "").toLowerCase());

  let titre: string;
  if (nature === "ensemble" || (nature === "partie" && /^l'ensemble/i.test(objet))) {
    const genre = texte ? /^(projet de loi|proposition de loi|proposition de résolution)( organique| constitutionnelle)?/i.exec(texte) : null;
    const g = genre ? genre[0].toLowerCase() : null;
    titre = nature === "partie"
      ? `Vote sur ${objet}`
      : g ? `Vote sur l'ensemble ${g.startsWith("projet") ? "du" : "de la"} ${g}` : "Vote sur l'ensemble du texte";
  } else {
    titre = objet.replace(/^(sur )?(l'|le |la |les )/i, "");
    if (nature === "amendement" || nature === "sous-amendement")
      titre = titre.replace(/([^,]) ((?:à|après|avant) (?:l'article|les articles|l'annexe)\b)/, "$1, $2");
    titre = capitale(titre);
  }
  if (!titre) titre = capitale((s.titre ?? "").trim()) || "Scrutin";

  return {
    nature,
    etiquette: ETIQUETTE_NATURE[nature],
    titre,
    texte: texte ? capitale(texte.replace(/[\s.,;]+$/, "")) : null,
    precisions,
  };
}
