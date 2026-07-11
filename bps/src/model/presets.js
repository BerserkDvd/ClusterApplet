// presets.js — a curated dictionary of BPS-quiver presets, organized as a
// folder tree (each entry carries a `path` = category folders).  Standard 4d
// N=2 BPS quivers; the S-finder computes spectrum generators on demand, so
// `spec` is supplied only where canonical (the pentagon).
//
// (A larger dictionary — a curated static-JSON subset of the canonical
// dictionaries/ tree — is Plan 39 v2, T3.5.  These built-ins are the
// physics starter set.)

// ── Family generators ─────────────────────────────────────────────

// [A₁,Aₙ] Argyres–Douglas: the linear Aₙ quiver (arrows i→i+1).
function aType(n) {
  const B = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n - 1; i++) { B[i][i + 1] = 1; B[i + 1][i] = -1; }
  const positions = Array.from({ length: n }, (_, i) => [90 + i * 110, 235]);
  return { B, positions };
}

// SU(2) with N_f fundamental flavours: 2 gauge nodes (Kronecker pairing 2)
// + N_f flavour nodes, each with a 1-arrow loop through the gauge pair.
function su2Nf(nf) {
  const n = 2 + nf;
  const B = Array.from({ length: n }, () => Array(n).fill(0));
  B[0][1] = 2; B[1][0] = -2;
  for (let i = 0; i < nf; i++) {
    const m = 2 + i;
    B[1][m] = 1; B[m][1] = -1;
    B[m][0] = 1; B[0][m] = -1;
  }
  const positions = [[210, 120], [450, 120]];
  for (let i = 0; i < nf; i++) positions.push([160 + i * 120, 330]);
  return { B, positions };
}

// ── The preset library ────────────────────────────────────────────

export const PRESETS = [
  { key: "empty", path: ["Basic"], name: "Empty", B: [], positions: [] },

  {
    key: "a1a2", path: ["Argyres–Douglas", "A-type [A₁,Aₙ]"], name: "[A₁,A₂] — Pentagon",
    ...aType(2),
    spec: { seq: [0, 1], charges: [[1, 0], [0, 1]], method: "canonical" },
  },
  { key: "a1a3", path: ["Argyres–Douglas", "A-type [A₁,Aₙ]"], name: "[A₁,A₃]", ...aType(3) },
  { key: "a1a4", path: ["Argyres–Douglas", "A-type [A₁,Aₙ]"], name: "[A₁,A₄] — Heptagon", ...aType(4) },
  { key: "a1a5", path: ["Argyres–Douglas", "A-type [A₁,Aₙ]"], name: "[A₁,A₅]", ...aType(5) },
  { key: "a1a6", path: ["Argyres–Douglas", "A-type [A₁,Aₙ]"], name: "[A₁,A₆] — Nonagon", ...aType(6) },

  {
    key: "a1d4", path: ["Argyres–Douglas", "D-type [A₁,Dₙ]"], name: "[A₁,D₄]",
    B: [[0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [-1, -1, -1, 0]],
    positions: [[160, 120], [160, 350], [520, 235], [320, 235]],
  },

  { key: "su2-pure", path: ["Gauge theories", "SU(2)"], name: "Pure SU(2) — Kronecker Â₁",
    B: [[0, 2], [-2, 0]], positions: [[210, 235], [450, 235]] },
  { key: "su2-nf1", path: ["Gauge theories", "SU(2)"], name: "SU(2), N_f = 1", ...su2Nf(1) },
  { key: "su2-nf2", path: ["Gauge theories", "SU(2)"], name: "SU(2), N_f = 2", ...su2Nf(2) },
  { key: "su2-nf3", path: ["Gauge theories", "SU(2)"], name: "SU(2), N_f = 3", ...su2Nf(3) },
  { key: "su2-nf4", path: ["Gauge theories", "SU(2)"], name: "SU(2), N_f = 4 (conformal)", ...su2Nf(4) },

  { key: "su3-pure", path: ["Gauge theories", "SU(3)"], name: "Pure SU(3)",
    B: [[0, 2, 0, -1], [-2, 0, 1, 0], [0, -1, 0, 2], [1, 0, -2, 0]],
    positions: [[150, 120], [470, 120], [470, 350], [150, 350]] },

  { key: "su2-su2-bifund", path: ["Quivers"], name: "SU(2) × SU(2) + bifund.",
    B: [[0, 2, 0, 0, -1], [-2, 0, 0, 0, 1], [0, 0, 0, 2, -1], [0, 0, -2, 0, 1], [1, -1, 1, -1, 0]],
    positions: [[90, 120], [90, 350], [520, 120], [520, 350], [305, 235]] },
];

export function presetByKey(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

// Build a nested folder tree from the presets' `path` arrays.  Returns a list
// of nodes, each either {type:'folder', label, children} or {type:'preset',
// key, name}.
export function presetTree(presets = PRESETS) {
  const root = { children: new Map(), presets: [] };
  for (const p of presets) {
    let node = root;
    for (const seg of p.path || []) {
      if (!node.children.has(seg)) node.children.set(seg, { children: new Map(), presets: [] });
      node = node.children.get(seg);
    }
    node.presets.push(p);
  }
  const toList = (node) => [
    ...[...node.children.entries()].map(([label, child]) => ({
      type: "folder", label, children: toList(child),
    })),
    ...node.presets.map((p) => ({ type: "preset", key: p.key, name: p.name })),
  ];
  return toList(root);
}
