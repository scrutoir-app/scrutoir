import StreamZip from "node-stream-zip";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { openDb, createSchema } from "./db.js";
import { AMENDEMENTS_ZIP, assurerAmendementsZip } from "./download.js";

function txt(v: any): any {
  return v && typeof v === "object" ? v["#text"] : v;
}

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();
}

/** Nettoie un fragment HTML (exposé/dispositif) en texte lisible. */
function clean(html: any): string | null {
  if (!html) return null;
  let s = String(html);
  s = s.replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;|&#39;|&apos;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»");
  return s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim() || null;
}

/** Auteur (nom de famille normalise) d'un amendement, pour la desambiguisation. */
function auteurAmendement(a: any): string | null {
  const aut = a?.signataires?.auteur ?? {};
  const g = aut.gouvernementRef;
  if (g && !(typeof g === "object" && g["@xsi:nil"] === "true")) return "gouvernement";
  if (aut.typeAuteur === "Gouvernement") return "gouvernement";
  const rap = aut.auteurRapporteurOrganeRef;
  if (rap && !(typeof rap === "object" && rap["@xsi:nil"] === "true")) return "commission";
  const lib = String(a?.signataires?.libelle ?? "").replace(/ /g, " ");
  const first = lib.split(",")[0]?.replace(/^(M\.|Mme|MM\.|Mmes)\s*/, "").trim();
  if (!first) return null;
  const n = norm(first).split(" ");
  return n[n.length - 1] || null;
}

/** Auteur (nom de famille normalise) depuis l'intitule d'un scrutin. */
function auteurScrutin(titre: string): string | null {
  const t = titre.replace(/ /g, " ");
  if (/gouvernement/i.test(t)) return "gouvernement";
  if (/de la commission/i.test(t)) return "commission";
  const m = t.match(/de (?:M\.|Mme|MM\.|Mmes) (.+?)(?: et | à | au | aux |,| après| avant| à l)/i);
  if (m) {
    const n = norm(m[1]).split(" ");
    return n[n.length - 1] || null;
  }
  return null;
}

function numeroScrutin(titre: string): number | null {
  const m = titre.match(/amendement[s]?\s+n°\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function articleAmendement(a: any): string | null {
  const d = a?.pointeurFragmentTexte?.division ?? {};
  const court = d.articleDesignationCourte;
  if (!court) return null;
  const av = d.avant_A_Apres;
  // Prefixe "Avant/Après" seulement s'il n'est pas deja dans la designation.
  if (av && typeof av !== "object" && !court.toLowerCase().includes(String(av).toLowerCase())) {
    return `${av} ${court}`.trim();
  }
  return court;
}

/**
 * Relie les scrutins sur amendement a leur exposé sommaire via une jointure
 * heuristique (date du sort + numero + auteur). Stocke le resultat dans la
 * table `amendements`.
 */
export async function lierAmendements(db: Database.Database): Promise<{ lies: number; total: number }> {
  if (!fs.existsSync(AMENDEMENTS_ZIP)) {
    console.log("  ⚠ Archive amendements absente, etape ignoree.");
    return { lies: 0, total: 0 };
  }
  const zip = new (StreamZip as any).async({ file: AMENDEMENTS_ZIP });
  const entries = await zip.entries();
  const noms = Object.keys(entries).filter((n) => n.endsWith(".json"));

  // Index : "date|numero" -> [{ nom, auteur }]
  const index = new Map<string, Array<{ nom: string; auteur: string | null }>>();
  let lus = 0;
  for (const nom of noms) {
    const a = JSON.parse((await zip.entryData(nom)).toString("utf8")).amendement;
    const cdv = a?.cycleDeVie ?? {};
    const ds = txt(cdv.dateSort);
    const sort = cdv.sort;
    const lib = typeof sort === "object" ? sort?.libelle : sort;
    if (!ds || (lib !== "Adopté" && lib !== "Rejeté")) continue;
    const numero = Number(txt(a?.identification?.numeroOrdreDepot));
    if (!Number.isFinite(numero)) continue;
    const cle = `${String(ds).slice(0, 10)}|${numero}`;
    let arr = index.get(cle);
    if (!arr) index.set(cle, (arr = []));
    arr.push({ nom, auteur: auteurAmendement(a) });
    if (++lus % 20000 === 0) console.log(`     ...${lus} amendements indexés`);
  }

  const scrutins = db
    .prepare(
      `SELECT uid, date, titre FROM scrutins
       WHERE titre LIKE 'l%amendement%' OR titre LIKE 'le sous-amendement%' OR titre LIKE 'les amendements%'`
    )
    .all() as Array<{ uid: string; date: string; titre: string }>;

  const ins = db.prepare(
    `INSERT INTO amendements (scrutin_uid, amendement_uid, numero, auteur, article, dispositif, expose)
     VALUES (@scrutin_uid, @amendement_uid, @numero, @auteur, @article, @dispositif, @expose)
     ON CONFLICT(scrutin_uid) DO UPDATE SET
       amendement_uid=excluded.amendement_uid, numero=excluded.numero, auteur=excluded.auteur,
       article=excluded.article, dispositif=excluded.dispositif, expose=excluded.expose`
  );

  // Resout chaque scrutin -> nom d'entree de l'amendement
  const aCharger: Array<{ scrutin: { uid: string; titre: string }; nom: string; numero: number }> = [];
  for (const s of scrutins) {
    const numero = numeroScrutin(s.titre);
    if (numero == null) continue;
    const cands = index.get(`${s.date}|${numero}`);
    if (!cands || cands.length === 0) continue;
    let choisi = cands[0];
    if (cands.length > 1) {
      const sa = auteurScrutin(s.titre);
      const m = cands.filter((c) => c.auteur && sa && c.auteur === sa);
      if (m.length === 1) choisi = m[0];
      else continue; // ambigu : on n'invente pas
    }
    aCharger.push({ scrutin: s, nom: choisi.nom, numero });
  }

  // Charge les amendements retenus (async, hors transaction) puis insere en bloc
  // (les transactions better-sqlite3 sont synchrones).
  let lies = 0;
  const charges = [] as Array<any>;
  for (const it of aCharger) {
    const a = JSON.parse((await zip.entryData(it.nom)).toString("utf8")).amendement;
    const corps = a?.corps?.contenuAuteur ?? {};
    charges.push({
      scrutin_uid: it.scrutin.uid,
      amendement_uid: a?.uid ?? null,
      numero: it.numero,
      auteur: clean(a?.signataires?.libelle) ?? null,
      article: articleAmendement(a),
      dispositif: clean(corps.dispositif),
      expose: clean(corps.exposeSommaire),
    });
  }
  db.transaction((rows: any[]) => {
    for (const r of rows) {
      ins.run(r);
      lies++;
    }
  })(charges);

  await zip.close();
  return { lies, total: scrutins.length };
}

// Execution directe : telecharge si besoin + relie.
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await assurerAmendementsZip(process.argv.includes("--download"));
    const db = openDb();
    createSchema(db);
    console.log("Liaison des amendements (lecture du zip, ~1-2 min)...");
    const r = await lierAmendements(db);
    console.log(`✅ ${r.lies}/${r.total} scrutins sur amendement reliés a leur exposé.`);
    db.close();
  })();
}
