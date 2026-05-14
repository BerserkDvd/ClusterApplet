import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const R = 24, AH = 9, ARR_GAP = 8;

const C = {
  bg: "#0f172a", card: "#1e293b", border: "#334155",
  nodeFill: "#1e3a5f", nodeStroke: "#60a5fa", frozenStroke: "#64748b",
  arrow: "#cbd5e1", hover: "#fbbf24", mutFlash: "#f59e0b",
  text: "#f1f5f9", dim: "#94a3b8", pos: "#3b82f6", neg: "#ef4444",
  accent: "#60a5fa", green: "#34d399", drawArrow: "#f59e0b",
  specgen: "#c084fc",
};

const PRESETS = [
  { name: "Empty", n: 0, positions: [], frozen: [], B: [] },
  { name: "A₂ – Pentagon ([A₁,A₂] AD)", n: 2,
    positions: [[180,220],[420,220]], frozen: [false,false],
    B: [[0,1],[-1,0]] },
  { name: "Â₁ – Kronecker (SU(2) SW)", n: 2,
    positions: [[180,220],[420,220]], frozen: [false,false],
    B: [[0,2],[-2,0]] },
  { name: "A₃ chain", n: 3,
    positions: [[100,220],[300,220],[500,220]], frozen: [false,false,false],
    B: [[0,1,0],[-1,0,1],[0,-1,0]] },
  { name: "SU(2) Nf=1", n: 3,
    positions: [[170,130],[430,130],[300,340]], frozen: [false,false,false],
    B: [[0,2,-1],[-2,0,1],[1,-1,0]] },
  { name: "SU(3) pure", n: 4,
    positions: [[140,130],[460,130],[460,340],[140,340]], frozen: [false,false,false,false],
    B: [[0,2,0,-1],[-2,0,1,0],[0,-1,0,2],[1,0,-2,0]] },
  { name: "SU(2)×SU(2) + bifund.", n: 5,
    positions: [[80,130],[80,340],[520,130],[520,340],[300,235]], frozen: [false,false,false,false,false],
    B: [[0,2,0,0,-1],[-2,0,0,0,1],[0,0,0,2,-1],[0,0,-2,0,1],[1,-1,1,-1,0]] },
  { name: "A₅ chain", n: 5,
    positions: [[60,220],[180,220],[300,220],[420,220],[540,220]],
    frozen: [false,false,false,false,false],
    B: [[0,1,0,0,0],[-1,0,1,0,0],[0,-1,0,1,0],[0,0,-1,0,1],[0,0,0,-1,0]] },
  { name: "A₂ amalgam: 2× FG-K3 (Yin/Yin)", n: 4,
    positions: [[300,350],[500,350],[400,200],[400,500]],
    frozen: [false,false,false,false],
    B: [[0,0,-1,1],[0,0,1,-1],[1,-1,0,0],[-1,1,0,0]] },
];

function dc(o) { return JSON.parse(JSON.stringify(o)); }

function makeInitial(preset) {
  const { n, positions, frozen, B, charges } = preset;
  const nodes = positions.map((p, i) => ({
    id: i, x: p[0], y: p[1], frozen: !!frozen[i],
    charge: charges && charges[i]
      ? [...charges[i]]
      : Array.from({ length: n }, (_, j) => j === i ? 1 : 0),
  }));
  return { nodes, B: dc(B) };
}

/* ── Preset import/export (Path B: shareable URL + paste) ── */
function validatePreset(obj) {
  if (!obj || typeof obj !== "object") throw new Error("expected a JSON object");
  const n = Number.isInteger(obj.n) ? obj.n
          : (Array.isArray(obj.B) ? obj.B.length : null);
  if (!Number.isInteger(n) || n < 0) throw new Error("missing or invalid n");
  if (!Array.isArray(obj.B) || obj.B.length !== n)
    throw new Error(`B must be a ${n}×${n} matrix`);
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(obj.B[i]) || obj.B[i].length !== n)
      throw new Error(`B row ${i+1} must have length ${n}`);
    for (let j = 0; j < n; j++) {
      if (!Number.isInteger(obj.B[i][j]))
        throw new Error(`B[${i+1}][${j+1}] is not an integer`);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (obj.B[i][j] + obj.B[j][i] !== 0)
      throw new Error(`B not antisymmetric at (${i+1},${j+1}): ${obj.B[i][j]} vs ${obj.B[j][i]}`);
  }
  let positions = obj.positions;
  if (!Array.isArray(positions) || positions.length !== n) {
    const cx = 300, cy = 235, r = Math.max(80, Math.min(180, 50 + 14 * n));
    positions = Array.from({ length: n }, (_, i) => {
      if (n <= 1) return [cx, cy];
      const a = 2 * Math.PI * i / n - Math.PI / 2;
      return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
    });
  } else {
    positions = positions.map((p, i) => {
      if (!Array.isArray(p) || p.length !== 2)
        throw new Error(`position ${i+1} must be [x,y]`);
      return [Number(p[0]), Number(p[1])];
    });
  }
  let frozen = obj.frozen;
  if (frozen == null) frozen = Array(n).fill(false);
  if (!Array.isArray(frozen) || frozen.length !== n)
    throw new Error("frozen must have length n");
  frozen = frozen.map(Boolean);
  let charges = obj.charges;
  if (charges != null) {
    if (!Array.isArray(charges) || charges.length !== n)
      throw new Error("charges must have length n");
    charges = charges.map((c, i) => {
      if (!Array.isArray(c) || c.length !== n)
        throw new Error(`charges[${i+1}] must have length ${n}`);
      return c.map(v => {
        const x = Number(v);
        if (!Number.isFinite(x)) throw new Error(`charges[${i+1}] has non-numeric entry`);
        return x;
      });
    });
  }
  const preset = {
    name: (typeof obj.name === "string" && obj.name.trim()) ? obj.name.trim() : "Imported",
    n, positions, frozen, B: obj.B,
  };
  if (charges) preset.charges = charges;
  return preset;
}

function parsePresetText(text) {
  let s = (text || "").trim();
  if (!s) throw new Error("empty input");
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0 && /^https?:\/\//i.test(s)) s = s.slice(hashIdx + 1);
  else if (s.startsWith("#")) s = s.slice(1);
  if (s.startsWith("q=")) s = s.slice(2);
  if (!s.startsWith("{") && !s.startsWith("[")) {
    try { s = decodeURIComponent(s); } catch { /* leave as-is */ }
  }
  let obj;
  try { obj = JSON.parse(s); }
  catch (e) { throw new Error("invalid JSON: " + e.message); }
  return validatePreset(obj);
}

function presetToJSON(preset) {
  const obj = {
    name: preset.name,
    n: preset.n,
    positions: preset.positions,
    frozen: preset.frozen,
    B: preset.B,
  };
  if (preset.charges) obj.charges = preset.charges;
  return JSON.stringify(obj, null, 2);
}

function buildShareURL(preset) {
  const compact = JSON.stringify({
    name: preset.name,
    n: preset.n,
    positions: preset.positions,
    frozen: preset.frozen,
    B: preset.B,
    ...(preset.charges ? { charges: preset.charges } : {}),
  });
  const loc = (typeof window !== "undefined" && window.location) ? window.location : { origin: "", pathname: "", search: "" };
  return loc.origin + loc.pathname + loc.search + "#" + encodeURIComponent(compact);
}

function mutateQuiver(nodesIn, Bin, k) {
  const n = Bin.length, B = dc(Bin), nodes = dc(nodesIn);
  const Bn = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === k || j === k) Bn[i][j] = -B[i][j];
      else Bn[i][j] = B[i][j] + Math.max(B[i][k],0)*Math.max(B[k][j],0)
                                - Math.max(-B[i][k],0)*Math.max(-B[k][j],0);
    }
  const ck = [...nodes[k].charge];
  for (let j = 0; j < n; j++) {
    if (j === k) nodes[j].charge = ck.map(c => -c);
    else {
      const co = Math.max(B[j][k], 0);
      if (co > 0) nodes[j].charge = nodes[j].charge.map((c, i) => c + co * ck[i]);
    }
  }
  return { nodes, B: Bn };
}

/* ── Positive cone check via Gaussian elimination ── */
function inPositiveCone(charge, generators) {
  const nGen = generators.length;
  if (nGen === 0) return charge.every(x => x === 0);
  const rank = charge.length;
  // Build augmented matrix [generators^T | charge]
  const A = [];
  for (let i = 0; i < rank; i++) {
    const row = [];
    for (let j = 0; j < nGen; j++) row.push(generators[j][i]);
    row.push(charge[i]);
    A.push(row);
  }
  // Gaussian elimination
  const pivotCols = [];
  let row = 0;
  for (let col = 0; col < nGen && row < rank; col++) {
    let pivot = -1;
    for (let r = row; r < rank; r++) { if (A[r][col] !== 0) { pivot = r; break; } }
    if (pivot < 0) continue;
    pivotCols.push(col);
    [A[row], A[pivot]] = [A[pivot], A[row]];
    for (let r = 0; r < rank; r++) {
      if (r === row) continue;
      if (A[r][col] !== 0) {
        const factor = A[r][col] / A[row][col];
        for (let c = 0; c <= nGen; c++) A[r][c] -= factor * A[row][c];
      }
    }
    row++;
  }
  for (let r = row; r < rank; r++) if (Math.abs(A[r][nGen]) > 1e-12) return false;
  const coeffs = Array(nGen).fill(0);
  for (let idx = 0; idx < pivotCols.length; idx++) {
    coeffs[pivotCols[idx]] = A[idx][nGen] / A[idx][pivotCols[idx]];
  }
  return coeffs.every(c => c >= -1e-12);
}

/* ── Spectrum generator search (BFS + random walk hybrid) ── */
function chargeKey(nodes) {
  return nodes.map(nd => nd.charge.join(",")).join("|");
}

function findSpecGen(nodesInit, Binit, maxMs = 5000) {
  const n = Binit.length;
  const mutableIdx = [];
  for (let i = 0; i < n; i++) if (!nodesInit[i].frozen) mutableIdx.push(i);
  const origGens = mutableIdx.map(i => [...nodesInit[i].charge]);
  const negSet = new Set(origGens.map(c => c.map(x => -x).join(",")));

  function isDone(nodes) {
    const curSet = new Set(mutableIdx.map(i => nodes[i].charge.join(",")));
    if (curSet.size !== negSet.size) return false;
    for (const s of negSet) if (!curSet.has(s)) return false;
    return true;
  }

  const t0 = performance.now();
  
  // Phase 1: BFS for short sequences (up to depth ~12)
  const bfsLimit = Math.min(12, n <= 4 ? 15 : 10);
  const queue = [{ nodes: dc(nodesInit), B: dc(Binit), path: [] }];
  const visited = new Set();
  visited.add(chargeKey(nodesInit));
  let head = 0;

  while (head < queue.length && performance.now() - t0 < maxMs * 0.6) {
    const { nodes, B, path } = queue[head++];
    if (path.length > bfsLimit) break;
    if (isDone(nodes)) {
      const charges = [];
      let cn = dc(nodesInit), cb = dc(Binit);
      for (const k of path) {
        charges.push([...cn[k].charge]);
        const r = mutateQuiver(cn, cb, k);
        cn = r.nodes; cb = r.B;
      }
      return { seq: path, charges, method: "BFS" };
    }
    for (const k of mutableIdx) {
      if (!inPositiveCone(nodes[k].charge, origGens)) continue;
      const r = mutateQuiver(nodes, B, k);
      const key = chargeKey(r.nodes);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ nodes: r.nodes, B: r.B, path: [...path, k] });
      }
    }
  }

  // Phase 2: Random walk for longer sequences
  let best = null;
  const rng = () => Math.random();
  let trials = 0;
  while (performance.now() - t0 < maxMs) {
    trials++;
    let cn = dc(nodesInit), cb = dc(Binit);
    const seq = [];
    const maxSteps = best ? best.seq.length - 1 : 30;
    for (let step = 0; step < maxSteps; step++) {
      const eligible = mutableIdx.filter(k => inPositiveCone(cn[k].charge, origGens));
      if (eligible.length === 0) break;
      const k = eligible[Math.floor(rng() * eligible.length)];
      seq.push(k);
      const r = mutateQuiver(cn, cb, k);
      cn = r.nodes; cb = r.B;
      if (isDone(cn)) {
        const charges = [];
        let cn2 = dc(nodesInit), cb2 = dc(Binit);
        for (const k2 of seq) {
          charges.push([...cn2[k2].charge]);
          const r2 = mutateQuiver(cn2, cb2, k2);
          cn2 = r2.nodes; cb2 = r2.B;
        }
        if (!best || seq.length < best.seq.length) {
          best = { seq: [...seq], charges, method: `random (${trials} trials)` };
        }
        break;
      }
    }
  }
  return best;
}

function fmtVec(v) { return "(" + v.join(",") + ")"; }
function fmtCharge(c) {
  let s = "";
  for (let i = 0; i < c.length; i++) {
    if (c[i] === 0) continue;
    const abs = Math.abs(c[i]);
    const sign = c[i] > 0 ? (s ? "+" : "") : "−";
    const coeff = abs === 1 ? "" : String(abs);
    s += sign + coeff + `γ${i+1}`;
  }
  return s || "0";
}
function fmtChargeNeg(c) {
  return fmtCharge(c.map(x => -x));
}

function getEdges(nodes, B) {
  const edges = [];
  const n = B.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const v = B[i][j];
      if (v === 0) continue;
      const from = v > 0 ? i : j, to = v > 0 ? j : i, count = Math.abs(v);
      const x1 = nodes[from].x, y1 = nodes[from].y;
      const x2 = nodes[to].x, y2 = nodes[to].y;
      const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy);
      if (len < 2*R+4) continue;
      const ux = dx/len, uy = dy/len, px = -uy, py = ux;
      edges.push({ sx: x1+R*ux, sy: y1+R*uy, tx: x2-R*ux, ty: y2-R*uy, ux, uy, px, py, count });
    }
  return edges;
}

function svgPt(svgEl, e) {
  const rect = svgEl.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function nodeAt(nodes, x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const dx = nodes[i].x - x, dy = nodes[i].y - y;
    if (dx*dx + dy*dy <= R*R) return i;
  }
  return -1;
}

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
    setHistory([]); setMutLog([]);
    setFlash(null);
    setEditingCharge(null); setDrawFrom(null); setDrawMouse(null);
    setSpecResult(null); setSpecStep(-1);
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
        setSpecStep(specStep + 1); // goes to total when done
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

  // ── Share / Import helpers ──
  const currentPreset = useMemo(() => ({
    name: presets[preset]?.name || "Custom",
    n: nodes.length,
    positions: nodes.map(nd => [Math.round(nd.x), Math.round(nd.y)]),
    frozen: nodes.map(nd => !!nd.frozen),
    B: dc(B),
    charges: nodes.map(nd => [...nd.charge]),
  }), [nodes, B, preset, presets]);

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
  const guidedNode = (specResult && specResult.seq && specStep >= 0 && specStep < specResult.seq.length)
    ? specResult.seq[specStep] : -1;

  const allNegated = nodes.length > 0 && mutLog.length > 0 && (() => {
    const n = nodes.length;
    const mutableIdx = [];
    for (let i = 0; i < n; i++) if (!nodes[i].frozen) mutableIdx.push(i);
    const negSet = new Set(mutableIdx.map(i => {
      const init = Array.from({ length: n }, (_, j) => j === i ? -1 : 0);
      return init.join(",");
    }));
    const curSet = new Set(mutableIdx.map(i => nodes[i].charge.join(",")));
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
        <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
        <button onClick={() => { setShowShare(true); setImportError(""); setImportNote(""); }}
          style={{ background: "transparent", color: C.accent,
            border: `1px solid ${C.accent}`, borderRadius: 4,
            padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>
          ⇄ Share
        </button>
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
                  {isGuided && !isF && (
                    <circle cx={nd.x} cy={nd.y} r={R+8} fill="none"
                      stroke={C.specgen} strokeWidth={2.5} opacity={0.7} filter="url(#glow)">
                      <animate attributeName="r" values={`${R+6};${R+11};${R+6}`} dur="1.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {(isH||isF||isSource) && !isGuided && <circle cx={nd.x} cy={nd.y} r={R+6} fill="none"
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
