import React, { useEffect, useState } from "react";
import QuiverCanvas from "./components/QuiverCanvas.jsx";
import SidePanel from "./components/SidePanel.jsx";
import { makeQuiver, emptyQuiver, renameQuiver } from "./model/quiver.js";
import { PRESETS, presetByKey, presetGroups } from "./model/presets.js";
import { toJSONString, toShareURL, parseImport, quiverFromLocationHash } from "./model/share.js";

const DEFAULT_KEY = "a2-pentagon";

export default function App() {
  const [quiver, setQuiver] = useState(() =>
    quiverFromLocationHash() || makeQuiver(presetByKey(DEFAULT_KEY))
  );
  const [presetKey, setPresetKey] = useState(DEFAULT_KEY);
  const [mode, setMode] = useState("edit");
  const [selected, setSelected] = useState(-1);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [toast, setToast] = useState("");

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
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`Copied ${what}`);
    } catch {
      setToast(`Copy failed — select & copy manually`);
    }
  }

  function doImport() {
    try {
      const q = parseImport(importText);
      setQuiver(q);
      setPresetKey("");
      setImportOpen(false);
      setImportText("");
      setImportErr("");
      setToast("Imported");
    } catch (e) {
      setImportErr(String(e.message || e));
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo">K𝖖</span>
          <div>
            <div className="title">KAlgebra Applets</div>
            <div className="subtitle">BPS quiver input · v0.1</div>
          </div>
        </div>

        <input
          className="name-input"
          value={quiver.name}
          onChange={(e) => setQuiver((q) => renameQuiver(q, e.target.value))}
          aria-label="Quiver name"
        />

        <label className="field">
          Preset
          <select value={presetKey} onChange={(e) => loadPreset(e.target.value)}>
            {presetKey === "" && <option value="">(imported)</option>}
            {presetGroups().map(({ group, items }) => (
              <optgroup key={group} label={group}>
                {items.map((p) => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="mode-toggle" role="group" aria-label="Edit mode">
          <button className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")} title="Add nodes, draw arrows, freeze, delete">Edit</button>
          <button className={mode === "move" ? "on" : ""} onClick={() => setMode("move")} title="Drag nodes to reposition">Move</button>
        </div>

        <div className="spacer" />

        <button onClick={() => { setImportOpen(true); setImportErr(""); }}>Import…</button>
        <button onClick={() => copy(toJSONString(quiver), "JSON")}>Copy JSON</button>
        <button onClick={() => copy(toShareURL(quiver), "share URL")}>Copy URL</button>
      </header>

      <main className="workspace">
        <div className="canvas-wrap">
          <QuiverCanvas quiver={quiver} onChange={setQuiver} mode={mode} selected={selected} onSelect={setSelected} />
          <div className="canvas-legend">
            {mode === "edit"
              ? "Edit: click empty = add node · click node→node = arrow · dbl-click = freeze · shift-click = delete · right-click node→node = reverse"
              : "Move: drag a node to reposition (display only)"}
          </div>
        </div>
        <SidePanel quiver={quiver} onChange={setQuiver} onCopy={copy} />
      </main>

      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import a quiver</h3>
            <p className="hint">Paste a JSON object, a share URL, or a <code>#</code>-fragment. Schema: <code>{"{name, n, positions, frozen, B, charges?, spec?}"}</code> — compatible with the repo's <code>clusterapplet_url.py</code>.</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"name":"A₂ pentagon","n":2,"B":[[0,1],[-1,0]]}'
              rows={7}
            />
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
