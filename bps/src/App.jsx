import React, { useEffect, useRef, useState } from "react";
import QuiverCanvas from "./components/QuiverCanvas.jsx";
import SidePanel from "./components/SidePanel.jsx";
import PresetTree from "./components/PresetTree.jsx";
import { makeQuiver, emptyQuiver, renameQuiver, removeNode, autoArrange, nodeLabel, mutate, applyMutations, spectrumStatus, sameMatrix, toConstructorPayload, greenNodes, guidedHead, onSpecPath } from "./model/quiver.js";
import { presetByKey } from "./model/presets.js";
import { toJSONString, toShareURL, parseImport, quiverFromLocationHash } from "./model/share.js";
import { onKernelStatus, kernelStatus, killKernel } from "./compute/kernel.js";
import { findSpectrumExact, findSpec, findSpecBFS, exportDiagnostics } from "./compute/bps.js";

const DEFAULT_KEY = "a1a2";
const APP_VERSION = "v0.15 (spec necklace)";

export default function App() {
  const [quiver, setQuiver] = useState(() => quiverFromLocationHash() || makeQuiver(presetByKey(DEFAULT_KEY)));
  const [mutBase, setMutBase] = useState(quiver);   // quiver before the current mutation sequence
  const [mutLog, setMutLog] = useState([]);          // [{index, dir}]
  const [presetKey, setPresetKey] = useState(DEFAULT_KEY);
  const [mode, setMode] = useState("arrange");
  const [selected, setSelected] = useState(-1);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [toast, setToast] = useState("");
  const canvasRef = useRef(null);

  // compute (real BPSKAlgebra via Pyodide)
  const [kernel, setKernel] = useState({ status: "idle", ready: false, statusMsg: "" });
  const [computing, setComputing] = useState(false);
  const [exactS, setExactS] = useState(null);       // { terms, K } or null
  const [computeMsg, setComputeMsg] = useState("");
  const [diagJson, setDiagJson] = useState("");     // last diagnostics report (JSON string)
  const [guideSpec, setGuideSpec] = useState(null); // { seq, charges } — the Mutate-tab spec guide

  useEffect(() => onKernelStatus(setKernel), []);
  // a computed S is stale once the arrows / node count change (moves are fine)
  useEffect(() => { setExactS(null); setComputeMsg(""); }, [JSON.stringify(quiver.B), quiver.nodes.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  async function doFindSExact() {
    setComputing(true); setComputeMsg(""); setExactS(null);
    try {
      const out = await findSpectrumExact(toConstructorPayload(quiver));
      setExactS(out);
      if (!out.terms.length) setComputeMsg("No S returned (chart may have no finite spectrum generator).");
    } catch (e) {
      setComputeMsg(String(e.message || e));
    } finally {
      setComputing(false);
    }
  }

  // Commit a found spec: attach it to the quiver (payload + S section), make it
  // the fresh mutation base, arm the Mutate-tab guide, and jump to Mutate mode so
  // the head node is immediately highlighted for walking.
  function commitFoundSpec(seq, charges, method) {
    const nq = { ...quiver, spec: { seq: seq || [], charges, method } };
    setQuiver(nq); setMutBase(nq); setMutLog([]);
    setGuideSpec({ seq: seq || [], charges });
    setMode("mutate");
  }

  // Primary spec-finder: bidirectional BFS over the mutation graph (fast; no
  // build_S).  Writes both the found mutation sequence and the ordered spec.
  async function doFindSpecBFS() {
    setComputing(true); setComputeMsg("");
    try {
      const { seq, spec } = await findSpecBFS(toConstructorPayload(quiver));
      if (spec === null) {
        setComputeMsg("No negating sequence within depth 25 (wild/infinite chamber, or raise the depth).");
      } else {
        commitFoundSpec(seq, spec, "BFS");
        setToast(`Spec found (BFS) — ${spec.length} BPS states · follow the ★ head`);
      }
    } catch (e) {
      setComputeMsg(String(e.message || e));
    } finally {
      setComputing(false);
    }
  }

  // Exact spec via build_S (slow; can blow up on higher rank — prefer BFS).  No
  // mutation sequence, so the guide shows the necklace + green moves (no ★ head).
  async function doFindSpec() {
    setComputing(true); setComputeMsg("");
    try {
      const { spec } = await findSpec(toConstructorPayload(quiver));
      if (spec === null) {
        setComputeMsg("No finite-chamber spec found (wild chart / raise the cutoff).");
      } else {
        commitFoundSpec([], spec, "S->spec");
        setToast(`Spec found — ${spec.length} BPS states`);
      }
    } catch (e) {
      setComputeMsg(String(e.message || e));
    } finally {
      setComputing(false);
    }
  }

  // ▶ Restart the guided walk from the base quiver (re-enter Mutate mode).
  function followSpec() {
    if (!guideSpec) return;
    setQuiver(mutBase); setMutLog([]); setMode("mutate");
    setToast("Following spec — click the ★ head node");
  }

  // Terminate a runaway/slow compute (e.g. an exact build_S) and respawn the
  // kernel, so the UI is usable again immediately.
  function doCancel() {
    killKernel();
    setComputing(false);
    setComputeMsg("Compute cancelled — kernel restarted. It will reload on the next run.");
  }

  // Self-test / paste-back diagnostics: assemble the JS-side context (kernel
  // state, bundle source, environment) + a bounded Python-side self-test into one
  // JSON blob the user can copy back into a chat for debugging.  The JS half is
  // rendered instantly, before the (timeout-bounded) Python probe, so the panel
  // is never blank — even when a busy worker can't answer.
  function diagJsContext(pyResult) {
    const k = kernelStatus();       // fresh, not the render-time snapshot
    return {
      diagnostics: "kalgebra-bps-applet",
      js: {
        app_version: APP_VERSION,
        when: new Date().toISOString(),
        href: (typeof location !== "undefined" && location.href) || null,
        userAgent: (typeof navigator !== "undefined" && navigator.userAgent) || null,
        kernel: { status: k.status, ready: k.ready, bundleSource: k.bundleSource || null, statusMsg: k.statusMsg || "" },
        computing,
        quiver: { name: quiver.name, n: quiver.nodes.length, B: quiver.B },
      },
      python: pyResult,
    };
  }
  async function doDiagnostics() {
    // Render the JS context immediately so the button always visibly does
    // something, even if the kernel is loading or busy.
    setDiagJson(JSON.stringify(diagJsContext("probing… (kernel self-test running)"), null, 2));
    let py;
    try {
      py = await exportDiagnostics(toConstructorPayload(quiver));
    } catch (e) {
      py = { ok: false, kernel_error: String(e.message || e) };
    }
    const report = JSON.stringify(diagJsContext(py), null, 2);
    setDiagJson(report);
    try { await navigator.clipboard.writeText(report); setToast("Diagnostics copied — paste them back"); }
    catch { setToast("Diagnostics ready — copy from the panel"); }
  }

  function newBaseQuiver(nq) {
    setQuiver(nq); setMutBase(nq); setMutLog([]);
    // seed the guide from an imported/preset spec if present, else clear it
    setGuideSpec(nq.spec?.charges?.length ? { seq: nq.spec.seq || [], charges: nq.spec.charges } : null);
  }

  function loadPreset(key) {
    setPresetKey(key);
    const p = presetByKey(key);
    newBaseQuiver(p && p.key === "empty" ? emptyQuiver() : makeQuiver(p));
    setSelected(-1);
    setPresetsOpen(false);
  }

  // structural (B / node-count) edits from Construct start a fresh mutation base
  function handleChange(newQ) {
    setQuiver(newQ);
    if (newQ.nodes.length !== quiver.nodes.length || !sameMatrix(newQ.B, quiver.B)) {
      setMutBase(newQ); setMutLog([]); setGuideSpec(null);   // spec no longer valid
    }
  }

  function doMutate(k, dir) {
    const newLog = [...mutLog, { index: k, dir }];
    const nq = mutate(quiver, k, dir);
    const st = spectrumStatus(mutBase, newLog);
    if (st.complete) {
      nq.spec = { seq: newLog.map((s) => s.index), charges: st.specCharges, method: "mutation" };
      // arm the necklace guide from a hand-found spectrum generator (forward-only
      // walks give a replayable sequence; otherwise keep the charges necklace)
      setGuideSpec({ seq: newLog.every((s) => s.dir > 0) ? newLog.map((s) => s.index) : [], charges: st.specCharges });
    }
    setQuiver(nq);
    setMutLog(newLog);
    if (st.complete) setToast("Spectrum generator found — necklace closed!");
  }

  function undoMutation() {
    const newLog = mutLog.slice(0, -1);
    setQuiver(applyMutations(mutBase, newLog));
    setMutLog(newLog);
  }
  function clearMutations() { setQuiver(mutBase); setMutLog([]); }

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setToast(`Copied ${what}`); }
    catch { setToast("Copy failed — select & copy manually"); }
  }

  function doImport() {
    try {
      const q = parseImport(importText);
      newBaseQuiver(q); setPresetKey(""); setImportOpen(false); setImportText(""); setImportErr(""); setToast("Imported");
    } catch (e) { setImportErr(String(e.message || e)); }
  }

  function deleteSelected() {
    if (selected < 0) return;
    setQuiver((q) => removeNode(q, selected));
    setSelected(-1);
  }

  function resetQuiver() {
    if (presetKey && presetByKey(presetKey)) loadPreset(presetKey);
    else { newBaseQuiver(emptyQuiver()); setSelected(-1); setToast("Reset to empty"); }
  }

  function doAutoArrange() {
    const el = canvasRef.current;
    const w = el?.clientWidth || 600, h = el?.clientHeight || 460;
    setQuiver((q) => autoArrange(q, w, h));
    setToast("Auto-arranged");
  }

  const spectrum = spectrumStatus(mutBase, mutLog);

  // Mutate-tab guide: green = admissible "green" moves in the running quiver;
  // head = the next node in the found sequence (cyclic necklace), shown only
  // while the walk is faithfully following the spec.
  const specSeq = guideSpec?.seq || [];
  const following = onSpecPath(specSeq, mutLog);
  const green = mode === "mutate" ? greenNodes(quiver, mutBase.nodes.map((nd) => nd.charge)) : [];
  const headNode = mode === "mutate" && following ? guidedHead(specSeq, mutLog.length) : -1;
  const necklace = guideSpec
    ? { charges: guideSpec.charges, hasSeq: specSeq.length > 0, following,
        pos: specSeq.length ? mutLog.length % specSeq.length : mutLog.length,
        lap: specSeq.length ? Math.floor(mutLog.length / specSeq.length) : 0 }
    : null;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo">K𝖖</span>
          <div>
            <div className="title">KAlgebra Applets</div>
            <div className="subtitle">BPS quiver · {APP_VERSION}</div>
          </div>
        </div>

        <input className="name-input" value={quiver.name}
          onChange={(e) => setQuiver((q) => renameQuiver(q, e.target.value))} aria-label="Quiver name" />

        <button onClick={() => setPresetsOpen(true)} title="Browse the preset library">📚 Presets</button>
        <button onClick={doAutoArrange} title="Prettify: auto-arrange the nodes into a clean force-directed layout">✨ Auto-arrange</button>
        <button onClick={resetQuiver} title="Reset to the loaded preset (or empty)">⟲ Reset</button>

        <div className="mode-toggle" role="group" aria-label="Mode">
          <button className={mode === "arrange" ? "on" : ""} onClick={() => setMode("arrange")}
            title="Drag nodes to reposition">Move</button>
          <button className={mode === "construct" ? "on" : ""} onClick={() => setMode("construct")}
            title="Drag between nodes = arrow · click empty = add node · click node = select · right-click = delete">Construct</button>
          <button className={mode === "mutate" ? "on" : ""} onClick={() => setMode("mutate")}
            title="Left-click a node = mutation μ_k · right-click = inverse μ_k⁻¹">Mutate</button>
        </div>

        {selected >= 0 && selected < quiver.nodes.length && (
          <span className="sel-chip">
            {nodeLabel(quiver, selected).text}
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
          <QuiverCanvas quiver={quiver} onChange={handleChange} onMutate={doMutate} mode={mode} selected={selected} onSelect={setSelected}
            greenNodes={green} headNode={headNode} />
          <div className="canvas-legend">
            {mode === "construct"
              ? "Construct: drag between nodes = draw an arrow (drag the reverse to remove) · click empty = add node · click node = select · right-click = delete"
              : mode === "mutate"
              ? "Mutate: left-click = μ_k · right-click = inverse · ★ gold ring = next spec node (follow it) · green ring = admissible move · charges below; all negated ⇒ spectrum generator"
              : "Move: drag a node to reposition (display only)"}
          </div>
        </div>
        <SidePanel quiver={quiver} onChange={handleChange} onCopy={copy}
          mutLog={mutLog} spectrum={spectrum} onUndoMutation={undoMutation} onClearMutations={clearMutations}
          necklace={necklace} onFollowSpec={followSpec} mode={mode}
          kernel={kernel} computing={computing} exactS={exactS} computeMsg={computeMsg}
          onFindSpecBFS={doFindSpecBFS} onFindSExact={doFindSExact} onFindSpec={doFindSpec} onCancel={doCancel}
          onDiagnostics={doDiagnostics} diagJson={diagJson} onCopyDiag={() => copy(diagJson, "diagnostics")} />
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
