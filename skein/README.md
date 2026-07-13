# Skein · triangulations (KAlgebra Applet Suite)

Deployed at `…/ClusterApplet/skein/`. An ideal-triangulation editor for the
SU(2) skein K-algebras `A_𝖖[T[A₁, Σ]]` — the sibling of the `bps/` applet.

Vendored, standalone copy of the skein applet from the Cluster repo
(`export/public/KAlgebra/webapp/`, Plan 39). Three views — Polygon (disk
n-gons; click a diagonal to flip ≡ mutation), Developed (closed / higher-genus
as a fundamental polygon with identified side-pairs), and the dual σ quiver.
The panel reports topology, the regular/irregular puncture census, and `σ_Δ`;
**Open in BPS applet ↗** hands `σ_Δ` (the BPS exchange matrix) to the sibling
`../bps/` applet.

```bash
npm install && npm run dev      # http://localhost:5173/
npm test                        # model tests (vs Python ground truth)
npm run build                   # → dist/  (base './', deploys under /skein/)
```
