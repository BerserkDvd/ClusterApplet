import React, { useEffect, useMemo, useState } from "react";
import TriangulationCanvas from "./components/TriangulationCanvas.jsx";
import TriangulationPanel from "./components/TriangulationPanel.jsx";
import BuildPanel from "./components/BuildPanel.jsx";
import SkeinComputePanel from "./components/SkeinComputePanel.jsx";
import { onKernelStatus, startKernel } from "./compute/kernel.js";
import { recognizeSkeinKAlgebra } from "./model/skein_recognize.js";
import { flip, renameTriangulation, canFlip, vertices } from "./model/triangulation.js";
import {
  attachTriangle, selfGlue, cut, addPuncture, removePuncture,
} from "./model/triangulation_build.js";
import { presetByKey, presetGroups, customPolygon, PRESETS } from "./model/triangulation_presets.js";
import { isSimplePolygon, defaultView } from "./model/triangulation_layout.js";
import {
  toTriangulationJSON, toTriangulationShareURL, parseTriangulationImport,
  triangulationFromLocationHash, toBpsJSON, toBpsAppURL,
} from "./model/triangulation_share.js";

const DEFAULT_KEY = "p5";

export default function SkeinApp() {
  const seed = () => triangulationFromLocationHash() || presetByKey(DEFAULT_KEY);
  // history stack of { tri, label }; hist[0] is the base.  Undo pops; reset
  // clears to base.  Uniform for flips AND build ops.
  const [hist, setHist] = useState(() => [{ tri: seed(), label: "base" }]);
  const tri = hist[hist.length - 1].tri;

  const [presetKey, setPresetKey] = useState(DEFAULT_KEY);
  const [presetNote, setPresetNote] = useState(noteFor(DEFAULT_KEY));
  const [view, setView] = useState(() => defaultView(seed()));
  const [mode, setMode] = useState("flip");           // flip | build
  const [selEdges, setSelEdges] = useState([]);        // build: up to 2 edge ids
  const [selTriangle, setSelTriangle] = useState(-1);  // build: a triangle id
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [polyN, setPolyN] = useState(5);
  const [toast, setToast] = useState("");
  const [showCompute, setShowCompute] = useState(false);
  const [kernel, setKernel] = useState({ status: "idle", ready: false, statusMsg: "" });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => onKernelStatus(setKernel), []);

  const rec = useMemo(() => recognizeSkeinKAlgebra(tri), [tri]);

  function clearSel() { setSelEdges([]); setSelTriangle(-1); }

  function loadBase(nt, key = "", note = "an ideal triangulation") {
    setHist([{ tri: nt, label: "base" }]);
    setPresetKey(key); setPresetNote(note);
    setView(defaultView(nt)); clearSel();
  }
  function loadPreset(key) {
    const p = presetByKey(key);
    if (p) loadBase(p, key, noteFor(key));
    setPresetsOpen(false);
  }

  // apply a mutating op; on failure surface the reason (honest-fail).
  function applyOp(fn, label) {
    try {
      const nt = fn(tri);
      setHist((h) => [...h, { tri: nt, label }]);
      clearSel();
      if (view === "polygon" && !isSimplePolygon(nt)) setView(defaultView(nt));
    } catch (e) { setToast(String(e.message || e)); }
  }

  function doFlip(edge) {
    if (!canFlip(tri, edge)) { setToast("that edge can't be flipped (boundary or self-folded)"); return; }
    applyOp((t) => flip(t, edge), `flip e${edge}`);
  }
  function undo() { if (hist.length > 1) setHist((h) => h.slice(0, -1)); clearSel(); }
  function reset() { setHist((h) => [h[0]]); clearSel(); }

  // ── build-mode picking ──
  function onEdge(id) {
    if (mode !== "build") { doFlip(id); return; }
    setSelEdges((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      return [...cur, id].slice(-2);   // keep the two most-recent
    });
  }
  function onTriangle(id) {
    if (mode !== "build") return;
    setSelTriangle((cur) => (cur === id ? -1 : id));
  }

  // ── build actions ──
  const free = new Set(tri.boundaryEdgeIds);
  const internal = new Set(tri.internalEdgeIds);
  const selFree = selEdges.filter((e) => free.has(e));
  const selInternal = selEdges.filter((e) => internal.has(e));
  const interiorPunctures = useMemo(
    () => vertices(tri).map((v, i) => ({ label: i, regular: v.regular })).filter((v) => v.regular),
    [tri],
  );

  const build = {
    attach: () => selFree.length === 1 && applyOp((t) => attachTriangle(t, selFree[0]), `attach e${selFree[0]}`),
    glue: () => selFree.length === 2 && applyOp((t) => selfGlue(t, selFree[0], selFree[1]), `glue e${selFree[0]}+e${selFree[1]}`),
    cut: () => selInternal.length === 1 && applyOp((t) => cut(t, selInternal[0]), `cut e${selInternal[0]}`),
    addPuncture: (ti) => applyOp((t) => addPuncture(t, ti), `+punct t${ti}`),
    removePuncture: (v) => applyOp((t) => removePuncture(t, v), `−punct v${v}`),
  };

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setToast(`Copied ${what}`); }
    catch { setToast("Copy failed — select & copy manually"); }
  }
  function openBps() {
    if (typeof window !== "undefined") window.open(toBpsAppURL(tri), "_blank", "noopener");
    setToast("Opening the σ quiver in the BPS applet…");
  }
  function doImport() {
    try {
      const nt = parseTriangulationImport(importText);
      loadBase(nt, "", nt.name || "imported triangulation");
      setImportOpen(false); setImportText(""); setImportErr(""); setToast("Imported");
    } catch (e) { setImportErr(String(e.message || e)); }
  }
  function makePolygon() {
    const n = Math.max(3, Math.min(24, Math.trunc(polyN) || 5));
    loadBase(customPolygon(n), "", `A_𝖖[T[A₁,A${n - 3}]] — the ${n}-gon`);
  }

  const groups = presetGroups();
  const canPolygon = isSimplePolygon(tri);
  const views = [
    ...(canPolygon ? [["polygon", "Polygon"]] : []),
    ["developed", "Developed"],
    ["quiver", "σ quiver"],
  ];
  const opLabels = hist.slice(1).map((h) => h.label);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo alt">Sk</span>
          <div>
            <div className="title">Skein · triangulations</div>
            <div className="subtitle">A_𝖖[T[A₁, Σ]] · flips ≡ mutations · v0.2 (build)</div>
          </div>
        </div>

        <input className="name-input" value={tri.name}
          onChange={(e) => setHist((h) => [...h.slice(0, -1), { ...h[h.length - 1], tri: renameTriangulation(tri, e.target.value) }])}
          aria-label="Surface name" />

        <button onClick={() => setPresetsOpen(true)} title="Browse standard surfaces">📚 Presets</button>

        <label className="field poly">n-gon
          <span className="row" style={{ gap: 4 }}>
            <input type="number" min="3" max="24" value={polyN} onChange={(e) => setPolyN(e.target.value)} style={{ width: 52 }} />
            <button onClick={makePolygon} title="Build the fan-triangulated n-gon">Go</button>
          </span>
        </label>

        <div className="mode-toggle" role="group" aria-label="Interaction">
          <button className={mode === "flip" ? "on" : ""} onClick={() => { setMode("flip"); clearSel(); }} title="Click an internal edge to flip it (≡ mutation)">Flip</button>
          <button className={mode === "build" ? "on" : ""} onClick={() => setMode("build")} title="Select edges / triangles to attach, glue, cut, or add punctures">Build</button>
        </div>

        <div className="mode-toggle" role="group" aria-label="View">
          {views.map(([k, lbl]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{lbl}</button>
          ))}
        </div>

        <button className={showCompute ? "on" : ""} title={rec.ok ? `Connect to ${rec.ctor} and run the real K_𝖖 engine` : "Connect to the real SkeinKAlgebra (polygon disks)"}
          onClick={() => { const n = !showCompute; setShowCompute(n); if (n) startKernel(); }}>
          🔗 SkeinKAlgebra{rec.ok ? "" : " ·"}
        </button>

        <div className="spacer" />

        <button onClick={() => { setImportOpen(true); setImportErr(""); }}>Import…</button>
        <button onClick={() => copy(toTriangulationShareURL(tri), "share URL")}>Copy URL</button>
      </header>

      <main className="workspace">
        <div className="canvas-wrap">
          <TriangulationCanvas tri={tri} view={view} mode={mode}
            selEdges={new Set(selEdges)} selTriangle={selTriangle}
            onEdge={onEdge} onTriangle={onTriangle} />
          <div className="canvas-legend">
            {mode === "build"
              ? "Build: click free edges (bright) — 1 → Attach a triangle, 2 → Glue; click an internal edge → Cut; click a triangle → Add puncture. Actions in the panel →"
              : view === "polygon"
              ? "Flip · Polygon (disk): click a diagonal to flip it (≡ mutation). Boundary sides frozen; ▢ = marked points."
              : view === "developed"
              ? "Flip · Developed fundamental polygon: dashed = interior (click to flip); coloured pairs (same colour + arrow + label) = identified sides."
              : "Flip · dual σ_Δ quiver: ○ = internal (mutable) edge — click to flip; ▢ = boundary (frozen)."}
          </div>
        </div>

        <div className="panel-stack">
          {showCompute && <SkeinComputePanel rec={rec} kernel={kernel} />}
          {mode === "build" && (
            <BuildPanel tri={tri} selFree={selFree} selInternal={selInternal} selTriangle={selTriangle}
              interiorPunctures={interiorPunctures} build={build} />
          )}
          <TriangulationPanel tri={tri} presetNote={presetNote} flipLog={opLabels}
            onUndo={undo} onReset={reset}
            onCopyJSON={() => copy(toTriangulationJSON(tri), "JSON")}
            onCopyURL={() => copy(toTriangulationShareURL(tri), "share URL")}
            onCopyBpsJSON={() => copy(toBpsJSON(tri), "BPS JSON")}
            onOpenBps={openBps} />
        </div>
      </main>

      {presetsOpen && (
        <div className="modal-backdrop" onClick={() => setPresetsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Surface library</h3>
            <p className="hint">Ideal triangulations of marked surfaces — start from a single triangle and build by hand, or load a standard surface.</p>
            <div className="preset-tree">
              {groups.map((g) => (
                <details key={g.group} open>
                  <summary>{g.group}</summary>
                  <div className="tree-children">
                    {g.items.map((p) => (
                      <div key={p.key} className={`tree-leaf ${p.key === presetKey ? "active" : ""}`}
                        onClick={() => loadPreset(p.key)} title={p.note}>
                        {p.label} <span className="dim small">— {p.note}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <div className="row end"><button onClick={() => setPresetsOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import a triangulation</h3>
            <p className="hint">Paste a triangulation JSON or share URL. Schema: <code>{"{kind:\"triangulation\", n_punctures, edges, triangle_edges}"}</code> — the same FST data as <code>Triangulation.from_edge_data</code>.</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
              placeholder='{"kind":"triangulation","n_punctures":5,"edges":[[0,2],[0,3],...],"triangle_edges":[[2,3,0],...]}' rows={7} />
            {importErr && <div className="banner err">⚠ {importErr}</div>}
            <div className="row end">
              <button onClick={() => setImportOpen(false)}>Cancel</button>
              <button className="primary" onClick={doImport}>Load</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function noteFor(key) {
  const p = PRESETS.find((x) => x.key === key);
  return p ? p.note : "an ideal triangulation";
}
