# KAlgebra Applets

Web tools driving the **real** `KAlgebra` family (Plan 39 — the KAlgebra
Applet Suite). A shared platform will host several per-algebra applets
(BPS, Skein, …) over one cached Pyodide runtime; this is the first slice.

## v0.1 — BPS quiver input (the light path)

Input or load a **BPS quiver**, with no compute yet:

- **Load a preset** — pentagon `[A₁,A₂]`, A₃/A₅ chains, Kronecker/pure
  SU(2), SU(2) N_f=1, pure SU(3), SU(2)×SU(2)+bifund.
- **Build one** — click empty space to add a node; click node→node to draw
  an arrow; double-click to freeze (flavour) a node; shift-click to delete;
  right-click node→node for a reverse arrow. *Move* mode drags nodes.
- **Edit the exchange matrix** B directly (click a cell +1, right-click −1;
  antisymmetry is maintained).
- **Import / export** — JSON or a shareable URL hash, schema-compatible
  with the repo's `clusterapplet_url.py` (`{name, n, positions, frozen, B,
  charges?, spec?}`), so links emitted Python-side load here and vice versa.
- **Constructor payload** — the panel shows the exact
  `BPSKAlgebra(pairing=…, node_charges=…, spec=…)` this quiver will feed
  the real algebra once the compute path lands.

The **S-finder**, **canonical basis**, **partial RG flows**, and the
**verifier panel** (the O(𝖖)-axiom demonstration) arrive with the Pyodide
compute path — see `restructuring_plans/39_cluster_interface/` in the
Cluster repo.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # model unit tests (node --test)
npm run build      # → dist/  (static; base='./' so it runs at any subpath)
npm run preview    # serve the build
```

## Layout

```
src/
  model/    quiver.js · presets.js · share.js   (pure, framework-free, tested)
  ui/       theme.js
  components/ QuiverCanvas.jsx · SidePanel.jsx
  App.jsx · main.jsx · styles.css
test/       model.test.js
```

`src/model/` is the input-only data layer (no cluster-mutation or
spectrum-search math — Plan 39 D3 retires the toy JS engine; the real
algebra owns all math via Pyodide). It is the natural seed for the shared
`packages/core` once a second applet arrives (Plan 39 T2.1).
