// triangulation_share.js — import / export of a triangulation, and the
// bridge to the BPS-quiver applet.
//
// Two wire formats:
//   · the skein-native triangulation object (round-trips this app):
//       { kind:"triangulation", name, n_punctures, edges, triangle_edges }
//   · the BPS-quiver object the BPS applet reads (share.js schema):
//       { name, n, B, kinds }  — B = σ_Δ, internal edges → gauge nodes,
//       boundary edges → framing nodes.  σ_Δ IS a BPS Dirac pairing, so a
//       triangulation produces BPS-quiver input directly (flip ≡ mutation).

import { makeTriangulation, sigma } from "./triangulation.js";
import { quiverLayout } from "./triangulation_layout.js";

// ── skein-native round-trip ─────────────────────────────────────────────────

export function toTriangulationWire(T) {
  return {
    kind: "triangulation",
    name: T.name,
    n_punctures: T.nPunctures,
    edges: T.edges.map((e) => [...e]),
    triangle_edges: T.triangleEdges.map((t) => [...t]),
  };
}

export function toTriangulationJSON(T) {
  return JSON.stringify(toTriangulationWire(T), null, 2);
}

export function toTriangulationShareURL(T, base) {
  const loc = base || appBase();
  const payload = JSON.stringify(toTriangulationWire(T));
  return `${loc}?app=skein#${encodeURIComponent(payload)}`;
}

export function parseTriangulationImport(text) {
  const obj = parseAnyJSON(text);
  if (!obj || obj.kind !== "triangulation") {
    if (obj && Array.isArray(obj.B) && !obj.edges) {
      throw new Error("that looks like a BPS quiver, not a triangulation");
    }
    throw new Error("not a triangulation object (expected kind:\"triangulation\")");
  }
  const T = makeTriangulation({
    name: obj.name,
    nPunctures: obj.n_punctures ?? obj.nPunctures,
    edges: obj.edges,
    triangleEdges: obj.triangle_edges ?? obj.triangleEdges,
  });
  if (T.nTriangles === 0) throw new Error("triangulation has no triangles");
  return T;
}

export function triangulationFromLocationHash() {
  if (typeof window === "undefined" || !window.location || !window.location.hash) return null;
  try { return parseTriangulationImport(window.location.hash); } catch { return null; }
}

// ── BPS-quiver export ────────────────────────────────────────────────────────

// The BPS quiver of the chart: one node per edge, B = σ_Δ.  Internal edges are
// mutable gauge nodes; boundary (frozen) edges are framing nodes.
export function toBpsWireObject(T) {
  const B = sigma(T);
  const n = T.nEdges;
  const bset = new Set(T.boundaryEdgeIds);
  const kinds = Array.from({ length: n }, (_, i) => (bset.has(i) ? "framing" : "gauge"));
  const lay = quiverLayout(T);
  const positions = lay.nodes.map((nd) => [Math.round(nd.x), Math.round(nd.y)]);
  const obj = { name: `${T.name} — σ quiver`, n, B, positions };
  if (kinds.some((k) => k === "framing")) obj.kinds = kinds;
  return obj;
}

export function toBpsJSON(T) {
  return JSON.stringify(toBpsWireObject(T), null, 2);
}

// A URL that opens the BPS applet preloaded with this chart's σ quiver (the BPS
// app reads a #<encoded quiver> hash on load).  Meant for window.open(_, "_blank").
// Handles both deployment shapes:
//   · standalone Pages subpaths (…/skein/ → sibling …/bps/, as on ClusterApplet);
//   · the single-page suite (?app=bps route on the same page).
export function toBpsAppURL(T, base) {
  const payload = encodeURIComponent(JSON.stringify(toBpsWireObject(T)));
  if (base) return `${base}#${payload}`;
  if (typeof window !== "undefined" && window.location) {
    const { pathname, href, origin } = window.location;
    if (/\/skein\/?($|[?#])/.test(pathname)) {
      return new URL("../bps/", href).toString() + `#${payload}`;
    }
    return `${origin}${pathname}?app=bps#${payload}`;
  }
  return `?app=bps#${payload}`;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function appBase() {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin + window.location.pathname;
  }
  return "";
}

function parseAnyJSON(text) {
  let s = (text || "").trim();
  if (!s) throw new Error("empty input");
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0 && /^https?:\/\//i.test(s)) s = s.slice(hashIdx + 1);
  else if (s.startsWith("#")) s = s.slice(1);
  if (s.startsWith("q=")) s = s.slice(2);
  if (!s.startsWith("{") && !s.startsWith("[")) {
    try { s = decodeURIComponent(s); } catch { /* leave as-is */ }
  }
  try { return JSON.parse(s); } catch (e) { throw new Error("invalid JSON: " + e.message); }
}
