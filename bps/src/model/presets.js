// presets.js — a curated dictionary of BPS-quiver presets.
//
// Each entry is a loose spec accepted by makeQuiver: { name, B, positions?,
// frozen?, charges?, spec? }.  B is the antisymmetric exchange matrix
// (Dirac pairing).  These are standard 4d N=2 BPS quivers; the S-finder will
// compute spectrum generators on demand, so `spec` is supplied only where it
// is canonical (the pentagon).
//
// (A larger preset dictionary — a curated static-JSON subset of the canonical
// dictionaries/ tree — is Plan 39 v2, task T3.5.  These built-ins are the
// physics starter set.)

export const PRESETS = [
  {
    key: "empty",
    group: "—",
    name: "Empty",
    B: [],
    positions: [],
  },
  {
    key: "a2-pentagon",
    group: "Argyres–Douglas",
    name: "A₂ — Pentagon ([A₁,A₂])",
    B: [[0, 1], [-1, 0]],
    positions: [[180, 220], [420, 220]],
    spec: { seq: [0, 1], charges: [[1, 0], [0, 1]], method: "canonical" },
  },
  {
    key: "a3-chain",
    group: "Argyres–Douglas",
    name: "A₃ chain ([A₁,A₃])",
    B: [[0, 1, 0], [-1, 0, 1], [0, -1, 0]],
    positions: [[120, 220], [300, 220], [480, 220]],
  },
  {
    key: "a5-chain",
    group: "Argyres–Douglas",
    name: "A₅ chain",
    B: [
      [0, 1, 0, 0, 0],
      [-1, 0, 1, 0, 0],
      [0, -1, 0, 1, 0],
      [0, 0, -1, 0, 1],
      [0, 0, 0, -1, 0],
    ],
    positions: [[60, 220], [180, 220], [300, 220], [420, 220], [540, 220]],
  },
  {
    key: "su2-kronecker",
    group: "Gauge theories",
    name: "Â₁ — Kronecker (pure SU(2))",
    B: [[0, 2], [-2, 0]],
    positions: [[180, 220], [420, 220]],
  },
  {
    key: "su2-nf1",
    group: "Gauge theories",
    name: "SU(2), N_f = 1",
    B: [[0, 2, -1], [-2, 0, 1], [1, -1, 0]],
    positions: [[170, 130], [430, 130], [300, 340]],
  },
  {
    key: "su3-pure",
    group: "Gauge theories",
    name: "Pure SU(3)",
    B: [[0, 2, 0, -1], [-2, 0, 1, 0], [0, -1, 0, 2], [1, 0, -2, 0]],
    positions: [[140, 130], [460, 130], [460, 340], [140, 340]],
  },
  {
    key: "su2-su2-bifund",
    group: "Gauge theories",
    name: "SU(2) × SU(2) + bifund.",
    B: [
      [0, 2, 0, 0, -1],
      [-2, 0, 0, 0, 1],
      [0, 0, 0, 2, -1],
      [0, 0, -2, 0, 1],
      [1, -1, 1, -1, 0],
    ],
    positions: [[80, 130], [80, 340], [520, 130], [520, 340], [300, 235]],
  },
];

export function presetByKey(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

export function presetGroups() {
  const groups = new Map();
  for (const p of PRESETS) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push(p);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}
