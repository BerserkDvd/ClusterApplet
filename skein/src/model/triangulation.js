// triangulation.js — ideal triangulations of marked surfaces (pure, framework-free).
//
// A faithful JS mirror of the repo's `skein_sphere/triangulation.py` FST datum.
// A triangulation is the combinatorial gluing
//
//     nPunctures     number of vertices (punctures / marked points)
//     edges          list of [u, v] endpoint pairs (self-loops u==v and
//                    multi-edges allowed)
//     triangleEdges  list of [e0, e1, e2] — each triangle is a triple of edge
//                    indices in ccw order
//
// This one datum represents ALL ideal triangulations — closed spheres,
// higher-genus, punctured, and bordered (disk/polygon) surfaces — exactly as
// the Python `Triangulation` / `Triangulation.from_edge_data` do.  Closed
// charts have every edge in exactly two triangles; bordered charts have
// boundary edges in exactly one.
//
// The three structural operations that drive the skein↔BPS bridge are all
// here and need ONLY the combinatorics (no vertex labels):
//   · sigma(T)          — the antisymmetric exchange matrix σ_Δ = the BPS Dirac
//                         pairing of A_𝖖[T[A₁, Σ]] on this chart;
//   · flip(T, e)        — the diagonal flip at internal edge e, index-aligned
//                         with quiver mutation: sigma(flip(T,e)) == μ_e(sigma(T));
//   · canonicalForm(T)  — a combinatorial-isomorphism invariant (puncture
//                         labels ignored).
//
// Vertex labels (edge endpoints) are used only for the geometric polygon
// rendering and the puncture flavour charge; the corner vertex is the shared
// endpoint of its two adjacent edges.
//
// This module is input + combinatorics only: NO K-algebra math (multiply,
// trace, verifiers) — the real `SkeinKAlgebra` owns that, reached via Pyodide.

// ── Construction / normalization ──────────────────────────────────────────

// Build a normalized triangulation from loose fields (a preset or an import).
// Derives the edge incidences and boundary/internal split.
export function makeTriangulation(spec = {}) {
  const nPunctures = Math.trunc(Number(spec.nPunctures ?? spec.n_punctures ?? 0));
  const edges = (spec.edges || []).map((e) => [Math.trunc(Number(e[0])), Math.trunc(Number(e[1]))]);
  const triangleEdges = (spec.triangleEdges || spec.triangle_edges || []).map((t) => [
    Math.trunc(Number(t[0])), Math.trunc(Number(t[1])), Math.trunc(Number(t[2])),
  ]);
  const name = typeof spec.name === "string" && spec.name.trim() ? spec.name.trim() : "Untitled surface";
  const kind = spec.kind === "bordered" || spec.kind === "closed" ? spec.kind : undefined;
  return withDerived({ name, nPunctures, edges, triangleEdges, kind });
}

export function emptyTriangulation() {
  return withDerived({ name: "Untitled surface", nPunctures: 0, edges: [], triangleEdges: [] });
}

export function cloneTriangulation(T) {
  return withDerived({
    name: T.name,
    nPunctures: T.nPunctures,
    edges: T.edges.map((e) => [...e]),
    triangleEdges: T.triangleEdges.map((t) => [...t]),
    kind: T.kind,
  });
}

// Recompute all derived fields.  `edgeIncidences[e]` = list of [triangle, slot]
// (slot 0..2) where edge e appears; boundary edges have one incidence, internal
// edges have two.
function withDerived(T) {
  const nEdges = T.edges.length;
  const edgeIncidences = Array.from({ length: nEdges }, () => []);
  T.triangleEdges.forEach((te, ti) => {
    te.forEach((ei, pos) => {
      if (ei >= 0 && ei < nEdges) edgeIncidences[ei].push([ti, pos]);
    });
  });
  const boundaryEdgeIds = [];
  const internalEdgeIds = [];
  for (let e = 0; e < nEdges; e++) {
    if (edgeIncidences[e].length === 1) boundaryEdgeIds.push(e);
    else if (edgeIncidences[e].length === 2) internalEdgeIds.push(e);
  }
  const bordered = boundaryEdgeIds.length > 0;
  return {
    ...T,
    kind: T.kind || (bordered ? "bordered" : "closed"),
    nEdges,
    nTriangles: T.triangleEdges.length,
    edgeIncidences,
    boundaryEdgeIds,
    internalEdgeIds,
    isBordered: bordered,
  };
}

// ── Euler / topology ──────────────────────────────────────────────────────

// V − E + F, and the closed-surface genus when applicable.  Bordered charts
// have χ = number of boundary components − (…); we report the raw χ and only
// claim a genus for closed charts (every edge internal, χ = 2 − 2g).
export function topology(T) {
  const V = T.nPunctures, E = T.nEdges, F = T.nTriangles;
  const chi = V - E + F;
  const closed = !T.isBordered && E > 0;
  const genus = closed && chi <= 2 && chi % 2 === 0 ? (2 - chi) / 2 : null;
  return { V, E, F, chi, closed, genus };
}

// ── The exchange matrix σ_Δ ───────────────────────────────────────────────
//
// σ(e, f) = (# triangles where f follows e ccw) − (# triangles where e follows
// f ccw).  Antisymmetric; the internal×internal principal block is the BPS
// Dirac pairing (boundary edges are frozen).  Matches Triangulation.sigma().
export function sigma(T) {
  const n = T.nEdges;
  const s = Array.from({ length: n }, () => Array(n).fill(0));
  for (const te of T.triangleEdges) {
    for (let pos = 0; pos < 3; pos++) {
      const ei = te[pos], ej = te[(pos + 1) % 3];
      s[ei][ej] += 1;
      s[ej][ei] -= 1;
    }
  }
  return s;
}

// The internal×internal principal block of σ — the mutable BPS quiver.
export function mutableBlock(T) {
  const s = sigma(T);
  const idx = T.internalEdgeIds;
  return idx.map((i) => idx.map((j) => s[i][j]));
}

// ── Corner vertices ───────────────────────────────────────────────────────
//
// The puncture at corner k of triangle ti sits between the edges at ccw slots
// k+1 and k+2 — so it is their shared endpoint.  Unambiguous on polygon/disk
// charts (used for geometric rendering and flip endpoints); may be ambiguous
// with self-loops/multi-edges, where it returns the first shared endpoint.
export function cornerVertex(T, ti, k) {
  const te = T.triangleEdges[ti];
  const e1 = T.edges[te[(k + 1) % 3]];
  const e2 = T.edges[te[(k + 2) % 3]];
  if (e1 && e2) {
    if (e1[0] === e2[0] || e1[0] === e2[1]) return e1[0];
    if (e1[1] === e2[0] || e1[1] === e2[1]) return e1[1];
  }
  return -1;
}

// ── Vertices as corner orbits — regular vs irregular punctures ────────────
//
// A vertex is the orbit of a corner under the walk around it: from corner k of
// triangle ti, cross the OUTGOING edge (ccw slot k+2) into its other incidence
// (tj, pj) and land on corner (pj−1)%3 of tj.  At a boundary edge the walk
// terminates, so orbits come in two kinds (mirrors Triangulation._corner_orbits):
//   · CYCLES  = interior vertices  = REGULAR punctures (carry a flavour charge
//               in ker σ, a flavour SU(2)/U(1) of the class-S theory);
//   · CHAINS  = boundary vertices  = the marked points of IRREGULAR punctures
//               (an n-boundary / hole; rank = (#marked points on it)/2).
// Uses only the combinatorics — no vertex labels.
export function cornerOrbits(T) {
  const step = new Map(); // "ti,k" -> [tj,k'] | null
  const key = (ti, k) => `${ti},${k}`;
  for (let ti = 0; ti < T.nTriangles; ti++) {
    const te = T.triangleEdges[ti];
    for (let k = 0; k < 3; k++) {
      const posOut = (k + 2) % 3;
      const inc = T.edgeIncidences[te[posOut]];
      if (inc.length === 1) { step.set(key(ti, k), null); continue; }
      const [[t1, p1], [t2, p2]] = inc;
      const [tj, pj] = (t1 === ti && p1 === posOut) ? [t2, p2] : [t1, p1];
      step.set(key(ti, k), [tj, (pj - 1 + 3) % 3]);
    }
  }
  const corners = [...step.keys()].sort(); // (ti,k) as strings sort lexically enough for small charts
  const targets = new Set();
  for (const v of step.values()) if (v) targets.add(key(v[0], v[1]));
  const seen = new Set();
  const orbits = [], isChain = [];
  const walk = (start) => {
    const orb = []; let cur = start;
    while (cur !== null && !seen.has(cur)) {
      seen.add(cur); orb.push(cur);
      const nx = step.get(cur);
      cur = nx ? key(nx[0], nx[1]) : null;
    }
    return orb;
  };
  // chains: a corner nobody steps into (chain start) and not yet seen
  for (const s of corners) {
    if (seen.has(s) || targets.has(s)) continue;
    orbits.push(walk(s).map(parseCorner)); isChain.push(true);
  }
  // cycles: everything left
  for (const c of corners) {
    if (seen.has(c)) continue;
    const orb = []; let cur = c;
    while (!seen.has(cur)) { seen.add(cur); orb.push(cur); const nx = step.get(cur); cur = nx ? key(nx[0], nx[1]) : null; if (cur === null) break; }
    orbits.push(orb.map(parseCorner)); isChain.push(false);
  }
  return { orbits, isChain };
}
function parseCorner(s) { const [a, b] = s.split(",").map(Number); return [a, b]; }

// Vertex classification for display: one entry per corner orbit.
//   { corners, regular (interior cycle?), incidentEdges }
// Regular = interior puncture ●; non-regular = boundary marked point of an
// irregular puncture / n-boundary.
export function vertices(T) {
  const { orbits, isChain } = cornerOrbits(T);
  return orbits.map((orb, i) => {
    const incident = new Set();
    for (const [ti, k] of orb) {
      const te = T.triangleEdges[ti];
      incident.add(te[(k + 1) % 3]); // the edge ending at this corner
      incident.add(te[(k + 2) % 3]); // the edge starting at this corner
    }
    return { corners: orb, regular: !isChain[i], incidentEdges: [...incident].sort((a, b) => a - b) };
  });
}

// Counts for the panel: regular (interior) punctures, boundary marked points,
// and boundary components ("n-boundaries" / holes) with their marked-point count.
export function punctureSummary(T) {
  const vs = vertices(T);
  const regular = vs.filter((v) => v.regular).length;
  const markedPoints = vs.filter((v) => !v.regular).length;
  const boundaryComponents = countBoundaryComponents(T);
  return { regular, markedPoints, boundaryComponents, nBoundaries: boundaryComponents.length };
}

// Boundary components (holes / n-boundaries).  Two boundary edges belong to
// the same boundary circle iff they meet at a boundary marked point — i.e. a
// corner CHAIN incident to both.  We union boundary edges through the chains
// and count components.  `marks` = number of boundary edges on the circle =
// the number of marked points on it (a boundary circle alternates edges and
// marked points).
function countBoundaryComponents(T) {
  const bnd = T.boundaryEdgeIds;
  if (bnd.length === 0) return [];
  const bset = new Set(bnd);
  const { orbits, isChain } = cornerOrbits(T);
  const parent = {};
  for (const e of bnd) parent[e] = e;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { parent[find(a)] = find(b); };
  for (let i = 0; i < orbits.length; i++) {
    if (!isChain[i]) continue; // only boundary marked points link boundary edges
    const inc = [];
    for (const [ti, k] of orbits[i]) {
      const te = T.triangleEdges[ti];
      for (const ei of [te[(k + 1) % 3], te[(k + 2) % 3]]) if (bset.has(ei)) inc.push(ei);
    }
    for (let j = 1; j < inc.length; j++) union(inc[0], inc[j]);
  }
  const comps = {};
  for (const e of bnd) { const r = find(e); (comps[r] = comps[r] || new Set()).add(e); }
  return Object.values(comps).map((set) => ({ edges: [...set].sort((a, b) => a - b), marks: set.size }));
}

// ── The diagonal flip ─────────────────────────────────────────────────────
//
// Replaces internal edge `edge` by the other diagonal of its quadrilateral,
// REUSING the same edge index so the flip is index-aligned with quiver mutation
// at node `edge`:  sigma(flip(T, e)) == μ_e(sigma(T)).  Mirrors
// Triangulation.flip.  Throws on a boundary edge or a self-folded configuration.
export function flip(T, edge) {
  const inc = T.edgeIncidences[edge];
  if (!inc || inc.length !== 2) {
    throw new Error(`edge ${edge} is not internal (cannot flip)`);
  }
  const [[t1, p1], [t2, p2]] = inc;
  const te1 = T.triangleEdges[t1], te2 = T.triangleEdges[t2];
  const a = te1[(p1 + 1) % 3], b = te1[(p1 + 2) % 3];
  const c = te2[(p2 + 1) % 3], d = te2[(p2 + 2) % 3];
  if (b === c || d === a) {
    throw new Error(`flip at edge ${edge} would create a self-folded triangle (out of scope)`);
  }
  // new diagonal joins the corners opposite `edge` in the two triangles
  const u = cornerVertex(T, t1, p1);
  const v = cornerVertex(T, t2, p2);
  const newEdges = T.edges.map((e) => [...e]);
  if (u >= 0 && v >= 0) newEdges[edge] = [Math.min(u, v), Math.max(u, v)];
  const newTris = T.triangleEdges.map((t) => [...t]);
  newTris[t1] = [edge, b, c];
  newTris[t2] = [edge, d, a];
  return withDerived({
    name: T.name, nPunctures: T.nPunctures, edges: newEdges, triangleEdges: newTris, kind: T.kind,
  });
}

export function canFlip(T, edge) {
  try { flip(T, edge); return true; } catch { return false; }
}

// ── Combinatorial-isomorphism canonical form ──────────────────────────────
//
// The minimum, over every (start triangle, rotation), of the BFS
// discovery-order relabelling of triangleEdges.  Two triangulations are
// combinatorially isomorphic (orientation-preserving; puncture labels ignored)
// iff their canonical forms are equal.  Mirrors Triangulation.canonical_form.
export function canonicalForm(T) {
  const tris = T.triangleEdges;
  const inc = T.edgeIncidences;
  let best = null;
  for (let t0 = 0; t0 < tris.length; t0++) {
    for (let rot = 0; rot < 3; rot++) {
      const edgeLab = new Map();
      const triLab = new Map([[t0, 0]]);
      const startRot = new Map([[t0, rot]]);
      const queue = [t0];
      const order = [];
      const elab = (e) => {
        if (!edgeLab.has(e)) edgeLab.set(e, edgeLab.size);
        return edgeLab.get(e);
      };
      let head = 0;
      while (head < queue.length) {
        const ti = queue[head++];
        const r = startRot.get(ti);
        const te = tris[ti];
        order.push([0, 1, 2].map((i) => elab(te[(r + i) % 3])));
        for (let i = 0; i < 3; i++) {
          const e = te[(r + i) % 3];
          for (const [tj, pj] of inc[e]) {
            if (tj === ti && pj === (r + i) % 3) continue;
            if (!triLab.has(tj)) {
              triLab.set(tj, triLab.size);
              startRot.set(tj, pj);
              queue.push(tj);
            }
          }
        }
      }
      const enc = JSON.stringify(order);
      if (best === null || enc < best) best = enc;
    }
  }
  return best;
}

export function isomorphic(A, B) {
  return canonicalForm(A) === canonicalForm(B);
}

// ── Structural edits (immutable) ──────────────────────────────────────────

export function renameTriangulation(T, name) {
  return { ...cloneTriangulation(T), name };
}

// Apply a sequence of flips [e0, e1, …] to a base triangulation.
export function applyFlips(base, seq) {
  return seq.reduce((T, e) => flip(T, e), base);
}

// ── Validation ────────────────────────────────────────────────────────────

export function validateTriangulation(T) {
  const errors = [], warnings = [];
  const V = T.nPunctures;
  if (!Number.isInteger(V) || V < 1) errors.push(`nPunctures must be a positive integer (got ${V})`);
  for (let ti = 0; ti < T.triangleEdges.length; ti++) {
    const te = T.triangleEdges[ti];
    if (!Array.isArray(te) || te.length !== 3) { errors.push(`triangle ${ti} must list 3 edge ids`); continue; }
    for (const ei of te) if (!Number.isInteger(ei) || ei < 0 || ei >= T.nEdges) errors.push(`triangle ${ti} references edge ${ei} out of range`);
    if (new Set(te).size !== 3) errors.push(`triangle ${ti} reuses an edge (self-folded triangles are out of scope)`);
  }
  for (let e = 0; e < T.nEdges; e++) {
    const d = T.edgeIncidences[e].length;
    if (d === 0) warnings.push(`edge ${e} is in no triangle`);
    else if (d > 2) errors.push(`edge ${e} is glued to ${d} triangles (max 2)`);
  }
  // Euler cross-check (closed charts): 2E = 3F.
  if (!T.isBordered && T.nEdges > 0 && 2 * T.nEdges !== 3 * T.nTriangles) {
    errors.push(`inconsistent closed chart: 2E=${2 * T.nEdges} ≠ 3F=${3 * T.nTriangles}`);
  }
  // Orientable-surface Euler check: χ = 2 − 2g − b with g ≥ 0 (b = #boundary
  // circles).  So 2g = 2 − χ − b must be a non-negative even integer.
  if (errors.length === 0 && T.nEdges > 0 && T.triangleEdges.every((te) => new Set(te).size === 3)) {
    const chi = T.nPunctures - T.nEdges + T.nTriangles;
    const b = countBoundaryComponents(T).length;
    const g2 = 2 - chi - b;
    if (g2 < 0 || g2 % 2 !== 0) {
      errors.push(`χ=${chi} with ${b} boundary component(s) is not 2−2g−b for an orientable surface`);
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

// ── The constructor payload / snippet for the real SkeinKAlgebra ──────────
//
// The polygon roster of A_𝖖[T[A₁, Σ]] is addressed by SkeinKAlgebra.polygon(n)
// (an (n)-gon disk) and the closed presets by SkeinAtlas.  We surface the edge
// data + σ so a session can reconstruct the exact chart Python-side.
export function toConstructorPayload(T) {
  return {
    name: T.name,
    n_punctures: T.nPunctures,
    edges: T.edges.map((e) => [...e]),
    triangle_edges: T.triangleEdges.map((t) => [...t]),
    sigma: sigma(T),
    bordered: T.isBordered,
  };
}

export function toPythonSnippet(T) {
  const edges = "[" + T.edges.map((e) => `(${e[0]}, ${e[1]})`).join(", ") + "]";
  const tris = "[" + T.triangleEdges.map((t) => `(${t[0]}, ${t[1]}, ${t[2]})`).join(", ") + "]";
  return (
    "from skein_sphere.triangulation import Triangulation\n" +
    `T = Triangulation.from_edge_data(\n` +
    `    n_punctures=${T.nPunctures},\n` +
    `    edges=${edges},\n` +
    `    triangle_edges=${tris},\n` +
    `    allow_boundary=${T.isBordered ? "True" : "False"},\n` +
    ")\n" +
    "T.sigma()          # the exchange matrix σ_Δ (BPS Dirac pairing)\n" +
    "T.flip(edge)       # diagonal flip ≡ quiver mutation at node `edge`"
  );
}

// ── ker(σ) flavour rank ───────────────────────────────────────────────────

export function matrixRank(M) {
  const n = M.length;
  if (n === 0) return 0;
  const A = M.map((row) => row.map(Number));
  const rows = n, cols = M[0].length;
  let rank = 0;
  for (let col = 0; col < cols && rank < rows; col++) {
    let piv = -1;
    for (let r = rank; r < rows; r++) if (Math.abs(A[r][col]) > 1e-9) { piv = r; break; }
    if (piv < 0) continue;
    [A[rank], A[piv]] = [A[piv], A[rank]];
    for (let r = 0; r < rows; r++) {
      if (r === rank) continue;
      const f = A[r][col] / A[rank][col];
      if (f !== 0) for (let c = col; c < cols; c++) A[r][c] -= f * A[rank][c];
    }
    rank++;
  }
  return rank;
}

// Flavour rank of the chart = corank of the mutable (internal) block of σ.
export function flavourRank(T) {
  const G = mutableBlock(T);
  return G.length - matrixRank(G);
}

// Directed arrows i→j (i<j convention folded) from an antisymmetric matrix,
// for rendering the exchange quiver.
export function arrowsFromMatrix(B) {
  const out = [];
  const n = B.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const v = B[i][j];
      if (v > 0) out.push({ from: i, to: j, mult: v });
      else if (v < 0) out.push({ from: j, to: i, mult: -v });
    }
  return out;
}
