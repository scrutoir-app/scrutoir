// Qualité de la DÉDUCTION « comme toi » sur les données publiées (app/public/data/test-proximite.json).
// Simulation de la consigne du lot 5 : pour chaque groupe X, un profil qui vote exactement comme X
// sur les questions du test ; pour chaque question, on met la question de côté, on calcule la
// proximité sur les autres, puis on déduit le camp du profil sur la question mise de côté.
// La déduction doit retrouver le vrai vote du profil (16/11/2026 : 93 % justes, 3 % fausses,
// 5 % Partagé ; avant, avec la taille des groupes : 80 % / 11 % / 9 %).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { positionMajoritaire } from "../decompte";
import { calculerProximite, type QuestionProximite, type Reponse } from "./score";
import { verdictDeduit, type GroupePos } from "./verdict";
import type { ContexteJe } from "./jeProximite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../public/data/test-proximite.json"), "utf8"),
) as QuestionProximite[];
const groupes = ORDRE_HEMICYCLE.map((abrev) => ({ abrev }));
const tranche = (p: unknown): p is "pour" | "contre" => p === "pour" || p === "contre";

function ctxDe(resultat: ContexteJe["resultat"]): ContexteJe {
  return {
    reponses: {}, poids: {}, questions: [], questionsTest: [], resultat, resultatTestSeul: resultat,
    comparableParGroupe: {}, nbVotes: 0, compteurs: { test: 0, perso: 0, horsCalcul: 0, sansAvis: 0 },
  };
}

test("déduction : un profil qui vote comme un groupe est bien retrouvé (question mise de côté)", () => {
  let n = 0, justes = 0, fausses = 0, commeToi = 0, commeReel = 0;
  for (const x of ORDRE_HEMICYCLE) {
    const reponses: Record<number, Reponse> = {};
    for (const q of questions) {
      const p = positionMajoritaire(q.decomptes?.[x] ?? {});
      if (tranche(p)) reponses[q.id] = p;
    }
    for (const q of questions) {
      const vrai = reponses[q.id];
      if (!vrai || !q.totaux) continue;
      const autres = questions.filter((o) => o.id !== q.id);
      const ctx = ctxDe(calculerProximite(autres, reponses, {}, groupes));
      const pos: GroupePos[] = ORDRE_HEMICYCLE.map((abrev) => {
        const c = q.decomptes?.[abrev] ?? { pour: 0, contre: 0, abstention: 0 };
        return { abrev, taille: c.pour + c.contre + c.abstention, position: positionMajoritaire(c) };
      });
      const sort = q.totaux.pour > q.totaux.contre ? "adopte" : "rejete";
      const gagnant = sort === "adopte" ? "pour" : "contre";
      const v = verdictDeduit(ctx, pos, sort);
      n++;
      if (v.penche === vrai) justes++;
      else if (v.penche) fausses++;
      if (v.penche === gagnant) commeToi++;
      if (vrai === gagnant) commeReel++;
    }
  }
  assert.ok(n > 200, `trop peu de cas simulés (${n})`);
  assert.ok(justes / n >= 0.9, `déductions justes : ${Math.round((justes / n) * 100)} %`);
  assert.ok(fausses / n <= 0.05, `déductions fausses : ${Math.round((fausses / n) * 100)} %`);
  // « Comme toi » ne doit plus être surreprésenté (la taille tirait vers le camp gagnant).
  assert.ok(Math.abs(commeToi - commeReel) / n <= 0.05, `« Comme toi » ${commeToi} contre ${commeReel} réels sur ${n}`);
});
