import { test } from "node:test";
import assert from "node:assert/strict";
import { groupeCanonique, ORGANE_SUCCESSEUR } from "./organesGroupes.js";

test("les organes historiques de l'UDR sont rattachés à l'organe actuel", () => {
  assert.equal(groupeCanonique("PO847173"), "PO872880"); // « UDR », 12/09/2024 → 04/09/2025
  assert.equal(groupeCanonique("PO845520"), "PO872880"); // « À Droite », 18/07 → 11/09/2024
  assert.equal(groupeCanonique("PO872880"), "PO872880");
});

test("les autres groupes et les valeurs vides ne bougent pas", () => {
  assert.equal(groupeCanonique("PO845401"), "PO845401");
  assert.equal(groupeCanonique(null), null);
  assert.equal(groupeCanonique(undefined), null);
  assert.equal(groupeCanonique(""), null);
});

test("pas de chaîne : chaque successeur est un organe final", () => {
  for (const succ of Object.values(ORGANE_SUCCESSEUR)) assert.equal(ORGANE_SUCCESSEUR[succ], undefined);
});
