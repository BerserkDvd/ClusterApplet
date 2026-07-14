// skein_curves.js — curve → tropical charge + F, on the intrinsic SkeinAlgebra
// of ANY built triangulation (not limited to the curated SkeinKAlgebra roster).
//
// A simple closed curve on the chart is encoded by its normal coordinates
// (per-edge intersection numbers).  We compute, via the bundled src/skein:
//   · crossed_edges(coords)                 — which edges the curve meets;
//   · is_admissible / components_of_coords  — validity + component count;
//   · GeometricF.trace_single(coords)       — the quantum trace F in Y_Δ (the
//     "geometric F" = bare part of F(−γ) in the skein↔BPS dictionary);
//   · the tropical charge γ = the Newton-polytope corners of F (min/max support).

import { run } from "./kernel.js";

export function pyError(tb) {
  const lines = String(tb).trim().split("\n").filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "compute error";
}

// Interior (regular) punctures = vertices touched by no boundary edge; these are
// the ones with a peripheral loop (puncture_flavour_charge).  On a disk this is
// empty (all vertices are boundary marked points, and closed curves are trivial).
export function interiorPunctures(T) {
  const onBoundary = new Set();
  for (const e of T.boundaryEdgeIds) { onBoundary.add(T.edges[e][0]); onBoundary.add(T.edges[e][1]); }
  const out = [];
  for (let p = 0; p < T.nPunctures; p++) if (!onBoundary.has(p)) out.push(p);
  return out;
}

function triLiteral(T) {
  const edges = T.edges.map((e) => `(${e[0]},${e[1]})`).join(",");
  const tris = T.triangleEdges.map((t) => `(${t[0]},${t[1]},${t[2]})`).join(",");
  return `Triangulation.from_edge_data(n_punctures=${T.nPunctures}, edges=[${edges}], triangle_edges=[${tris}], allow_boundary=${T.isBordered ? "True" : "False"})`;
}

// spec = { kind: "peripheral", puncture } | { kind: "coords", coords: [...] }
export async function curveF(T, spec) {
  const coordsExpr = spec.kind === "peripheral"
    ? `T.puncture_flavour_charge(${Math.trunc(spec.puncture)})`
    : `(${spec.coords.map((c) => Math.trunc(c)).join(",")},)`;
  const src = `
import json
from triangulation import Triangulation
from geometric_f import GeometricF
from curve_realization import crossed_edges
from multicurve import is_admissible, components_of_coords
T = ${triLiteral(T)}
coords = tuple(int(c) for c in ${coordsExpr})
adm = bool(is_admissible(T, coords))
out = dict(coords=list(coords), crossed_edges=crossed_edges(coords), admissible=adm)
if not adm:
    out['error'] = 'not an admissible simple multicurve (crossing numbers violate the triangle inequalities)'
else:
    comps = components_of_coords(T, coords)
    out['n_components'] = len(comps)
    try:
        F = GeometricF(T).trace_single(coords)
        supp = [list(m) for m, c in F.items()]
        out.update(F=str(F), gamma_lower=min(supp), gamma_upper=max(supp), n_terms=len(supp))
    except Exception as e:
        out['error'] = f'{type(e).__name__}: {e}'
print(json.dumps(out))
`;
  const res = await run(src);
  if (res.err) throw new Error(pyError(res.err));
  return JSON.parse((res.stdout || "{}").trim() || "{}");
}
