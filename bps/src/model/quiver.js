// quiver.js — the BPS-quiver input data model (pure, framework-free).
//
// Two node kinds:
//   · "gauge"   — a mutable BPS-quiver node γ_i (a circle).  The gauge nodes
//                 and their Dirac pairing ARE the BPS quiver fed to the real
//                 BPSKAlgebra(pairing, node_charges, spec).
//   · "framing" — a FRAMING node (a square): an extended charge γ *outside*
//                 the lattice spanned by the gauge γ_i, specified purely by
//                 its Dirac pairings ⟨γ, γ_i⟩ (its arrows to the gauge nodes).
//                 It defines an extended F_γ (a framed line operator):
//                 findable (F_γ·S = X_γ + O(q) needs only ⟨γ,γ_i⟩), but two
//                 extended F_γ CANNOT be multiplied.  Not mutated by the
//                 S-finder.
//
// The antisymmetric exchange matrix B holds ⟨node_a, node_b⟩ for all nodes;
// the gauge×gauge block is the BPS quiver, the framing→gauge rows are the
// framings ⟨γ, γ_i⟩.  This module is input-only: NO cluster-mutation or
// spectrum-search math (Plan 39 D3; the real algebra owns all math).

export function identityCharges(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}
export function zeroMatrix(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

let _uid = 0;
export function freshId() { _uid += 1; return `n${_uid}`; }

// Build a normalized quiver from loose fields (a preset or an import).
export function makeQuiver(spec = {}) {
  const B = (spec.B || []).map((row) => row.map((x) => Math.trunc(Number(x))));
  const n = B.length;
  const positions =
    Array.isArray(spec.positions) && spec.positions.length === n
      ? spec.positions.map((p) => [Number(p[0]), Number(p[1])])
      : circularLayout(n);
  // `kinds` is the current field; legacy `frozen` is ignored (frozen is gone).
  const kinds =
    Array.isArray(spec.kinds) && spec.kinds.length === n
      ? spec.kinds.map((k) => (k === "framing" ? "framing" : "gauge"))
      : Array(n).fill("gauge");
  const charges =
    Array.isArray(spec.charges) && spec.charges.length === n
      ? spec.charges.map((c) => c.map((x) => Math.trunc(Number(x))))
      : identityCharges(n);
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: freshId(), x: positions[i][0], y: positions[i][1], kind: kinds[i], charge: charges[i],
  }));
  return {
    name: typeof spec.name === "string" && spec.name.trim() ? spec.name.trim() : "Untitled quiver",
    nodes, B, spec: normalizeSpec(spec.spec),
  };
}

export function emptyQuiver() { return { name: "Untitled quiver", nodes: [], B: [], spec: null }; }

export function circularLayout(n, { cx = 300, cy = 235, radius } = {}) {
  if (n === 0) return [];
  if (n === 1) return [[cx, cy]];
  const r = radius ?? Math.max(80, Math.min(180, 50 + 14 * n));
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
  });
}

// Prettifying auto-layout: a Fruchterman–Reingold force-directed embedding
// (nodes repel, arrows attract), then fit-to-box.  Deterministic (seeded from
// the current positions; circular if degenerate) so repeated presses settle.
export function autoArrange(q, width = 600, height = 460, { iterations = 400, margin = 64, spacing = 125 } = {}) {
  const n = q.nodes.length;
  if (n === 0) return q;
  const r = cloneQuiver(q);
  if (n === 1) { r.nodes[0] = { ...r.nodes[0], x: Math.round(width / 2), y: Math.round(height / 2) }; return r; }

  // seed positions (fall back to a circle if the current ones are degenerate)
  let pos = q.nodes.map((nd) => [nd.x, nd.y]);
  const spread = Math.max(...pos.map((p) => p[0])) - Math.min(...pos.map((p) => p[0]))
               + Math.max(...pos.map((p) => p[1])) - Math.min(...pos.map((p) => p[1]));
  if (!Number.isFinite(spread) || spread < 1) pos = circularLayout(n, { cx: width / 2, cy: height / 2 });

  const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (q.B[i][j] !== 0) edges.push([i, j]);
  // FIXED natural edge length (independent of canvas) — so the layout's
  // intrinsic size scales with the node count, not the window.
  const k = spacing;
  let temp = k * 3;

  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (k * k) / d; // repulsion
      disp[i][0] += (dx / d) * f; disp[i][1] += (dy / d) * f;
    }
    for (const [i, j] of edges) {
      const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k; // attraction
      disp[i][0] -= (dx / d) * f; disp[i][1] -= (dy / d) * f;
      disp[j][0] += (dx / d) * f; disp[j][1] += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      const dl = Math.hypot(disp[i][0], disp[i][1]) || 0.01;
      pos[i][0] += (disp[i][0] / dl) * Math.min(dl, temp);
      pos[i][1] += (disp[i][1] / dl) * Math.min(dl, temp);
    }
    temp = Math.max(temp * 0.975, 1);
  }

  // fit to the canvas box, preserving aspect ratio, centered
  const xs = pos.map((p) => p[0]), ys = pos.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const w = maxx - minx || 1, h = maxy - miny || 1;
  const bw = width - 2 * margin, bh = height - 2 * margin;
  // Only shrink to fit (scale ≤ 1); never blow the layout up to the edges.
  // A small quiver keeps its compact natural size and is centered.
  const scale = Math.min(1, bw / w, bh / h);
  const ox = margin + (bw - w * scale) / 2, oy = margin + (bh - h * scale) / 2;
  for (let i = 0; i < n; i++) {
    r.nodes[i] = { ...r.nodes[i], x: Math.round(ox + (pos[i][0] - minx) * scale), y: Math.round(oy + (pos[i][1] - miny) * scale) };
  }
  return r;
}

function normalizeSpec(s) {
  if (s == null || !Array.isArray(s.seq)) return null;
  return {
    seq: s.seq.map((v) => Math.trunc(Number(v))),
    charges: Array.isArray(s.charges) ? s.charges.map((c) => c.map(Number)) : [],
    method: typeof s.method === "string" ? s.method : "imported",
  };
}

// ── Structural edits (return new quivers; never mutate in place) ──

export function cloneQuiver(q) {
  return {
    name: q.name,
    nodes: q.nodes.map((nd) => ({ ...nd, charge: [...nd.charge] })),
    B: q.B.map((row) => [...row]),
    spec: q.spec ? { ...q.spec, seq: [...q.spec.seq], charges: q.spec.charges.map((c) => [...c]) } : null,
  };
}

export function addNode(q, x, y, kind = "gauge") {
  const r = cloneQuiver(q);
  const n = r.nodes.length;
  r.nodes.push({ id: freshId(), x, y, kind, charge: unit(n + 1, n) });
  for (const row of r.B) row.push(0);
  r.B.push(Array(n + 1).fill(0));
  for (let i = 0; i < n; i++) r.nodes[i].charge.push(0);
  r.spec = null;
  return r;
}

export function removeNode(q, index) {
  const r = cloneQuiver(q);
  r.nodes.splice(index, 1);
  r.B.splice(index, 1);
  for (const row of r.B) row.splice(index, 1);
  for (const nd of r.nodes) nd.charge.splice(index, 1);
  r.spec = null;
  return r;
}

export function moveNode(q, index, x, y) {
  const r = cloneQuiver(q);
  r.nodes[index] = { ...r.nodes[index], x, y };
  return r;
}

export function setNodeKind(q, index, kind) {
  const r = cloneQuiver(q);
  r.nodes[index] = { ...r.nodes[index], kind: kind === "framing" ? "framing" : "gauge" };
  return r;
}

// Add `delta` arrows i→j (keeps B antisymmetric).
export function addArrow(q, i, j, delta = 1) {
  if (i === j) return q;
  const r = cloneQuiver(q);
  r.B[i][j] += delta;
  r.B[j][i] -= delta;
  r.spec = null;
  return r;
}

export function setNodeCharge(q, index, charge) {
  const r = cloneQuiver(q);
  r.nodes[index] = { ...r.nodes[index], charge: charge.map((x) => Math.trunc(Number(x))) };
  return r;
}

export function renameQuiver(q, name) { return { ...cloneQuiver(q), name }; }

// ── Cluster mutation at node k (the BPS-quiver mutation) ──
// Flips the arrows at k (Fomin–Zelevinsky rule; direction-independent) and
// updates the node charges.  `dir = +1` is the FORWARD mutation μ_k, `dir = -1`
// the INVERSE μ_k⁻¹ — they differ only in the charge-update sign and are
// genuine inverses: mutate(mutate(q,k,+1),k,-1) == q.  A pure combinatorial
// operation on (B, charges) — NOT the K-algebra math.
export function mutate(q, k, dir = 1) {
  const r = cloneQuiver(q);
  const n = r.nodes.length;
  const B = q.B;
  const Bn = zeroMatrix(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === k || j === k) Bn[i][j] = -B[i][j];
    else Bn[i][j] = B[i][j] + Math.max(B[i][k], 0) * Math.max(B[k][j], 0) - Math.max(-B[i][k], 0) * Math.max(-B[k][j], 0);
  }
  r.B = Bn;
  const ck = [...q.nodes[k].charge];
  for (let j = 0; j < n; j++) {
    if (j === k) { r.nodes[j] = { ...r.nodes[j], charge: ck.map((c) => (c ? -c : 0)) }; continue; }
    const co = dir > 0 ? Math.max(B[j][k], 0) : Math.max(-B[j][k], 0);
    if (co > 0) r.nodes[j] = { ...r.nodes[j], charge: r.nodes[j].charge.map((c, i) => c + co * ck[i]) };
  }
  r.spec = null;
  return r;
}

// A mutation log is an ordered list of { index, dir } steps.
export function applyMutations(base, log) {
  return log.reduce((q, s) => mutate(q, s.index, s.dir), base);
}

export function sameMatrix(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

// A spectrum generator is found when every node charge has been NEGATED
// (as a multiset) relative to the base quiver's charges.  Returns
// { complete, specCharges } where specCharges is the ordered list of the BPS
// charges S = ∏ E_q(X_γ) collected along the mutation sequence.
export function spectrumStatus(baseQ, log) {
  const n = baseQ.nodes.length;
  if (n === 0) return { complete: false, specCharges: [] };
  const negSet = new Set(baseQ.nodes.map((nd) => nd.charge.map((c) => -c).join(",")));
  // collect the BPS charge of the mutated node at each step, in the running quiver
  const specCharges = [];
  let cur = baseQ;
  for (const s of log) {
    specCharges.push([...cur.nodes[s.index].charge]);
    cur = mutate(cur, s.index, s.dir);
  }
  const curSet = new Set(cur.nodes.map((nd) => nd.charge.join(",")));
  let complete = log.length > 0 && curSet.size === negSet.size;
  if (complete) for (const s of negSet) if (!curSet.has(s)) { complete = false; break; }
  return { complete, specCharges };
}

function unit(len, k) { const v = Array(len).fill(0); if (k < len) v[k] = 1; return v; }

// ── Spec necklace: "green" admissibility, guided head, on-spec detection ──
//
// These drive the Mutate-tab guide.  They are purely combinatorial (on B and
// charges); the real spectrum math stays in BPSKAlgebra.

// Solve the square system A x = b by Gaussian elimination (partial pivoting).
// Returns x, or null if singular.  (Float, tolerance-based — only used for the
// green highlight, and only in the non-standard-basis case.)
function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row.map(Number), Number(b[i])]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f) for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Coordinates c of the charge v in the original charge basis (v = Σ c_i orig[i]),
// or null if v ∉ span.  Exact for the standard basis — the applet's charge
// convention (every gauge γ_i starts as e_i) — where c = v.
export function coneCoords(v, orig) {
  const n = orig.length;
  let identity = n === v.length;
  for (let i = 0; i < n && identity; i++)
    for (let r = 0; r < orig[i].length; r++) if (orig[i][r] !== (r === i ? 1 : 0)) { identity = false; break; }
  if (identity) return [...v];
  const At = Array.from({ length: v.length }, (_, r) => orig.map((o) => o[r])); // transpose(orig)
  return solveLinear(At, v);
}

// The "green" nodes of the running quiver `cur`: those whose current charge is
// still a NON-NEGATIVE combination of the base's original charges — exactly the
// mutations the spectrum finder admits (positivity of the E_q factors).  Once
// all charges are negated the set is empty (spectrum generator reached).
export function greenNodes(cur, origCharges) {
  const out = [];
  for (let i = 0; i < cur.nodes.length; i++) {
    if (cur.nodes[i].kind === "framing") continue;
    const c = coneCoords(cur.nodes[i].charge, origCharges);
    if (!c) continue;
    if (c.every((x) => x >= -1e-6) && c.some((x) => x > 1e-6)) out.push(i);
  }
  return out;
}

// The guided head: the next node index the found sequence says to mutate,
// read cyclically (necklace) so it keeps advancing past completion.
export function guidedHead(seq, mutLogLen) {
  if (!Array.isArray(seq) || seq.length === 0) return -1;
  const N = seq.length;
  return seq[((mutLogLen % N) + N) % N];
}

// Is the mutation log a forward prefix of the found sequence (cyclically)?  When
// true, the walk is faithfully following the spec and the guided head is shown.
export function onSpecPath(seq, log) {
  if (!Array.isArray(seq) || seq.length === 0) return false;
  const N = seq.length;
  for (let t = 0; t < log.length; t++) {
    if (log[t].dir < 0) return false;                 // guided walk is forward-only
    if (log[t].index !== seq[t % N]) return false;
  }
  return true;
}

// ── Kind helpers + per-kind labels ──

export function gaugeIndices(q) { return q.nodes.map((nd, i) => (nd.kind !== "framing" ? i : -1)).filter((i) => i >= 0); }
export function framingIndices(q) { return q.nodes.map((nd, i) => (nd.kind === "framing" ? i : -1)).filter((i) => i >= 0); }

// Label a node: gauge → γ{k}, framing → f{m} (running per-kind index).
export function nodeLabel(q, index) {
  let g = 0, f = 0;
  for (let i = 0; i <= index; i++) {
    if (q.nodes[i].kind === "framing") f++; else g++;
  }
  return q.nodes[index].kind === "framing" ? { text: `f${f}`, kind: "framing" } : { text: `γ${g}`, kind: "gauge" };
}

// The gauge×gauge block of B — the BPS quiver's Dirac pairing.
export function gaugeBlock(q) {
  const g = gaugeIndices(q);
  return g.map((i) => g.map((j) => q.B[i][j]));
}

// For each framing node: { label, pairing:[⟨f, γ_i⟩ …] over the gauge nodes }.
export function framingRows(q) {
  const g = gaugeIndices(q);
  return framingIndices(q).map((fi) => ({
    label: nodeLabel(q, fi).text,
    pairing: g.map((gi) => q.B[fi][gi]),
  }));
}

// ── Validation ──

export function validateQuiver(q) {
  const errors = [], warnings = [];
  const n = q.nodes.length;
  if (q.B.length !== n) errors.push(`B is ${q.B.length}×… but there are ${n} nodes`);
  for (let i = 0; i < q.B.length; i++)
    if (!Array.isArray(q.B[i]) || q.B[i].length !== n) errors.push(`B row ${i + 1} must have length ${n}`);
  for (let i = 0; i < n; i++) {
    if (q.B[i]?.[i] !== 0) errors.push(`B[${i + 1}][${i + 1}] must be 0 (no self-loops)`);
    for (let j = 0; j < n; j++) {
      if (!Number.isInteger(q.B[i]?.[j])) errors.push(`B[${i + 1}][${j + 1}] is not an integer`);
      if (q.B[i]?.[j] + q.B[j]?.[i] !== 0) errors.push(`B not antisymmetric at (${i + 1},${j + 1})`);
    }
  }
  // framing↔framing pairings are not part of the data (a framing only pairs
  // with the gauge nodes).
  const fr = framingIndices(q);
  for (const a of fr) for (const b of fr) if (a < b && q.B[a][b] !== 0)
    warnings.push(`framing↔framing pairing ${nodeLabel(q, a).text},${nodeLabel(q, b).text} is ignored`);
  if (n > 0 && gaugeIndices(q).length === 0) warnings.push("no gauge nodes — add a BPS-quiver node");
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

// ── The constructor payload: the args for the real BPSKAlgebra ──
//
// The BPS quiver is the GAUGE sublattice only; framing nodes are listed
// separately as extended charges (their pairings with the gauge nodes).
export function toConstructorPayload(q) {
  const pairing = gaugeBlock(q);
  const k = pairing.length;
  const payload = { name: q.name, pairing, node_charges: identityCharges(k) };
  const spec = q.spec?.charges?.length ? q.spec.charges.map((c) => [...c]) : null;
  if (spec) payload.spec = spec;
  const framing = framingRows(q);
  if (framing.length) payload.framing = framing;
  return payload;
}

export function toPythonSnippet(q) {
  const p = toConstructorPayload(q);
  const mat = (m) => "[" + m.map((r) => "[" + r.join(", ") + "]").join(", ") + "]";
  const charges = "[" + p.node_charges.map((c) => "(" + c.join(", ") + ")").join(", ") + "]";
  let s = `A = BPSKAlgebra(pairing=${mat(p.pairing)}, node_charges=${charges}`;
  if (p.spec) s += `, spec=[${p.spec.map((c) => "(" + c.join(", ") + ")").join(", ")}]`;
  s += ")";
  if (p.framing) {
    s += "\n# extended F_γ (framing, findable — not multipliable):";
    for (const fr of p.framing) s += `\n#   ${fr.label}: ⟨γ,γ_i⟩ = [${fr.pairing.join(", ")}]`;
  }
  return s;
}

// ── ker(B) flavour rank (on the GAUGE block) ──

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

// Flavour lattice Γ_f = ker(B) of the GAUGE quiver: rank f = k − rank(gaugeBlock).
// This — not any per-node flag — is how flavour enters BPSKAlgebra.
export function flavourRank(q) {
  const G = gaugeBlock(q);
  return G.length - matrixRank(G);
}

export function arrowsFromB(B) {
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
