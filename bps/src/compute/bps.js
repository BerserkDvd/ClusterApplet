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

// S -> spec via the bidirectional BFS mutation-path finder — meet-in-the-middle
// search of the mutation graph for a sequence negating every charge (a spectrum
// generator), then replayed into the ordered spec.  This does NOT build the
// exact S element, so it stays ms-fast on quivers where the recursive build_S
// blows up (e.g. rank ≥ 5).  Returns { seq, spec } (spec = [[charge],…]) or
// { seq: null, spec: null } when no finite chamber is reachable within maxDepth.
export async function findSpecBFS(payload, maxDepth = 25) {
  const { B, nc } = payloadArgs(payload);
  const src = `
import json
from bps_quiver_tools import BPSQuiver
Q = BPSQuiver.from_pairing(${nc}, ${B})
seq = Q.find_negating_sequence(max_depth=${maxDepth}, bidirectional=True)
spec = Q.build_spectrum_generator(seq) if seq is not None else None
print(json.dumps({"seq": seq, "spec": None if spec is None else [list(g) for g in spec]}))
`;
  const res = await run(src, { timeoutMs: 45000 });
  if (res.err) throw new Error(pyError(res.err));
  const out = JSON.parse((res.stdout || "null").trim() || "null");
  return out || { seq: null, spec: null };
}

// S -> spec: recover a finite-chamber spectrum generator spec (the ordered BPS
// charges [γ_1,…,γ_N] with S = ∏ E_q(X_{γ_i})) from the quiver, by building S
// (recursive F-finder) then running the insertion extractor + full-cone
// verification.  Exact, but the recursion can blow up on higher rank — prefer
// findSpecBFS for spec-finding.  Returns { spec: [[charge],…] } or
// { spec: null } for wild charts (no finite chamber at this cutoff).
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

// Self-test: run a canned pentagon compute on the loaded bundle and report the
// runtime provenance (bundle source, Pyodide/Python versions, src dirs, module
// imports).  Returns a plain object; every check is guarded so this never
// throws from the Python side — a broken kernel still yields a useful report.
export async function exportDiagnostics(payload = null) {
  const B = payload ? matLit(payload.pairing) : "[[0, 1], [-1, 0]]";
  const nc = payload ? chargesLit(payload.node_charges) : "[(1, 0), (0, 1)]";
  const src = `
import json, sys, pathlib, platform
d = {"ok": True, "python": sys.version.split()[0], "platform": platform.platform(),
     "bundle_source": None, "pyodide": None, "src_dirs": None,
     "imports": {}, "checks": {}}
try: d["bundle_source"] = _BUNDLE_SOURCE
except Exception: d["bundle_source"] = "unknown (pre-0.13 worker?)"
try: d["pyodide"] = _PYODIDE_VERSION
except Exception: pass
try:
    d["src_dirs"] = sum(1 for p in pathlib.Path("src").rglob("*") if p.is_dir() and p.name != "__pycache__")
except Exception as e:
    d["src_dirs"] = f"ERR {e}"
for mod in ["kalgebra", "laurent_poly", "zplus_ring", "bps_kalgebra", "recursive_spectrum"]:
    try:
        __import__(mod); d["imports"][mod] = "ok"
    except Exception as e:
        d["imports"][mod] = f"{type(e).__name__}: {e}"; d["ok"] = False
try:
    from recursive_spectrum import extract_spec_from_quiver
    spec = extract_spec_from_quiver(${B}, ${nc}, cutoff=8)
    d["checks"]["spec"] = None if spec is None else [list(g) for g in spec]
except Exception:
    import traceback; d["checks"]["spec"] = "ERR " + traceback.format_exc().strip().splitlines()[-1]; d["ok"] = False
try:
    from bps_kalgebra import BPSKAlgebra
    A = BPSKAlgebra(pairing=${B}, node_charges=${nc}, build_S=True)
    S = A.spectrum_generator(K=6)
    d["checks"]["S_terms"] = sum(1 for c in S.values() if str(c) not in ("0", ""))
except Exception:
    import traceback; d["checks"]["S_terms"] = "ERR " + traceback.format_exc().strip().splitlines()[-1]; d["ok"] = False
print(json.dumps(d))
`;
  const res = await run(src, { timeoutMs: 20000 });
  if (res.err) return { ok: false, kernel_error: pyError(res.err), raw: res.err };
  try { return JSON.parse((res.stdout || "{}").trim() || "{}"); }
  catch (e) { return { ok: false, parse_error: String(e), stdout: res.stdout }; }
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
