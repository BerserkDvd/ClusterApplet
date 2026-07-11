import React, { useEffect, useRef, useState } from "react";
import QuiverCanvas from "./components/QuiverCanvas.jsx";
import SidePanel from "./components/SidePanel.jsx";
import PresetTree from "./components/PresetTree.jsx";
import { makeQuiver, emptyQuiver, renameQuiver, removeNode, setNodeKind, addNode, autoArrange } from "./model/quiver.js";
import { presetByKey } from "./model/presets.js";
import { toJSONString, toShareURL, parseImport, quiverFromLocationHash } from "./model/share.js";

const DEFAULT_KEY = "a1a2";

export default function App() {
  const [quiver, setQuiver] = useState(() => quiverFromLocationHash() || makeQuiver(presetByKey(DEFAULT_KEY)));
  const [presetKey, setPresetKey] = useState(DEFAULT_KEY);
  const [mode, setMode] = useState("construct");
  const [selected, setSelected] = useState(-1);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [toast, setToast] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  function loadPreset(key) {
    setPresetKey(key);
    const p = presetByKey(key);
    setQuiver(p && p.key === "empty" ? emptyQuiver() : makeQuiver(p));
    setSelected(-1);
    setPresetsOpen(false);
  }

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setToast(`Copied ${what}`); }
    catch { setToast("Copy failed — select & copy manually"); }
  }

  function doImport() {
    try {
      const q = parseImport(importText);
      setQuiver(q); setPresetKey(""); setImportOpen(false); setImportText(""); setImportErr(""); setToast("Imported");
    } catch (e) { setImportErr(String(e.message || e)); }
  }

  function deleteSelected() {
    if (selected < 0) return;
    setQuiver((q) => removeNode(q, selected));
    setSelected(-1);
  }

  function addFraming() {
    setSelected(quiver.nodes.length);
    setQuiver((q) => addNode(q, 300, 235, "framing"));
    setMode("construct");
  }

  function resetQuiver() {
    if (presetKey && presetByKey(presetKey)) loadPreset(presetKey);
    else { setQuiver(emptyQuiver()); setSelected(-1); setToast("Reset to empty"); }
  }

  function doAutoArrange() {
    const el = canvasRef.current;
    const w = el?.clientWidth || 600, h = el?.clientHeight || 460;
    setQuiver((q) => autoArrange(q, w, h));
    setToast("Auto-arranged");
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo">K𝖖</span>
          <div>
            <div className="title">KAlgebra Applets</div>
            <div className="subtitle">BPS quiver input · v0.5</div>
          </div>
        </div>

        <input className="name-input" value={quiver.name}
          onChange={(e) => setQuiver((q) => renameQuiver(q, e.target.value))} aria-label="Quiver name" />

        <button onClick={() => setPresetsOpen(true)} title="Browse the preset library">📚 Presets</button>
        <button onClick={addFraming} title="Add a framing node (square) — an extended charge γ outside the BPS lattice, defining an extended F_γ">+ ▪ Framing</button>
        <button onClick={doAutoArrange} title="Prettify: auto-arrange the nodes into a clean force-directed layout">✨ Auto-arrange</button>
        <button onClick={resetQuiver} title="Reset to the loaded preset (or empty)">⟲ Reset</button>

        <div className="mode-toggle" role="group" aria-label="Mode">
          <button className={mode === "construct" ? "on" : ""} onClick={() => setMode("construct")}
            title="Drag between nodes = arrow · click empty = add node · click node = select · right-click = delete">Construct</button>
          <button className={mode === "arrange" ? "on" : ""} onClick={() => setMode("arrange")}
            title="Drag nodes to reposition">Move</button>
        </div>

        {selected >= 0 && selected < quiver.nodes.length && (
          <span className="sel-chip">
            {quiver.nodes[selected].kind === "framing" ? "framing" : "gauge"} node
            <button className="chip-btn"
              title="Convert between a gauge (BPS, circle) node and a framing (extended-charge, square) node"
              onClick={() => setQuiver((q) => setNodeKind(q, selected, q.nodes[selected].kind === "framing" ? "gauge" : "framing"))}>
              {quiver.nodes[selected].kind === "framing" ? "→ gauge" : "→ framing"}
            </button>
            <button className="chip-x" title="Delete this node" onClick={deleteSelected}>✕</button>
          </span>
        )}

        <div className="spacer" />

        <button onClick={() => { setImportOpen(true); setImportErr(""); }}>Import…</button>
        <button onClick={() => copy(toJSONString(quiver), "JSON")}>Copy JSON</button>
        <button onClick={() => copy(toShareURL(quiver), "share URL")}>Copy URL</button>
      </header>

      <main className="workspace">
        <div className="canvas-wrap" ref={canvasRef}>
          <QuiverCanvas quiver={quiver} onChange={setQuiver} mode={mode} selected={selected} onSelect={setSelected} />
          <div className="canvas-legend">
            {mode === "construct"
              ? "Construct: drag between nodes = draw an arrow (drag the reverse to remove) · click empty = add node · click node = select · right-click = delete · + ▪ Framing adds a square"
              : "Move: drag a node to reposition (display only)"}
          </div>
        </div>
        <SidePanel quiver={quiver} onChange={setQuiver} onCopy={copy} />
      </main>

      {presetsOpen && (
        <div className="modal-backdrop" onClick={() => setPresetsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Preset library</h3>
            <p className="hint">Standard 4d N=2 BPS quivers. Pick one to load it.</p>
            <PresetTree onPick={loadPreset} activeKey={presetKey} />
            <div className="row end"><button onClick={() => setPresetsOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import a quiver</h3>
            <p className="hint">Paste a JSON object, a share URL, or a <code>#</code>-fragment. Schema: <code>{"{name, n, positions, frozen, B, charges?, spec?}"}</code> — compatible with the repo's <code>clusterapplet_url.py</code>.</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
              placeholder='{"name":"A₂ pentagon","n":2,"B":[[0,1],[-1,0]]}' rows={7} />
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
