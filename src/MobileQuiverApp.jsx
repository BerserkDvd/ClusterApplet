import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  R, C, PRESETS,
  dc, makeInitial, parsePresetText, presetToJSON, buildShareURL,
  mutateQuiver, findSpecGen,
  fmtVec, fmtCharge, fmtChargeNeg, getEdges, nodeAt,
} from "./quiver-core";

const MONO = "'Menlo','Consolas','Monaco',monospace";
const TOUCH_R = 36;        // hit-test radius in world units (larger than visual R=24 for fingers)
const TAP_MS = 350;
const LONG_PRESS_MS = 550;
const MOVE_THRESH = 8;     // px in screen space to count as drag

export default function MobileQuiverApp() {
  const [presets, setPresets] = useState(PRESETS);
  const init0 = makeInitial(PRESETS[1]);
  const [nodes, setNodes] = useState(init0.nodes);
  const [B, setB] = useState(init0.B);
  const [history, setHistory] = useState([]);
  const [mutLog, setMutLog] = useState([]);
  const [preset, setPreset] = useState(1);
  const [mode, setMode] = useState("mutate"); // "mutate" | "construct"
  const [flash, setFlash] = useState(null);
  const [drawFrom, setDrawFrom] = useState(null);
  const [drawTo, setDrawTo] = useState(null); // {x,y} in world coords
  const [specResult, setSpecResult] = useState(null);
  const [specStep, setSpecStep] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // null | "menu" | "B" | "γ" | "μ" | "S" | "⇄"
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState({ tx: 0, ty: 0, s: 1 });
  const [vbSize, setVbSize] = useState({ w: 900, h: 700 });

  const svgRef = useRef(null);
  const nextId = useRef(100);
  const hashLoadedRef = useRef(false);
  const initialChargesRef = useRef(init0.nodes.map(nd => [...nd.charge]));
  const gesture = useRef(null);   // active gesture state
  const longPressTimer = useRef(null);
  const pointers = useRef(new Map());

  // Toast helper
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(t => t === msg ? "" : t), 1800);
  }, []);

  // Auto-fit on preset change. vbW/vbH default to current vbSize to handle initial mount race.
  const autoFit = useCallback((nds, vbW, vbH) => {
    const W = vbW || vbSize.w, H = vbH || vbSize.h;
    if (!nds.length) { setView({ tx: 0, ty: 0, s: 1 }); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const nd of nds) {
      if (nd.x < minX) minX = nd.x; if (nd.x > maxX) maxX = nd.x;
      if (nd.y < minY) minY = nd.y; if (nd.y > maxY) maxY = nd.y;
    }
    const pad = 60;
    const w = (maxX - minX) + 2*pad, h = (maxY - minY) + 2*pad;
    const s = Math.min(W / w, H / h, 2);
    const tx = -(minX - pad) * s + (W - w*s) / 2;
    const ty = -(minY - pad) * s + (H - h*s) / 2;
    setView({ tx, ty, s });
  }, [vbSize]);

  const installPreset = useCallback((p) => {
    const init = makeInitial(p);
    setNodes(init.nodes); setB(init.B);
    setHistory([]);
    setMutLog(p.mutLog
      ? p.mutLog.map(m => ({ index: m.index, charge: Array.isArray(m.charge) ? [...m.charge] : [] }))
      : []);
    setFlash(null);
    setDrawFrom(null); setDrawTo(null);
    setSpecResult(null); setSpecStep(-1);
    initialChargesRef.current = init.nodes.map(nd => [...nd.charge]);
    autoFit(init.nodes);
  }, [autoFit]);

  const loadPreset = useCallback((idx) => {
    installPreset(presets[idx]);
    setPreset(idx);
  }, [presets, installPreset]);

  const importPreset = useCallback((p) => {
    setPresets(arr => {
      const next = [...arr, p];
      setPreset(next.length - 1);
      return next;
    });
    installPreset(p);
  }, [installPreset]);

  // URL-hash preset auto-load
  useEffect(() => {
    if (hashLoadedRef.current) return;
    hashLoadedRef.current = true;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;
    try {
      const p = parsePresetText(hash);
      importPreset(p);
    } catch (e) {
      console.warn("URL-hash preset failed to load:", e.message);
    }
  }, [importPreset]);

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
    if (specResult && specResult.seq && specStep >= 0 && specStep < specResult.seq.length) {
      if (k === specResult.seq[specStep]) setSpecStep(specStep + 1);
      else { setSpecResult(null); setSpecStep(-1); }
    } else if (specResult && specResult.seq && specStep >= specResult.seq.length) {
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
    if (specResult && specResult.seq && specStep > 0) setSpecStep(specStep - 1);
    else if (!specResult) setSpecStep(-1);
  }, [history, specStep, specResult]);

  const reset = useCallback(() => { loadPreset(preset); }, [preset, loadPreset]);

  const addNodeAt = useCallback((x, y) => {
    pushHistory();
    const n = B.length, dim = n + 1;
    const nn = nodes.map(nd => ({ ...nd, charge: [...nd.charge, 0] }));
    nn.push({
      id: nextId.current++, x, y, frozen: false,
      charge: Array.from({ length: dim }, (_, j) => j === n ? 1 : 0),
    });
    const newB = B.map(row => [...row, 0]);
    newB.push(Array(dim).fill(0));
    setNodes(nn); setB(newB); setSpecResult(null); setSpecStep(-1);
  }, [nodes, B, pushHistory]);

  const addArrow = useCallback((from, to) => {
    if (from === to) return;
    pushHistory();
    const nb = dc(B); nb[from][to] += 1; nb[to][from] -= 1;
    setB(nb); setSpecResult(null); setSpecStep(-1);
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
    const nn = dc(nodes); nn[idx].frozen = !nn[idx].frozen;
    setNodes(nn); setSpecResult(null); setSpecStep(-1);
  }, [nodes]);

  const editBCell = useCallback((i, j, delta) => {
    if (i === j) return;
    pushHistory();
    const nb = dc(B); nb[i][j] += delta; nb[j][i] -= delta;
    setB(nb); setSpecResult(null); setSpecStep(-1);
  }, [B, pushHistory]);

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
    setDrawFrom(null); setDrawTo(null);
    setSearching(true);
    setSpecResult(null); setSpecStep(-1);
    setTimeout(() => {
      const result = findSpecGen(nodes, B, 5000);
      if (result) { setSpecResult(result); setSpecStep(0); }
      else { setSpecResult(false); setSpecStep(-1); }
      setSearching(false);
    }, 50);
  }, [nodes, B]);

  const doCompleteSpecGen = useCallback(() => {
    if (nodes.length === 0) return;
    const snap = initialChargesRef.current;
    if (!snap || snap.length !== nodes.length
        || (nodes[0] && snap[0] && snap[0].length !== nodes[0].charge.length)) {
      setSpecResult(false); setSpecStep(-1);
      return;
    }
    const mutableIdx = [];
    for (let i = 0; i < nodes.length; i++) if (!nodes[i].frozen) mutableIdx.push(i);
    const origGens = mutableIdx.map(i => [...snap[i]]);
    setMode("mutate");
    setDrawFrom(null); setDrawTo(null);
    setSearching(true);
    setSpecResult(null); setSpecStep(-1);
    setTimeout(() => {
      const result = findSpecGen(nodes, B, 5000, origGens);
      if (result) { setSpecResult(result); setSpecStep(0); }
      else { setSpecResult(false); setSpecStep(-1); }
      setSearching(false);
    }, 50);
  }, [nodes, B]);

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
    try {
      const url = buildShareURL(currentPreset);
      await navigator.clipboard.writeText(url);
      showToast("URL copied");
    } catch (e) { showToast("Clipboard error"); }
  }, [currentPreset, showToast]);

  const handleCopyJSON = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportJSON);
      showToast("JSON copied");
    } catch (e) { showToast("Clipboard error"); }
  }, [exportJSON, showToast]);

  // ── Coordinate transforms ──
  // screenToViewBox: screen px → viewBox coords, correctly handling letterboxing.
  const screenToViewBox = useCallback((sx, sy) => {
    const el = svgRef.current;
    if (!el || !el.getScreenCTM) return { x: sx, y: sy };
    const ctm = el.getScreenCTM();
    if (!ctm) return { x: sx, y: sy };
    const pt = el.createSVGPoint();
    pt.x = sx; pt.y = sy;
    const v = pt.matrixTransform(ctm.inverse());
    return { x: v.x, y: v.y };
  }, []);

  const screenToWorld = useCallback((sx, sy) => {
    const v = screenToViewBox(sx, sy);
    return { x: (v.x - view.tx) / view.s, y: (v.y - view.ty) / view.s };
  }, [view, screenToViewBox]);

  // ── Pointer gesture handling ──
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const el = svgRef.current;
    if (!el) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    pointers.current.set(e.pointerId, { sx: e.clientX, sy: e.clientY });

    if (pointers.current.size === 2) {
      // begin pinch
      cancelLongPress();
      const ps = [...pointers.current.values()];
      const dx = ps[0].sx - ps[1].sx, dy = ps[0].sy - ps[1].sy;
      gesture.current = {
        kind: "pinch",
        startDist: Math.hypot(dx, dy),
        startCenter: { x: (ps[0].sx + ps[1].sx)/2, y: (ps[0].sy + ps[1].sy)/2 },
        startView: { ...view },
      };
      setDrawFrom(null); setDrawTo(null);
      return;
    }

    if (pointers.current.size !== 1) return;

    const w = screenToWorld(e.clientX, e.clientY);
    const hit = nodeAt(nodes, w.x, w.y, TOUCH_R);
    gesture.current = {
      kind: "pending",
      startSX: e.clientX, startSY: e.clientY,
      startWX: w.x, startWY: w.y,
      startTime: Date.now(),
      hit, hitMode: mode,
      origNodeX: hit >= 0 ? nodes[hit].x : 0,
      origNodeY: hit >= 0 ? nodes[hit].y : 0,
      startView: { ...view },
      moved: false,
    };

    if (hit >= 0 && mode === "construct") {
      // Long-press to delete
      longPressTimer.current = setTimeout(() => {
        if (gesture.current && gesture.current.kind === "pending" && gesture.current.hit === hit && !gesture.current.moved) {
          if (window.confirm(`Delete node ${hit + 1}?`)) removeNode(hit);
          gesture.current = null;
        }
        longPressTimer.current = null;
      }, LONG_PRESS_MS);
    }
  }, [nodes, mode, view, screenToWorld, cancelLongPress, removeNode]);

  const onPointerMove = useCallback((e) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.sx = e.clientX; p.sy = e.clientY;

    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const ps = [...pointers.current.values()];
      const dx = ps[0].sx - ps[1].sx, dy = ps[0].sy - ps[1].sy;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / g.startDist;
      const newS = Math.max(0.2, Math.min(6, g.startView.s * ratio));
      // Anchor zoom around the pinch's starting screen center, expressed in viewBox coords.
      const vc = screenToViewBox(g.startCenter.x, g.startCenter.y);
      // world point under the pinch center (using the view that was active when pinch began)
      const wx = (vc.x - g.startView.tx) / g.startView.s;
      const wy = (vc.y - g.startView.ty) / g.startView.s;
      const tx = vc.x - wx * newS;
      const ty = vc.y - wy * newS;
      setView({ tx, ty, s: newS });
      return;
    }

    if (g.kind === "pending") {
      const dx = e.clientX - g.startSX, dy = e.clientY - g.startSY;
      if (!g.moved && (Math.abs(dx) > MOVE_THRESH || Math.abs(dy) > MOVE_THRESH)) {
        g.moved = true;
        cancelLongPress();
        // Decide drag kind
        if (g.hit >= 0 && g.hitMode === "mutate" && !nodes[g.hit].frozen) {
          g.kind = "dragNode";
        } else if (g.hit >= 0 && g.hitMode === "construct") {
          g.kind = "drawArrow";
          setDrawFrom(g.hit);
        } else if (g.hit >= 0 && g.hitMode === "mutate" && nodes[g.hit].frozen) {
          g.kind = "dragNode";
        } else {
          g.kind = "panView";
        }
      }
    }

    if (g.kind === "dragNode") {
      const w = screenToWorld(e.clientX, e.clientY);
      const dwx = w.x - g.startWX, dwy = w.y - g.startWY;
      setNodes(nds => {
        const nn = [...nds];
        nn[g.hit] = { ...nn[g.hit],
          x: Math.max(R, Math.min(2000, g.origNodeX + dwx)),
          y: Math.max(R, Math.min(2000, g.origNodeY + dwy)) };
        return nn;
      });
    } else if (g.kind === "drawArrow") {
      const w = screenToWorld(e.clientX, e.clientY);
      setDrawTo({ x: w.x, y: w.y });
    } else if (g.kind === "panView") {
      // Translate screen delta into viewBox delta via CTM.
      const a = screenToViewBox(g.startSX, g.startSY);
      const b = screenToViewBox(e.clientX, e.clientY);
      setView({
        tx: g.startView.tx + (b.x - a.x),
        ty: g.startView.ty + (b.y - a.y),
        s: g.startView.s,
      });
    }
  }, [nodes, screenToWorld, cancelLongPress]);

  const onPointerUp = useCallback((e) => {
    const el = svgRef.current;
    if (el) { try { el.releasePointerCapture(e.pointerId); } catch {} }
    pointers.current.delete(e.pointerId);
    cancelLongPress();

    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pinch") {
      // If one pointer remains, drop into idle (don't smoothly transition to pan)
      gesture.current = null;
      return;
    }

    if (g.kind === "pending" && !g.moved) {
      // Tap
      const dt = Date.now() - g.startTime;
      if (dt <= TAP_MS + 200) {
        if (g.hit >= 0) {
          if (g.hitMode === "mutate") doMutate(g.hit);
          // construct mode tap on node: nothing (drag-to-arrow / long-press-to-delete)
        } else {
          if (g.hitMode === "construct") {
            const w = screenToWorld(e.clientX, e.clientY);
            if (w.x >= R && w.x <= 2000 && w.y >= R && w.y <= 2000)
              addNodeAt(Math.round(w.x), Math.round(w.y));
          }
          // mutate mode tap on empty: nothing
        }
      }
    } else if (g.kind === "drawArrow") {
      const w = screenToWorld(e.clientX, e.clientY);
      const hit = nodeAt(nodes, w.x, w.y, TOUCH_R);
      if (hit >= 0 && hit !== g.hit) addArrow(g.hit, hit);
      setDrawFrom(null); setDrawTo(null);
    }
    // dragNode and panView: handled in move

    gesture.current = null;
  }, [doMutate, addNodeAt, addArrow, nodes, screenToWorld, cancelLongPress]);

  const onPointerCancel = useCallback((e) => {
    pointers.current.delete(e.pointerId);
    cancelLongPress();
    gesture.current = null;
    setDrawFrom(null); setDrawTo(null);
  }, [cancelLongPress]);

  // Disable browser pinch-zoom / pull-to-refresh on the canvas
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onTouchMove = (e) => { if (e.touches && e.touches.length >= 2) e.preventDefault(); };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  // Track SVG container size so viewBox matches 1:1 (no letterboxing). On meaningful
  // resize (e.g. portrait↔landscape) we re-fit so the quiver stays visible.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastFitKey = "";
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const r = entry.contentRect;
        if (r.width <= 0 || r.height <= 0) continue;
        const w = Math.round(r.width), h = Math.round(r.height);
        setVbSize(prev => (prev.w === w && prev.h === h) ? prev : { w, h });
        const key = `${w}x${h}`;
        if (key !== lastFitKey) {
          lastFitKey = key;
          // refit on first meaningful size and on orientation flips
          autoFit(nodes, w, h);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ──
  const edges = useMemo(() => getEdges(nodes, B), [nodes, B]);

  const guidedNode = (specResult && specResult.seq && specStep >= 0 && specStep < specResult.seq.length)
    ? specResult.seq[specStep] : -1;

  const allNegated = nodes.length > 0 && mutLog.length > 0 && (() => {
    const n = nodes.length;
    const mutableIdx = [];
    for (let i = 0; i < n; i++) if (!nodes[i].frozen) mutableIdx.push(i);
    if (mutableIdx.length === 0) return false;
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
  if (drawFrom !== null && drawTo && nodes[drawFrom]) {
    const nd = nodes[drawFrom];
    const dx = drawTo.x - nd.x, dy = drawTo.y - nd.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len > R) {
      const ux = dx/len, uy = dy/len;
      tempArrow = { x1: nd.x + R*ux, y1: nd.y + R*uy, x2: drawTo.x, y2: drawTo.y };
    }
  }

  const switchToDesktop = useCallback(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("mobile", "0");
    window.location.href = u.toString();
  }, []);

  const resetView = useCallback(() => autoFit(nodes), [autoFit, nodes]);

  // ── Render ──
  return (
    <div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column",
      background:C.bg, color:C.text, fontFamily:MONO, fontSize:13, overflow:"hidden",
      WebkitTapHighlightColor:"transparent" }}>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 10px",
        borderBottom:`1px solid ${C.border}`, background:C.card, flexShrink:0 }}>
        <div style={{ fontWeight:700, fontSize:14, color:C.accent }}>◇</div>
        <select value={preset} onChange={e => loadPreset(+e.target.value)}
          style={{ flex:1, minWidth:0, background:C.bg, color:C.text,
            border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 6px",
            fontSize:12, fontFamily:MONO }}>
          {presets.map((p,i) => <option key={i} value={i}>{p.name}</option>)}
        </select>
        <button onClick={() => setActiveSheet("menu")}
          style={{ background:"transparent", color:C.text,
            border:`1px solid ${C.border}`, borderRadius:6,
            padding:"6px 10px", fontSize:14, fontFamily:MONO, cursor:"pointer" }}>
          ☰
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex:1, position:"relative", minHeight:0, background:C.bg }}>
        <svg ref={svgRef}
          width="100%" height="100%"
          viewBox={`0 0 ${vbSize.w} ${vbSize.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{ display:"block", touchAction:"none", userSelect:"none" }}>
          <defs>
            <filter id="m-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="m-mutGlow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`}>
            {/* edges */}
            {edges.map((e, i) => {
              const HS = 9, AH_ = 9;
              const useLabel = e.count > 3;
              const nHeads = useLabel ? 1 : e.count;
              const mx = (e.sx+e.tx)/2, my = (e.sy+e.ty)/2;
              return (
                <g key={i}>
                  <line x1={e.sx} y1={e.sy} x2={e.tx} y2={e.ty} stroke={C.arrow} strokeWidth={1.8}/>
                  {Array.from({length:nHeads},(_,h) => {
                    const d = (h-(nHeads-1)/2)*HS;
                    const tipX = mx+d*e.ux, tipY = my+d*e.uy;
                    const bl = {x:tipX-AH_*0.45*e.ux-AH_*0.5*e.px, y:tipY-AH_*0.45*e.uy-AH_*0.5*e.py};
                    const br = {x:tipX-AH_*0.45*e.ux+AH_*0.5*e.px, y:tipY-AH_*0.45*e.uy+AH_*0.5*e.py};
                    return <polygon key={h} points={`${tipX},${tipY} ${bl.x},${bl.y} ${br.x},${br.y}`} fill={C.arrow}/>;
                  })}
                  {useLabel && (
                    <text x={mx + 14*e.px} y={my + 14*e.py}
                      textAnchor="middle" dominantBaseline="central"
                      fill={C.dim} fontSize={13} fontFamily={MONO} fontWeight={600}>
                      {e.count}
                    </text>
                  )}
                </g>
              );
            })}

            {/* draft arrow */}
            {tempArrow && (
              <line x1={tempArrow.x1} y1={tempArrow.y1} x2={tempArrow.x2} y2={tempArrow.y2}
                stroke={C.drawArrow} strokeWidth={2.5} strokeDasharray="6 4" opacity={0.8}/>
            )}

            {/* nodes */}
            {nodes.map((nd, i) => {
              const isF = flash === i;
              const isSource = drawFrom === i;
              const isGuided = guidedNode === i;
              return (
                <g key={nd.id}>
                  {isGuided && !isF && (
                    <circle cx={nd.x} cy={nd.y} r={R+8} fill="none"
                      stroke={C.specgen} strokeWidth={2.5} opacity={0.7} filter="url(#m-glow)">
                      <animate attributeName="r" values={`${R+6};${R+11};${R+6}`} dur="1.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {(isF || isSource) && !isGuided && (
                    <circle cx={nd.x} cy={nd.y} r={R+6} fill="none"
                      stroke={isF ? C.mutFlash : C.drawArrow} strokeWidth={2}
                      opacity={isF ? 0.8 : 0.5} filter={isF ? "url(#m-mutGlow)" : "url(#m-glow)"}/>
                  )}
                  <circle cx={nd.x} cy={nd.y} r={R}
                    fill={nd.frozen ? "transparent" : (isGuided ? "#2d1b4e" : C.nodeFill)}
                    stroke={nd.frozen ? C.frozenStroke : (isGuided ? C.specgen : (isSource ? C.drawArrow : C.nodeStroke))}
                    strokeWidth={nd.frozen ? 1.5 : (isGuided ? 2.5 : 2)}
                    strokeDasharray={nd.frozen ? "5 3" : "none"}/>
                  <text x={nd.x} y={nd.y+1} textAnchor="middle" dominantBaseline="central"
                    fill={isGuided ? C.specgen : (isSource ? C.drawArrow : C.text)}
                    fontSize={16} fontFamily={MONO} fontWeight={600}>
                    {i+1}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Mode + status overlay (top of canvas) */}
        <div style={{ position:"absolute", top:6, left:6, right:6, display:"flex", gap:6, pointerEvents:"none" }}>
          <div style={{ pointerEvents:"auto", display:"inline-flex", gap:0,
            background:"rgba(15,23,42,0.85)", border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            <button onClick={() => { setMode("mutate"); setDrawFrom(null); setDrawTo(null); }}
              style={{ background: mode==="mutate" ? C.accent : "transparent",
                color: mode==="mutate" ? "#0f172a" : C.dim,
                border:"none", padding:"6px 12px", fontSize:12, fontFamily:MONO,
                fontWeight: mode==="mutate" ? 700 : 400, cursor:"pointer" }}>
              Mutate
            </button>
            <button onClick={() => { setMode("construct"); setDrawFrom(null); setDrawTo(null); }}
              style={{ background: mode==="construct" ? C.accent : "transparent",
                color: mode==="construct" ? "#0f172a" : C.dim,
                border:"none", padding:"6px 12px", fontSize:12, fontFamily:MONO,
                fontWeight: mode==="construct" ? 700 : 400, cursor:"pointer" }}>
              Construct
            </button>
          </div>
          <div style={{ flex:1 }} />
          <button onClick={resetView}
            style={{ pointerEvents:"auto", background:"rgba(15,23,42,0.85)",
              color:C.dim, border:`1px solid ${C.border}`, borderRadius:8,
              padding:"6px 10px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
            ⊡ Fit
          </button>
        </div>

        {/* Status line (bottom of canvas) */}
        <div style={{ position:"absolute", bottom:6, left:8, right:8,
          fontSize:11, color:C.dim, textAlign:"center", pointerEvents:"none",
          textShadow:"0 1px 2px rgba(0,0,0,0.8)" }}>
          {mode === "construct"
            ? "Tap empty: add · Drag node→node: arrow · Long-press: delete · 2-finger: zoom"
            : guidedNode >= 0
              ? `Tap node ${guidedNode+1} to continue the spectrum sequence`
              : "Tap node: mutate · Drag node: reposition · Pinch: zoom · Drag bg: pan"}
        </div>

        {searching && (
          <div style={{ position:"absolute", inset:0, display:"flex",
            alignItems:"center", justifyContent:"center",
            background:"rgba(15,23,42,0.6)", color:C.specgen,
            fontSize:14, fontFamily:MONO, pointerEvents:"none" }}>
            Searching…
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{ display:"flex", borderTop:`1px solid ${C.border}`, background:C.card, flexShrink:0 }}>
        <TabBtn label="↩" onClick={undo} disabled={!history.length} accent={C.text} />
        <TabBtn label="B" onClick={() => setActiveSheet("B")} accent={C.accent} />
        <TabBtn label="γ" onClick={() => setActiveSheet("γ")} accent={C.accent} />
        <TabBtn label={`μ${mutLog.length ? "·"+mutLog.length : ""}`} onClick={() => setActiveSheet("μ")} accent={allNegated ? C.green : C.accent} />
        <TabBtn label="S" onClick={() => setActiveSheet("S")} accent={C.specgen} highlight={!!specResult} />
        <TabBtn label="⇄" onClick={() => setActiveSheet("⇄")} accent={C.accent} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:"absolute", left:"50%", bottom:80, transform:"translateX(-50%)",
          background:"rgba(52,211,153,0.95)", color:"#0f172a", fontSize:12,
          padding:"6px 14px", borderRadius:20, fontFamily:MONO, fontWeight:700,
          pointerEvents:"none", zIndex:2000 }}>
          {toast}
        </div>
      )}

      {/* Sheets */}
      {activeSheet && (
        <Sheet onClose={() => setActiveSheet(null)} title={
          activeSheet === "menu" ? "Menu" :
          activeSheet === "B" ? "Exchange Matrix B" :
          activeSheet === "γ" ? "Charge Vectors" :
          activeSheet === "μ" ? "Mutation Sequence" :
          activeSheet === "S" ? "Spectrum Generator" :
          activeSheet === "⇄" ? "Share / Import" : ""
        }>
          {activeSheet === "menu" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <MenuBtn onClick={() => { reset(); setActiveSheet(null); }}>⟲ Reset preset</MenuBtn>
              <MenuBtn onClick={() => { resetView(); setActiveSheet(null); }}>⊡ Fit to view</MenuBtn>
              <MenuBtn onClick={() => { setActiveSheet(null); doFindSpecGen(); }}
                disabled={searching || nodes.length===0}
                style={{ color: C.specgen, borderColor: C.specgen }}>
                {searching ? "Searching…" : "Find S (spectrum)"}
              </MenuBtn>
              <MenuBtn onClick={() => { setActiveSheet(null); doCompleteSpecGen(); }}
                disabled={searching || nodes.length===0}
                style={{ color: C.specgen, borderColor: C.specgen }}>
                Complete S
              </MenuBtn>
              <MenuBtn onClick={() => canonicalizeCharges()}
                disabled={!nodes.length}>
                Reset charges (δᵢⱼ)
              </MenuBtn>
              <div style={{ height:1, background:C.border, margin:"4px 0" }} />
              <MenuBtn onClick={switchToDesktop}>↗ Switch to desktop view</MenuBtn>
            </div>
          )}

          {activeSheet === "B" && nodes.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:8 }}>
                {mode === "construct"
                  ? "Tap +: add 1 · Tap −: subtract 1"
                  : "Switch to Construct mode to edit"}
              </div>
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ borderCollapse:"collapse", fontSize:12, margin:"0 auto" }}>
                  <thead><tr>
                    <th style={{ padding:"4px 6px", color:C.dim }}></th>
                    {nodes.map((_,j) => <th key={j}
                      style={{ padding:"4px 6px", color:nodes[j].frozen?C.frozenStroke:C.dim, fontWeight:400 }}>{j+1}</th>)}
                  </tr></thead>
                  <tbody>
                    {B.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding:"4px 6px", color:nodes[i].frozen?C.frozenStroke:C.dim, fontWeight:400 }}>{i+1}</td>
                        {row.map((v, j) => (
                          <td key={j}
                            style={{ padding:"2px 4px", textAlign:"center" }}>
                            {mode === "construct" && i !== j ? (
                              <div style={{ display:"inline-flex", alignItems:"center", gap:2 }}>
                                <button onClick={() => editBCell(i,j,-1)}
                                  style={{ background:"transparent", color:C.neg,
                                    border:`1px solid ${C.border}`, borderRadius:3,
                                    width:18, height:22, fontSize:11, fontFamily:MONO,
                                    cursor:"pointer", padding:0 }}>−</button>
                                <span style={{ minWidth:18, textAlign:"center", fontWeight:v?600:400,
                                  color:v>0?C.pos:v<0?C.neg:"#475569" }}>
                                  {v>0?`+${v}`:v}
                                </span>
                                <button onClick={() => editBCell(i,j,1)}
                                  style={{ background:"transparent", color:C.pos,
                                    border:`1px solid ${C.border}`, borderRadius:3,
                                    width:18, height:22, fontSize:11, fontFamily:MONO,
                                    cursor:"pointer", padding:0 }}>+</button>
                              </div>
                            ) : (
                              <span style={{ fontWeight:v?600:400,
                                color:v>0?C.pos:v<0?C.neg:"#475569" }}>
                                {v>0?`+${v}`:v}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSheet === "γ" && nodes.length > 0 && (
            <div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {nodes.map((nd, ni) => (
                  <div key={ni} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
                    <span style={{ color: nd.frozen ? C.frozenStroke : C.dim, width:24, textAlign:"right" }}>{ni+1}</span>
                    <span style={{ color:C.dim, fontSize:11 }}>→</span>
                    <span style={{ color:C.text, fontFamily:MONO, wordBreak:"break-word" }}>
                      ({nd.charge.map((c, ci) => (
                        <span key={ci} style={{ color: c===0 ? "#475569" : (c<0 ? C.neg : C.text), fontWeight: c?600:400 }}>
                          {c}{ci < nd.charge.length-1 ? "," : ""}
                        </span>
                      ))})
                    </span>
                    {nd.frozen && <span style={{ color:C.frozenStroke, fontSize:10 }}>frozen</span>}
                    {mode === "construct" && (
                      <button onClick={() => toggleFrozen(ni)}
                        style={{ marginLeft:"auto", background:"transparent", color:C.dim,
                          border:`1px solid ${C.border}`, borderRadius:4,
                          padding:"2px 8px", fontSize:10, fontFamily:MONO, cursor:"pointer" }}>
                        {nd.frozen ? "unfreeze" : "freeze"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}>
                <button onClick={canonicalizeCharges}
                  style={{ background:"transparent", color:C.dim,
                    border:`1px solid ${C.border}`, borderRadius:6,
                    padding:"6px 12px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
                  Reset charges (δᵢⱼ)
                </button>
              </div>
            </div>
          )}

          {activeSheet === "μ" && (
            <div>
              {mutLog.length === 0 ? (
                <div style={{ fontSize:13, color:C.dim, fontStyle:"italic" }}>No mutations yet</div>
              ) : (
                <>
                  <div style={{ fontSize:13, lineHeight:2, wordBreak:"break-word", color:C.text }}>
                    {mutLog.map((m, i) => (
                      <span key={i}>
                        <span style={{ color:C.green, fontWeight:600 }}>μ</span>
                        <sub style={{ fontSize:10, color:C.dim }}>{fmtVec(m.charge)}</sub>
                        {i < mutLog.length-1 && <span style={{ color:C.dim, margin:"0 3px" }}>·</span>}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>
                    {mutLog.length} mutation{mutLog.length!==1?"s":""}
                  </div>
                  {allNegated && (
                    <div style={{ marginTop:10, padding:"8px 10px",
                      background:"rgba(52,211,153,0.12)", color:C.green,
                      fontWeight:600, fontSize:13, borderRadius:6 }}>
                      ✓ All charges negated — gives S
                    </div>
                  )}
                  <div style={{ marginTop:12, display:"flex", gap:8 }}>
                    <button onClick={undo} disabled={!history.length}
                      style={{ background:"transparent", color:history.length?C.text:C.dim,
                        border:`1px solid ${C.border}`, borderRadius:6,
                        padding:"6px 12px", fontSize:12, fontFamily:MONO,
                        cursor:history.length?"pointer":"default" }}>
                      ↩ Undo
                    </button>
                    <button onClick={async () => {
                      try { await navigator.clipboard.writeText(mutLog.map(m => m.index).join(",")); showToast("0-based copied"); }
                      catch { showToast("Clipboard error"); }
                    }}
                      style={{ background:"transparent", color:C.dim,
                        border:`1px solid ${C.border}`, borderRadius:6,
                        padding:"6px 12px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
                      Copy 0-based
                    </button>
                    <button onClick={async () => {
                      try { await navigator.clipboard.writeText(mutLog.map(m => m.index+1).join(",")); showToast("1-based copied"); }
                      catch { showToast("Clipboard error"); }
                    }}
                      style={{ background:"transparent", color:C.dim,
                        border:`1px solid ${C.border}`, borderRadius:6,
                        padding:"6px 12px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
                      Copy 1-based
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSheet === "S" && (
            <div>
              {searching && (
                <div style={{ fontSize:13, color:C.specgen, fontStyle:"italic" }}>
                  Searching for negating sequence…
                </div>
              )}
              {!searching && specResult === null && (
                <div style={{ fontSize:13, color:C.dim, marginBottom:10 }}>
                  Press "Find S" to search for a spectrum-generator sequence (BFS up to depth ~12, then random walk for ≤ 5s).
                </div>
              )}
              {!searching && specResult === false && (
                <div style={{ fontSize:13, color:C.neg, fontWeight:600,
                  padding:"8px 10px", background:"rgba(239,68,68,0.1)", borderRadius:6 }}>
                  No finite sequence found (infinite type?)
                </div>
              )}
              {!searching && specResult && specResult.charges && (() => {
                const total = specResult.charges.length;
                const step = specStep >= 0 ? specStep : total;
                const done = step;
                const remaining = total - step;
                return (
                  <div>
                    <div style={{ fontSize:13, color:C.green, fontWeight:600,
                      marginBottom:8, padding:"6px 10px",
                      background:"rgba(52,211,153,0.1)", borderRadius:6 }}>
                      ✓ {total} BPS states
                      {done > 0 && done < total && <span style={{ color:C.dim, fontWeight:400 }}> — {done}/{total} done</span>}
                      {done >= total && <span style={{ color:C.green }}> — complete!</span>}
                    </div>
                    {step < total && (
                      <div style={{ fontSize:12, color:C.specgen, marginBottom:8,
                        padding:"6px 10px", background:"rgba(192,132,252,0.1)", borderRadius:6 }}>
                        Tap node {specResult.seq[step]+1} on the canvas to continue.
                      </div>
                    )}
                    <div style={{ fontSize:13, lineHeight:2.2, wordBreak:"break-word" }}>
                      {step < total && <span style={{ color:C.dim, fontSize:11 }}>S = </span>}
                      {specResult.charges.slice(step).map((c, i) => (
                        <span key={`r${i}`}>
                          <span style={{ color: i===0 && step<total ? C.specgen : C.text, fontWeight: i===0 && step<total ? 700 : 400 }}>
                            <span style={{ color: i===0 && step<total ? C.specgen : C.dim }}>E</span>
                            <sub style={{ fontSize:9, color:C.dim }}>q</sub>
                            <span style={{ color:C.dim }}>(</span>
                            <span style={{ fontWeight:600 }}>{fmtCharge(c)}</span>
                            <span style={{ color:C.dim }}>)</span>
                          </span>
                          {i < remaining - 1 && <span style={{ color:C.dim, margin:"0 3px" }}>·</span>}
                        </span>
                      ))}
                      {done > 0 && (
                        <>
                          {remaining > 0 && <span style={{ color:C.dim, margin:"0 3px" }}>·</span>}
                          {specResult.charges.slice(0, done).map((c, i) => (
                            <span key={`d${i}`} style={{ opacity:0.45 }}>
                              <span style={{ color:C.dim }}>E</span>
                              <sub style={{ fontSize:9, color:C.dim }}>q</sub>
                              <span style={{ color:C.dim }}>(</span>
                              <span style={{ fontWeight:600, color:C.dim }}>{fmtChargeNeg(c)}</span>
                              <span style={{ color:C.dim }}>)</span>
                              {i < done - 1 && <span style={{ color:C.dim, margin:"0 3px" }}>·</span>}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div style={{ marginTop:14, display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={doFindSpecGen} disabled={searching || nodes.length === 0}
                  style={{ background: searching ? C.border : C.specgen,
                    color: searching ? C.dim : "#0f172a",
                    border:`1px solid ${searching ? C.border : C.specgen}`, borderRadius:6,
                    padding:"6px 14px", fontSize:13, fontFamily:MONO, fontWeight:700,
                    cursor: searching ? "wait" : "pointer" }}>
                  Find S
                </button>
                <button onClick={doCompleteSpecGen} disabled={searching || nodes.length === 0}
                  style={{ background:"transparent",
                    color: searching ? C.dim : C.specgen,
                    border:`1px solid ${C.specgen}`, borderRadius:6,
                    padding:"6px 14px", fontSize:13, fontFamily:MONO, fontWeight:700,
                    cursor: searching ? "wait" : "pointer" }}>
                  Complete S
                </button>
              </div>
            </div>
          )}

          {activeSheet === "⇄" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.accent,
                  marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Import</div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:6, lineHeight:1.5 }}>
                  Paste a preset JSON, a full share URL, or a #-fragment.
                </div>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5}
                  placeholder='{"name":"...","n":4,"B":[[...]],...}'
                  style={{ width:"100%", boxSizing:"border-box",
                    background:C.bg, color:C.text,
                    border:`1px solid ${C.border}`, borderRadius:6,
                    padding:8, fontSize:12, fontFamily:MONO, resize:"vertical" }}/>
                <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                  <button onClick={handleLoadImport}
                    style={{ background:C.accent, color:"#0f172a",
                      border:`1px solid ${C.accent}`, borderRadius:6,
                      padding:"6px 14px", fontSize:12, fontFamily:MONO, fontWeight:700,
                      cursor:"pointer" }}>
                    Load
                  </button>
                  <button onClick={() => { setImportText(""); setImportError(""); setImportNote(""); }}
                    style={{ background:"transparent", color:C.dim,
                      border:`1px solid ${C.border}`, borderRadius:6,
                      padding:"6px 12px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
                    Clear
                  </button>
                  <button onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      setImportText(t);
                    } catch { showToast("Clipboard read failed"); }
                  }}
                    style={{ background:"transparent", color:C.dim,
                      border:`1px solid ${C.border}`, borderRadius:6,
                      padding:"6px 12px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
                    Paste
                  </button>
                </div>
                {importError && <div style={{ color:C.neg, fontSize:11, marginTop:6 }}>✗ {importError}</div>}
                {importNote && !importError && <div style={{ color:C.green, fontSize:11, marginTop:6 }}>✓ {importNote}</div>}
              </div>

              <div style={{ height:1, background:C.border }}/>

              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.accent,
                  marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Export current state</div>
                <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                  <button onClick={handleCopyURL}
                    style={{ background:C.accent, color:"#0f172a",
                      border:`1px solid ${C.accent}`, borderRadius:6,
                      padding:"6px 14px", fontSize:12, fontFamily:MONO, fontWeight:700,
                      cursor:"pointer" }}>
                    Copy URL
                  </button>
                  <button onClick={handleCopyJSON}
                    style={{ background:"transparent", color:C.text,
                      border:`1px solid ${C.border}`, borderRadius:6,
                      padding:"6px 14px", fontSize:12, fontFamily:MONO, cursor:"pointer" }}>
                    Copy JSON
                  </button>
                </div>
                <textarea readOnly value={exportJSON} rows={8}
                  style={{ width:"100%", boxSizing:"border-box",
                    background:C.bg, color:C.text,
                    border:`1px solid ${C.border}`, borderRadius:6,
                    padding:8, fontSize:11, fontFamily:MONO, resize:"vertical" }}/>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function TabBtn({ label, onClick, disabled, accent, highlight }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex:1, background: highlight ? "rgba(192,132,252,0.15)" : "transparent",
        color: disabled ? C.frozenStroke : (accent || C.text),
        border:"none", borderRight:`1px solid ${C.border}`,
        padding:"10px 4px", fontSize:14, fontFamily:MONO, fontWeight:600,
        cursor: disabled ? "default" : "pointer",
        minHeight:44 }}>
      {label}
    </button>
  );
}

function MenuBtn({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:"transparent",
        color: disabled ? C.frozenStroke : C.text,
        border:`1px solid ${C.border}`, borderRadius:6,
        padding:"10px 14px", fontSize:13, fontFamily:MONO,
        cursor: disabled ? "default" : "pointer",
        textAlign:"left",
        ...style }}>
      {children}
    </button>
  );
}

function Sheet({ title, children, onClose }) {
  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        zIndex:1500, fontFamily:MONO }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:C.card, border:`1px solid ${C.border}`,
          borderTopLeftRadius:14, borderTopRightRadius:14,
          padding:14, width:"100%", maxHeight:"82vh", overflow:"auto",
          color:C.text, boxSizing:"border-box" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.accent,
            textTransform:"uppercase", letterSpacing:1 }}>
            {title}
          </div>
          <button onClick={onClose}
            style={{ background:"transparent", color:C.dim,
              border:`1px solid ${C.border}`, borderRadius:6,
              padding:"4px 12px", fontSize:13, fontFamily:MONO, cursor:"pointer",
              minHeight:32, minWidth:44 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
