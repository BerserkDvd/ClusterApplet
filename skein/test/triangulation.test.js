import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  makeTriangulation, sigma, flip, canFlip, canonicalForm, isomorphic,
  topology, vertices, punctureSummary, validateTriangulation, applyFlips,
  mutableBlock, flavourRank,
} from "../src/model/triangulation.js";
import { fanPolygon, presetByKey, PRESETS } from "../src/model/triangulation_presets.js";
import {
  toTriangulationWire, parseTriangulationImport, toBpsWireObject, toBpsAppURL,
} from "../src/model/triangulation_share.js";

const REF = JSON.parse(readFileSync(fileURLToPath(new URL("./triangulation_ref.json", import.meta.url))));

// Mutation of an antisymmetric matrix at node k (Fomin–Zelevinsky) — the flip's
// combinatorial shadow, for the flip↔mutation cross-check.
function mutateMatrix(B, k) {
  const n = B.length;
  const Bn = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === k || j === k) Bn[i][j] = -B[i][j];
    else Bn[i][j] = B[i][j] + Math.max(B[i][k], 0) * Math.max(B[k][j], 0) - Math.max(-B[i][k], 0) * Math.max(-B[k][j], 0);
    if (Bn[i][j] === 0) Bn[i][j] = 0; // normalize -0 → 0 for strict deepEqual
  }
  return Bn;
}

function fromRef(rec) {
  return makeTriangulation({ nPunctures: rec.n, edges: rec.edges, triangleEdges: rec.tris });
}

// ── σ_Δ matches Python entry-by-entry, for every fixture chart ──────────────
test("sigma matches Python for all fixtures", () => {
  for (const [key, rec] of Object.entries(REF)) {
    const T = fromRef(rec);
    assert.deepEqual(sigma(T), rec.sigma, `sigma mismatch on ${key}`);
    assert.deepEqual(T.internalEdgeIds, rec.internal, `internal ids on ${key}`);
    assert.deepEqual(T.boundaryEdgeIds, rec.boundary, `boundary ids on ${key}`);
    assert.equal(T.isBordered, rec.bordered, `bordered flag on ${key}`);
  }
});

// ── flip(edge).sigma() matches Python, and equals the FZ mutation ───────────
test("flip matches Python and equals quiver mutation", () => {
  for (const [key, rec] of Object.entries(REF)) {
    const T = fromRef(rec);
    for (const [edgeStr, expectedSigma] of Object.entries(rec.flips)) {
      const e = Number(edgeStr);
      const F = flip(T, e);
      assert.deepEqual(sigma(F), expectedSigma, `flip(${e}).sigma on ${key}`);
      assert.deepEqual(sigma(F), mutateMatrix(sigma(T), e), `flip≡mutation at ${e} on ${key}`);
    }
  }
});

// ── flipping the same edge twice restores the chart (up to iso) ─────────────
test("flip is an involution up to combinatorial isomorphism", () => {
  for (const rec of Object.values(REF)) {
    const T = fromRef(rec);
    for (const e of T.internalEdgeIds) {
      if (!canFlip(T, e)) continue;
      const back = flip(flip(T, e), e);
      assert.ok(isomorphic(back, T), `flip² at ${e} not iso to original`);
    }
  }
});

// ── fanPolygon reproduces the Python fan_polygon numbering exactly ──────────
test("fanPolygon matches the p{n} fixtures", () => {
  for (let n = 4; n <= 9; n++) {
    const T = fanPolygon(n);
    const rec = REF[`p${n}`];
    assert.deepEqual(T.edges, rec.edges, `P${n} edges`);
    assert.deepEqual(T.triangleEdges, rec.tris, `P${n} triangles`);
    assert.deepEqual(sigma(T), rec.sigma, `P${n} sigma`);
    assert.equal(T.nTriangles, n - 2);
    assert.equal(T.internalEdgeIds.length, n - 3); // (n−3) diagonals
  }
});

// ── topology / Euler ────────────────────────────────────────────────────────
test("topology: genus and Euler are correct", () => {
  assert.equal(topology(presetByKey("tetrahedron")).genus, 0);
  assert.equal(topology(presetByKey("torus")).genus, 1);
  assert.equal(topology(presetByKey("csaszar")).genus, 1);
  const tet = topology(presetByKey("tetrahedron"));
  assert.equal(tet.chi, tet.V - tet.E + tet.F);
});

// ── puncture classification: regular (interior) vs boundary ─────────────────
test("puncture summary distinguishes regular and irregular punctures", () => {
  // closed sphere: all vertices are regular interior punctures, no boundary
  const tet = punctureSummary(presetByKey("tetrahedron"));
  assert.equal(tet.regular, 4);
  assert.equal(tet.nBoundaries, 0);
  // torus: one regular puncture
  assert.equal(punctureSummary(presetByKey("torus")).regular, 1);
  // a disk polygon: no regular (interior) punctures, one boundary
  const p5 = punctureSummary(presetByKey("p5"));
  assert.equal(p5.regular, 0);
  assert.equal(p5.nBoundaries, 1);
  assert.equal(p5.markedPoints, 5);
});

// ── canonicalForm: reflexive + separates non-isomorphic charts ──────────────
test("canonicalForm is an isomorphism invariant", () => {
  const tet = presetByKey("tetrahedron");
  assert.equal(canonicalForm(tet), canonicalForm(tet));
  assert.ok(isomorphic(tet, tet));
  assert.ok(!isomorphic(tet, presetByKey("bipyramid")));
  assert.ok(!isomorphic(presetByKey("p5"), presetByKey("p6")));
});

// ── validation ──────────────────────────────────────────────────────────────
test("validation flags a self-folded triangle and out-of-range edge", () => {
  const bad = makeTriangulation({ nPunctures: 3, edges: [[0, 1], [1, 2], [0, 2]], triangleEdges: [[0, 0, 1]] });
  assert.equal(validateTriangulation(bad).ok, false);
  const good = presetByKey("p5");
  assert.equal(validateTriangulation(good).ok, true);
});

// ── skein-native round-trip ─────────────────────────────────────────────────
test("triangulation wire round-trips", () => {
  for (const p of PRESETS) {
    const T = p.build();
    const back = parseTriangulationImport(JSON.stringify(toTriangulationWire(T)));
    assert.deepEqual(sigma(back), sigma(T), `round-trip σ on ${p.key}`);
    assert.deepEqual(back.triangleEdges, T.triangleEdges, `round-trip tris on ${p.key}`);
  }
});

// ── BPS-quiver export: B = σ, internal→gauge, boundary→framing ──────────────
test("BPS export exposes σ as the exchange matrix with the right node kinds", () => {
  const T = presetByKey("p6"); // bordered: has framing (boundary) nodes
  const obj = toBpsWireObject(T);
  assert.equal(obj.n, T.nEdges);
  assert.deepEqual(obj.B, sigma(T));
  assert.ok(Array.isArray(obj.kinds));
  for (const e of T.boundaryEdgeIds) assert.equal(obj.kinds[e], "framing");
  for (const e of T.internalEdgeIds) assert.equal(obj.kinds[e], "gauge");
  // closed chart: all gauge, no kinds key needed
  const tet = toBpsWireObject(presetByKey("tetrahedron"));
  assert.equal(tet.kinds, undefined);
  assert.deepEqual(tet.B, sigma(presetByKey("tetrahedron")));
  // the app URL carries the σ-quiver payload in the hash and targets the bps app
  const url = toBpsAppURL(T, "https://example.org/ClusterApplet/bps/");
  assert.match(url, /^https:\/\/example\.org\/ClusterApplet\/bps\/#%7B/);
});

// ── flavour rank = corank of the mutable block ──────────────────────────────
test("mutable block and flavour rank are consistent", () => {
  const T = presetByKey("bipyramid");
  const mb = mutableBlock(T);
  assert.equal(mb.length, T.internalEdgeIds.length);
  assert.ok(flavourRank(T) >= 0);
});
