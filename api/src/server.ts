import express from "express";
import cors from "cors";
import { openDb } from "../../pipeline/src/db.js";
import {
  rechercheDeputes,
  rechercheScrutins,
  profilDepute,
  detailScrutin,
  voteDeputeSurScrutin,
  grandsScrutins,
  scrutinsParCategorie,
  dissidences,
  votesDeputeCategorie,
  votantsScrutin,
  listePartis,
  profilParti,
  type Periode,
} from "../../pipeline/src/stats.js";

const db = openDb();
const app = express();
app.use(cors());

const PORT = Number(process.env.PORT) || 4000;

app.get("/health", (_req, res) => {
  const n = db.prepare("SELECT COUNT(*) c FROM deputes WHERE actif=1").get() as any;
  res.json({ ok: true, deputes_actifs: n.c });
});

// Recherche unifiee : deputes + scrutins
app.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ deputes: [], scrutins: [] });
  res.json({
    deputes: rechercheDeputes(db, q, 250),
    scrutins: rechercheScrutins(db, q, 15),
  });
});

app.get("/categories", (_req, res) => {
  res.json(db.prepare("SELECT * FROM categories ORDER BY ordre").all());
});

// Partis (groupes) : liste + profil (réussite par thème)
app.get("/partis", (_req, res) => {
  res.json(listePartis(db));
});
app.get("/partis/:uid", (req, res) => {
  const periode = (["all", "12m", "6m"].includes(String(req.query.periode)) ? req.query.periode : "all") as Periode;
  const p = profilParti(db, req.params.uid, periode);
  if (!p) return res.status(404).json({ error: "Parti introuvable" });
  res.json(p);
});

// Derniers grands scrutins (solennels + motions de censure)
app.get("/scrutins-recents", (_req, res) => {
  res.json(grandsScrutins(db, 30));
});

// Scrutins d'une categorie
app.get("/categories/:id/scrutins", (req, res) => {
  res.json(scrutinsParCategorie(db, req.params.id, 40));
});

// Dissidences d'un depute (votes contre la consigne du groupe)
app.get("/deputes/:uid/dissidences", (req, res) => {
  res.json(dissidences(db, req.params.uid, 100));
});

// Scrutins d'une categorie ou le depute a vote une position donnee (drill-down)
app.get("/deputes/:uid/votes", (req, res) => {
  const categorie = String(req.query.categorie ?? "");
  // position optionnelle : absente => toutes les positions (pour affichage groupé)
  const position = req.query.position ? String(req.query.position) : null;
  const periode = (["all", "12m", "6m"].includes(String(req.query.periode))
    ? req.query.periode
    : "all") as Periode;
  if (!categorie) return res.status(400).json({ error: "categorie requise" });
  res.json(votesDeputeCategorie(db, req.params.uid, categorie, position, periode));
});

// Deputes ayant vote une position donnee sur un scrutin (drill-down)
app.get("/scrutins/:uid/votants", (req, res) => {
  const position = String(req.query.position ?? "");
  const groupe = req.query.groupe ? String(req.query.groupe) : undefined;
  if (!position) return res.status(400).json({ error: "position requise" });
  res.json(votantsScrutin(db, req.params.uid, position, groupe));
});

// Profil de vote d'un depute (avec loyaute), filtrable par periode
app.get("/deputes/:uid", (req, res) => {
  const periode = (["all", "12m", "6m"].includes(String(req.query.periode))
    ? req.query.periode
    : "all") as Periode;
  const profil = profilDepute(db, req.params.uid, periode);
  if (!profil) return res.status(404).json({ error: "Depute introuvable" });
  res.json(profil);
});

// Detail d'un scrutin (resultat + ventilation par groupe avec consigne)
app.get("/scrutins/:uid", (req, res) => {
  const detail = detailScrutin(db, req.params.uid);
  if (!detail) return res.status(404).json({ error: "Scrutin introuvable" });
  res.json(detail);
});

// Vote precis d'un depute sur un scrutin (conformite a la consigne)
app.get("/scrutins/:uid/vote/:deputeUid", (req, res) => {
  const v = voteDeputeSurScrutin(db, req.params.uid, req.params.deputeUid);
  if (!v) return res.status(404).json({ error: "Vote introuvable" });
  res.json(v);
});

app.listen(PORT, () => {
  console.log(`🟢 API votes-an sur http://localhost:${PORT}`);
});
