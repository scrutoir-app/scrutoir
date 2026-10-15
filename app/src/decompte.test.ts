import { test } from "node:test";
import assert from "node:assert/strict";
import { decompteClair } from "./decompte";

test("décompte en clair : positions non nulles, dans l'ordre pour · contre · abst.", () => {
  assert.equal(decompteClair({ pour: 14, contre: 0, abstention: 0 }), "14 pour");
  assert.equal(decompteClair({ pour: 10, contre: 0, abstention: 1 }), "10 pour, 1 abst.");
  assert.equal(decompteClair({ pour: 0, contre: 17, abstention: 0 }), "17 contre");
  assert.equal(decompteClair({ pour: 1312, contre: 2, abstention: 3 }), "1 312 pour, 2 contre, 3 abst.");
  assert.equal(decompteClair({ pour: 0, contre: 0, abstention: 0 }), "");
});
