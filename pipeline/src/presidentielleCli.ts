/**
 * Rubrique Présidentielle 2027 : aperçu privé, mise en service, retour arrière. Depuis le Mac,
 * JAMAIS en CI (refuse si CI est posé).
 *
 *   npm run presidentielle:apercu -- <id>      export forcé + build + déploiement sur la branche
 *                                              d'aperçu des deux projets Pages (URL *.pages.dev,
 *                                              noindex). Publiques pour qui les connaît.
 *   npm run presidentielle:activer -- <id>     prérequis (PREREQUIS.md + prerequis.json) → enService
 *                                              true → commit + push main → refresh.yml → vérif. prod.
 *   npm run presidentielle:desactiver -- <id>  enService false → commit + push → refresh.yml → vérif.
 *   npm run presidentielle:verifier -- <id>    contrôle à blanc des prérequis (ne modifie rien).
 *
 * Zéro coût : Cloudflare Pages (offre gratuite) et GitHub Actions (dépôt public), rien d'autre.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CONFIG, DOSSIER_PROGRAMMES, construireProgramme, exporterPresidentielle, lireConfig, type ConfigProgramme } from "./exportPresidentielle";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, "../..");
const APP = path.join(RACINE, "app");
const PIPELINE = path.join(RACINE, "pipeline");
const BRANCHE_APERCU = "apercu-presidentielle";
const DEPOT = "scrutoir-app/scrutoir";
const DATA_PROD = "https://data.scrutoir.fr";
const APP_PROD = "https://scrutoir.fr";
const GH = fs.existsSync(path.join(os.homedir(), ".local/bin/gh")) ? path.join(os.homedir(), ".local/bin/gh") : "gh";
// Compte Cloudflare du projet (déjà public dans CLAUDE.md) ; surchargeable par l'environnement.
const COMPTE_CF = process.env.CLOUDFLARE_ACCOUNT_ID ?? "627984d2dd614e139df12342e9f2469a";

function lancer(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd ?? RACINE, env: { ...process.env, ...opts.env } });
  if (r.status !== 0) throw new Error(`échec de : ${cmd} ${args.join(" ")}`);
}
const lire = (cmd: string, args: string[], cwd = RACINE) => execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const duree = (ms: number) => `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;

function programme(id: string | undefined): ConfigProgramme {
  if (!id) throw new Error("Préciser le programme : npm run presidentielle:<action> -- <id>");
  const p = lireConfig().programmes.find((x) => x.id === id);
  if (!p) throw new Error(`Programme inconnu : ${id} (voir programmes/presidentielle.json)`);
  return p;
}

function ecrireEnService(id: string, enService: boolean) {
  const brut = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const p = brut.programmes.find((x: { id: string }) => x.id === id);
  p.enService = enService;
  fs.writeFileSync(CONFIG, JSON.stringify(brut, null, 2) + "\n");
}

// ---------------------------------------------------------------------------------------------
// Aperçu privé

function prefixerHeaders(fichier: string, bloc: string) {
  const avant = fs.existsSync(fichier) ? fs.readFileSync(fichier, "utf8") : "";
  fs.writeFileSync(fichier, `${bloc}\n\n${avant}`);
}

async function apercu(id: string) {
  if (process.env.CI) throw new Error("presidentielle:apercu se lance depuis le Mac, jamais en CI.");
  const p = programme(id);
  const debut = Date.now();
  const dataApercu = `https://${BRANCHE_APERCU}.scrutoir-data.pages.dev`;
  const appApercu = `https://${BRANCHE_APERCU}.scrutoir.pages.dev`;
  const noindex = "/*\n  X-Robots-Tag: noindex, nofollow, noarchive";
  try {
    // 1) Données : export avec le programme forcé en service (sur le disque seulement).
    if (fs.existsSync(path.join(APP, "public/data/version.json"))) exporterPresidentielle({ forcer: [p.id] });
    else lancer("npm", ["run", "export:static"], { cwd: PIPELINE, env: { PRESIDENTIELLE_FORCER: p.id } });
    // 2) Build web lisant les données d'aperçu ; mesure d'audience coupée.
    lancer("npm", ["run", "build:web"], { cwd: APP, env: { EXPO_PUBLIC_DATA_BASE: dataApercu, EXPO_PUBLIC_ANALYTICS_URL: "off" } });
    // 3) Aperçu non indexable ; la CSP doit autoriser l'origine des données d'aperçu.
    const h = path.join(APP, "dist/_headers");
    const csp = fs.readFileSync(h, "utf8");
    if (!csp.includes("connect-src 'self' https://data.scrutoir.fr")) throw new Error("CSP inattendue dans dist/_headers (connect-src)");
    fs.writeFileSync(h, csp.replace("connect-src 'self' https://data.scrutoir.fr", `connect-src 'self' ${dataApercu} https://data.scrutoir.fr`));
    prefixerHeaders(h, noindex);
    fs.writeFileSync(path.join(APP, "dist/robots.txt"), "User-agent: *\nDisallow: /\n");
    lancer("node", ["scripts/split-data-site.mjs"], { cwd: APP });
    prefixerHeaders(path.join(APP, ".data-site/_headers"), noindex);
    // 4) Branche d'aperçu des deux projets Pages (la garde check-data-freshness ne s'applique pas).
    const env = { CLOUDFLARE_ACCOUNT_ID: COMPTE_CF };
    lancer("npx", ["wrangler", "pages", "deploy", ".data-site", "--project-name=scrutoir-data", `--branch=${BRANCHE_APERCU}`, "--commit-dirty=true"], { cwd: APP, env });
    lancer("npx", ["wrangler", "pages", "deploy", "dist", "--project-name=scrutoir", `--branch=${BRANCHE_APERCU}`, "--commit-dirty=true"], { cwd: APP, env });
    console.log(`\n✅ Aperçu privé de ${p.id} déployé en ${duree(Date.now() - debut)} :`);
    console.log(`   App     : ${appApercu}/?open=programme:${p.id}`);
    console.log(`   Données : ${dataApercu}/data/presidentielle/index.json`);
    console.log("   ⚠️ Ces URL sont publiques pour qui les connaît (noindex, mais pas d'accès restreint).");
    console.log("      Ne les écrire dans aucun fichier commité. Rien n'a changé en production.");
  } finally {
    // Le disque revient en état dormant : aucun fichier de programme, aucun build d'aperçu
    // (un déploiement manuel ne doit jamais emporter l'aperçu en production).
    exporterPresidentielle({ forcer: [], log: () => {} });
    fs.rmSync(path.join(APP, "dist"), { recursive: true, force: true });
    fs.rmSync(path.join(APP, ".data-site"), { recursive: true, force: true });
    console.log("\nDisque remis en état dormant (data/presidentielle/index.json seul) ; dist/ et .data-site/ de l'aperçu supprimés.");
  }
}

// ---------------------------------------------------------------------------------------------
// Prérequis de mise en service

interface Prerequis {
  groupeUid: string;
  aucunVotant?: { numero: number; statut: "non votant" | "absent du scrutin" }[];
  consigneDans?: { fichier: string; doitContenir: string[] };
  textesInterdits?: { fichier: string; motif: string }[];
  aucuneMentionInterne?: boolean;
}

async function lireScrutin(numero: number): Promise<any> {
  const local = path.join(APP, `public/data/scrutin/VTANR5L17V${numero}.json`);
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf8"));
  const r = await fetch(`${DATA_PROD}/data/scrutin/VTANR5L17V${numero}.json`);
  if (!r.ok) throw new Error(`scrutin n° ${numero} introuvable (${r.status})`);
  return r.json();
}

export async function verifierPrerequis(p: ConfigProgramme): Promise<string[]> {
  const dossier = path.join(DOSSIER_PROGRAMMES, p.dossier);
  const manques: string[] = [];
  const fMd = path.join(dossier, "PREREQUIS.md");
  if (!fs.existsSync(fMd)) return [`${fMd} introuvable`];
  const md = fs.readFileSync(fMd, "utf8");
  for (const l of md.split("\n")) if (/^\s*- \[ \]/.test(l)) manques.push(`case non cochée dans PREREQUIS.md : ${l.replace(/^\s*- \[ \]\s*/, "").replace(/\*\*/g, "").slice(0, 90)}`);
  if (!/^\s*- \[x\]/im.test(md)) manques.push("PREREQUIS.md ne contient aucune case cochée");

  const fJson = path.join(dossier, "prerequis.json");
  if (!fs.existsSync(fJson)) return [...manques, `${fJson} introuvable`];
  const pr = JSON.parse(fs.readFileSync(fJson, "utf8")) as Prerequis;
  for (const a of pr.aucunVotant ?? []) {
    try {
      const d = await lireScrutin(a.numero);
      const g = (d.groupes ?? []).find((x: any) => x.uid === pr.groupeUid);
      const exprimes = g ? (g.pour ?? 0) + (g.contre ?? 0) + (g.abstention ?? 0) : 0;
      const dans = (pos: string) => ((d.votants ?? {})[pos] ?? []).filter((v: any) => v.groupe_uid === pr.groupeUid || v.groupe === g?.abrev).length;
      const nonVotants = dans("nonvotant");
      if (exprimes !== 0) manques.push(`n° ${a.numero} : le groupe a ${exprimes} voix exprimées (attendu : aucun votant)`);
      else if (a.statut === "non votant" && nonVotants === 0) manques.push(`n° ${a.numero} : aucun « non votant » du groupe dans les données AN`);
      else if (a.statut === "absent du scrutin" && nonVotants + dans("pour") + dans("contre") + dans("abstention") > 0) manques.push(`n° ${a.numero} : des députés du groupe figurent dans la liste nominative`);
    } catch (e) {
      manques.push(`n° ${a.numero} : vérification impossible (${(e as Error).message})`);
    }
  }
  if (pr.consigneDans) {
    const f = path.join(dossier, pr.consigneDans.fichier);
    const t = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
    for (const m of pr.consigneDans.doitContenir) if (!t.includes(m)) manques.push(`${pr.consigneDans.fichier} ne consigne pas « ${m} »`);
  }
  for (const ti of pr.textesInterdits ?? []) {
    const f = path.join(dossier, ti.fichier);
    if (fs.existsSync(f) && fs.readFileSync(f, "utf8").includes(ti.motif)) manques.push(`${ti.fichier} contient encore « ${ti.motif} »`);
  }
  try {
    const c = construireProgramme(p, dossier); // échoue si un compte est faux
    if (pr.aucuneMentionInterne) {
      const internes = c.avertissements.filter((a) => a.includes("mention interne"));
      if (internes.length) manques.push(`${internes.length} texte(s) publié(s) avec une mention interne, ex. ${internes[0]}`);
    }
  } catch (e) {
    manques.push((e as Error).message);
  }
  return manques;
}

// ---------------------------------------------------------------------------------------------
// Mise en service / retour arrière

function fichiersEntree(p: ConfigProgramme): string[] {
  const d = path.join(DOSSIER_PROGRAMMES, p.dossier);
  const rel = (f: string) => path.relative(RACINE, path.join(d, f));
  const out = ["mesures.json", "classement.json", "attendus.json"].map(rel);
  for (const f of fs.readdirSync(path.join(d, "verdicts")).filter((f) => f.endsWith(".json"))) out.push(rel(`verdicts/${f}`));
  for (const f of fs.readdirSync(d).filter((f) => /-chiffrees-\d+\.json$/.test(f))) out.push(rel(f));
  if (fs.existsSync(path.join(d, "methode/a_juger.json"))) out.push(rel("methode/a_juger.json"));
  return out;
}

function verifierGit() {
  const branche = lire("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branche !== "main") throw new Error(`Se placer sur main (branche actuelle : ${branche}).`);
  lancer("git", ["fetch", "origin", "main", "--quiet"]);
  const [avance, retard] = lire("git", ["rev-list", "--left-right", "--count", "HEAD...origin/main"]).split(/\s+/).map(Number);
  if (avance || retard) throw new Error(`main local et origin/main divergent (${avance} en avance, ${retard} en retard) : synchroniser d'abord.`);
  if (lire("git", ["diff", "--cached", "--name-only"])) throw new Error("Des fichiers sont déjà indexés (git add) : les commiter ou les retirer d'abord.");
}

async function lancerRefresh(): Promise<void> {
  const avant = new Date(Date.now() - 5000).toISOString();
  lancer(GH, ["workflow", "run", "refresh.yml", "--repo", DEPOT, "--ref", "main"]);
  let id = "";
  for (let i = 0; i < 24 && !id; i++) {
    await attendre(5000);
    const runs = JSON.parse(lire(GH, ["run", "list", "--repo", DEPOT, "--workflow", "refresh.yml", "--limit", "5", "--json", "databaseId,createdAt,event"])) as { databaseId: number; createdAt: string; event: string }[];
    const r = runs.find((x) => x.event === "workflow_dispatch" && x.createdAt >= avant);
    if (r) id = String(r.databaseId);
  }
  if (!id) throw new Error("Run refresh.yml introuvable : le suivre à la main (gh run list --workflow refresh.yml).");
  console.log(`\nSuivi du run ${id} (https://github.com/${DEPOT}/actions/runs/${id})`);
  lancer(GH, ["run", "watch", id, "--repo", DEPOT, "--exit-status", "--interval", "15"]);
}

async function json(url: string): Promise<{ status: number; data: any }> {
  const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" as RequestCache });
  return { status: r.status, data: r.ok ? await r.json() : null };
}

async function activer(id: string) {
  if (process.env.CI) throw new Error("presidentielle:activer se lance depuis le Mac, jamais en CI.");
  const debut = Date.now();
  const p = programme(id);
  if (p.enService) throw new Error(`${id} est déjà en service.`);
  verifierGit();
  const manques = await verifierPrerequis(p);
  if (manques.length) {
    console.error(`\n❌ Mise en service de ${id} BLOQUÉE (${manques.length}) :\n  - ${manques.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`✅ Prérequis de ${id} remplis.`);
  ecrireEnService(id, true);
  const fichiers = fichiersEntree(p);
  lancer("git", ["add", path.relative(RACINE, CONFIG)]);
  lancer("git", ["add", "-f", ...fichiers]);
  lancer("git", ["commit", "-m", `Présidentielle 2027 : mise en service du programme ${id}`]);
  lancer("git", ["push", "origin", "main"]);
  await lancerRefresh();

  // Vérification en production.
  const att = JSON.parse(fs.readFileSync(path.join(DOSSIER_PROGRAMMES, p.dossier, "attendus.json"), "utf8"));
  const idx = await json(`${DATA_PROD}/data/presidentielle/index.json`);
  const prog = await json(`${DATA_PROD}/data/presidentielle/${id}/programme.json`);
  const erreurs: string[] = [];
  if (!idx.data?.programmes?.some((x: { id: string }) => x.id === id)) erreurs.push("index.json ne liste pas le programme");
  if (!prog.data) erreurs.push(`programme.json : HTTP ${prog.status}`);
  else {
    for (const k of ["mesures", "confrontables", "horsChamp", "cles", "clesConfrontables", "chiffrees"]) if (prog.data.comptes[k] !== att[k]) erreurs.push(`comptes.${k} = ${prog.data.comptes[k]} (attendu ${att[k]})`);
    if (JSON.stringify(prog.data.verdicts) !== JSON.stringify(att.verdicts)) erreurs.push("verdicts ≠ attendus.json");
  }
  const html = await fetch(`${APP_PROD}/`).then((r) => r.text()).catch(() => "");
  const bundle = html.match(/src="(\/_expo\/static\/js\/web\/[^"]+\.js)"/)?.[1];
  const js = bundle ? await fetch(`${APP_PROD}${bundle}`).then((r) => r.text()).catch(() => "") : "";
  if (!js.includes("presidentielle_open")) erreurs.push("le bundle de scrutoir.fr ne contient pas la rubrique (version déployée ?)");
  if (erreurs.length) {
    console.error(`\n⚠️ Vérification en production incomplète :\n  - ${erreurs.join("\n  - ")}\n  Retour arrière : npm run presidentielle:desactiver -- ${id}`);
    process.exit(1);
  }
  console.log(`\n✅ ${id} EN SERVICE en ${duree(Date.now() - debut)}. Données et comptes vérifiés en production.`);
  console.log("   À contrôler à l'œil (le script ne lance pas de navigateur) : la carte d'accueil, puis le lien du programme.");
  console.log("\nLiens pour Instagram :");
  console.log(`   Bio                          : ${APP_PROD}/?open=presidentielle`);
  console.log(`   Carrousel « confrontation »  : ${APP_PROD}/?open=programme:${id}`);
  const lignes = (prog.data?.listeChiffrees ?? []) as { code: string; libelle: string }[];
  if (lignes.length) {
    console.log(`   Carrousel « chiffrage »      : ${APP_PROD}/?open=programme:${id} (puis « Chiffrées par le parti »), ou ligne par ligne :`);
    for (const l of lignes) console.log(`     ${l.code}  ${APP_PROD}/?open=mesure:${id}.${l.code}   ${l.libelle}`);
  }
}

async function desactiver(id: string) {
  if (process.env.CI) throw new Error("presidentielle:desactiver se lance depuis le Mac, jamais en CI.");
  const debut = Date.now();
  const p = programme(id);
  if (!p.enService) throw new Error(`${id} n'est pas en service.`);
  verifierGit();
  ecrireEnService(id, false);
  lancer("git", ["add", path.relative(RACINE, CONFIG)]);
  lancer("git", ["commit", "-m", `Présidentielle 2027 : retrait du programme ${id} (hors service)`]);
  lancer("git", ["push", "origin", "main"]);
  await lancerRefresh();
  const idx = await json(`${DATA_PROD}/data/presidentielle/index.json`);
  const prog = await json(`${DATA_PROD}/data/presidentielle/${id}/programme.json`);
  if (idx.data?.programmes?.some((x: { id: string }) => x.id === id) || prog.status === 200) {
    console.error("⚠️ Le programme est encore servi en production : vérifier le run refresh.yml.");
    process.exit(1);
  }
  console.log(`\n✅ ${id} retiré en ${duree(Date.now() - debut)} : plus listé, fichiers absents de data.scrutoir.fr.`);
  console.log("   Les fichiers d'entrée restent dans l'historique git (le dépôt est public).");
}

/** Contrôle à blanc des prérequis (rien n'est modifié). */
async function verifier(id: string) {
  const p = programme(id);
  const manques = await verifierPrerequis(p);
  if (manques.length) {
    console.log(`Mise en service de ${id} : BLOQUÉE (${manques.length}) :\n  - ${manques.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`Mise en service de ${id} : prérequis remplis.`);
}

const [action, id] = process.argv.slice(2);
const actions: Record<string, (id: string) => Promise<void>> = { apercu, activer, desactiver, verifier };
if (!actions[action]) {
  console.error("Usage : npm run presidentielle:apercu|activer|desactiver|verifier -- <id>");
  process.exit(1);
}
actions[action](id).catch((e) => {
  console.error(`\n❌ ${(e as Error).message}`);
  process.exit(1);
});
