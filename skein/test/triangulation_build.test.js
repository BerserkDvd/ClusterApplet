import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeTriangulation, sigma, validateTriangulation, isomorphic } from "../src/model/triangulation.js";
import {
  cut, selfGlue, attachTriangle, singleTriangle, addPuncture, removePuncture, freeEdges,
} from "../src/model/triangulation_build.js";
import { presetByKey } from "../src/model/triangulation_presets.js";

const REF = JSON.parse(readFileSync(fileURLToPath(new URL("./triangulation_build_ref.json", import.meta.url))));

function chart(key) {
  const c = REF.charts[key];
  return makeTriangulation({ nPunctures: c.n, edges: c.edges, triangleEdges: c.tris });
}

function runOp(name, T) {
  let m;
  if ((m = name.match(/^cut(\d+)$/))) return cut(T, +m[1]);
  if ((m = name.match(/^selfglue(\d+)_(\d+)$/))) return selfGlue(T, +m[1], +m[2]);
  if ((m = name.match(/^attach(\d+)$/))) return attachTriangle(T, +m[1]);
  throw new Error("unknown op " + name);
}

// ── every Python build op matches (or is rejected) by the JS port ───────────
test("build ops match Python (cut / selfGlue / attach)", () => {
  let checked = 0, rejected = 0;
  for (const o of REF.ops) {
    const T = chart(o.chart);
    if (o.ok) {
      const R = runOp(o.op, T);
      const v = validateTriangulation(R);
      assert.ok(v.ok, `${o.op} on ${o.chart} produced an invalid chart: ${v.errors[0]}`);
      assert.deepEqual(R.edges, o.result.edges, `${o.op}/${o.chart} edges`);
      assert.deepEqual(R.triangleEdges, o.result.tris, `${o.op}/${o.chart} tris`);
      assert.deepEqual(sigma(R), o.result.sigma, `${o.op}/${o.chart} sigma`);
      checked++;
    } else {
      // Python raised — JS must throw OR produce a chart validation flags invalid.
      let bad = false;
      try {
        const R = runOp(o.op, T);
        bad = !validateTriangulation(R).ok;
      } catch { bad = true; }
      assert.ok(bad, `${o.op} on ${o.chart}: Python rejected but JS accepted`);
      rejected++;
    }
  }
  assert.ok(checked >= 30, `expected many checked ops, got ${checked}`);
  assert.ok(rejected >= 1, `expected some rejected ops, got ${rejected}`);
});

// ── attach grows a valid disk; free-edge count behaves ──────────────────────
test("attachTriangle grows the surface by one triangle on a free edge", () => {
  let T = singleTriangle();
  assert.equal(T.nTriangles, 1);
  assert.equal(freeEdges(T).length, 3);
  T = attachTriangle(T, 0);                 // glue onto free edge 0
  assert.equal(T.nTriangles, 2);
  assert.ok(validateTriangulation(T).ok);
  assert.equal(T.internalEdgeIds.length, 1); // the glued edge is now internal
});

// ── selfGlue reduces two free edges to one internal edge ────────────────────
test("selfGlue closes free edges into an internal edge", () => {
  const P5 = presetByKey("p5");
  const bnd = P5.boundaryEdgeIds;
  // glue two NON-adjacent boundary edges (adjacent → self-folded, rejected)
  const R = selfGlue(P5, bnd[0], bnd[2]);
  assert.ok(validateTriangulation(R).ok);
  assert.equal(R.nEdges, P5.nEdges - 1);       // one edge id removed
  assert.ok(R.internalEdgeIds.length > P5.internalEdgeIds.length);
});

// ── surgery: add then remove a puncture returns to the same chart (iso) ──────
// (distinct-vertex triangles — the common case; the centre is the fresh top
// label so removePuncture(A, A.nPunctures−1) undoes it.)
test("addPuncture then removePuncture round-trips (up to iso)", () => {
  for (const key of ["p5", "tetra"]) {
    const T = chart(key);
    const A = addPuncture(T, 0);
    assert.ok(validateTriangulation(A).ok, `addPuncture on ${key} invalid`);
    assert.equal(A.nTriangles, T.nTriangles + 2);
    assert.equal(A.nPunctures, T.nPunctures + 1);   // one new interior puncture
    const back = removePuncture(A, A.nPunctures - 1);
    assert.ok(validateTriangulation(back).ok, `removePuncture on ${key} invalid`);
    assert.ok(isomorphic(back, T), `round-trip on ${key} not iso`);
  }
});

// ── after attach, the polygon layout uses BOUNDARY order (no fold-over) ─────
test("polygon layout places marked points in boundary order, not label order", async () => {
  const { boundaryVertexOrder, polygonLayout } = await import("../src/model/triangulation_layout.js");
  // pentagon + one attached triangle (labels re-derived; boundary ≠ label order)
  const T = makeTriangulation({
    nPunctures: 6,
    edges: [[1, 3], [0, 3], [0, 1], [1, 2], [2, 3], [3, 4], [0, 4], [0, 5], [1, 5]],
    triangleEdges: [[0, 3, 4], [0, 1, 2], [1, 5, 6], [2, 7, 8]],
  });
  const order = boundaryVertexOrder(T);
  assert.equal(order.length, 6);
  // consecutive vertices in the walk are joined by a boundary edge
  const bedges = new Set(T.boundaryEdgeIds.map((e) => T.edges[e].slice().sort((a, b) => a - b).join(",")));
  for (let i = 0; i < order.length; i++) {
    const u = order[i], v = order[(i + 1) % order.length];
    assert.ok(bedges.has([u, v].sort((a, b) => a - b).join(",")), `${u}-${v} not a boundary edge`);
  }
  // no two disjoint drawn chords cross (clean planar embedding)
  const L = polygonLayout(T);
  const cross = (p, q, r, s) => {
    const d = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    return d(p, q, r) !== d(p, q, s) && d(r, s, p) !== d(r, s, q);
  };
  let crossings = 0;
  for (let i = 0; i < L.edges.length; i++) for (let j = i + 1; j < L.edges.length; j++) {
    const a = L.edges[i], b = L.edges[j];
    if (new Set([a.u, a.v, b.u, b.v]).size < 4) continue; // share a vertex
    if (cross([a.x1, a.y1], [a.x2, a.y2], [b.x1, b.y1], [b.x2, b.y2])) crossings++;
  }
  assert.equal(crossings, 0, "polygon chords should not cross");
});

// ── addPuncture is valid even on a one-vertex chart (multi-edge spokes) ──────
test("addPuncture works on a degenerate one-vertex chart (torus)", () => {
  const T = chart("torus");
  const A = addPuncture(T, 0);
  assert.ok(validateTriangulation(A).ok);
  assert.equal(A.nPunctures, 2);
  assert.equal(A.nTriangles, 4);
});
