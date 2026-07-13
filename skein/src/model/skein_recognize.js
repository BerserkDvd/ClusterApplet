// skein_recognize.js — map a built triangulation to a real SkeinKAlgebra.
//
// SkeinKAlgebra instances are curated per theory (SkeinKAlgebra.polygon(n),
// su2_nf, punctured_polygon, the ROSTER); an arbitrary surface is not
// automatically one.  This recognizer connects what it can and honest-fails the
// rest with a clear reason — so the compute panel never fabricates an algebra.
//
// Wired now: the [A₁, A_{n−3}] polygons — a disk with n boundary marked points
// is A_𝖖[T[A₁, A_{n−3}]] = SkeinKAlgebra.polygon(n) (chart-independent: any
// triangulation of the n-gon presents the same algebra, so we recognise by n).

import { isSimplePolygon } from "./triangulation_layout.js";

const POLY_MAX = 11;   // SkeinKAlgebra.polygon supports n ≥ 4; cap for interactivity

const POLY_NAME = {
  4: "U1Square (SQED₁)", 5: "Pentagon [A₁,A₂]", 6: "U1Hexagon [A₁,A₃]",
  7: "Heptagon [A₁,A₄]", 8: "U1Octagon [A₁,A₅]", 9: "Nonagon [A₁,A₆]",
  10: "U1Decagon [A₁,A₇]", 11: "Hendecagon [A₁,A₈]",
};

export function recognizeSkeinKAlgebra(T) {
  if (isSimplePolygon(T)) {
    const n = T.nPunctures;
    if (n >= 4 && n <= POLY_MAX) {
      return {
        ok: true, kind: "polygon", n,
        ctor: `SkeinKAlgebra.polygon(${n})`,
        theory: `A_𝖖[T[A₁, A${n - 3}]]`,
        label: POLY_NAME[n] || `polygon P${n}`,
      };
    }
    if (n === 3) return { ok: false, reason: "a single triangle has no polygon skein algebra — build up to n ≥ 4 boundary marked points" };
    return { ok: false, reason: `polygon P${n}: SkeinKAlgebra.polygon supports n = 4…${POLY_MAX} in this applet` };
  }
  return {
    ok: false,
    reason: "no SkeinKAlgebra is wired for this surface yet — connect works on polygon disks (Presets → Polygons, or the n-gon builder). Closed / punctured / higher-genus charts have curated instances only.",
  };
}
