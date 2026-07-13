// triangulation_layout.js — geometry for drawing a triangulation (pure).
//
// Three complementary layouts, none of which touch K-algebra math:
//
//   · polygonLayout(T)   — for a disk with n boundary marked points: the honest
//                          n-gon (marked points on a circle, chords).  Diagonals
//                          are the flippable internal edges.
//   · developedLayout(T) — for a CLOSED chart: unfold the triangles into the
//                          plane along a spanning tree; tree edges become
//                          interior segments, every non-tree edge appears twice
//                          on the boundary as an IDENTIFIED side-pair (the
//                          "fundamental polygon with identified sides" picture —
//                          e.g. the torus as a square with opposite sides glued).
//   · quiverLayout(T)    — the dual exchange quiver of σ_Δ (nodes = edges,
//                          arrows = σ): always planar, the BPS-quiver picture.
//
// The consuming canvas fits whichever layout to its viewport.

import { sigma, cornerVertex, vertices } from "./triangulation.js";

// ── vector helpers ─────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
function reflect(P, A, B) {
  // reflection of P across the line through A, B
  const d = sub(B, A);
  const t = dot(sub(P, A), d) / (dot(d, d) || 1e-9);
  const proj = add(A, mul(d, t));
  return sub(mul(proj, 2), P);
}
function centroid(pts) {
  const s = pts.reduce((a, p) => add(a, p), [0, 0]);
  return mul(s, 1 / pts.length);
}

// ── which view fits ─────────────────────────────────────────────────────────

// A chart draws as an honest polygon iff it is a disk: bordered, one boundary
// circle, no self-loops, every vertex on the boundary.
export function isSimplePolygon(T) {
  if (!T.isBordered) return false;
  if (T.edges.some((e) => e[0] === e[1])) return false;
  const vs = vertices(T);
  return vs.every((v) => !v.regular); // all vertices are boundary marked points
}

export function defaultView(T) {
  if (isSimplePolygon(T)) return "polygon";
  if (!T.isBordered && T.nTriangles > 0) return "developed";
  return "quiver";
}

// ── polygon (disk) layout ────────────────────────────────────────────────────

export function polygonLayout(T, { R = 150, cx = 0, cy = 0 } = {}) {
  const n = T.nPunctures;
  const pos = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n; // vertex 0 at top, ccw
    pos.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  const verts = pos.map((p, i) => ({ id: i, x: p[0], y: p[1] }));
  const bset = new Set(T.boundaryEdgeIds);
  const edges = T.edges.map((e, id) => ({
    id, u: e[0], v: e[1],
    x1: pos[e[0]][0], y1: pos[e[0]][1], x2: pos[e[1]][0], y2: pos[e[1]][1],
    boundary: bset.has(id), internal: !bset.has(id),
  }));
  const triangles = T.triangleEdges.map((te, ti) => {
    const cs = [0, 1, 2].map((k) => cornerVertex(T, ti, k)).filter((v) => v >= 0);
    const c = centroid([...new Set(cs)].map((v) => pos[v]));
    return { id: ti, cx: c[0], cy: c[1], corners: cs };
  });
  return { kind: "polygon", verts, edges, triangles };
}

// ── developed (unfolded) layout with identified sides ───────────────────────

export function developedLayout(T, { s = 90 } = {}) {
  const F = T.nTriangles;
  const placed = new Array(F).fill(null); // per triangle: [P0, P1, P2] corner points
  const treeEdge = new Set();             // edge ids used as unfolding (tree) edges
  // base triangle: equilateral, slot0 = C1-C2, slot1 = C2-C0, slot2 = C0-C1
  const h = (s * Math.sqrt(3)) / 2;
  const C0 = [0, 0], C1 = [s, 0], C2 = [s / 2, -h];
  const startTri = 0;
  placed[startTri] = [C0, C1, C2];
  const queue = [startTri];
  let head = 0;
  while (head < queue.length) {
    const ti = queue[head++];
    const te = T.triangleEdges[ti];
    const P = placed[ti];
    for (let sSlot = 0; sSlot < 3; sSlot++) {
      const edge = te[sSlot];
      const inc = T.edgeIncidences[edge];
      if (inc.length !== 2) continue; // boundary: nothing to unfold
      const other = inc[0][0] === ti && inc[0][1] === sSlot ? inc[1] : inc[0];
      const [tj, sj] = other;
      if (placed[tj]) continue;
      // shared edge endpoints in ti: corners (s+1),(s+2); orientation reverses
      const Pa = P[(sSlot + 1) % 3], Pb = P[(sSlot + 2) % 3];
      const Q = [null, null, null];
      Q[(sj + 1) % 3] = Pb;
      Q[(sj + 2) % 3] = Pa;
      Q[sj] = reflect(P[sSlot], Pa, Pb);
      placed[tj] = Q;
      treeEdge.add(edge);
      queue.push(tj);
    }
  }
  // assemble sides
  const sides = [];
  const interiorDrawn = new Set();
  for (let ti = 0; ti < F; ti++) {
    if (!placed[ti]) continue;
    const te = T.triangleEdges[ti];
    const P = placed[ti];
    for (let sSlot = 0; sSlot < 3; sSlot++) {
      const edge = te[sSlot];
      const A = P[(sSlot + 1) % 3], B = P[(sSlot + 2) % 3];
      const inc = T.edgeIncidences[edge];
      let role;
      if (inc.length === 1) role = "boundary";
      else if (treeEdge.has(edge)) {
        if (interiorDrawn.has(edge)) continue; // draw the shared segment once
        interiorDrawn.add(edge);
        role = "interior";
      } else role = "identified";
      sides.push({ edge, ti, slot: sSlot, x1: A[0], y1: A[1], x2: B[0], y2: B[1], role });
    }
  }
  const triangles = [];
  for (let ti = 0; ti < F; ti++) {
    if (!placed[ti]) continue;
    const c = centroid(placed[ti]);
    triangles.push({ id: ti, cx: c[0], cy: c[1], pts: placed[ti] });
  }
  // identification pairs: edge id -> the two identified sides (for matching color)
  const idPairs = {};
  for (const sd of sides) {
    if (sd.role !== "identified") continue;
    (idPairs[sd.edge] = idPairs[sd.edge] || []).push(sd);
  }
  return { kind: "developed", sides, triangles, idPairs, placedCount: placed.filter(Boolean).length, totalTriangles: F };
}

// ── dual exchange-quiver layout (force-directed on the edge graph) ──────────

export function quiverLayout(T, { width = 520, height = 420, iterations = 320, spacing = 96 } = {}) {
  const S = sigma(T);
  const n = T.nEdges;
  const bset = new Set(T.boundaryEdgeIds);
  // seed on a circle
  let pos = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
    pos.push([width / 2 + 120 * Math.cos(a), height / 2 + 120 * Math.sin(a)]);
  }
  const links = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (S[i][j] !== 0) links.push([i, j]);
  const k = spacing; let temp = k * 2;
  for (let it = 0; it < iterations && n > 1; it++) {
    const disp = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (k * k) / d;
      disp[i][0] += (dx / d) * f; disp[i][1] += (dy / d) * f;
    }
    for (const [i, j] of links) {
      const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      disp[i][0] -= (dx / d) * f; disp[i][1] -= (dy / d) * f;
      disp[j][0] += (dx / d) * f; disp[j][1] += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      const dl = Math.hypot(disp[i][0], disp[i][1]) || 0.01;
      pos[i][0] += (disp[i][0] / dl) * Math.min(dl, temp);
      pos[i][1] += (disp[i][1] / dl) * Math.min(dl, temp);
    }
    temp = Math.max(temp * 0.97, 1);
  }
  const nodes = pos.map((p, i) => ({ id: i, x: p[0], y: p[1], boundary: bset.has(i) }));
  const arrows = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const v = S[i][j];
    if (v > 0) arrows.push({ from: i, to: j, mult: v });
    else if (v < 0) arrows.push({ from: j, to: i, mult: -v });
  }
  return { kind: "quiver", nodes, arrows };
}

// ── fit a set of points to a viewBox ────────────────────────────────────────
export function boundsOf(points, pad = 40) {
  if (!points.length) return { x: 0, y: 0, w: 100, h: 100 };
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  return { x: minx - pad, y: miny - pad, w: (maxx - minx) + 2 * pad, h: (maxy - miny) + 2 * pad };
}
