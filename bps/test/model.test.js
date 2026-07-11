import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeQuiver, validateQuiver, toConstructorPayload, toPythonSnippet,
  addArrow, addNode, removeNode, identityCharges, flavourRank, matrixRank,
  gaugeIndices, gaugeBlock, framingRows,
} from "../src/model/quiver.js";
import { presetByKey, presetTree, PRESETS } from "../src/model/presets.js";
import { toWireObject, objectToQuiver, parseImport, toShareURL } from "../src/model/share.js";

test("pentagon preset builds a valid 2-node quiver", () => {
  const q = makeQuiver(presetByKey("a1a2"));
  assert.equal(q.nodes.length, 2);
  assert.deepEqual(q.B, [[0, 1], [-1, 0]]);
  assert.ok(validateQuiver(q).ok);
});

test("constructor payload = the BPSKAlgebra args", () => {
  const q = makeQuiver(presetByKey("a1a2"));
  const p = toConstructorPayload(q);
  assert.deepEqual(p.pairing, [[0, 1], [-1, 0]]);
  assert.deepEqual(p.node_charges, identityCharges(2));
  assert.deepEqual(p.spec, [[1, 0], [0, 1]]);
  assert.match(toPythonSnippet(q), /^A = BPSKAlgebra\(pairing=\[\[0, 1\], \[-1, 0\]\]/);
});

test("validation catches a non-antisymmetric B", () => {
  const q = makeQuiver({ name: "bad", B: [[0, 1], [1, 0]] });
  const v = validateQuiver(q);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /antisymmetric/.test(e)));
});

test("addArrow preserves antisymmetry; add/removeNode keep dims", () => {
  let q = makeQuiver(presetByKey("a1a2"));
  q = addArrow(q, 0, 1, 1); // B[0][1] -> 2
  assert.equal(q.B[0][1], 2);
  assert.equal(q.B[1][0], -2);
  q = addNode(q, 100, 100);
  assert.equal(q.nodes.length, 3);
  assert.equal(q.B.length, 3);
  assert.ok(q.B.every((r) => r.length === 3));
  assert.ok(q.nodes.every((nd) => nd.charge.length === 3));
  q = removeNode(q, 2);
  assert.equal(q.nodes.length, 2);
  assert.ok(q.B.every((r) => r.length === 2));
});

test("share round-trips through the wire schema", () => {
  const q = makeQuiver(presetByKey("su3-pure"));
  const wire = toWireObject(q);
  assert.equal(wire.n, 4);
  const q2 = objectToQuiver(wire);
  assert.deepEqual(q2.B, q.B);
  assert.equal(q2.nodes.length, 4);
});

test("parseImport accepts a raw JSON object and a URL hash", () => {
  const raw = '{"name":"t","n":2,"B":[[0,1],[-1,0]]}';
  const a = parseImport(raw);
  assert.deepEqual(a.B, [[0, 1], [-1, 0]]);
  const url = toShareURL(makeQuiver(presetByKey("a1a2")), "https://x/y");
  assert.ok(url.startsWith("https://x/y#"));
  const b = parseImport(url);
  assert.deepEqual(b.B, [[0, 1], [-1, 0]]);
});

test("flavour rank = dim ker(B) (degenerate B ⇒ flavour)", () => {
  // pentagon: non-degenerate ⇒ f = 0
  assert.equal(flavourRank(makeQuiver(presetByKey("a1a2"))), 0);
  // hexagon B has a 1-dim kernel ⇒ f = 1
  const hex = makeQuiver({ name: "hex", B: [[0, 1, -1], [-1, 0, 1], [1, -1, 0]] });
  assert.equal(matrixRank(hex.B), 2);
  assert.equal(flavourRank(hex), 1);
});

test("framing node: square kind, gauge-only payload, extended F_γ listed", () => {
  let q = makeQuiver(presetByKey("a1a2"));   // 2 gauge nodes
  q = addNode(q, 300, 100, "framing");       // node 2 = framing
  q = addArrow(q, 2, 0, 1);                  // ⟨f1, γ1⟩ = 1
  assert.equal(q.nodes[2].kind, "framing");
  assert.equal(gaugeIndices(q).length, 2);
  assert.deepEqual(gaugeBlock(q), [[0, 1], [-1, 0]]);   // gauge block unaffected
  const fr = framingRows(q);
  assert.equal(fr.length, 1);
  assert.deepEqual(fr[0].pairing, [1, 0]);              // ⟨f1,γ1⟩=1, ⟨f1,γ2⟩=0
  const p = toConstructorPayload(q);
  assert.deepEqual(p.pairing, [[0, 1], [-1, 0]]);       // BPSKAlgebra sees gauge only
  assert.equal(p.node_charges.length, 2);
  assert.equal(p.framing.length, 1);
  assert.equal(flavourRank(q), 0);                      // ker on gauge block
  assert.match(toPythonSnippet(q), /extended F_γ/);
});

test("framing kind round-trips through the wire (kinds)", async () => {
  const { toWireObject, objectToQuiver } = await import("../src/model/share.js");
  let q = makeQuiver(presetByKey("a1a2"));
  q = addNode(q, 300, 100, "framing");
  const wire = toWireObject(q);
  assert.deepEqual(wire.kinds, ["gauge", "gauge", "framing"]);
  assert.equal(objectToQuiver(wire).nodes[2].kind, "framing");
});

test("preset tree nests folders and reaches every preset as a leaf", () => {
  const tree = presetTree();
  assert.ok(tree.some((n) => n.type === "folder" && n.label === "Argyres–Douglas"));
  const leaves = [];
  const walk = (ns) => ns.forEach((n) => (n.type === "folder" ? walk(n.children) : leaves.push(n.key)));
  walk(tree);
  assert.equal(leaves.length, PRESETS.length);
  assert.ok(leaves.includes("su2-nf4"));
});

test("identity charges are omitted from the wire object, non-identity kept", () => {
  const q = makeQuiver(presetByKey("a1a2"));
  assert.equal(toWireObject(q).charges, undefined);
  const q2 = makeQuiver({ name: "emb", B: [[0, 1], [-1, 0]], charges: [[1, 0], [1, 1]] });
  assert.deepEqual(toWireObject(q2).charges, [[1, 0], [1, 1]]);
});
