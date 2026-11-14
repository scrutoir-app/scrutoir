// Rubrique Présidentielle 2027 : logique pure, libellés, liens profonds, absence de pourcentage.
// Lancé par `npm test` (pipeline). Aucune donnée de verdict réelle ici (dépôt public) : fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexPresidentielle, ProgrammeResume, ScrutinConfronte } from "./types";
import {
  cibleLienProfond, comptesDe, correspond, familleDe, finCommune, programmeDuGroupe, regrouper, repartir, resoudreProgramme,
  rubriqueVisible, valeurOpen, ordonnerProgrammes,
} from "./logique";
import {
  annonceFiltre, comptesEnLettres, dateLongue, detailNeutre, intituleAffiche, ligneComptes, metaMesure, nombre, phraseGroupe, phraseSansEffet,
  phraseVerdict, sortsDuLot, titreLot,
} from "./libelles";
import { pileDeCible, pileLienProfond } from "./routes";
import { indexValide } from "./donnees";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESUME: ProgrammeResume = {
  id: "abc-2027",
  alias: ["abc"],
  parti: "Parti fictif",
  groupe: { uid: "PO000001", abrev: "GRP", libelle: "Groupe fictif" },
  publieLe: "2026-11-06",
  mesures: 10,
  chiffrees: 2,
  base: { scrutins: 100, du: "2024-10-08", au: "2026-11-12" },
};
const VIDE: IndexPresidentielle = { generatedAt: "2026-11-14T00:00:00Z", programmes: [] };
const PLEIN: IndexPresidentielle = { generatedAt: "2026-11-14T00:00:00Z", programmes: [RESUME] };

function sc(p: Partial<ScrutinConfronte> & { numero: number }): ScrutinConfronte {
  return {
    uid: `VTANR5L17V${p.numero}`,
    date: "2024-11-28",
    sort: "rejete",
    sens: "inverse",
    effet: "c",
    position: "contre",
    pour: 0,
    contre: 50,
    abstention: 0,
    votants: 50,
    intitule: `l'amendement n° ${p.numero} de M. X à l'article premier de la proposition de loi visant à essayer (première lecture).`,
    alertes: [],
    ...p,
  };
}

// --- Index vide : la rubrique n'existe pas -------------------------------------------------------

test("index vide, absent ou invalide : rubrique invisible partout", () => {
  for (const i of [VIDE, null, undefined, indexValide(null), indexValide({ programmes: "x" }), indexValide({})]) {
    assert.equal(rubriqueVisible(i), false);
    assert.equal(programmeDuGroupe(i, "PO000001"), null);
    for (const open of ["presidentielle", "programme:abc-2027", "programme:abc", "chapitre:abc-2027.p2c2", "mesure:abc-2027.p3c1-046", "mesure:abc-2027.D13"]) {
      assert.equal(cibleLienProfond(open, i), null, open);
      assert.equal(pileLienProfond(open, i), null, open);
    }
  }
});

test("indexValide écarte les entrées mal formées", () => {
  const i = indexValide({ generatedAt: "x", programmes: [RESUME, { id: "../x", publieLe: "2026", alias: [] }, null] });
  assert.deepEqual(i.programmes.map((p) => p.id), ["abc-2027"]);
});

// --- Liens profonds -------------------------------------------------------------------------------

test("liens profonds : formes acceptées, alias, identifiants inconnus", () => {
  assert.deepEqual(cibleLienProfond("presidentielle", PLEIN), { ecran: "presidentielle" });
  assert.deepEqual(cibleLienProfond("programme:abc-2027", PLEIN), { ecran: "programme", programme: "abc-2027" });
  assert.deepEqual(cibleLienProfond("programme:abc", PLEIN), { ecran: "programme", programme: "abc-2027" });
  assert.deepEqual(cibleLienProfond("chapitre:abc-2027.p2c2", PLEIN), { ecran: "chapitre", programme: "abc-2027", chapitre: "p2c2" });
  assert.deepEqual(cibleLienProfond("mesure:abc.D13", PLEIN), { ecran: "mesure", programme: "abc-2027", mesure: "D13" });
  assert.equal(cibleLienProfond("programme:inconnu", PLEIN), null);
  assert.equal(cibleLienProfond("mesure:abc-2027", PLEIN), null);
  assert.equal(cibleLienProfond("mesure:abc-2027.<script>", PLEIN), null);
  assert.equal(cibleLienProfond("autre:abc", PLEIN), null);
  for (const c of [
    { ecran: "presidentielle" as const },
    { ecran: "programme" as const, programme: "abc-2027" },
    { ecran: "chapitre" as const, programme: "abc-2027", chapitre: "p2c2" },
    { ecran: "mesure" as const, programme: "abc-2027", mesure: "p3c1-046" },
  ])
    assert.deepEqual(cibleLienProfond(valeurOpen(c), PLEIN), c);
});

test("liens profonds : le retour suit le même chemin", () => {
  const noms = (o: string) => pileLienProfond(o, PLEIN)!.map((r) => r.name);
  assert.deepEqual(noms("presidentielle"), ["search", "presidentielle"]);
  assert.deepEqual(noms("programme:abc"), ["search", "presidentielle", "programme"]);
  assert.deepEqual(noms("chapitre:abc.p2c2"), ["search", "presidentielle", "programme", "chapitre"]);
  assert.deepEqual(noms("mesure:abc.p3c1-046"), ["search", "presidentielle", "programme", "chapitre", "mesure"]);
  const pile = pileDeCible({ ecran: "mesure", programme: "abc-2027", mesure: "D13" });
  assert.deepEqual(pile.map((r) => r.name), ["search", "presidentielle", "programme", "mesure"]);
  assert.equal((pile[2] as any).perimetre, "ch");
  assert.equal((pileDeCible({ ecran: "mesure", programme: "abc-2027", mesure: "p3c1-046" })[3] as any).chapitre, "p3c1");
});

test("programmes du plus récent au plus ancien ; fiche parti par groupe", () => {
  const vieux = { ...RESUME, id: "old-2027", publieLe: "2026-09-01", groupe: { uid: "PO000002", abrev: "OLD", libelle: "Vieux" } };
  assert.deepEqual(ordonnerProgrammes([vieux, RESUME]).map((p) => p.id), ["abc-2027", "old-2027"]);
  const i = { ...PLEIN, programmes: [vieux, RESUME] };
  assert.equal(programmeDuGroupe(i, "PO000002")?.id, "old-2027");
  assert.equal(programmeDuGroupe(i, "PO999999"), null);
  assert.equal(resoudreProgramme(i, "OLD-2027")?.id, "old-2027");
});

// --- Comptes et filtres --------------------------------------------------------------------------

test("familles, comptes et filtres (le hors champ n'est jamais compté)", () => {
  assert.equal(familleDe("h"), null);
  assert.equal(familleDe("j"), "n");
  const k = comptesDe(["c", "c", "t", "s", "j", "r", "h", "h"]);
  assert.deepEqual(k, { c: 2, t: 1, s: 1, j: 1, r: 1 });
  assert.equal(correspond("h", "toutes"), false);
  assert.equal(correspond("j", "n"), true);
  assert.equal(correspond("j", "n", "s"), false);
  assert.equal(correspond("s", "n", "s"), true);
  assert.equal(correspond("c", "t"), false);
  assert.equal(ligneComptes(k), "= 2  ≠ 1  ∅ 3");
  assert.equal(detailNeutre({ c: 0, t: 0, s: 1385, j: 0, r: 2 }), "1 385 sans scrutin public · 2 sans vote représentatif");
  assert.equal(comptesEnLettres(k), "2 cohérentes, 1 en tension, 3 neutres");
  assert.equal(annonceFiltre(0), "Aucune mesure affichée");
  assert.equal(annonceFiltre(33), "33 mesures affichées");
});

test("nombres et dates à la française", () => {
  assert.equal(nombre(1069), "1 069");
  assert.equal(nombre(9895), "9 895");
  assert.equal(nombre(28), "28");
  assert.equal(dateLongue("2026-11-06"), "6 novembre 2026");
  assert.equal(dateLongue("2025-12-01"), "1er décembre 2025");
  assert.equal(dateLongue("n'importe quoi"), "");
});

// --- Scrutins : répartition, regroupement, phrases -----------------------------------------------

test("répartition par effet et tri par date décroissante", () => {
  const r = repartir([
    sc({ numero: 1, date: "2024-01-01", effet: "c" }),
    sc({ numero: 2, date: "2025-01-01", effet: "t" }),
    sc({ numero: 3, date: "2026-01-01", effet: "c" }),
    sc({ numero: 4, effet: "j" }),
    sc({ numero: 5, effet: "r" }),
    sc({ numero: 6, effet: "o" }),
    sc({ numero: 7, effet: "x", votants: 0, contre: 0, position: "aucun" }),
  ]);
  assert.deepEqual(r.sens.map((s) => s.numero), [3, 1]);
  assert.deepEqual(r.ecarts.map((s) => s.numero), [2]);
  assert.deepEqual(r.aJuger.map((s) => s.numero), [4]);
  assert.deepEqual(r.sansEffet.map((s) => s.numero).sort(), [5, 6, 7]);
});

test("lots : même texte, même jour, même effet, même position → une ligne", () => {
  const douze = Array.from({ length: 12 }, (_, i) => sc({ numero: 1469 + i }));
  const autre = sc({ numero: 900, date: "2025-06-05", sens: "meme", effet: "c", position: "pour", pour: 50, contre: 0, intitule: "la proposition de résolution visant à abroger une loi." });
  const el = regrouper([...douze, autre]);
  assert.equal(el.length, 2);
  assert.ok("seul" in el[0] && el[0].seul.numero === 900);
  assert.ok("groupe" in el[1]);
  const g = (el[1] as any).groupe;
  assert.equal(g.scrutins.length, 12);
  assert.equal(g.communFin, "à l'article premier de la proposition de loi visant à essayer (première lecture).");
  assert.equal(titreLot(g.scrutins), "12 amendements du 28 novembre 2024");
  assert.equal(sortsDuLot(g.scrutins), "tous rejetés");
  assert.equal(phraseGroupe("contre", 12), "Le groupe vote contre les 12");
  // Une position différente casse le lot.
  const el2 = regrouper([sc({ numero: 1 }), sc({ numero: 2, position: "pour", pour: 50, contre: 0 })]);
  assert.equal(el2.length, 2);
});

test("fin commune recalée au début d'un mot", () => {
  assert.equal(finCommune(["l'amendement n° 12 à l'article 3 du projet de loi de finances", "l'amendement n° 2 à l'article 3 du projet de loi de finances"]), "à l'article 3 du projet de loi de finances");
  assert.equal(finCommune(["abc", "xbc"]), null);
});

test("phrase du verdict : des nombres, jamais de part", () => {
  const ret = [
    ...Array.from({ length: 5 }, (_, i) => sc({ numero: i + 1, effet: "c" })),
    sc({ numero: 100, effet: "t", sens: "meme" }),
    sc({ numero: 102, effet: "t", sens: "meme", votants: 0, contre: 0, position: "aucun" }),
  ];
  assert.equal(phraseVerdict("t", ret), "2 des 7 scrutins retenus s’écartent de la mesure. Les 5 autres vont dans son sens.");
  const multi = [...Array.from({ length: 4 }, (_, i) => sc({ numero: i + 1 })), sc({ numero: 50, effet: "t", sens: "meme", votants: 0, contre: 0, position: "aucun" })];
  assert.equal(
    phraseVerdict("t", multi),
    "1 des 5 scrutins retenus s’écarte de la mesure : le groupe n’y a pas pris part. Les 4 autres vont dans son sens.",
  );
  assert.equal(phraseVerdict("c", [sc({ numero: 1 })]), "Le seul scrutin retenu va dans le sens de la mesure.");
  assert.match(phraseVerdict("t", [sc({ numero: 1, effet: "t" }), sc({ numero: 2, effet: "c" }), sc({ numero: 3, effet: "j" })]), /Parmi les autres : 1 va dans son sens, 1 est à juger\./);
});

test("aucun pourcentage dans les libellés générés par la rubrique", () => {
  const statuts = ["c", "t", "s", "j", "r", "h"] as const;
  const effets = ["c", "t", "j", "r", "o", "x"] as const;
  const textes: string[] = [];
  for (const st of statuts) {
    textes.push(metaMesure(st, 3), metaMesure(st, 0));
    for (const n of [1, 2, 18]) textes.push(phraseVerdict(st, Array.from({ length: n }, (_, i) => sc({ numero: i, effet: effets[i % effets.length] }))));
  }
  for (const e of effets) textes.push(phraseSansEffet(sc({ numero: 1, effet: e, votants: e === "x" ? 0 : 2 })) ?? "");
  textes.push(intituleAffiche(sc({ numero: 1 })), ligneComptes({ c: 12, t: 7, s: 30, j: 4, r: 1 }), comptesEnLettres({ c: 1, t: 1, s: 1, j: 1, r: 1 }));
  for (const t of textes) assert.ok(!t.includes("%"), t);
});

test("aucun « % » dans le code des écrans et composants de la rubrique (hors commentaires)", () => {
  const dossiers = [path.join(__dirname, "../screens/presidentielle"), path.join(__dirname, "../components/presidentielle")];
  const fichiers = [...dossiers.flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f))), path.join(__dirname, "libelles.ts")];
  assert.ok(fichiers.length >= 8);
  for (const f of fichiers) {
    const sansCommentaires = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    assert.ok(!sansCommentaires.includes("%"), `« % » trouvé dans ${path.basename(f)}`);
  }
});

test("intitulé officiel : le « Sur » de l'Assemblée, puis le texte mot pour mot", () => {
  assert.equal(intituleAffiche({ intitule: "l'ensemble du projet de loi (première lecture)." }), "Sur l'ensemble du projet de loi (première lecture).");
  assert.equal(intituleAffiche({ intitule: "sur la motion de rejet." }), "Sur la motion de rejet.");
});
