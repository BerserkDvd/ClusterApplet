// bps.js — build Python snippets for the real BPSKAlgebra and parse results.
// The snippets construct BPSKAlgebra(pairing, node_charges [, spec]) on the
// bundled src and call the exact engines (recursive build_S = the F-finder,
// multiply, inner_product).

import { run } from "./kernel.js";

const matLit = (m) => "[" + m.map((r) => "[" + r.map((x) => Math.trunc(x)).join(", ") + "]").join(", ") + "]";
const chargesLit = (cs) => "[" + cs.map((c) => "(" + c.map((x) => Math.trunc(x)).join(", ") + ")").join(", ") + "]";

// Last meaningful line of a Python traceback, for a concise UI message.
export function pyError(tb) {
  const lines = String(tb).trim().split("\n").filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "compute error";
}

function payloadArgs(payload) {
  const B = matLit(payload.pairing);
  const nc = chargesLit(payload.node_charges);
  const spec = payload.spec ? `, spec=${chargesLit(payload.spec)}` : "";
  return { B, nc, spec };
}

// Exact recursive spectrum generator S (via build_S; the F-finder engine).
// Returns { terms: [[charge, coeffStr], …], K } or throws with a friendly msg.
export async function findSpectrumExact(payload, K = 8) {
  const { B, nc } = payloadArgs(payload);
  const src = `
import json
from bps_kalgebra import BPSKAlgebra
A = BPSKAlgebra(pairing=${B}, node_charges=${nc}, build_S=True)
S = A.spectrum_generator(K=${K})
# order the positive cone the way the F-solver does: by node-basis cone-degree
# (Σ coords) then coords.  node_charges here are the identity basis, so coords = γ.
_key = lambda kv: (sum(kv[0]), kv[0])
terms = [[list(g), str(c)] for g, c in sorted(S.items(), key=_key) if str(c) not in ("0", "")]
print(json.dumps(terms))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return { terms: JSON.parse((res.stdout || "[]").trim() || "[]"), K };
}

// S -> spec: recover a finite-chamber spectrum generator spec (the ordered BPS
// charges [γ_1,…,γ_N] with S = ∏ E_q(X_{γ_i})) from the quiver, by building S
// (recursive F-finder) then running the insertion extractor + full-cone
// verification.  Returns { spec: [[charge],…] } or { spec: null } for wild
// charts (no finite chamber at this cutoff).
export async function findSpec(payload, cutoff = 8) {
  const { B, nc } = payloadArgs(payload);
  const src = `
import json
from recursive_spectrum import extract_spec_from_quiver
spec = extract_spec_from_quiver(${B}, ${nc}, cutoff=${cutoff})
print(json.dumps(None if spec is None else [list(g) for g in spec]))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  const spec = JSON.parse((res.stdout || "null").trim() || "null");
  return { spec };
}

// Structure constants L_a · L_b = Σ_c C^c_ab L_c.  Returns a display string.
export async function computeMultiply(payload, a, b) {
  const { B, nc, spec } = payloadArgs(payload);
  const src = `
from bps_kalgebra import BPSKAlgebra
A = BPSKAlgebra(pairing=${B}, node_charges=${nc}${spec})
print(A.multiply(${aTuple(a)}, ${aTuple(b)}))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return (res.stdout || "").trim();
}

// Schur inner product I_{a,b}(q) = Tr(ρ(a)·b) = δ + O(q), to order K.
export async function computeInnerProduct(payload, a, b, K = 8) {
  const { B, nc, spec } = payloadArgs(payload);
  const src = `
from bps_kalgebra import BPSKAlgebra
A = BPSKAlgebra(pairing=${B}, node_charges=${nc}${spec})
print(A.inner_product(${aTuple(a)}, ${aTuple(b)}, K=${K}))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return (res.stdout || "").trim();
}

const aTuple = (a) => "(" + a.map((x) => Math.trunc(x)).join(", ") + ")";
