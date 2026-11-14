// Export de la rubrique Présidentielle 2027 : mode dormant, contrôles bloquants, comptes exportés.
// Jeu de données SYNTHÉTIQUE (dépôt public : aucune donnée de verdict réelle ici). Si les vraies
// données d'un programme sont sur le disque (Mac, pas la CI), leurs comptes exportés sont aussi
// vérifiés contre leur attendus.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG, DOSSIER_PROGRAMMES, construireProgramme, exporterPresidentielle, lireConfig, type ConfigProgramme } from "./exportPresidentielle";
import type { ChapitreDetail, IndexPresidentielle, Programme } from "../../app/src/presidentielle/types";
import { comptesDe, confrontables } from "../../app/src/presidentielle/logique";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "presidentielle-"));
const ecrire = (f: string, d: unknown) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(d));
};
const silence = () => {};

const CFG: ConfigProgramme = {
  id: "fic-2027",
  dossier: "fic-2027",
  enService: false,
  alias: ["fic"],
  parti: "Parti fictif",
  groupe: { uid: "PO000001", abrev: "FIC", libelle: "Groupe fictif" },
  publieLe: "2026-11-01",
  livre: { titre: "Livre", url: "https://exemple.fr/livre/" },
  chiffrage: { titre: "Chiffrage", url: "https://exemple.fr/c.pdf", date: "octobre 2026" },
  base: { scrutins: 10, du: "2024-10-08", au: "2026-11-12" },
};

const mesure = (id: string, cle = false) => ({
  id,
  partie: "Partie 1 – Première partie",
  chapitre: `Chapitre ${id[3]} : Chapitre ${id[3]}`,
  section: "Section",
  texte: `Texte de ${id}`,
  url: "https://exemple.fr/livre/chapitre",
  mesure_cle: cle,
  sous_mesure_de: null,
});
const scrutinBrut = (numero: number, effet: string, position = "pour", n = 30) => ({
  uid: `VTANR5L17V${numero}`,
  numero,
  date: "2025-01-0" + ((numero % 9) + 1),
  intitule: `l'amendement n° ${numero} à l'article 2 du projet de loi fictif (première lecture).`,
  dossier: "Projet de loi fictif",
  sens: "même sens",
  base: "dispositif",
  extrait: "extrait",
  ecart: "écart",
  note: "",
  sort: "rejete",
  vote_lfi: { position, pour: position === "pour" ? n : 0, contre: position === "contre" ? n : 0, abstention: 0, votants_lfi: n },
  auteur_groupe: null,
  effet,
  url_an: "",
  vigilance: [],
});

/** Programme synthétique : 4 mesures (1 cohérente clé, 1 en tension, 1 sans scrutin, 1 hors champ), 2 lignes chiffrées. */
function jeuSynthetique(racine: string, enService: boolean) {
  const d = path.join(racine, "fic-2027");
  const m = [mesure("p1c1-001", true), mesure("p1c1-002"), mesure("p1c2-001"), mesure("p1c2-002")];
  ecrire(path.join(d, "mesures.json"), m);
  ecrire(
    path.join(d, "classement.json"),
    m.map((x, i) => ({ ...x, statut: i === 3 ? "hors champ" : "confrontable", motif: i === 3 ? "Intention générale" : "Loi" })),
  );
  const v = (x: (typeof m)[number], verdict: string, scrutins: unknown[]) => ({ ...x, verdict, constat: "", regle_recherche: [], n_trouves: 0, commentaire: "", motif_confrontable: "", scrutins });
  ecrire(path.join(d, "verdicts", "coherent.json"), [v(m[0], "Cohérent", [scrutinBrut(11, "cohérent")])]);
  ecrire(path.join(d, "verdicts", "tension.json"), [v(m[1], "Tension", [scrutinBrut(12, "tension", "contre"), scrutinBrut(13, "cohérent")])]);
  ecrire(path.join(d, "verdicts", "a-juger.json"), []);
  ecrire(path.join(d, "verdicts", "pas-de-vote-representatif.json"), []);
  ecrire(path.join(d, "verdicts", "pas-de-scrutin-public.json"), [v(m[2], "Pas de scrutin public", [])]);
  ecrire(path.join(d, "fic-2027-chiffrees-2.json"), {
    total_recettes_milliards: 1,
    mesures: [
      { code: "R01", type: "recette", libelle_chiffrage: "Recette fictive", montant_milliards_euros: 9, confronte_avec: { mesure_programme: "p1c1-002" }, verdict: "Tension", constat: "", equivalence_programme: "directe", scrutins: [{}, {}], mesures_secondaires: [] },
      {
        code: "D01", type: "depense", libelle_chiffrage: "Dépense fictive", montant_milliards_euros: 3, confronte_avec: { libelle_chiffrage: "Dépense fictive : 3 milliards d'euros" },
        verdict: "Cohérent", constat: "", equivalence_programme: "aucune", mesures_secondaires: [{ id: "p1c2-002", verdict: "hors champ ou non confrontée" }],
        scrutins: [{ numero: 20, date: "2025-02-02", sort: "adopté", sens: "même sens", vote_groupe: { position: "pour", pour: 20, contre: 0, abstention: 0, votants: 20 }, effet: "cohérent", intitule: "l'ensemble du projet de loi fictif.", url_an: "" }],
      },
    ],
  });
  ecrire(path.join(d, "attendus.json"), {
    mesures: 4, confrontables: 3, horsChamp: 1, cles: 1, clesConfrontables: 1, chiffrees: 2, chapitres: 2,
    verdicts: { all: { c: 1, t: 1, s: 1, j: 0, r: 0 }, cle: { c: 1, t: 0, s: 0, j: 0, r: 0 }, ch: { c: 1, t: 1, s: 0, j: 0, r: 0 } },
  });
  const config = path.join(racine, "presidentielle.json");
  ecrire(config, { programmes: [{ ...CFG, enService }] });
  return { dossier: d, config };
}

test("dormant : un programme hors service ne produit AUCUN fichier hors index.json (programmes vide)", () => {
  const r = tmp();
  const { config } = jeuSynthetique(r, false);
  const sortie = path.join(r, "out");
  // Un aperçu précédent laissé sur le disque doit disparaître.
  ecrire(path.join(sortie, "presidentielle", "fic-2027", "programme.json"), { reste: true });
  const res = exporterPresidentielle({ sortie, config, dossierProgrammes: r, log: silence });
  const fichiers = fs.readdirSync(path.join(sortie, "presidentielle"), { recursive: true }).map(String);
  assert.deepEqual(fichiers, ["index.json"]);
  const index = JSON.parse(fs.readFileSync(path.join(sortie, "presidentielle", "index.json"), "utf8")) as IndexPresidentielle;
  assert.deepEqual(index.programmes, []);
  assert.ok(index.generatedAt);
  assert.deepEqual(res.enService, []);
});

test("dossier absent (CI) et programme hors service : l'export n'échoue pas", () => {
  const r = tmp();
  const config = path.join(r, "presidentielle.json");
  ecrire(config, { programmes: [CFG] });
  const sortie = path.join(r, "out");
  exporterPresidentielle({ sortie, config, dossierProgrammes: r, log: silence });
  assert.deepEqual(fs.readdirSync(path.join(sortie, "presidentielle")), ["index.json"]);
});

test("en service (ou forcé) : fichiers, comptes, aucun montant", () => {
  const r = tmp();
  const { config } = jeuSynthetique(r, false);
  const sortie = path.join(r, "out");
  const res = exporterPresidentielle({ sortie, config, dossierProgrammes: r, forcer: ["fic-2027"], log: silence });
  assert.deepEqual(res.enService, ["fic-2027"]);
  const base = path.join(sortie, "presidentielle");
  assert.deepEqual(
    fs.readdirSync(base, { recursive: true }).map(String).filter((f) => f.endsWith(".json")).sort(),
    ["fic-2027/chapitre/p1c1.json", "fic-2027/chapitre/p1c2.json", "fic-2027/chiffrage.json", "fic-2027/programme.json", "index.json"],
  );
  const p = JSON.parse(fs.readFileSync(path.join(base, "fic-2027/programme.json"), "utf8")) as Programme;
  assert.deepEqual(p.verdicts.all, { c: 1, t: 1, s: 1, j: 0, r: 0 });
  assert.equal(p.listeMesures.find((m) => m.id === "p1c1-002")?.chiffree, "R01");
  assert.equal(p.listeMesures.find((m) => m.id === "p1c2-002")?.motifHorsChamp, "Intention générale");
  const brut = fs.readFileSync(path.join(base, "fic-2027/programme.json"), "utf8") + fs.readFileSync(path.join(base, "fic-2027/chiffrage.json"), "utf8");
  assert.ok(!/montant|total_recettes|milliards_euros/.test(brut), "aucun montant exporté");
  const ch = JSON.parse(fs.readFileSync(path.join(base, "fic-2027/chapitre/p1c1.json"), "utf8")) as ChapitreDetail;
  const t = ch.mesures.find((m) => m.id === "p1c1-002")!.scrutins;
  assert.deepEqual(t.map((s) => s.effet).sort(), ["c", "t"]);
  const index = JSON.parse(fs.readFileSync(path.join(base, "index.json"), "utf8")) as IndexPresidentielle;
  assert.deepEqual(index.programmes.map((x) => x.id), ["fic-2027"]);
});

test("contrôle bloquant : un compte faux fait échouer l'export", () => {
  const r = tmp();
  const { config, dossier } = jeuSynthetique(r, true);
  const att = JSON.parse(fs.readFileSync(path.join(dossier, "attendus.json"), "utf8"));
  att.verdicts.all.t = 2;
  ecrire(path.join(dossier, "attendus.json"), att);
  assert.throws(() => exporterPresidentielle({ sortie: path.join(r, "out"), config, dossierProgrammes: r, log: silence }), /comptes faux/);
});

test("contrôle bloquant : statut incohérent avec ses scrutins", () => {
  const r = tmp();
  const { config, dossier } = jeuSynthetique(r, true);
  const f = path.join(dossier, "verdicts", "coherent.json");
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  c[0].scrutins[0].effet = "tension";
  ecrire(f, c);
  assert.throws(() => exporterPresidentielle({ sortie: path.join(r, "out"), config, dossierProgrammes: r, log: silence }), /incohérent/);
});

test("contrôle bloquant : vigilance inconnue (rien ne se perd en silence)", () => {
  const r = tmp();
  const { config, dossier } = jeuSynthetique(r, true);
  const f = path.join(dossier, "verdicts", "coherent.json");
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  c[0].scrutins[0].vigilance = ["une remarque jamais vue"];
  ecrire(f, c);
  assert.throws(() => exporterPresidentielle({ sortie: path.join(r, "out"), config, dossierProgrammes: r, log: silence }), /vigilance inconnue/);
});

test("la configuration versionnée est valide et ne met aucun programme en service par erreur", () => {
  const cfg = lireConfig(CONFIG);
  assert.ok(cfg.programmes.length >= 1);
  for (const p of cfg.programmes) assert.equal(typeof p.enService, "boolean");
});

// Vraies données présentes sur le disque (Mac) : comptes exportés = attendus.json. Ignoré en CI.
for (const p of lireConfig(CONFIG).programmes) {
  const dossier = path.join(DOSSIER_PROGRAMMES, p.dossier);
  const present = fs.existsSync(path.join(dossier, "mesures.json")) && fs.existsSync(path.join(dossier, "attendus.json"));
  test(`données réelles ${p.id} : comptes exportés = attendus.json`, { skip: present ? false : "données absentes (normal en CI)" }, () => {
    const sortie = tmp();
    exporterPresidentielle({ sortie, forcer: [p.id], log: silence });
    const base = path.join(sortie, "presidentielle", p.id);
    const prog = JSON.parse(fs.readFileSync(path.join(base, "programme.json"), "utf8")) as Programme;
    const att = JSON.parse(fs.readFileSync(path.join(dossier, "attendus.json"), "utf8"));
    for (const k of ["mesures", "confrontables", "horsChamp", "cles", "clesConfrontables", "chiffrees"]) assert.equal((prog.comptes as any)[k], att[k], k);
    assert.deepEqual(prog.verdicts, att.verdicts);
    // Recompte indépendant depuis les mesures exportées.
    assert.deepEqual(comptesDe(prog.listeMesures.map((m) => m.statut)), att.verdicts.all);
    assert.equal(confrontables(prog.verdicts.all) + prog.comptes.horsChamp, prog.comptes.mesures);
    // Un fichier par chapitre, + programme.json + chiffrage.json.
    assert.equal(fs.readdirSync(path.join(base, "chapitre")).length, prog.chapitres.length);
    const n = fs.readdirSync(path.join(sortie, "presidentielle"), { recursive: true }).map(String).filter((f) => f.endsWith(".json")).length;
    assert.equal(n, prog.chapitres.length + 3);
    // La construction directe donne le même résultat.
    assert.deepEqual(construireProgramme(p, dossier).programme.verdicts, att.verdicts);
  });
}
