// share.js — import / export of a quiver as JSON or a shareable URL hash.
//
// The wire schema is kept COMPATIBLE with the repo's clusterapplet_url.py and
// the old applet:  { name, n, positions, frozen, B, charges?, spec? }.  So
// links emitted by `bpskalgebra_applet_url(...)` on the Python side load here,
// and links copied here round-trip back.  (Extending the schema with computed
// results + provenance is Plan 39 v2, task T3.4.)

import { makeQuiver, validateQuiver, identityCharges } from "./quiver.js";

// Serialize the current quiver to the wire object.  Node kinds are emitted
// as `kinds` only when some node is a framing node (all-gauge is the default).
export function toWireObject(q) {
  const n = q.nodes.length;
  const obj = {
    name: q.name,
    n,
    positions: q.nodes.map((nd) => [Math.round(nd.x), Math.round(nd.y)]),
    B: q.B.map((row) => [...row]),
  };
  if (q.nodes.some((nd) => nd.kind === "framing")) obj.kinds = q.nodes.map((nd) => nd.kind);
  const charges = q.nodes.map((nd) => [...nd.charge]);
  if (JSON.stringify(charges) !== JSON.stringify(identityCharges(n))) obj.charges = charges;
  if (q.spec && q.spec.seq && q.spec.seq.length) obj.spec = q.spec;
  return obj;
}

export function toJSONString(q) {
  return JSON.stringify(toWireObject(q), null, 2);
}

// Percent-encoded URL hash matching clusterapplet_url.py's encoding.
export function toShareURL(q, base) {
  const loc =
    base ||
    (typeof window !== "undefined" && window.location
      ? window.location.origin + window.location.pathname
      : "");
  const payload = JSON.stringify(toWireObject(q));
  return `${loc}#${encodeURIComponent(payload)}`;
}

// Parse any of: raw JSON object, a full URL with #<encoded JSON>, a bare
// #fragment, or a #q=<encoded JSON> fragment.  Returns a normalized quiver.
export function parseImport(text) {
  let s = (text || "").trim();
  if (!s) throw new Error("empty input");
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0 && /^https?:\/\//i.test(s)) s = s.slice(hashIdx + 1);
  else if (s.startsWith("#")) s = s.slice(1);
  if (s.startsWith("q=")) s = s.slice(2);
  if (!s.startsWith("{") && !s.startsWith("[")) {
    try {
      s = decodeURIComponent(s);
    } catch {
      /* leave as-is */
    }
  }
  let obj;
  try {
    obj = JSON.parse(s);
  } catch (e) {
    throw new Error("invalid JSON: " + e.message);
  }
  return objectToQuiver(obj);
}

// Validate a wire object and turn it into a normalized quiver.
export function objectToQuiver(obj) {
  if (!obj || typeof obj !== "object") throw new Error("expected a JSON object");
  const n = Number.isInteger(obj.n) ? obj.n : Array.isArray(obj.B) ? obj.B.length : null;
  if (!Number.isInteger(n) || n < 0) throw new Error("missing or invalid n");
  if (!Array.isArray(obj.B) || obj.B.length !== n)
    throw new Error(`B must be a ${n}×${n} matrix`);
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(obj.B[i]) || obj.B[i].length !== n)
      throw new Error(`B row ${i + 1} must have length ${n}`);
    for (let j = 0; j < n; j++) {
      if (!Number.isInteger(obj.B[i][j])) throw new Error(`B[${i + 1}][${j + 1}] is not an integer`);
      if (obj.B[i][j] + obj.B[j][i] !== 0)
        throw new Error(`B not antisymmetric at (${i + 1},${j + 1})`);
    }
  }
  const q = makeQuiver(obj);
  const { ok, errors } = validateQuiver(q);
  if (!ok) throw new Error(errors[0] || "invalid quiver");
  return q;
}

// If the page was opened with a #<encoded JSON> hash, return that quiver.
export function quiverFromLocationHash() {
  if (typeof window === "undefined" || !window.location || !window.location.hash) return null;
  try {
    return parseImport(window.location.hash);
  } catch {
    return null;
  }
}
