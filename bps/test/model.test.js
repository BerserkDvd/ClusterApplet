import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeQuiver, validateQuiver, toConstructorPayload, toPythonSnippet,
  addArrow, addNode, removeNode, identityCharges,
} from "../src/model/quiver.js";
import { presetByKey } from "../src/model/presets.js";
import { toWireObject, objectToQuiver, parseImport, toShareURL } from "../src/model/share.js";

test("pentagon preset builds a valid 2-node quiver", () => {
  const q = makeQuiver(presetByKey("a2-pentagon"));
  assert.equal(q.nodes.length, 2);
  assert.deepEqual(q.B, [[0, 1], [-1, 0]]);
  assert.ok(validateQuiver(q).ok);
});

test("constructor payload = the BPSKAlgebra args", () => {
  const q = makeQuiver(presetByKey("a2-pentagon"));
  const p = toConstructorPayload(q);
  assert.deepEqual(p.pairing, [[0, 1], [-1, 0]]);
  assert.deepEqual(p.node_charges, identityCharges(2));
  assert.deepEqual(p.spec, [[1, 0], [0, 1]]);
  assert.match(toPythonSnippet(q), /^BPSKAlgebra\(pairing=\[\[0, 1\], \[-1, 0\]\]/);
});

test("validation catches a non-antisymmetric B", () => {
  const q = makeQuiver({ name: "bad", B: [[0, 1], [1, 0]] });
  const v = validateQuiver(q);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /antisymmetric/.test(e)));
});

test("addArrow preserves antisymmetry; add/removeNode keep dims", () => {
  let q = makeQuiver(presetByKey("a2-pentagon"));
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
  const url = toShareURL(makeQuiver(presetByKey("a2-pentagon")), "https://x/y");
  assert.ok(url.startsWith("https://x/y#"));
  const b = parseImport(url);
  assert.deepEqual(b.B, [[0, 1], [-1, 0]]);
});

test("identity charges are omitted from the wire object, non-identity kept", () => {
  const q = makeQuiver(presetByKey("a2-pentagon"));
  assert.equal(toWireObject(q).charges, undefined);
  const q2 = makeQuiver({ name: "emb", B: [[0, 1], [-1, 0]], charges: [[1, 0], [1, 1]] });
  assert.deepEqual(toWireObject(q2).charges, [[1, 0], [1, 1]]);
});
