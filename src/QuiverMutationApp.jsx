import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { R, AH, C, PRESETS, dc, makeInitial, parsePresetText, presetToJSON, buildShareURL, mutateQuiver, findSpecGen, fmtVec, fmtCharge, fmtChargeNeg, getEdges, svgPt, nodeAt, inPositiveCone } from "./quiver-core";
import { Celebration } from "./Celebration";

export default function QuiverMutationApp() {
  const [presets, setPresets] = useState(PRESETS);
  const init0 = makeInitial(PRESETS[1]);
  const [nodes, setNodes] = useState(init0.nodes);
  const [B, setB] = useState(init0.B);
  const [history, setHistory] = useState([]);
  const [mutLog, setMutLog] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [preset, setPreset] = useState(1);
  const [mode, setMode] = useState("mutate");
  const [flash, setFlash] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [drawFrom, setDrawFrom] = useState(null);
  const [drawMouse, setDrawMouse] = useState(null);
  const [specResult, setSpecResult] = useState(null);
  const [celebKey, setCelebKey] = useState(0);
  const [celebData, setCelebData] = useState({ count: 0, method: "" });
  const [specStep, setSpecStep] = useState(-1); // -1 = not guided, 0..n = current step
  const [searching, setSearching] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const wasDrag = useRef(false);
  const nextId = useRef(100);
  const hashLoadedRef = useRef(false);
  const [baselineGens, setBaselineGens] = useState(init0.nodes.map(nd => [...nd.charge]));
  const [showAllowed, setShowAllowed] = useState(false);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 500 });

  const svgRefCb = useCallback((el) => {
    svgRef.current = el;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSvgSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);

  const installPreset = useCallback((preset) => {
    const init = makeInitial(preset);
    setNodes(init.nodes); setB(init.B);
    setHistory([]);
    setMutLog(preset.mutLog
      ? preset.mutLog.map(m => ({ index: m.index, charge: Array.isArray(m.charge) ? [...m.charge] : [] }))
      : []);
    setFlash(null);
    setEditingCharge(null); setDrawFrom(null); setDrawMouse(null);
    setSpecResult(null); setSpecStep(-1);
    setBaselineGens(init.nodes.map(nd => [...nd.charge]));
  }, []);

  const loadPreset = useCallback((idx) => {
    installPreset(presets[idx]);
    setPreset(idx);
  }, [presets, installPreset]);

  const importPreset = useCallback((preset) => {
    setPresets(p => {
      const next = [...p, preset];
      setPreset(next.length - 1);
      return next;
    });
    installPreset(preset);
  }, [installPreset]);

  useEffect(() => {
    if (hashLoadedRef.current) return;
    hashLoadedRef.current = true;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;
    try {
      const preset = parsePresetText(hash);
      importPreset(preset);
    } catch (e) {
      console.warn("URL-hash preset failed to load:", e.message);
    }
  }, [importPreset]);

  // Celebrate when a spectrum-generator is discovered.
  useEffect(() => {
    if (specResult && specResult.charges) {
      setCelebData({ count: specResult.charges.length, method: specResult.method || "" });
      setCelebKey(k => k + 1);
    }
  }, [specResult]);

  const pushHistory = useCallback(() => {
    setHistory(h => [...h, { nodes: dc(nodes), B: dc(B), mutLog: dc(mutLog) }]);
  }, [nodes, B, mutLog]);

  const doMutate = useCallback((k) => {
    if (nodes[k].frozen) return;
    pushHistory();
    const chargeAtMutation = [...nodes[k].charge];
    const r = mutateQuiver(nodes, B, k);
    setNodes(r.nodes); setB(r.B);
    setMutLog(l => [...l, { index: k, charge: chargeAtMutation }]);
    setFlash(k); setTimeout(() => setFlash(null), 350);
    // Guided mode: advance if correct node, exit if wrong
    if (specResult && specResult.seq && specStep >= 0 && specStep < specResult.seq.length) {
      if (k === specResult.seq[specStep]) {
        const next = specStep + 1;
        setSpecStep(next);
        if (next === specResult.seq.length) {
          // User just landed the final guided mutation — celebrate.
          const total = specResult.charges ? specResult.charges.length : specResult.seq.length;
          setCelebData({ count: total, method: "completed by hand" });
          setCelebKey(c => c + 1);
        }
      } else {
        setSpecResult(null); setSpecStep(-1);
      }
    } else if (specResult && specResult.seq && specStep >= specResult.seq.length) {
      // Already completed; further mutations clear the display
      setSpecResult(null); setSpecStep(-1);
    } else {
      setSpecResult(null); setSpecStep(-1);
    }
  }, [nodes, B, pushHistory, specResult, specStep]);

  const undo = useCallback(() => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setNodes(prev.nodes); setB(prev.B); setMutLog(prev.mutLog || []);
    setHistory(h => h.slice(0, -1));
    // In guided mode, step back
    if (specResult && specResult.seq && specStep > 0) {
      setSpecStep(specStep - 1);
    } else if (!specResult) {
      setSpecStep(-1);
    }
  }, [history, specStep, specResult]);

  const reset = useCallback(() => { loadPreset(preset); }, [preset, loadPreset]);

  const addNodeAt = useCallback((x, y) => {
    if (x < R || x > svgSize.w-R || y < R || y > svgSize.h-R) return;
    pushHistory();
    const n = B.length, dim = n + 1;
    const nn = nodes.map(nd => ({ ...nd, charge: [...nd.charge, 0] }));
    nn.push({ id: nextId.current++, x, y, frozen: false,
      charge: Array.from({ length: dim }, (_, j) => j === n ? 1 : 0) });
    const newB = B.map(row => [...row, 0]);
    newB.push(Array(dim).fill(0));
    setNodes(nn); setB(newB); setSpecResult(null); setSpecStep(-1);
  }, [nodes, B, pushHistory, svgSize]);

  const addArrow = useCallback((from, to) => {
    if (from === to) return;
    pushHistory();
    const nb = dc(B); nb[from][to] += 1; nb[to][from] -= 1; setB(nb); setSpecResult(null); setSpecStep(-1);
  }, [B, pushHistory]);

  const removeNode = useCallback((idx) => {
    if (B.length <= 0) return;
    pushHistory();
    const nn = nodes.filter((_, i) => i !== idx).map(nd => ({
      ...nd, charge: nd.charge.filter((_, j) => j !== idx),
    }));
    const nb = B.filter((_, i) => i !== idx).map(row => row.filter((_, j) => j !== idx));
    setNodes(nn); setB(nb); setSpecResult(null); setSpecStep(-1);
  }, [nodes, B, pushHistory]);

  const toggleFrozen = useCallback((idx) => {
    const nn = dc(nodes); nn[idx].frozen = !nn[idx].frozen; setNodes(nn); setSpecResult(null); setSpecStep(-1);
  }, [nodes]);

  const editBCell = useCallback((i, j, delta) => {
    if (i === j) return;
    pushHistory();
    const nb = dc(B); nb[i][j] += delta; nb[j][i] -= delta; setB(nb); setSpecResult(null); setSpecStep(-1);
  }, [B, pushHistory]);

  const startEditCharge = (ni, ci) => { setEditingCharge({ ni, ci }); setEditVal(String(nodes[ni].charge[ci])); };
  const commitCharge = () => {
    if (!editingCharge) return;
    const v = parseInt(editVal);
    if (!isNaN(v)) { const nn = dc(nodes); nn[editingCharge.ni].charge[editingCharge.ci] = v; setNodes(nn); }
    setEditingCharge(null);
  };

  const canonicalizeCharges = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();
    const n = nodes.length;
    const nn = dc(nodes);
    for (let j = 0; j < n; j++)
      nn[j].charge = Array.from({ length: n }, (_, i) => i === j ? 1 : 0);
    setNodes(nn);
  }, [nodes, pushHistory]);

  const doFindSpecGen = useCallback(() => {
    if (nodes.length === 0) return;
    setMode("mutate");
    setDrawFrom(null); setDrawMouse(null); setEditingCharge(null);
    setSearching(true);
    setSpecResult(null); setSpecStep(-1);
    // Use current quiver state (user may have already mutated)
    setTimeout(() => {
      const result = findSpecGen(nodes, B, 5000);
      if (result) {
        setSpecResult(result);
        setSpecStep(0);
      } else {
        setSpecResult(false);
        setSpecStep(-1);
      }
      setSearching(false);
    }, 50);
  }, [nodes, B]);

  const doCompleteSpecGen = useCallback(() => {
    if (nodes.length === 0) return;
    const snap = baselineGens;
    if (!snap || snap.length !== nodes.length
        || (nodes[0] && snap[0] && snap[0].length !== nodes[0].charge.length)) {
      setSpecResult(false); setSpecStep(-1);
      return;
    }
    const mutableIdx = [];
    for (let i = 0; i < nodes.length; i++) if (!nodes[i].frozen) mutableIdx.push(i);
    const origGens = mutableIdx.map(i => [...snap[i]]);
    setMode("mutate");
    setDrawFrom(null); setDrawMouse(null); setEditingCharge(null);
    setSearching(true);
    setSpecResult(null); setSpecStep(-1);
    setTimeout(() => {
      const result = findSpecGen(nodes, B, 5000, origGens);
      if (result) {
        setSpecResult(result);
        setSpecStep(0);
      } else {
        setSpecResult(false);
        setSpecStep(-1);
      }
      setSearching(false);
    }, 50);
  }, [nodes, B, baselineGens]);

  const rebaseBaseline = useCallback(() => {
    if (nodes.length === 0) return;
    setBaselineGens(nodes.map(nd => [...nd.charge]));
    setMutLog([]);
    setHistory([]);
    setSpecResult(null); setSpecStep(-1);
  }, [nodes]);

  // ── Share / Import helpers ──
  const currentPreset = useMemo(() => {
    const obj = {
      name: presets[preset]?.name || "Custom",
      n: nodes.length,
      positions: nodes.map(nd => [Math.round(nd.x), Math.round(nd.y)]),
      frozen: nodes.map(nd => !!nd.frozen),
      B: dc(B),
      charges: nodes.map(nd => [...nd.charge]),
    };
    if (mutLog.length > 0) {
      obj.mutLog = mutLog.map(m => ({ index: m.index, charge: [...m.charge] }));
    }
    if (specResult && specResult.seq) {
      obj.spec = {
        seq: [...specResult.seq],
        charges: (specResult.charges || []).map(c => [...c]),
        method: specResult.method || "",
      };
    }
    return obj;
  }, [nodes, B, preset, presets, mutLog, specResult]);

  const exportJSON = useMemo(() => presetToJSON(currentPreset), [currentPreset]);

  const handleLoadImport = useCallback(() => {
    setImportError(""); setImportNote("");
    try {
      const p = parsePresetText(importText);
      importPreset(p);
      setImportNote(`Loaded "${p.name}" (n=${p.n})`);
    } catch (e) {
      setImportError(e.message);
    }
  }, [importText, importPreset]);

  const handleCopyURL = useCallback(async () => {
    setImportError(""); setImportNote("");
    try {
      const url = buildShareURL(currentPreset);
      await navigator.clipboard.writeText(url);
      setImportNote("Shareable URL copied to clipboard");
    } catch (e) {
      setImportError("Clipboard error: " + e.message);
    }
  }, [currentPreset]);

  const handleCopyJSON = useCallback(async () => {
    setImportError(""); setImportNote("");
    try {
      await navigator.clipboard.writeText(exportJSON);
      setImportNote("JSON copied to clipboard");
    } catch (e) {
      setImportError("Clipboard error: " + e.message);
    }
  }, [exportJSON]);

  // ── Mouse handlers ──
  const onSvgMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const sp = svgPt(svgRef.current, e);
    const hit = nodeAt(nodes, sp.x, sp.y);
    if (mode === "construct") {
      if (hit >= 0) { setDrawFrom(hit); setDrawMouse({ x: sp.x, y: sp.y }); }
      else addNodeAt(Math.round(sp.x), Math.round(sp.y));
    } else {
      if (hit >= 0) {
        e.preventDefault();
        dragRef.current = { idx: hit, startX: sp.x, startY: sp.y, origX: nodes[hit].x, origY: nodes[hit].y, moved: false };
      }
    }
  }, [nodes, mode, addNodeAt]);

  const onSvgMouseMove = useCallback((e) => {
    const sp = svgPt(svgRef.current, e);
    if (mode === "construct" && drawFrom !== null) {
      setDrawMouse({ x: sp.x, y: sp.y });
      const hit = nodeAt(nodes, sp.x, sp.y);
      setHovered(hit >= 0 && hit !== drawFrom ? hit : null);
      return;
    }
    if (dragRef.current) {
      const dx = sp.x - dragRef.current.startX, dy = sp.y - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
      if (dragRef.current.moved) {
        const nn = [...nodes];
        nn[dragRef.current.idx] = { ...nn[dragRef.current.idx],
          x: Math.max(R, Math.min(svgSize.w-R, dragRef.current.origX + dx)),
          y: Math.max(R, Math.min(svgSize.h-R, dragRef.current.origY + dy)) };
        setNodes(nn);
      }
    }
  }, [nodes, mode, drawFrom, svgSize]);

  const onSvgMouseUp = useCallback((e) => {
    if (mode === "construct" && drawFrom !== null) {
      const sp = svgPt(svgRef.current, e);
      const hit = nodeAt(nodes, sp.x, sp.y);
      if (hit >= 0 && hit !== drawFrom) addArrow(drawFrom, hit);
      setDrawFrom(null); setDrawMouse(null); setHovered(null);
      return;
    }
    if (dragRef.current) {
      wasDrag.current = dragRef.current.moved;
      dragRef.current = null;
    }
  }, [mode, drawFrom, nodes, addArrow, doMutate]);

  const onNodeContext = useCallback((e, idx) => {
    e.preventDefault();
    if (mode === "construct") removeNode(idx);
  }, [mode, removeNode]);

  const edges = getEdges(nodes, B);
  const mono = "'Menlo','Consolas','Monaco',monospace";

  // Per-node "allowed for spec-gen" flag: true if node's charge is still in the
  // positive cone of the (mutable) baseline generators. null = not applicable
  // (frozen, baseline dim mismatch, or feature off).
  const allowedFlags = useMemo(() => {
    if (!showAllowed || !baselineGens) return null;
    const n = nodes.length;
    if (baselineGens.length !== n) return null;
    for (let i = 0; i < n; i++) {
      if (!Array.isArray(baselineGens[i]) || baselineGens[i].length !== n) return null;
    }
    const mutGens = [];
    for (let i = 0; i < n; i++) if (!nodes[i].frozen) mutGens.push(baselineGens[i]);
    return nodes.map(nd => nd.frozen ? null : inPositiveCone(nd.charge, mutGens));
  }, [showAllowed, baselineGens, nodes]);

  const guidedNode = (specResult && specResult.seq && specStep >= 0 && specStep < specResult.seq.length)
    ? specResult.seq[specStep] : -1;

  const allNegated = nodes.length > 0 && mutLog.length > 0 && (() => {
    const n = nodes.length;
    const mutableIdx = [];
    for (let i = 0; i < n; i++) if (!nodes[i].frozen) mutableIdx.push(i);
    if (mutableIdx.length === 0) return false;
    // Project each mutable node's charge onto the mutable-index subspace and
    // check that the multiset equals { -e_p : p = 0..|mutable|-1 } — i.e. the
    // gauge charges are negated, frozen flavour components are ignored.
    const M = mutableIdx.length;
    const negSet = new Set();
    for (let p = 0; p < M; p++) {
      const v = Array(M).fill(0); v[p] = -1;
      negSet.add(v.join(","));
    }
    const curSet = new Set(mutableIdx.map(i =>
      mutableIdx.map(j => nodes[i].charge[j]).join(",")));
    if (curSet.size !== negSet.size) return false;
    for (const s of negSet) if (!curSet.has(s)) return false;
    return true;
  })();

  let tempArrow = null;
  if (drawFrom !== null && drawMouse && nodes[drawFrom]) {
    const nd = nodes[drawFrom];
    const dx = drawMouse.x - nd.x, dy = drawMouse.y - nd.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len > R) {
      const ux = dx/len, uy = dy/len;
      tempArrow = { x1: nd.x + R*ux, y1: nd.y + R*uy, x2: drawMouse.x, y2: drawMouse.y };
    }
  }

  const modeBtn = (m, label) => (
    <button onClick={() => { setMode(m); setDrawFrom(null); setDrawMouse(null); setEditingCharge(null); }}
      style={{ background: mode===m ? C.accent : "transparent", color: mode===m ? "#0f172a" : C.dim,
        border: `1px solid ${mode===m ? C.accent : C.border}`, borderRadius: 4,
        padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: mono, fontWeight: mode===m ? 700 : 400 }}>
      {label}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.bg, color:C.text, fontFamily:mono, fontSize:13, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderBottom:`1px solid ${C.border}`, background:C.card, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ fontWeight:700, fontSize:15, color:C.accent, letterSpacing:0.5, marginRight:4 }}>◇ Quiver Mutation</div>
        <select value={preset} onChange={e => loadPreset(+e.target.value)}
          style={{ background:C.bg, color:C.text, border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 8px", fontSize:12, fontFamily:mono }}>
          {presets.map((p,i) => <option key={i} value={i}>{p.name}</option>)}
        </select>
        <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
        {modeBtn("mutate", "Mutate")}
        {modeBtn("construct", "Construct")}
        <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
        <button onClick={undo} disabled={!history.length}
          style={{ background:history.length?C.border:"transparent", color:history.length?C.text:C.dim, border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 10px", cursor:history.length?"pointer":"default", fontSize:12, fontFamily:mono }}>↩ Undo</button>
        <button onClick={reset}
          style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:mono }}>⟲ Reset</button>
        <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
        <button onClick={doFindSpecGen} disabled={searching || nodes.length === 0}
          style={{ background: searching ? C.border : C.specgen, color: searching ? C.dim : "#0f172a",
            border: `1px solid ${searching ? C.border : C.specgen}`, borderRadius: 4,
            padding: "4px 12px", cursor: searching ? "wait" : "pointer", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>
          {searching ? "Searching…" : "Find S"}
        </button>
        <button onClick={doCompleteSpecGen} disabled={searching || nodes.length === 0}
          title="Complete S from the current state, treating the current baseline charges as the original generators."
          style={{ background: "transparent", color: searching ? C.dim : C.specgen,
            border: `1px solid ${C.specgen}`, borderRadius: 4,
            padding: "4px 12px", cursor: searching ? "wait" : "pointer", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>
          Complete S
        </button>
        <button onClick={rebaseBaseline} disabled={nodes.length === 0}
          title="Set the current state as the new baseline. Future Complete S searches and the allowed-mutation coloring use these charges as the original generators."
          style={{ background: "transparent", color: C.specgen,
            border: `1px dashed ${C.specgen}`, borderRadius: 4,
            padding: "4px 12px", cursor: nodes.length ? "pointer" : "default", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>
          ⟲ Rebase
        </button>
        <label title="Color mutable nodes by whether their charge is in the positive cone of the baseline (green = allowed next step toward S; red = mutating would back out)."
          style={{ display:"inline-flex", alignItems:"center", gap:5, color:C.dim, fontSize:11, fontFamily:mono,
            cursor:"pointer", padding:"3px 8px", border:`1px solid ${C.border}`, borderRadius:4,
            background: showAllowed ? "rgba(52,211,153,0.08)" : "transparent" }}>
          <input type="checkbox" checked={showAllowed} onChange={e => setShowAllowed(e.target.checked)}
            style={{ accentColor: C.green, cursor:"pointer" }}/>
          <span style={{ color: showAllowed ? C.green : C.dim }}>🟢 Allowed</span>
        </label>
        <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
        <button onClick={() => { setShowShare(true); setImportError(""); setImportNote(""); }}
          style={{ background: "transparent", color: C.accent,
            border: `1px solid ${C.accent}`, borderRadius: 4,
            padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>
          ⇄ Share
        </button>
        <div style={{ flex:1 }} />
        <a href="?mobile=1"
          onClick={(e) => {
            // Rebuild the share URL from the current (possibly edited) state so the
            // mobile view opens with whatever the user is looking at right now.
            e.preventDefault();
            try {
              const u = new URL(buildShareURL(currentPreset));
              u.searchParams.set("mobile", "1");
              window.location.href = u.toString();
            } catch {
              window.location.href = `?mobile=1${window.location.hash || ""}`;
            }
          }}
          title="Open the mobile-optimized version (touch UI, pinch/zoom, slide-up sheets). Preserves current state."
          style={{ color: C.dim, fontSize: 11, fontFamily: mono, textDecoration: "none",
            border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 8px" }}>
          Mobile ↗
        </a>
      </div>

      {/* Main */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {/* SVG */}
        <div style={{ flex:1, position:"relative", minWidth:0 }}>
          <svg ref={svgRefCb} width="100%" height="100%"
            style={{ display:"block", cursor: mode==="construct" ? "crosshair" : "default" }}
            onMouseDown={onSvgMouseDown} onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp} onMouseLeave={() => { setDrawFrom(null); setDrawMouse(null); }}>
            <defs>
              <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="mutGlow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            {Array.from({length:Math.floor(svgSize.w/50)},(_,i)=>Array.from({length:Math.floor(svgSize.h/50)},(_,j)=>(
              <circle key={`${i}-${j}`} cx={25+i*50} cy={25+j*50} r={0.7} fill={C.border} opacity={0.4}/>
            ))).flat()}
            {edges.map((e,i) => {
              const HS = 9;
              const useLabel = e.count > 3;
              const nHeads = useLabel ? 1 : e.count;
              const mx = (e.sx+e.tx)/2, my = (e.sy+e.ty)/2;
              return (
                <g key={i}>
                  <line x1={e.sx} y1={e.sy} x2={e.tx} y2={e.ty} stroke={C.arrow} strokeWidth={1.5}/>
                  {Array.from({length:nHeads},(_,h) => {
                    const d = (h-(nHeads-1)/2)*HS;
                    const tipX = mx+d*e.ux, tipY = my+d*e.uy;
                    const bl = {x:tipX-AH*0.45*e.ux-AH*0.5*e.px, y:tipY-AH*0.45*e.uy-AH*0.5*e.py};
                    const br = {x:tipX-AH*0.45*e.ux+AH*0.5*e.px, y:tipY-AH*0.45*e.uy+AH*0.5*e.py};
                    return <polygon key={h} points={`${tipX},${tipY} ${bl.x},${bl.y} ${br.x},${br.y}`} fill={C.arrow}/>;
                  })}
                  {useLabel && (
                    <text x={mx + 12*e.px} y={my + 12*e.py}
                      textAnchor="middle" dominantBaseline="central"
                      fill={C.dim} fontSize={12} fontFamily={mono} fontWeight={600}>
                      {e.count}
                    </text>
                  )}
                </g>
              );
            })}
            {tempArrow && (
              <line x1={tempArrow.x1} y1={tempArrow.y1} x2={tempArrow.x2} y2={tempArrow.y2}
                stroke={C.drawArrow} strokeWidth={2} strokeDasharray="6 4" opacity={0.8}/>
            )}
            {nodes.map((nd,i) => {
              const isH = (mode==="mutate" && hovered===i && !nd.frozen) || (mode==="construct" && hovered===i && drawFrom!==null && drawFrom!==i);
              const isF = flash===i;
              const isSource = drawFrom===i;
              const isGuided = guidedNode === i;
              const allowed = allowedFlags ? allowedFlags[i] : null;
              const handleNodeClick = (e) => {
                if (wasDrag.current) { wasDrag.current = false; return; }
                if (mode === "mutate" && !nd.frozen) {
                  e.stopPropagation();
                  doMutate(i);
                }
              };
              return (
                <g key={nd.id}
                  style={{ cursor: mode==="construct" ? (isSource ? "grabbing" : "pointer") : (nd.frozen ? "grab" : "pointer") }}
                  onMouseEnter={() => { if (mode==="mutate") setHovered(i); }}
                  onMouseLeave={() => { if (mode==="mutate") setHovered(null); }}
                  onClick={handleNodeClick}
                  onContextMenu={e => onNodeContext(e, i)}>
                  {allowed !== null && !isGuided && (
                    <circle cx={nd.x} cy={nd.y} r={R+4} fill="none"
                      stroke={allowed ? C.green : C.neg} strokeWidth={2.5}
                      opacity={0.85} filter="url(#glow)"/>
                  )}
                  {isGuided && !isF && (
                    <circle cx={nd.x} cy={nd.y} r={R+8} fill="none"
                      stroke={C.specgen} strokeWidth={2.5} opacity={0.7} filter="url(#glow)">
                      <animate attributeName="r" values={`${R+6};${R+11};${R+6}`} dur="1.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {(isH||isF||isSource) && !isGuided && <circle cx={nd.x} cy={nd.y} r={R+(allowed!==null?10:6)} fill="none"
                    stroke={isF?C.mutFlash:(isSource?C.drawArrow:C.hover)} strokeWidth={2}
                    opacity={isF?0.8:0.5} filter={isF?"url(#mutGlow)":"url(#glow)"}/>}
                  <circle cx={nd.x} cy={nd.y} r={R}
                    fill={nd.frozen?"transparent":(isGuided?"#2d1b4e":(isH?"#2a4a70":C.nodeFill))}
                    stroke={nd.frozen?C.frozenStroke:(isGuided?C.specgen:(isSource?C.drawArrow:(isH?C.hover:C.nodeStroke)))}
                    strokeWidth={nd.frozen?1.5:(isGuided?2.5:2)} strokeDasharray={nd.frozen?"5 3":"none"}/>
                  <text x={nd.x} y={nd.y+1} textAnchor="middle" dominantBaseline="central"
                    fill={isGuided?C.specgen:(isH?C.hover:(isSource?C.drawArrow:C.text))} fontSize={15} fontFamily={mono} fontWeight={600}>
                    {i+1}
                  </text>
                </g>
              );
            })}
            <text x={svgSize.w/2} y={svgSize.h-15} textAnchor="middle" fill={C.dim} fontSize={11} fontFamily={mono}>
              {mode==="construct"
                ? "Click empty space: add node · Drag node→node: add arrow · Right-click node: delete"
                : guidedNode >= 0
                  ? `Click highlighted node ${guidedNode+1} to continue the mutation sequence`
                  : "Click mutable node: mutate · Drag: reposition"}
            </text>
          </svg>
        </div>

        {/* Side Panel */}
        <div style={{ width:270, borderLeft:`1px solid ${C.border}`, background:C.card, overflowY:"auto", flexShrink:0 }}>
          {/* Exchange Matrix */}
          {nodes.length > 0 && (
            <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Exchange Matrix B</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ borderCollapse:"collapse", fontSize:12 }}>
                  <thead><tr>
                    <th style={{ padding:"3px 6px", color:C.dim }}></th>
                    {nodes.map((_,j) => <th key={j} style={{ padding:"3px 6px", color:nodes[j].frozen?C.frozenStroke:C.dim, fontWeight:400 }}>{j+1}</th>)}
                  </tr></thead>
                  <tbody>
                    {B.map((row,i) => (
                      <tr key={i}>
                        <td style={{ padding:"3px 6px", color:nodes[i].frozen?C.frozenStroke:C.dim, fontWeight:400 }}>{i+1}</td>
                        {row.map((v,j) => (
                          <td key={j}
                            onClick={() => mode==="construct" && i!==j && editBCell(i,j,1)}
                            onContextMenu={e => { e.preventDefault(); mode==="construct" && i!==j && editBCell(i,j,-1); }}
                            style={{ padding:"3px 8px", textAlign:"center", fontWeight:v?600:400,
                              color:v>0?C.pos:v<0?C.neg:"#475569",
                              background:mode==="construct"&&i!==j?"rgba(255,255,255,0.03)":"transparent",
                              cursor:mode==="construct"&&i!==j?"pointer":"default", borderRadius:2 }}>
                            {v>0?`+${v}`:v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mode==="construct" && <div style={{ fontSize:10, color:C.dim, marginTop:6 }}>Click cell: +1 · Right-click: −1</div>}
            </div>
          )}

          {/* Charges */}
          {nodes.length > 0 && (
            <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Charge Vectors</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {nodes.map((nd,ni) => (
                  <div key={ni} style={{ display:"flex", alignItems:"center", gap:4, fontSize:12 }}>
                    <span style={{ color:nd.frozen?C.frozenStroke:C.dim, width:16, flexShrink:0, textAlign:"right" }}>{ni+1}</span>
                    <span style={{ color:C.dim, fontSize:10 }}>→</span>
                    <span style={{ color:C.text }}>(</span>
                    {nd.charge.map((c,ci) => (
                      <span key={ci} style={{ display:"inline-flex", alignItems:"center" }}>
                        {mode==="construct" && editingCharge?.ni===ni && editingCharge?.ci===ci ? (
                          <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                            onBlur={commitCharge} onKeyDown={e => { if(e.key==="Enter") commitCharge(); if(e.key==="Escape") setEditingCharge(null); }}
                            style={{ width:28, background:C.bg, color:C.text, border:`1px solid ${C.accent}`, borderRadius:2, padding:"1px 2px", fontSize:12, fontFamily:mono, textAlign:"center" }}/>
                        ) : (
                          <span onClick={() => mode==="construct" && startEditCharge(ni,ci)}
                            style={{ cursor:mode==="construct"?"pointer":"default", color:c===0?"#475569":(c<0?C.neg:C.text),
                              fontWeight:c?600:400, minWidth:14, textAlign:"center",
                              background:mode==="construct"?"rgba(255,255,255,0.03)":"transparent", borderRadius:2, padding:"0 1px" }}>
                            {c}
                          </span>
                        )}
                        {ci<nd.charge.length-1 && <span style={{ color:C.dim }}>,</span>}
                      </span>
                    ))}
                    <span style={{ color:C.text }}>)</span>
                    {nd.frozen && <span style={{ color:C.frozenStroke, fontSize:9, marginLeft:4 }}>frozen</span>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                {mode==="construct" && (
                  <button onClick={() => toggleFrozen(nodes.length-1)} disabled={!nodes.length}
                    style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:10, fontFamily:mono }}>
                    Toggle last frozen
                  </button>
                )}
                <button onClick={canonicalizeCharges} disabled={!nodes.length}
                  style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:10, fontFamily:mono }}>
                  Reset charges (δᵢⱼ)
                </button>
              </div>
            </div>
          )}

          {/* Mutation Sequence */}
          <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Mutation Sequence</div>
            {mutLog.length===0 ? (
              <div style={{ fontSize:11, color:C.dim, fontStyle:"italic" }}>No mutations yet</div>
            ) : (
              <div style={{ fontSize:12, color:C.text, lineHeight:1.9, wordBreak:"break-word" }}>
                {mutLog.map((m,i) => (
                  <span key={i}>
                    <span style={{ color:C.green, fontWeight:600 }}>μ</span>
                    <sub style={{ fontSize:9, color:C.dim }}>{fmtVec(m.charge)}</sub>
                    {i<mutLog.length-1 && <span style={{ color:C.dim, margin:"0 3px" }}>·</span>}
                  </span>
                ))}
              </div>
            )}
            {mutLog.length>0 && <div style={{ fontSize:10, color:C.dim, marginTop:4 }}>{mutLog.length} mutation{mutLog.length!==1?"s":""}</div>}
            {allNegated && (
              <div style={{ fontSize:11, color:C.green, marginTop:6, fontWeight:600, padding:"4px 8px", background:"rgba(52,211,153,0.1)", borderRadius:4 }}>
                ✓ All charges negated — gives S
              </div>
            )}
          </div>

          {/* Spectrum Generator Result */}
          <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.specgen, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Spectrum Generator</div>
            {searching && (
              <div style={{ fontSize:11, color:C.specgen, fontStyle:"italic" }}>
                Searching for negating sequence…
              </div>
            )}
            {!searching && specResult === null && (
              <div style={{ fontSize:11, color:C.dim, fontStyle:"italic" }}>
                Press "Find S" to search
              </div>
            )}
            {!searching && specResult === false && (
              <div style={{ fontSize:11, color:C.neg, fontWeight:600, padding:"4px 8px", background:"rgba(239,68,68,0.1)", borderRadius:4 }}>
                No finite sequence found (infinite type?)
              </div>
            )}
            {!searching && specResult && specResult.charges && (() => {
              const total = specResult.charges.length;
              const step = specStep >= 0 ? specStep : total; // if done, all are consumed
              const done = step;
              const remaining = total - step;
              return (
                <div>
                  <div style={{ fontSize:11, color:C.green, fontWeight:600, marginBottom:6, padding:"4px 8px", background:"rgba(52,211,153,0.1)", borderRadius:4 }}>
                    ✓ {total} BPS states
                    {done > 0 && done < total && <span style={{ color:C.dim, fontWeight:400 }}> — {done}/{total} done</span>}
                    {done >= total && <span style={{ color:C.green }}> — complete!</span>}
                  </div>
                  {step < total && (
                    <div style={{ fontSize:10, color:C.specgen, marginBottom:6, padding:"3px 6px", background:"rgba(192,132,252,0.1)", borderRadius:3 }}>
                      Click node {specResult.seq[step]+1} to mutate
                    </div>
                  )}
                  <div style={{ fontSize:11.5, color:C.text, lineHeight:2.1, wordBreak:"break-word" }}>
                    {/* Remaining factors (upcoming) */}
                    {step < total && <span style={{ color:C.dim, fontSize:10 }}>S = </span>}
                    {specResult.charges.slice(step).map((c, i) => (
                      <span key={`r${i}`}>
                        <span style={{ color: i === 0 && step < total ? C.specgen : C.text, fontWeight: i === 0 && step < total ? 700 : 400 }}>
                          <span style={{ color: i === 0 && step < total ? C.specgen : C.dim }}>E</span>
                          <sub style={{ fontSize:9, color:C.dim }}>q</sub>
                          <span style={{ color:C.dim }}>(</span>
                          <span style={{ fontWeight:600 }}>{fmtCharge(c)}</span>
                          <span style={{ color:C.dim }}>)</span>
                        </span>
                        {i < remaining - 1 && <span style={{ color:C.dim, margin:"0 2px" }}>·</span>}
                      </span>
                    ))}
                    {/* Done factors (negated, at the back) */}
                    {done > 0 && (
                      <>
                        {remaining > 0 && <span style={{ color:C.dim, margin:"0 2px" }}>·</span>}
                        {specResult.charges.slice(0, done).map((c, i) => (
                            <span key={`d${i}`} style={{ opacity:0.45 }}>
                              <span style={{ color:C.dim }}>E</span>
                              <sub style={{ fontSize:9, color:C.dim }}>q</sub>
                              <span style={{ color:C.dim }}>(</span>
                              <span style={{ fontWeight:600, color:C.dim }}>{fmtChargeNeg(c)}</span>
                              <span style={{ color:C.dim }}>)</span>
                              {i < done - 1 && <span style={{ color:C.dim, margin:"0 2px" }}>·</span>}
                            </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <Celebration trigger={celebKey} count={celebData.count} method={celebData.method} />

      {showShare && (
        <div onClick={() => setShowShare(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8,
              padding:16, width:"min(740px, 94vw)", maxHeight:"88vh", overflow:"auto",
              display:"flex", flexDirection:"column", gap:12, color:C.text, fontFamily:mono }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, color:C.accent, fontSize:14, letterSpacing:0.5 }}>⇄ Share / Import</div>
              <button onClick={() => setShowShare(false)}
                style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4,
                  padding:"2px 10px", cursor:"pointer", fontSize:12, fontFamily:mono }}>✕</button>
            </div>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Import</div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:6, lineHeight:1.5 }}>
                Paste a preset JSON (<code>{`{name, n, positions, frozen, B, charges?}`}</code>),
                a full URL with <code>#&lt;json&gt;</code>, or a bare <code>#</code>-fragment.
                B must be antisymmetric with integer entries.
              </div>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6}
                placeholder='{"name":"K=4 amalgam","n":9,"positions":[[..,..],...],"frozen":[false,...],"B":[[0,...],...]}'
                style={{ width:"100%", boxSizing:"border-box", background:C.bg, color:C.text,
                  border:`1px solid ${C.border}`, borderRadius:4, padding:8, fontSize:12, fontFamily:mono,
                  resize:"vertical" }}/>
              <div style={{ display:"flex", gap:8, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
                <button onClick={handleLoadImport}
                  style={{ background:C.accent, color:"#0f172a", border:`1px solid ${C.accent}`, borderRadius:4,
                    padding:"4px 14px", cursor:"pointer", fontSize:12, fontFamily:mono, fontWeight:700 }}>
                  Load
                </button>
                <button onClick={() => { setImportText(""); setImportError(""); setImportNote(""); }}
                  style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4,
                    padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:mono }}>
                  Clear
                </button>
                {importError && <span style={{ color:C.neg, fontSize:11 }}>✗ {importError}</span>}
                {importNote && !importError && <span style={{ color:C.green, fontSize:11 }}>✓ {importNote}</span>}
              </div>
            </div>

            <div style={{ height:1, background:C.border }}/>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.specgen, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Mutation sequence</div>
              {mutLog.length === 0 ? (
                <div style={{ fontSize:11, color:C.dim, fontStyle:"italic" }}>No mutations applied yet.</div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"60px 1fr auto", rowGap:6, columnGap:8, alignItems:"center" }}>
                  <span style={{ fontSize:11, color:C.dim }}>0-based</span>
                  <input readOnly value={mutLog.map(m => m.index).join(",")}
                    onFocus={e => e.target.select()}
                    style={{ width:"100%", boxSizing:"border-box", background:C.bg, color:C.text,
                      border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 6px", fontSize:12, fontFamily:mono }}/>
                  <button onClick={async () => {
                      try { await navigator.clipboard.writeText(mutLog.map(m => m.index).join(",")); setImportNote("0-based sequence copied"); setImportError(""); }
                      catch (e) { setImportError("Clipboard error: " + e.message); }
                    }}
                    style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4,
                      padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:mono }}>Copy</button>
                  <span style={{ fontSize:11, color:C.dim }}>1-based</span>
                  <input readOnly value={mutLog.map(m => m.index + 1).join(",")}
                    onFocus={e => e.target.select()}
                    style={{ width:"100%", boxSizing:"border-box", background:C.bg, color:C.text,
                      border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 6px", fontSize:12, fontFamily:mono }}/>
                  <button onClick={async () => {
                      try { await navigator.clipboard.writeText(mutLog.map(m => m.index + 1).join(",")); setImportNote("1-based sequence copied"); setImportError(""); }
                      catch (e) { setImportError("Clipboard error: " + e.message); }
                    }}
                    style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4,
                      padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:mono }}>Copy</button>
                </div>
              )}
              {mutLog.length > 0 && (
                <div style={{ fontSize:10, color:C.dim, marginTop:6 }}>
                  {mutLog.length} mutation{mutLog.length !== 1 ? "s" : ""} applied. Charges-at-mutation are preserved in the JSON export below.
                </div>
              )}
              {specResult && specResult.seq && specResult.seq.length > 0 && (
                <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(192,132,252,0.08)", border:`1px solid ${C.specgen}`, borderRadius:4 }}>
                  <div style={{ fontSize:11, color:C.specgen, fontWeight:700, marginBottom:6 }}>
                    Auto-found S ({specResult.method || "?"}, {specResult.seq.length} steps)
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"60px 1fr auto", rowGap:6, columnGap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:C.dim }}>0-based</span>
                    <input readOnly value={specResult.seq.join(",")}
                      onFocus={e => e.target.select()}
                      style={{ width:"100%", boxSizing:"border-box", background:C.bg, color:C.text,
                        border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 6px", fontSize:12, fontFamily:mono }}/>
                    <button onClick={async () => {
                        try { await navigator.clipboard.writeText(specResult.seq.join(",")); setImportNote("auto-found 0-based S copied"); setImportError(""); }
                        catch (e) { setImportError("Clipboard error: " + e.message); }
                      }}
                      style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4,
                        padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:mono }}>Copy</button>
                    <span style={{ fontSize:11, color:C.dim }}>1-based</span>
                    <input readOnly value={specResult.seq.map(k => k + 1).join(",")}
                      onFocus={e => e.target.select()}
                      style={{ width:"100%", boxSizing:"border-box", background:C.bg, color:C.text,
                        border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 6px", fontSize:12, fontFamily:mono }}/>
                    <button onClick={async () => {
                        try { await navigator.clipboard.writeText(specResult.seq.map(k => k + 1).join(",")); setImportNote("auto-found 1-based S copied"); setImportError(""); }
                        catch (e) { setImportError("Clipboard error: " + e.message); }
                      }}
                      style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:4,
                        padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:mono }}>Copy</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ height:1, background:C.border }}/>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.accent, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Export current state</div>
              <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                <button onClick={handleCopyURL}
                  style={{ background:C.accent, color:"#0f172a", border:`1px solid ${C.accent}`, borderRadius:4,
                    padding:"4px 12px", cursor:"pointer", fontSize:12, fontFamily:mono, fontWeight:700 }}>
                  Copy shareable URL
                </button>
                <button onClick={handleCopyJSON}
                  style={{ background:"transparent", color:C.text, border:`1px solid ${C.border}`, borderRadius:4,
                    padding:"4px 12px", cursor:"pointer", fontSize:12, fontFamily:mono }}>
                  Copy JSON
                </button>
              </div>
              <textarea readOnly value={exportJSON} rows={12}
                style={{ width:"100%", boxSizing:"border-box", background:C.bg, color:C.text,
                  border:`1px solid ${C.border}`, borderRadius:4, padding:8, fontSize:12, fontFamily:mono,
                  resize:"vertical" }}/>
              <div style={{ fontSize:10, color:C.dim, marginTop:4 }}>
                Includes current node positions, frozen flags, B-matrix, and charge vectors (post any mutations applied in this session).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
