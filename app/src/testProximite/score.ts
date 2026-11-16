// Moteur de score du « test de proximité » — LOGIQUE PURE (aucun import RN), testable
// hors app. Compare les réponses de l'utilisateur aux positions réelles des groupes sur
// les scrutins validés, par thème puis en global pondéré.

export type PositionGroupe = "pour" | "contre" | "abstention" | "partagé";
export type Reponse = "pour" | "contre" | "sans_avis";

export interface QuestionProximite {
  id: number;
  theme: string;
  these?: string | null;
  titre?: string | null; // intitulé officiel AN du scrutin (affiché sur la carte du test)
  date?: string | null; // date du scrutin (ISO)
  famille_clivage?: string;
  positions: Record<string, PositionGroupe>;
  /** Votants de chaque groupe (groupe actuel du député) : « Tes accords » en tire la position du
   *  groupe avec `positionMajoritaire` (decompte.ts). Absent d'un fichier en cache d'avant v1.24.0. */
  decomptes?: Record<string, { pour: number; contre: number; abstention: number }>;
  totaux?: { pour: number; contre: number; abstention: number };
  source_url?: string;
  /**
   * Origine de la question : « test » (absent = test, les questions publiées du test) ou « perso »
   * (un scrutin tranché par l'utilisateur hors du test, cf. questionsPerso.ts). Dans un thème,
   * les questions « perso » ne pèsent jamais plus que celles du test (cf. calculerProximite).
   */
  origine?: "test" | "perso";
}

export interface GroupeProximite {
  abrev: string;
}

/** Score d'un groupe sur un périmètre : ratio d'accord (0..1) et nb de comparables. */
export interface ScoreGroupe {
  pct: number | null; // accord / comparable, ou null si rien de comparable. (% à l'affichage)
  comparable: number;
  /** Votes comparés venus du test et des scrutins tranchés hors test (comparable = la somme). */
  comparableTest?: number;
  comparablePerso?: number;
  /** Votes comparés où le groupe a voté comme toi (toutes origines). */
  accord?: number;
}

export interface ResultatGlobal {
  abrev: string;
  pct: number; // moyenne pondérée des pct par thème (0..1)
  themes: number; // nombre de thèmes ayant contribué (comparable > 0)
}

export interface ResultatProximite {
  parTheme: Record<string, Record<string, ScoreGroupe>>;
  global: ResultatGlobal[]; // trié par pct décroissant
}

const tranche = (p: string | undefined): p is "pour" | "contre" =>
  p === "pour" || p === "contre";

/**
 * Calcule la proximité de l'utilisateur avec chaque groupe.
 * - "sans_avis" (ou réponse absente) : la question ne compte pas.
 * - comparable pour un groupe g sur une question : réponse ∈ {pour,contre} ET
 *   positions[g] ∈ {pour,contre} (abstention / partagé / absent ⇒ non comparable).
 * - accord si positions[g] == réponse.
 * - Votes HORS TEST (questions d'origine « perso ») : ils rejoignent leur thème, mais dans un
 *   thème ils ne pèsent jamais plus que les questions du test. Pour un groupe dans un thème :
 *   test seul ou perso seul → ratio habituel ; les deux → (sTest + w × sPerso) / (1 + w) avec
 *   w = min(1, comparablePerso / comparableTest). Un thème sans question du test répondue :
 *   les votes hors test y comptent seuls.
 * Les % ne sont PAS arrondis ici (ratios 0..1) — arrondi à l'affichage seulement.
 */
export function calculerProximite(
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  poids: Record<string, number>,
  groupes: GroupeProximite[]
): ResultatProximite {
  const abrevs = groupes.map((g) => g.abrev).filter(Boolean);

  // Accumulateurs comparable/accord par thème, par groupe et par origine.
  type Acc = { comparable: number; accord: number };
  const acc: Record<string, Record<string, { test: Acc; perso: Acc }>> = {};
  const themes = new Set<string>();

  for (const q of questions) {
    themes.add(q.theme);
    const rep = reponses[q.id];
    if (!tranche(rep)) continue; // sans_avis / non répondu → ignorée
    const origine = q.origine === "perso" ? "perso" : "test";

    for (const abrev of abrevs) {
      const pos = q.positions?.[abrev];
      if (!tranche(pos)) continue; // non comparable pour ce groupe
      const parGroupe = (acc[q.theme] ||= {});
      const g = (parGroupe[abrev] ||= { test: { comparable: 0, accord: 0 }, perso: { comparable: 0, accord: 0 } });
      g[origine].comparable++;
      if (pos === rep) g[origine].accord++;
    }
  }

  // parTheme : pour chaque thème rencontré, chaque groupe (pct null si non comparable).
  const parTheme: Record<string, Record<string, ScoreGroupe>> = {};
  for (const theme of themes) {
    parTheme[theme] = {};
    for (const abrev of abrevs) {
      const g = acc[theme]?.[abrev];
      const t = g?.test ?? { comparable: 0, accord: 0 };
      const p = g?.perso ?? { comparable: 0, accord: 0 };
      let pct: number | null = null;
      if (t.comparable > 0 && p.comparable > 0) {
        const w = Math.min(1, p.comparable / t.comparable); // plafond : jamais plus que le test
        pct = (t.accord / t.comparable + w * (p.accord / p.comparable)) / (1 + w);
      } else if (t.comparable > 0) pct = t.accord / t.comparable;
      else if (p.comparable > 0) pct = p.accord / p.comparable;
      parTheme[theme][abrev] = {
        pct,
        comparable: t.comparable + p.comparable,
        comparableTest: t.comparable,
        comparablePerso: p.comparable,
        accord: t.accord + p.accord,
      };
    }
  }

  // global : moyenne des pct par thème pondérée par poids[theme] (poids absent ⇒ 1),
  // en ignorant les thèmes où le groupe n'a aucun comparable. Trié décroissant.
  const global: ResultatGlobal[] = [];
  for (const abrev of abrevs) {
    let sommePoids = 0;
    let sommePond = 0;
    let nThemes = 0;
    for (const theme of themes) {
      const pt = parTheme[theme][abrev];
      if (pt.pct == null) continue;
      const w = poids[theme] ?? 1;
      sommePoids += w;
      sommePond += pt.pct * w;
      nThemes++;
    }
    if (sommePoids > 0) global.push({ abrev, pct: sommePond / sommePoids, themes: nThemes });
  }
  global.sort((a, b) => b.pct - a.pct || a.abrev.localeCompare(b.abrev));

  return { parTheme, global };
}

/** Score affiché : ratio d'accord (0..1) et base (nb de scrutins comparés). */
export interface ProximiteScore {
  pct: number;
  comparable: number;
}

// id de question (= n° de scrutin) → uid de scrutin (clé des votes d'un élu).
export const scrutinUidDeId = (id: number): string => `VTANR5L17V${id}`;

/**
 * Proximité du « je » avec un VOTANT quelconque (un député, via ses votes bruts
 * { scrutin_uid: position }). On réutilise EXACTEMENT le moteur des groupes — même
 * pondération par thème, mêmes règles de comparabilité — en fabriquant un « groupe
 * virtuel » dont la position sur chaque scrutin est le vote individuel du votant.
 * Abstention / absence / non-votant ⇒ non comparable. null si rien de comparable.
 */
export function scoreVotant(
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  poids: Record<string, number>,
  votes: Record<string, string>
): ProximiteScore | null {
  const CLE = "__moi";
  const qs = questions.map((q) => {
    const v = votes[scrutinUidDeId(q.id)];
    const pos: PositionGroupe = tranche(v) ? v : "abstention"; // non comparable sinon
    return { ...q, positions: { [CLE]: pos } };
  });
  const res = calculerProximite(qs, reponses, poids, [{ abrev: CLE }]);
  const g = res.global.find((x) => x.abrev === CLE);
  const comparable = Object.values(res.parTheme).reduce((s, t) => s + (t[CLE]?.comparable ?? 0), 0);
  if (!g || comparable < 1) return null;
  return { pct: g.pct, comparable };
}
