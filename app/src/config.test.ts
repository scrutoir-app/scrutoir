import { test } from "node:test";
import assert from "node:assert/strict";
import { lienAN, scrutinSourceUrl } from "./config";

test("lien vers l'Assemblée lu dans les données : https sur www.assemblee-nationale.fr, gardé tel quel", () => {
  const u = "https://www.assemblee-nationale.fr/dyn/17/scrutins/1262";
  assert.equal(lienAN(u), u);
  assert.equal(lienAN(scrutinSourceUrl(1262)), u);
});

test("lien des données refusé : autre schéma, autre hôte, hôte imité, vide", () => {
  for (const u of [
    "javascript:alert(document.cookie)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://www.assemblee-nationale.fr/dyn/17/scrutins/1262",
    "https://www.assemblee-nationale.fr.evil.example/dyn/17/scrutins/1262",
    "https://www.assemblee-nationale.fr@evil.example/",
    "https://evil.example/?https://www.assemblee-nationale.fr/",
    "//www.assemblee-nationale.fr/dyn/17/scrutins/1262",
    "",
    null,
    undefined,
  ])
    assert.equal(lienAN(u as string | null | undefined), null, String(u));
});
