import express from "express";
import cors from "cors";
import { openDb } from "../../pipeline/src/db.js";
import {
  rechercheDeputes,
  rechercheScrutins,
  profilDepute,
  detailScrutin,
  voteDeputeSurScrutin,
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
    deputes: rechercheDeputes(db, q, 10),
    scrutins: rechercheScrutins(db, q, 15),
  });
});

app.get("/categories", (_req, res) => {
  res.json(db.prepare("SELECT * FROM categories ORDER BY ordre").all());
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
