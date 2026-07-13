// triangulation_build.js — hand construction of triangulations (pure).
//
// Faithful JS port of the repo's gluing primitives (skein_sphere/
// triangulation.py):
//   · attachTriangle(T, e) — glue a fresh triangle onto a free (boundary) edge
//                            e  (= Triangulation.glue with a single triangle);
//   · selfGlue(T, b1, b2)  — glue two free edges of T into one internal edge
//                            (= Triangulation.self_glue);
//   · glue(T1,b1,T2,b2)    — glue a free edge of T1 to a free edge of T2;
//   · cut(T, e)            — un-glue an internal edge into two free edges
//                            (the inverse of selfGlue);
//   · addPuncture(T, ti)   — insert a regular puncture inside triangle ti
//                            (subdivide it into 3);
//   · removePuncture(T, v) — contract a degree-3 interior puncture (the inverse).
//
// Vertex labels are re-derived from the corner orbits of the new gluing exactly
// as Triangulation._rebuild_from_gluing does (an orbit prefers a label common to
// all its corners; falls back to the smallest seen; mints a fresh label when all
// are claimed — the split-vertex case).  Every result is a normalized
// makeTriangulation, so σ / flip / puncture census work unchanged.

import { makeTriangulation, validateTriangulation, cornerVertex } from "./triangulation.js";

// build a normalized triangulation and reject an invalid result (so gluing ops
// throw exactly where the Python primitives raise — self-folded / bad Euler).
function finish(spec) {
  const T = makeTriangulation(spec);
  const v = validateTriangulation(T);
  if (!v.ok) throw new Error(v.errors[0]);
  return T;
}

// ── corner orbits on raw gluing data (mirrors Triangulation._corner_orbits) ──
function cornerOrbitsRaw(triangleEdges, edgeIncidences) {
  const F = triangleEdges.length;
  const step = new Map();
  const key = (ti, k) => `${ti},${k}`;
  for (let ti = 0; ti < F; ti++) {
    const te = triangleEdges[ti];
    for (let k = 0; k < 3; k++) {
      const posOut = (k + 2) % 3;
      const inc = edgeIncidences[te[posOut]];
      if (inc.length === 1) { step.set(key(ti, k), null); continue; }
      const [[t1, p1], [t2, p2]] = inc;
      const [tj, pj] = (t1 === ti && p1 === posOut) ? [t2, p2] : [t1, p1];
      step.set(key(ti, k), [tj, (pj - 1 + 3) % 3]);
    }
  }
  const corners = [];
  for (let ti = 0; ti < F; ti++) for (let k = 0; k < 3; k++) corners.push([ti, k]);
  const targets = new Set();
  for (const v of step.values()) if (v) targets.add(key(v[0], v[1]));
  const seen = new Set();
  const orbits = [];
  const walkFrom = (start) => {
    const orb = []; let cur = start;
    while (cur !== null && !seen.has(cur)) {
      seen.add(cur); orb.push(cur.split(",").map(Number));
      const nx = step.get(cur); cur = nx ? key(nx[0], nx[1]) : null;
    }
    return orb;
  };
  // chains first (a corner nobody steps into), then cycles — matches Python
  for (const [ti, k] of corners) { const s = key(ti, k); if (!seen.has(s) && !targets.has(s)) orbits.push(walkFrom(s)); }
  for (const [ti, k] of corners) {
    const s = key(ti, k); if (seen.has(s)) continue;
    const orb = []; let cur = s;
    while (!seen.has(cur)) { seen.add(cur); orb.push(cur.split(",").map(Number)); const nx = step.get(cur); if (!nx) break; cur = key(nx[0], nx[1]); }
    orbits.push(orb);
  }
  return orbits;
}

function incidencesOf(triangleEdges, nEdges) {
  const inc = Array.from({ length: nEdges }, () => []);
  triangleEdges.forEach((te, ti) => te.forEach((ei, pos) => { if (ei >= 0 && ei < nEdges) inc[ei].push([ti, pos]); }));
  return inc;
}

// tuple-min of an orbit (numeric [ti,k] comparison)
function orbitMin(orb) {
  return orb.reduce((m, c) => (c[0] < m[0] || (c[0] === m[0] && c[1] < m[1]) ? c : m));
}
const setInter = (a, b) => new Set([...a].filter((x) => b.has(x)));

// ── the core: re-derive labels from corner orbits (mirrors _rebuild_from_gluing)
function rebuildFromGluing(triangleEdges, oldEndLabels, freshStart, name) {
  const nEdges = oldEndLabels.length;
  const newInc = incidencesOf(triangleEdges, nEdges);
  let orbits = cornerOrbitsRaw(triangleEdges, newInc);
  orbits = orbits.slice().sort((A, B) => { const a = orbitMin(A), b = orbitMin(B); return a[0] - b[0] || a[1] - b[1]; });

  const candsInt = [], candsUni = [];
  for (const orb of orbits) {
    let ci = null; const cu = new Set();
    for (const [ti, k] of orb) {
      const eIn = oldEndLabels[triangleEdges[ti][(k + 1) % 3]];
      const eOut = oldEndLabels[triangleEdges[ti][(k + 2) % 3]];
      const local = setInter(eIn, eOut);
      ci = ci === null ? local : setInter(ci, local);
      for (const x of local) cu.add(x);
    }
    candsInt.push(ci || new Set());
    candsUni.push(cu);
  }
  const labelOf = new Array(orbits.length).fill(-1);
  const claimed = new Set();
  let fresh = freshStart;
  let changed = true;
  while (changed) {
    changed = false;
    for (let oi = 0; oi < orbits.length; oi++) {
      if (labelOf[oi] >= 0) continue;
      const free = [...candsInt[oi]].filter((x) => !claimed.has(x));
      if (free.length === 1) { labelOf[oi] = free[0]; claimed.add(free[0]); changed = true; }
    }
  }
  for (let oi = 0; oi < orbits.length; oi++) {
    if (labelOf[oi] >= 0) continue;
    let free = [...candsInt[oi]].filter((x) => !claimed.has(x));
    if (free.length === 0) free = [...candsUni[oi]].filter((x) => !claimed.has(x));
    if (free.length > 0) labelOf[oi] = Math.min(...free);
    else labelOf[oi] = fresh++;
    claimed.add(labelOf[oi]);
  }
  // compress labels to 0..V-1 preserving order
  const order = [...new Set(labelOf)].sort((a, b) => a - b);
  const remap = new Map(order.map((l, i) => [l, i]));
  const labels = labelOf.map((l) => remap.get(l));
  const orbitOf = new Map();
  orbits.forEach((orb, oi) => orb.forEach(([ti, k]) => orbitOf.set(`${ti},${k}`, oi)));
  const newEdges = [];
  for (let ei = 0; ei < nEdges; ei++) {
    const [ti, p] = newInc[ei][0];
    const u = labels[orbitOf.get(`${ti},${(p + 1) % 3}`)];
    const v = labels[orbitOf.get(`${ti},${(p - 1 + 3) % 3}`)];
    newEdges.push([Math.min(u, v), Math.max(u, v)]);
  }
  return finish({ name, nPunctures: orbits.length, edges: newEdges, triangleEdges });
}

// ── free (boundary) edges ────────────────────────────────────────────────────
export function freeEdges(T) { return T.boundaryEdgeIds.slice(); }

// ── cut: un-glue an internal edge (inverse of selfGlue) ──────────────────────
export function cut(T, edge) {
  const inc = T.edgeIncidences[edge];
  if (!inc || inc.length !== 2) throw new Error(`edge ${edge} is already a boundary edge`);
  const [, [t2, p2]] = inc;
  const newId = T.nEdges;
  const newTris = T.triangleEdges.map((te) => [...te]);
  newTris[t2][p2] = newId;
  const oldEnds = T.edges.map((e) => new Set(e)).concat([new Set(T.edges[edge])]);
  return rebuildFromGluing(newTris, oldEnds, T.nPunctures, T.name);
}

// ── selfGlue: glue two free edges into one internal edge ─────────────────────
export function selfGlue(T, b1, b2) {
  if (b1 === b2) throw new Error("cannot glue a boundary edge to itself");
  for (const b of [b1, b2]) if (T.edgeIncidences[b]?.length !== 1) throw new Error(`edge ${b} is not a free (boundary) edge`);
  return selfGlueRaw(T.triangleEdges, T.edges, b1, b2, T.nPunctures, T.name);
}

// raw self-glue on (triangleEdges, edges[[u,v]], nPunctures)
function selfGlueRaw(triangleEdges, edges, b1, b2, nPunctures, name) {
  const keep = Math.min(b1, b2), drop = Math.max(b1, b2);
  const renum = (e) => (e === drop ? keep : e > drop ? e - 1 : e);
  const newTris = triangleEdges.map((te) => te.map(renum));
  const oldEnds = [];
  for (let ei = 0; ei < edges.length; ei++) {
    if (ei === drop) continue;
    let s = new Set(edges[ei]);
    if (ei === keep) { const d = edges[drop]; s = new Set([...s, ...d]); }
    oldEnds.push(s);
  }
  return rebuildFromGluing(newTris, oldEnds, nPunctures, name);
}

// ── glue: glue a free edge of T1 to a free edge of T2 (disjoint charts) ──────
export function glue(T1, b1, T2, b2) {
  for (const [T, b] of [[T1, b1], [T2, b2]]) if (T.edgeIncidences[b]?.length !== 1) throw new Error(`edge ${b} is not a free (boundary) edge`);
  const offE = T1.nEdges, offV = T1.nPunctures;
  const tris = T1.triangleEdges.map((te) => [...te]).concat(T2.triangleEdges.map((te) => te.map((e) => e + offE)));
  const edges = T1.edges.map((e) => [...e]).concat(T2.edges.map((e) => [e[0] + offV, e[1] + offV]));
  return selfGlueRaw(tris, edges, b1, b2 + offE, T1.nPunctures + T2.nPunctures, T1.name);
}

// ── the seed + attach-a-triangle ─────────────────────────────────────────────
export function singleTriangle(name = "Triangle") {
  return makeTriangulation({ name, nPunctures: 3, edges: [[0, 1], [1, 2], [0, 2]], triangleEdges: [[0, 1, 2]], kind: "bordered" });
}

// Glue a fresh triangle onto free edge `e` of T (its apex is a new vertex; the
// triangle's other two sides become new free edges).
export function attachTriangle(T, e) {
  if (T.edgeIncidences[e]?.length !== 1) throw new Error(`edge ${e} is not a free edge`);
  return glue(T, e, singleTriangle(), 0);
}

// ── surgery: add / remove a regular (interior) puncture ─────────────────────
// Insert a vertex at the centre of triangle `ti`, joined to its 3 corners:
// replaces 1 triangle by 3 and adds a regular (interior) puncture.  Built
// DIRECTLY — the centre takes the fresh top label `T.nPunctures`, so no
// relabelling is needed (χ preserved).
export function addPuncture(T, ti) {
  if (ti < 0 || ti >= T.nTriangles) throw new Error(`no triangle ${ti}`);
  const [e0, e1, e2] = T.triangleEdges[ti];
  const w0 = cornerVertex(T, ti, 0), w1 = cornerVertex(T, ti, 1), w2 = cornerVertex(T, ti, 2);
  if (w0 < 0 || w1 < 0 || w2 < 0) {
    throw new Error(`triangle ${ti} has undetermined corners; cannot add a puncture here`);
  }
  // (corners may coincide — e.g. a one-vertex chart — giving multi-edge spokes)
  const centre = T.nPunctures;          // fresh top label
  const c = T.nEdges;                    // spoke ids c (→w0), c+1 (→w1), c+2 (→w2)
  const newEdges = T.edges.map((e) => [...e]).concat([
    [Math.min(centre, w0), Math.max(centre, w0)],
    [Math.min(centre, w1), Math.max(centre, w1)],
    [Math.min(centre, w2), Math.max(centre, w2)],
  ]);
  const newTris = T.triangleEdges.map((te) => [...te]);
  // ccw sub-triangles: on e0 (w1–w2) → (s1, e0, s2), on e1 (w2–w0) → (s2, e1, s0),
  // on e2 (w0–w1) → (s0, e2, s1).  s_k = spoke c+k.
  newTris[ti] = [c + 1, e0, c + 2];
  newTris.push([c + 2, e1, c]);
  newTris.push([c, e2, c + 1]);
  return finish({ name: T.name, nPunctures: T.nPunctures + 1, edges: newEdges, triangleEdges: newTris });
}

// Remove a regular puncture: contract a degree-3 interior vertex `v` (three
// triangles meeting at it in a fan) back into one triangle — the inverse of
// addPuncture.  Built directly: drop the three spokes, merge the fan into the
// outer rim triangle, relabel vertices to skip `v`.
export function removePuncture(T, v) {
  const corners = [];
  T.triangleEdges.forEach((te, ti) => {
    for (let k = 0; k < 3; k++) if (cornerVertex(T, ti, k) === v) corners.push([ti, k]);
  });
  const triIdx = [...new Set(corners.map((c) => c[0]))];
  if (corners.length !== 3 || triIdx.length !== 3) {
    throw new Error(`vertex ${v} is not a removable degree-3 interior puncture`);
  }
  // rim edge of each fan triangle = the slot opposite v (slot k); spokes = the
  // other two edges of each triangle.
  const rim = corners.map(([ti, k]) => T.triangleEdges[ti][k]);
  if (new Set(rim).size !== 3) throw new Error(`vertex ${v} fan is degenerate (repeated rim edge)`);
  const spokes = new Set();
  for (const [ti] of corners) for (const ei of T.triangleEdges[ti]) if (!rim.includes(ei)) spokes.add(ei);
  if (spokes.size !== 3) throw new Error(`vertex ${v} fan is degenerate (spoke count ${spokes.size})`);
  // merged triangle = the three rim edges (ccw order taken from the fan)
  const keepTri = Math.min(...triIdx);
  const mergedTris = [];
  T.triangleEdges.forEach((te, ti) => {
    if (ti === keepTri) mergedTris.push(rim.slice());
    else if (!triIdx.includes(ti)) mergedTris.push([...te]);
  });
  // drop spoke edges; relabel remaining edge ids
  const edgeRemap = new Map();
  const keepEdges = [];
  T.edges.forEach((e, ei) => { if (!spokes.has(ei)) { edgeRemap.set(ei, keepEdges.length); keepEdges.push([...e]); } });
  const remTris = mergedTris.map((te) => te.map((e) => edgeRemap.get(e)));
  // relabel vertices to skip v
  const relabel = (x) => (x > v ? x - 1 : x);
  const remEdges = keepEdges.map(([a, b]) => { const p = relabel(a), q = relabel(b); return [Math.min(p, q), Math.max(p, q)]; });
  return finish({ name: T.name, nPunctures: T.nPunctures - 1, edges: remEdges, triangleEdges: remTris });
}
