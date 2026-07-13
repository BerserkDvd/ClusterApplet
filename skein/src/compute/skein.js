// skein.js — build Python snippets for the real SkeinKAlgebra and parse results.
//
// The snippets construct a curated SkeinKAlgebra (e.g. SkeinKAlgebra.polygon(n))
// on the bundled `src/skein` and call the exact K_𝖖 engine — multiply, trace,
// the Schur inner product I_{a,b}, and the axiom verifiers — so the panel shows
// the O(𝖖) axioms live on the real skein algebra.

import { run } from "./kernel.js";

// Last meaningful line of a Python traceback, for a concise UI message.
export function pyError(tb) {
  const lines = String(tb).trim().split("\n").filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "compute error";
}

const tup = (t) => "(" + t.map((x) => Math.trunc(x)).join(", ") + ")";

// Connect: construct the algebra and return a full demonstration payload —
// coefficient ring, some generators, a structure constant, the orthonormality
// pairing (diagonal + off-diagonal), Tr(1), and the verifier battery.
export async function connectSkein(rec, K = 6) {
  const src = `
import json
from skein_kalgebra import SkeinKAlgebra
A = ${rec.ctor}
K = ${K}
gens = [list(g) for g in list(A.cone_data().mult_gens())[:8]]
a, b = tuple(gens[1]), tuple(gens[2])
res = dict(
  name=type(A).__name__, coeff_ring=str(A.coefficient_ring()),
  gens=gens, a=list(a), b=list(b),
  multiply_ab=str(A.multiply(a, b)),
  trace_1=str(A.trace(A.identity(), K)),
  ip_aa=str(A.inner_product(a, a, K)),
  ip_ab=str(A.inner_product(a, b, K)),
  verifiers=dict(
    bar_involution=bool(A.verify_bar_involution(a, b)),
    rho_automorphism=bool(A.verify_rho_is_automorphism(a, b)),
    orthonormality_diag=bool(A.verify_orthonormality(a, a, K)),
    orthonormality_offdiag=bool(A.verify_orthonormality(a, b, K)),
    rho2_twisted_trace=bool(A.verify_rho_twisted_trace(a, b, K)),
  ),
)
print(json.dumps(res))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return JSON.parse((res.stdout || "{}").trim() || "{}");
}

// Interactive structure constant L_a · L_b = Σ_c C^c_ab L_c.
export async function skeinMultiply(rec, a, b) {
  const src = `
from skein_kalgebra import SkeinKAlgebra
A = ${rec.ctor}
print(A.multiply(${tup(a)}, ${tup(b)}))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return (res.stdout || "").trim();
}

// Interactive Schur inner product I_{a,b}(q) = Tr(ρ(a)·b) = δ_{a,b} + O(q).
export async function skeinInnerProduct(rec, a, b, K = 6) {
  const src = `
from skein_kalgebra import SkeinKAlgebra
A = ${rec.ctor}
print(A.inner_product(${tup(a)}, ${tup(b)}, ${K}))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return (res.stdout || "").trim();
}
