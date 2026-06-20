// ⚠️ DEV-ONLY. En production, Scrutoir est 100 % statique (JSON pré-générés servis sur
// Cloudflare Pages, cf. DEPLOY-static.md) : cette API Express n'est PAS déployée.
// Elle reste utile en développement local (port 4000) et comme référence de la logique
// de lecture, qui est aussi reflétée dans pipeline/src/exportStatic.ts + app/src/api.ts.
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  partisParCategorie,
  confrontation,
  departements,
  deputesParCirco,
  type Periode,
} from "../../pipeline/src/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Déploiement : si DB_PATH (inscriptible) est défini et la base absente, on la
// télécharge depuis DB_URL (ex. asset d'une Release GitHub) — repo léger, base ~174 Mo.
async function ensureDb() {
  const p = process.env.DB_PATH;
  const url = process.env.DB_URL;
  if (!p || !url || fs.existsSync(p)) return;
  console.log("⏬ Téléchargement de la base depuis DB_URL…");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DB_URL ${res.status}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  console.log(`✓ Base téléchargée dans ${p}`);
}
await ensureDb();

const db = openDb();
const app = express();
app.use(cors());

// Sert le web exporté (Expo web) en même origine que l'API, s'il est présent.
const WEB_DIR = path.resolve(__dirname, "../../app/dist");
const webExiste = fs.existsSync(path.join(WEB_DIR, "index.html"));
if (webExiste) app.use(express.static(WEB_DIR));

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
  res.json(grandsScrutins(db, 100));
});

// "Mon député" : liste des départements + députés d'une circonscription
app.get("/departements", (_req, res) => {
  res.json(departements(db));
});
app.get("/circonscription", (req, res) => {
  const dept = String(req.query.dept ?? "");
  const circo = req.query.circo ? String(req.query.circo) : undefined;
  if (!dept) return res.status(400).json({ error: "département (dept) requis" });
  res.json(deputesParCirco(db, dept, circo));
});

// Confrontation de deux deputes (désaccords / accords par thème)
app.get("/confrontation", (req, res) => {
  const a = String(req.query.a ?? "");
  const b = String(req.query.b ?? "");
  const periode = (["all", "12m", "6m"].includes(String(req.query.periode)) ? req.query.periode : "all") as Periode;
  if (!a || !b) return res.status(400).json({ error: "deux députés (a, b) requis" });
  const r = confrontation(db, a, b, periode);
  if (!r) return res.status(404).json({ error: "Député introuvable" });
  res.json(r);
});

// Scrutins d'une categorie
app.get("/categories/:id/scrutins", (req, res) => {
  res.json(scrutinsParCategorie(db, req.params.id, 40));
});

// Classement des partis par réussite sur un thème
app.get("/categories/:id/partis", (req, res) => {
  res.json(partisParCategorie(db, req.params.id));
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

// Fallback SPA : toute route non-API renvoie l'app web (après les routes API).
if (webExiste) {
  app.get("*", (_req, res) => res.sendFile(path.join(WEB_DIR, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🟢 votes-an sur http://0.0.0.0:${PORT}${webExiste ? " (web + API)" : " (API)"}`);
});
