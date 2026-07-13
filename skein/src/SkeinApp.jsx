import React, { useEffect, useState } from "react";
import TriangulationCanvas from "./components/TriangulationCanvas.jsx";
import TriangulationPanel from "./components/TriangulationPanel.jsx";
import {
  flip, applyFlips, renameTriangulation, canFlip,
} from "./model/triangulation.js";
import {
  presetByKey, presetGroups, customPolygon, PRESETS,
} from "./model/triangulation_presets.js";
import { isSimplePolygon, defaultView } from "./model/triangulation_layout.js";
import {
  toTriangulationJSON, toTriangulationShareURL, parseTriangulationImport,
  triangulationFromLocationHash, toBpsJSON, toBpsAppURL,
} from "./model/triangulation_share.js";

const DEFAULT_KEY = "p5";

export default function SkeinApp() {
  const [base, setBase] = useState(() => triangulationFromLocationHash() || presetByKey(DEFAULT_KEY));
  const [flipLog, setFlipLog] = useState([]);
  const [tri, setTri] = useState(base);
  const [presetKey, setPresetKey] = useState(DEFAULT_KEY);
  const [presetNote, setPresetNote] = useState(noteFor(DEFAULT_KEY));
  const [view, setView] = useState(() => defaultView(base));
  const [selected, setSelected] = useState(-1);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [polyN, setPolyN] = useState(5);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  function loadBase(nt, key = "", note = "an ideal triangulation") {
    setBase(nt); setTri(nt); setFlipLog([]); setSelected(-1);
    setPresetKey(key); setPresetNote(note);
    setView(defaultView(nt));
  }

  function loadPreset(key) {
    const p = presetByKey(key);
    if (p) loadBase(p, key, noteFor(key));
    setPresetsOpen(false);
  }

  function doFlip(edge) {
    if (!canFlip(tri, edge)) { setToast("that edge can't be flipped (boundary or self-folded)"); return; }
    const log = [...flipLog, edge];
    setTri(flip(tri, edge));
    setFlipLog(log);
    setSelected(-1);
  }
  function undo() {
    const log = flipLog.slice(0, -1);
    setTri(applyFlips(base, log)); setFlipLog(log);
  }
  function reset() { setTri(base); setFlipLog([]); }

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setToast(`Copied ${what}`); }
    catch { setToast("Copy failed — select & copy manually"); }
  }
  function openBps() {
    const url = toBpsAppURL(tri);
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
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

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo alt">Sk</span>
          <div>
            <div className="title">Skein · triangulations</div>
            <div className="subtitle">A_𝖖[T[A₁, Σ]] · flips ≡ mutations · v0.1</div>
          </div>
        </div>

        <input className="name-input" value={tri.name}
          onChange={(e) => setTri((t) => renameTriangulation(t, e.target.value))} aria-label="Surface name" />

        <button onClick={() => setPresetsOpen(true)} title="Browse standard surfaces">📚 Presets</button>

        <label className="field poly">n-gon
          <span className="row" style={{ gap: 4 }}>
            <input type="number" min="3" max="24" value={polyN}
              onChange={(e) => setPolyN(e.target.value)} style={{ width: 52 }} />
            <button onClick={makePolygon} title="Build the fan-triangulated n-gon">Go</button>
          </span>
        </label>

        <div className="mode-toggle" role="group" aria-label="View">
          {views.map(([k, lbl]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{lbl}</button>
          ))}
        </div>

        <div className="spacer" />

        <button onClick={() => { setImportOpen(true); setImportErr(""); }}>Import…</button>
        <button onClick={() => copy(toTriangulationShareURL(tri), "share URL")}>Copy URL</button>
      </header>

      <main className="workspace">
        <div className="canvas-wrap">
          <TriangulationCanvas tri={tri} view={view} selected={selected}
            onFlip={doFlip} onSelectEdge={setSelected} />
          <div className="canvas-legend">
            {view === "polygon"
              ? "Polygon (disk): click a diagonal to flip it (≡ mutation). Boundary sides are frozen; ▢ = marked points."
              : view === "developed"
              ? "Developed fundamental polygon: dashed = interior edges (click to flip); thick = boundary; coloured pairs (same colour + arrow + label) = identified sides."
              : "Dual exchange quiver of σ_Δ: ○ = internal (mutable) edge — click to flip; ▢ = boundary (frozen)."}
          </div>
        </div>
        <TriangulationPanel tri={tri} presetNote={presetNote} flipLog={flipLog}
          onUndo={undo} onReset={reset}
          onCopyJSON={() => copy(toTriangulationJSON(tri), "JSON")}
          onCopyURL={() => copy(toTriangulationShareURL(tri), "share URL")}
          onCopyBpsJSON={() => copy(toBpsJSON(tri), "BPS JSON")}
          onOpenBps={openBps} />
      </main>

      {presetsOpen && (
        <div className="modal-backdrop" onClick={() => setPresetsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Surface library</h3>
            <p className="hint">Ideal triangulations of marked surfaces — polygons, closed spheres, and higher genus. Pick one to load it.</p>
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
