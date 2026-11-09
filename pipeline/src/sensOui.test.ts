import { test } from "node:test";
import assert from "node:assert/strict";
import { affrontement, blocsDuScrutin, positionBloc, sensOui, type Compte } from "./sensOui.js";

const c = (pour: number, contre: number, abstention = 0): Compte => ({ pour, contre, abstention });
const m = (o: Record<string, Compte>) => new Map(Object.entries(o));

test("position d'un bloc : majorité absolue de ses votants, sinon divisé", () => {
  assert.equal(positionBloc(c(116, 0)), "pour");
  assert.equal(positionBloc(c(0, 4, 28)), "abstention");
  assert.equal(positionBloc(c(72, 65, 33)), "divisé"); // gauche sur le n° 1319
  assert.equal(positionBloc(c(0, 0)), null);
});

test("« gauche » : n° 881, impôt plancher (gauche pour, centre et DR contre, RN-UDR abstention)", () => {
  const b = blocsDuScrutin(m({ "LFI-NFP": c(70, 0), SOC: c(46, 0), EPR: c(0, 20, 2), DEM: c(0, 12, 1), DR: c(0, 3), RN: c(0, 4, 28) }));
  assert.deepEqual(b, { gauche: "pour", centre: "contre", DR: "contre", "RN-UDR": "abstention" });
  assert.equal(sensOui(b), "gauche");
  assert.ok(affrontement(b));
});

test("« droite » : n° 1624, justice des mineurs (gauche seule contre)", () => {
  const b = blocsDuScrutin(m({ "LFI-NFP": c(0, 70), SOC: c(0, 60), GDR: c(0, 17, 1), EPR: c(90, 3, 4), DR: c(45, 0), RN: c(120, 0), UDR: c(14, 0) }));
  assert.equal(sensOui(b), "droite");
});

test("« anti-RN » : n° 1319, Egalim (gauche divisée, RN-UDR seul contre)", () => {
  const b = blocsDuScrutin(m({ "LFI-NFP": c(0, 65, 5), SOC: c(60, 0, 20), GDR: c(12, 0, 8), EPR: c(110, 0), DR: c(43, 0), RN: c(0, 95, 6), UDR: c(0, 6, 2) }));
  assert.equal(b.gauche, "divisé");
  assert.equal(sensOui(b), "anti-RN");
});

test("« autre » et pas d'affrontement quand personne ne vote contre (n° 9241)", () => {
  const b = blocsDuScrutin(m({ "LFI-NFP": c(80, 0), SOC: c(68, 0), EPR: c(4, 5, 20), DR: c(0, 0, 6), RN: c(0, 0, 84) }));
  assert.equal(sensOui(b), "autre");
  assert.equal(affrontement(b), false);
});

test("« autre » quand le centre est seul contre (n° 2272, allocations dès le 1er enfant)", () => {
  const b = blocsDuScrutin(m({ "LFI-NFP": c(40, 0), SOC: c(29, 0), EPR: c(2, 17, 5), DR: c(4, 0), RN: c(26, 0) }));
  assert.equal(sensOui(b), "autre");
  assert.ok(affrontement(b));
});
