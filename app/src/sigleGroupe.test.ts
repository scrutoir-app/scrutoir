import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ORDRE_HEMICYCLE } from "./components/hemicycleGeo";
import {
  DUREE_BULLE_MS, basculerBulle, bulleCourante, fermerBulle, garderBulle, indexerGroupes, ouvrirBulle,
  placerBulle, quitterSurvol, survolerSigle, texteBulle, type Bulle, type GroupeConnu,
} from "./sigleGroupe";

// Sigle d'un groupe → nom complet (maquette validée le 11/11/2026). Le rendu et les touchers dans
// une ligne cliquable se vérifient dans le navigateur ; ici : les noms, la bulle unique, son
// minuteur et son placement.

const DOUZE = [...ORDRE_HEMICYCLE, "NI"];

// Copie de partis.json au 11/11/2026 (uid, abrev, libelle).
const PARTIS = [
  { uid: "PO845401", abrev: "RN", libelle: "Rassemblement National" },
  { uid: "PO845407", abrev: "EPR", libelle: "Ensemble pour la République" },
  { uid: "PO845413", abrev: "LFI-NFP", libelle: "La France insoumise - Nouveau Front Populaire" },
  { uid: "PO845419", abrev: "SOC", libelle: "Socialistes et apparentés" },
  { uid: "PO845425", abrev: "DR", libelle: "Droite Républicaine" },
  { uid: "PO845439", abrev: "ECOS", libelle: "Écologiste et Social" },
  { uid: "PO845454", abrev: "DEM", libelle: "Les Démocrates" },
  { uid: "PO845470", abrev: "HOR", libelle: "Horizons & Indépendants" },
  { uid: "PO845485", abrev: "LIOT", libelle: "Libertés, Indépendants, Outre-mer et Territoires" },
  { uid: "PO872880", abrev: "UDR", libelle: "Union des droites pour la République" },
  { uid: "PO845514", abrev: "GDR", libelle: "Gauche Démocrate et Républicaine" },
  { uid: "PO840056", abrev: "NI", libelle: "Non inscrit" },
];

const groupe = (abrev: string): GroupeConnu => indexerGroupes(PARTIS).get(abrev)!;
const bulle = (abrev: string, cle = abrev): Bulle => ({ cle, groupe: groupe(abrev), ancre: { x: 16, y: 300, w: 40, h: 20 } });

test("les 12 groupes : chaque sigle a son nom complet et sa bulle « SIGLE · Nom »", () => {
  const idx = indexerGroupes(PARTIS);
  for (const ab of DOUZE) {
    const g = idx.get(ab);
    assert.ok(g, `${ab} sans nom complet`);
    assert.ok(g.libelle.length > ab.length, `${ab} : nom pas plus long que le sigle`);
    assert.equal(texteBulle(g), `${ab} · ${g.libelle}`);
  }
  assert.equal(texteBulle(idx.get("EPR")!), "EPR · Ensemble pour la République");
});

const partisJson = fileURLToPath(new URL("../public/data/partis.json", import.meta.url));
test(
  "données réelles : aucun des 12 sigles n'est sans nom complet dans partis.json",
  { skip: existsSync(partisJson) ? false : "partis.json absent (données générées après les tests)" },
  () => {
    const idx = indexerGroupes(JSON.parse(readFileSync(partisJson, "utf8")));
    const sansNom = DOUZE.filter((ab) => !idx.get(ab)?.libelle);
    assert.deepEqual(sansNom, []);
  },
);

test("sigle sans nom dans les données (ou sans sigle) : hors de l'index, affiché seul sans bulle", () => {
  const idx = indexerGroupes([
    { uid: "X1", abrev: "UC", libelle: "" },
    { uid: "X2", abrev: null, libelle: "Groupe sans sigle" },
    { uid: "X3", abrev: " RN ", libelle: " Rassemblement National " },
  ]);
  assert.equal(idx.has("UC"), false);
  assert.equal(idx.size, 1);
  assert.deepEqual(idx.get("RN"), { uid: "X3", abrev: "RN", libelle: "Rassemblement National" });
});

test("une seule bulle ouverte à la fois", () => {
  fermerBulle();
  ouvrirBulle(bulle("EPR"));
  ouvrirBulle(bulle("LIOT"));
  assert.equal(bulleCourante()?.groupe.abrev, "LIOT");
  fermerBulle();
});

test("toucher le sigle ouvre la bulle, le toucher à nouveau la ferme ; toucher ailleurs la ferme", () => {
  fermerBulle();
  basculerBulle(bulle("UDR"));
  assert.equal(bulleCourante()?.groupe.libelle, "Union des droites pour la République");
  basculerBulle(bulle("UDR"));
  assert.equal(bulleCourante(), null);
  basculerBulle(bulle("UDR"));
  fermerBulle(); // ce que fait l'hôte au toucher ailleurs, au défilement, à Échap, au changement d'écran
  assert.equal(bulleCourante(), null);
});

test("la bulle se ferme seule après 4 secondes", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    basculerBulle(bulle("HOR"));
    mock.timers.tick(DUREE_BULLE_MS - 1);
    assert.ok(bulleCourante());
    mock.timers.tick(1);
    assert.equal(bulleCourante(), null);
  } finally {
    fermerBulle();
    mock.timers.reset();
  }
});

test("web, survol : ouverte au survol, gardée sur la bulle, fermée peu après le départ ; un clic la confirme", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    survolerSigle(bulle("GDR"));
    assert.equal(bulleCourante()?.survol, true);
    quitterSurvol(); // la souris quitte le sigle…
    garderBulle(); // …et entre dans la bulle
    mock.timers.tick(10_000);
    assert.ok(bulleCourante(), "gardée tant que la souris est sur la bulle");
    quitterSurvol();
    mock.timers.tick(300);
    assert.equal(bulleCourante(), null);

    survolerSigle(bulle("GDR"));
    basculerBulle(bulle("GDR")); // clic sur un sigle ouvert au survol : elle reste
    assert.equal(bulleCourante()?.survol, false);
    quitterSurvol(); // ouverte au clic : la souris qui part ne la ferme pas tout de suite
    mock.timers.tick(DUREE_BULLE_MS - 1);
    assert.ok(bulleCourante());
  } finally {
    fermerBulle();
    mock.timers.reset();
  }
});

test("placement : sous le sigle, ancrée du côté du sigle, jamais hors de l'écran", () => {
  const ecran = { w: 375, h: 812 };
  const gauche = placerBulle({ x: 30, y: 300, w: 40, h: 20 }, ecran);
  assert.equal(gauche.cote, "gauche");
  assert.equal(gauche.dessous, true);
  assert.equal(gauche.vertical, 326);
  assert.ok(gauche.bord >= 8 && gauche.bord + gauche.largeurMax <= ecran.w - 8);
  assert.equal(gauche.pointe, 30 + 20 - gauche.bord); // pointe sous le milieu du sigle

  const droite = placerBulle({ x: 300, y: 300, w: 50, h: 16 }, ecran);
  assert.equal(droite.cote, "droite");
  assert.ok(droite.bord >= 8 && droite.bord + droite.largeurMax <= ecran.w - 8);

  const enBas = placerBulle({ x: 30, y: 760, w: 40, h: 20 }, ecran);
  assert.equal(enBas.dessous, false, "pas la place dessous : au-dessus");
  assert.equal(enBas.vertical, ecran.h - 760 + 6);

  const auBord = placerBulle({ x: 0, y: 100, w: 20, h: 16 }, ecran);
  assert.equal(auBord.bord, 8);
  assert.ok(auBord.pointe >= 14);
});
