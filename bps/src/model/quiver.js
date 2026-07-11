// quiver.js — the BPS-quiver input data model (pure, framework-free).
//
// A BPS quiver is the input to the real `BPSKAlgebra(pairing, node_charges,
// spec)`.  Here the primary datum is the antisymmetric **exchange matrix** B
// (= the Dirac pairing ⟨γ_i, γ_j⟩ between node charges / the BPS-quiver
// adjacency, B[i][j] = #arrows i→j).  In the standard case the node charges
// are the canonical basis {γ_i}, so the ambient lattice pairing IS B and the
// constructor payload is `BPSKAlgebra(pairing=B, node_charges=identity)`.
// `frozen` marks non-mutable (flavour) nodes for the future S-finder; the
// real BPSKAlgebra auto-extracts the flavour lattice ker(B), so `frozen` is a
// UI/display concept, not a constructor argument.  `spec` (optional) is the
// ordered BPS spectrum generator S = ∏ E_q(X_γ), either as charge tuples or a
// node-index mutation sequence — left empty here for the S-finder to compute.
//
// This module is deliberately input-only: it carries NO cluster-mutation or
// spectrum-search math (Plan 39 D3 retires the toy JS engine; the real
// algebra owns all math via Pyodide later).

export function identityCharges(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

export function zeroMatrix(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

let _uid = 0;
export function freshId() {
  _uid += 1;
  return `n${_uid}`;
}

// Build a normalized quiver from loose fields (a preset or an import).
export function makeQuiver(spec = {}) {
  const B = (spec.B || []).map((row) => row.map((x) => Math.trunc(Number(x))));
  const n = B.length;
  const positions =
    Array.isArray(spec.positions) && spec.positions.length === n
      ? spec.positions.map((p) => [Number(p[0]), Number(p[1])])
      : circularLayout(n);
  const frozen =
    Array.isArray(spec.frozen) && spec.frozen.length === n
      ? spec.frozen.map(Boolean)
      : Array(n).fill(false);
  const charges =
    Array.isArray(spec.charges) && spec.charges.length === n
      ? spec.charges.map((c) => c.map((x) => Math.trunc(Number(x))))
      : identityCharges(n);
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: freshId(),
    x: positions[i][0],
    y: positions[i][1],
    frozen: frozen[i],
    charge: charges[i],
  }));
  return {
    name: typeof spec.name === "string" && spec.name.trim() ? spec.name.trim() : "Untitled quiver",
    nodes,
    B,
    spec: normalizeSpec(spec.spec),
  };
}

export function emptyQuiver() {
  return { name: "Untitled quiver", nodes: [], B: [], spec: null };
}

export function circularLayout(n, { cx = 300, cy = 235, radius } = {}) {
  if (n === 0) return [];
  if (n === 1) return [[cx, cy]];
  const r = radius ?? Math.max(80, Math.min(180, 50 + 14 * n));
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
  });
}

function normalizeSpec(s) {
  if (s == null) return null;
  if (!Array.isArray(s.seq)) return null;
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

export function addNode(q, x, y) {
  const r = cloneQuiver(q);
  const n = r.nodes.length;
  r.nodes.push({ id: freshId(), x, y, frozen: false, charge: unit(n + 1, n) });
  // grow B and every existing charge vector by one dimension
  for (const row of r.B) row.push(0);
  r.B.push(Array(n + 1).fill(0));
  for (let i = 0; i < n; i++) r.nodes[i].charge.push(0);
  r.spec = null; // editing invalidates any imported spec
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
  return r; // moving is display-only; spec/B untouched
}

export function toggleFrozen(q, index) {
  const r = cloneQuiver(q);
  r.nodes[index] = { ...r.nodes[index], frozen: !r.nodes[index].frozen };
  return r;
}

// Add `delta` arrows i→j (keeps B antisymmetric): B[i][j]+=delta, B[j][i]-=delta.
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

export function renameQuiver(q, name) {
  return { ...cloneQuiver(q), name };
}

function unit(len, k) {
  const v = Array(len).fill(0);
  if (k < len) v[k] = 1;
  return v;
}

// ── Validation ──

// Returns { ok, errors: string[], warnings: string[] }.
export function validateQuiver(q) {
  const errors = [];
  const warnings = [];
  const n = q.nodes.length;
  if (q.B.length !== n) errors.push(`B is ${q.B.length}×… but there are ${n} nodes`);
  for (let i = 0; i < q.B.length; i++) {
    if (!Array.isArray(q.B[i]) || q.B[i].length !== n)
      errors.push(`B row ${i + 1} must have length ${n}`);
  }
  for (let i = 0; i < n; i++) {
    if (q.B[i]?.[i] !== 0) errors.push(`B[${i + 1}][${i + 1}] must be 0 (no self-loops)`);
    for (let j = 0; j < n; j++) {
      const v = q.B[i]?.[j];
      if (!Number.isInteger(v)) errors.push(`B[${i + 1}][${j + 1}] is not an integer`);
      if (q.B[i]?.[j] + q.B[j]?.[i] !== 0)
        errors.push(`B not antisymmetric at (${i + 1},${j + 1})`);
    }
  }
  const mutable = q.nodes.filter((nd) => !nd.frozen).length;
  if (n > 0 && mutable === 0) warnings.push("all nodes are frozen — nothing is mutable");
  return { ok: errors.length === 0, errors: dedupe(errors), warnings };
}

function dedupe(a) {
  return [...new Set(a)];
}

// ── The constructor payload: the args for the real BPSKAlgebra ──

// Produces { name, pairing, node_charges, spec } — exactly the arguments the
// real `BPSKAlgebra(pairing=…, node_charges=…, spec=…)` takes.  In the
// standard (identity-charge) case, pairing = B and node_charges = {γ_i}.
export function toConstructorPayload(q) {
  const pairing = q.B.map((row) => [...row]);
  const node_charges = q.nodes.map((nd) => [...nd.charge]);
  const payload = { name: q.name, pairing, node_charges };
  if (q.spec && q.spec.charges && q.spec.charges.length) payload.spec = q.spec.charges.map((c) => [...c]);
  return payload;
}

// A copy-pasteable Python one-liner (informational; the real call runs in the
// Pyodide worker later).
export function toPythonSnippet(q) {
  const p = toConstructorPayload(q);
  const mat = (m) => "[" + m.map((r) => "[" + r.join(", ") + "]").join(", ") + "]";
  const charges = "[" + p.node_charges.map((c) => "(" + c.join(", ") + ")").join(", ") + "]";
  let s = `BPSKAlgebra(pairing=${mat(p.pairing)}, node_charges=${charges}`;
  if (p.spec) s += `, spec=[${p.spec.map((c) => "(" + c.join(", ") + ")").join(", ")}]`;
  s += ")";
  return s;
}

// ── Rendering helpers ──

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
