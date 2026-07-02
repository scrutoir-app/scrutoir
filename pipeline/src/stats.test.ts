/**
 * Tests « golden » du cœur de calcul statistique (stats.ts) sur une mini-base SQLite
 * EN MÉMOIRE aux résultats connus. C'est le fichier qui fabrique TOUS les chiffres
 * politiques affichés sur scrutoir.fr : une inversion pour/contre ou une borne de
 * période fausse passerait le typecheck et la CI — ces tests la bloquent.
 *
 * Fixture (2 groupes, 4 députés dont 1 sorti, 4 scrutins sur 2 thèmes) :
 *   - s1 (récent,   eco, adopté)  : A pour, B contre, C pour  — consignes G1=contre, G2=pour
 *   - s2 (~8 mois,  eco, rejeté)  : A contre, B contre, C abst — consignes G1=contre, G2=pour
 *   - s3 (récent,   soc, adopté)  : A nonvotant, B pour, C contre — pas de consigne
 *   - s4 (2024-09,  eco, adopté)  : X pour, A pour            — consigne G1=pour
 *   - X (G1) a quitté l'Assemblée le 2024-10-21 (borne les calculs de son profil).
 */
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createSchema } from "./db.js";
import { bornePeriode, profilDepute, dissidences, confrontation, profilParti, votesDeputeCategorie } from "./stats.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const joursAvant = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};
const RECENT = joursAvant(30); // dans la fenêtre 6 mois
const HUIT_MOIS = joursAvant(240); // entre 6 et 12 mois
const ANCIEN = "2024-09-01"; // pendant le mandat de X, hors 12 mois

function fixture(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);

  db.prepare("INSERT INTO groupes (uid, libelle, abrev, couleur) VALUES (?,?,?,?)").run("G1", "Les Rouges", "RGE", "#C00");
  db.prepare("INSERT INTO groupes (uid, libelle, abrev, couleur) VALUES (?,?,?,?)").run("G2", "Les Bleus", "BLE", "#00C");

  const dep = db.prepare(
    `INSERT INTO deputes (uid, prenom, nom, nom_complet, groupe_uid, actif, participation_rate, qualite, mandat_debut, mandat_fin)
     VALUES (@uid, @prenom, @nom, @nom_complet, @groupe, @actif, @rate, @qualite, @debut, @fin)`
  );
  dep.run({ uid: "A", prenom: "Alice", nom: "Avoté", nom_complet: "Alice Avoté", groupe: "G1", actif: 1, rate: 0.75, qualite: "Président", debut: "2024-07-01", fin: null });
  dep.run({ uid: "B", prenom: "Bruno", nom: "Bloc", nom_complet: "Bruno Bloc", groupe: "G1", actif: 1, rate: 0.5, qualite: null, debut: "2024-07-01", fin: null });
  dep.run({ uid: "C", prenom: "Chloé", nom: "Contre", nom_complet: "Chloé Contre", groupe: "G2", actif: 1, rate: 0.6, qualite: null, debut: "2024-07-01", fin: null });
  dep.run({ uid: "X", prenom: "Xavier", nom: "Sorti", nom_complet: "Xavier Sorti", groupe: "G1", actif: 0, rate: 1, qualite: null, debut: "2024-07-01", fin: "2024-10-21" });

  db.prepare("INSERT INTO categories (id, libelle, emoji, couleur, ordre) VALUES ('eco','Écologie','🌱','#0A0',1)").run();
  db.prepare("INSERT INTO categories (id, libelle, emoji, couleur, ordre) VALUES ('soc','Social','🤝','#A0A',2)").run();

  const scr = db.prepare("INSERT INTO scrutins (uid, numero, date, titre, sort_code) VALUES (?,?,?,?,?)");
  scr.run("s1", 1, RECENT, "l'ensemble du texte éco 1", "adopte");
  scr.run("s2", 2, HUIT_MOIS, "l'ensemble du texte éco 2", "rejete");
  scr.run("s3", 3, RECENT, "l'ensemble du texte social", "adopte");
  scr.run("s4", 4, ANCIEN, "l'ensemble du texte éco 2024", "adopte");

  const sc = db.prepare("INSERT INTO scrutin_categories (scrutin_uid, categorie_id, confiance) VALUES (?,?,1)");
  sc.run("s1", "eco");
  sc.run("s2", "eco");
  sc.run("s3", "soc");
  sc.run("s4", "eco");

  const gp = db.prepare("INSERT INTO groupe_positions (scrutin_uid, groupe_uid, position) VALUES (?,?,?)");
  gp.run("s1", "G1", "contre");
  gp.run("s1", "G2", "pour");
  gp.run("s2", "G1", "contre");
  gp.run("s2", "G2", "pour");
  gp.run("s4", "G1", "pour");

  const v = db.prepare("INSERT INTO votes (scrutin_uid, depute_uid, position, groupe_uid) VALUES (?,?,?,?)");
  v.run("s1", "A", "pour", "G1");
  v.run("s1", "B", "contre", "G1");
  v.run("s1", "C", "pour", "G2");
  v.run("s2", "A", "contre", "G1");
  v.run("s2", "B", "contre", "G1");
  v.run("s2", "C", "abstention", "G2");
  v.run("s3", "A", "nonvotant", "G1");
  v.run("s3", "B", "pour", "G1");
  v.run("s3", "C", "contre", "G2");
  v.run("s4", "X", "pour", "G1");
  v.run("s4", "A", "pour", "G1");

  return db;
}

test("bornePeriode : arithmétique des fenêtres (date de référence fixée)", () => {
  const ref = new Date("2026-07-02T12:00:00Z");
  assert.equal(bornePeriode("all", ref), null);
  assert.equal(bornePeriode("6m", ref), "2026-01-02");
  assert.equal(bornePeriode("12m", ref), "2025-07-02");
});

test("profilDepute : comptages par thème, loyauté, réussite, participation (all)", () => {
  const db = fixture();
  const p = profilDepute(db, "A", "all")!;
  const eco = p.categories.find((c) => c.id === "eco")!;
  // A sur eco : s1 pour, s2 contre, s4 pour — scope = 3 scrutins eco depuis son mandat.
  assert.equal(eco.pour, 2);
  assert.equal(eco.contre, 1);
  assert.equal(eco.abstention, 0);
  assert.equal(eco.nonvotant, 0);
  assert.equal(eco.total, 3);
  assert.equal(eco.absent, 0);
  // Réussite : pour→adopté (s1, s4) + contre→rejeté (s2) = 3 gagnés, 0 perdu.
  assert.equal(eco.gagnes, 3);
  assert.equal(eco.perdus, 0);
  assert.equal(eco.reussite_pct, 100);
  // Loyauté eco : consignes présentes sur s1/s2/s4 ; conforme sur s2 et s4, dissident s1.
  assert.equal(eco.base_loyaute, 3);
  assert.equal(eco.loyaute_pct, 67);

  const soc = p.categories.find((c) => c.id === "soc")!;
  // s3 : nonvotant enregistré ≠ absent déduit — et sans consigne, pas de base de loyauté.
  assert.equal(soc.nonvotant, 1);
  assert.equal(soc.absent, 0);
  assert.equal(soc.loyaute_pct, null);

  assert.equal(p.loyaute_globale_pct, 67); // 2 conformes / 3 votes avec consigne
  assert.equal(p.reussite_globale_pct, 100);
  // Participation : 3 exprimés / 4 scrutins tenus depuis le début de mandat.
  assert.equal(p.participation_pct, 75);
});

test("profilDepute : la période 6m exclut les scrutins plus anciens", () => {
  const db = fixture();
  const p = profilDepute(db, "A", "6m")!;
  const eco = p.categories.find((c) => c.id === "eco")!;
  // Fenêtre 6 mois : seul s1 reste côté eco (s2 ~8 mois, s4 en 2024).
  assert.equal(eco.pour, 1);
  assert.equal(eco.contre, 0);
  assert.equal(eco.total, 1);
  // Participation 6m : 1 exprimé (s1) / 2 scrutins tenus (s1, s3).
  assert.equal(p.participation_pct, 50);
});

test("profilDepute : le profil d'un sorti est borné à son mandat (pas d'absences fantômes)", () => {
  const db = fixture();
  const p = profilDepute(db, "X", "all")!;
  const eco = p.categories.find((c) => c.id === "eco")!;
  // Mandat de X : 2024-07-01 → 2024-10-21. Seul s4 est dans la fenêtre :
  // s1/s2 (postérieurs) ne comptent NI dans le scope NI comme absences.
  assert.equal(eco.total, 1);
  assert.equal(eco.pour, 1);
  assert.equal(eco.absent, 0);
  // 1 exprimé / 1 scrutin tenu pendant son mandat.
  assert.equal(p.participation_pct, 100);
});

test("dissidences : votes exprimés contre la consigne du groupe, rien d'autre", () => {
  const db = fixture();
  // A : dissident sur s1 (pour vs consigne contre) ; conforme sur s2 et s4.
  const dA = dissidences(db, "A");
  assert.deepEqual(dA.map((d: any) => d.uid), ["s1"]);
  assert.equal(dA[0].position, "pour");
  assert.equal(dA[0].consigne, "contre");
  // B : toujours conforme (s3 sans consigne ne compte pas).
  assert.deepEqual(dissidences(db, "B"), []);
  // C : abstention sur s2 vs consigne pour = dissidence (l'abstention est un vote exprimé).
  assert.deepEqual(dissidences(db, "C").map((d: any) => d.uid), ["s2"]);
});

test("confrontation : seuls les scrutins où les DEUX ont exprimé un vote comptent", () => {
  const db = fixture();
  const c = confrontation(db, "A", "B", "all")!;
  // s1 : pour vs contre → désaccord. s2 : contre vs contre → accord.
  // s3 : A nonvotant → exclu. s4 : B n'a pas de ligne → exclu.
  assert.equal(c.communs, 2);
  assert.equal(c.accords, 1);
  assert.equal(c.desaccords, 1);
  const eco = c.themes.find((t) => t.id === "eco")!;
  assert.equal(eco.communs, 2);
  assert.deepEqual(eco.desaccords.map((s) => s.uid), ["s1"]);
  assert.deepEqual(eco.accords.map((s) => s.uid), ["s2"]);
  assert.equal(eco.desaccords[0].posA, "pour");
  assert.equal(eco.desaccords[0].posB, "contre");
  // Thème sans scrutin commun = présent mais vide (« non couvert », pas un accord).
  const soc = c.themes.find((t) => t.id === "soc")!;
  assert.equal(soc.communs, 0);
});

test("confrontation : bornée par la période", () => {
  const db = fixture();
  const c = confrontation(db, "A", "B", "6m")!;
  // Seul s1 est dans la fenêtre 6 mois → 1 commun, 1 désaccord.
  assert.equal(c.communs, 1);
  assert.equal(c.accords, 0);
  assert.equal(c.desaccords, 1);
});

test("profilParti : cohésion, réussite de la consigne, président, participation moyenne", () => {
  const db = fixture();
  const p = profilParti(db, "G1", "all")!;
  // Réussite de la ligne du groupe : s1 contre→adopté (perdu), s2 contre→rejeté (gagné),
  // s4 pour→adopté (gagné) → 2/3.
  assert.equal(p.reussite_globale_pct, 67);
  // Cohésion des membres : 6 votes exprimés sous consigne (s1 A+B, s2 A+B, s4 A+X),
  // 5 conformes (seul A s1 est dissident) → 83 %.
  assert.equal(p.cohesion_pct, 83);
  // Effectif : les actifs seulement (X sorti n'y est plus).
  assert.equal(p.parti.nb_deputes, 2);
  assert.equal(p.president?.uid, "A");
  // Participation moyenne des actifs : (0.75 + 0.5) / 2 = 63 %.
  assert.equal(p.participation_moy_pct, 63);
});

test("votesDeputeCategorie : « absent » = déduit, borné au mandat", () => {
  const db = fixture();
  // B n'a pas de ligne de vote sur s4 (eco, pendant son mandat) → absent déduit.
  const absentsB = votesDeputeCategorie(db, "B", "eco", "absent", "all");
  assert.deepEqual(absentsB.map((s: any) => s.uid), ["s4"]);
  // X : aucune absence eco — s1/s2 sont hors mandat, il a voté s4.
  assert.deepEqual(votesDeputeCategorie(db, "X", "eco", "absent", "all"), []);
});
