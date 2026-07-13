import React, { useMemo, useState } from "react";
import { C } from "../ui/theme.js";
import {
  polygonLayout, developedLayout, quiverLayout, boundsOf,
} from "../model/triangulation_layout.js";

// Interactive SVG canvas for an ideal triangulation, in three views:
//   · polygon   — the honest n-gon (disk charts): chords, diagonals flip;
//   · developed — the unfolded fundamental polygon with IDENTIFIED side-pairs
//                 (closed / higher-genus charts): the "octagon with identified
//                 sides" picture;
//   · quiver    — the dual exchange quiver of σ_Δ (always planar).
//
// Two interaction modes:
//   · flip  — click an internal edge → diagonal flip ≡ mutation;
//   · build — click edges to select them (free edges highlighted) and click a
//             triangle interior to pick it (for add-a-puncture); the app's build
//             panel turns the selection into attach / glue / cut / puncture ops.

const PAIR_HUES = [190, 45, 320, 150, 265, 20, 95, 230, 350, 120];
const pairColor = (edge) => `hsl(${PAIR_HUES[edge % PAIR_HUES.length]} 70% 60%)`;

export default function TriangulationCanvas({
  tri, view, mode = "flip", selEdges, selTriangle = -1, onEdge, onTriangle,
}) {
  const [hover, setHover] = useState(-1);
  const sel = selEdges || new Set();

  const layout = useMemo(() => {
    if (view === "polygon") return polygonLayout(tri);
    if (view === "developed") return developedLayout(tri);
    return quiverLayout(tri);
  }, [tri, view]);

  const vb = useMemo(() => {
    let pts = [];
    if (layout.kind === "polygon") pts = layout.verts.map((v) => [v.x, v.y]);
    else if (layout.kind === "developed") pts = layout.sides.flatMap((s) => [[s.x1, s.y1], [s.x2, s.y2]]);
    else pts = layout.nodes.map((n) => [n.x, n.y]);
    return boundsOf(pts, 44);
  }, [layout]);

  const internal = new Set(tri.internalEdgeIds);
  const free = new Set(tri.boundaryEdgeIds);
  const ctx = { mode, sel, internal, free, hover, setHover, onEdge, onTriangle, selTriangle };

  return (
    <svg
      className="quiver-canvas"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ background: C.bg, touchAction: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <marker id="tah" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L9,4.5 L0,9 Z" fill={C.arrow} />
        </marker>
        <marker id="idar" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M1,1 L8,5 L1,9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </marker>
      </defs>

      {layout.kind === "polygon" && <PolygonView layout={layout} {...ctx} />}
      {layout.kind === "developed" && <DevelopedView layout={layout} {...ctx} />}
      {layout.kind === "quiver" && <QuiverView layout={layout} {...ctx} />}
    </svg>
  );
}

// stroke for an edge given the interaction state
function edgeStroke({ id, isBoundary, mode, sel, internal, hover }) {
  if (sel.has(id)) return C.selected;
  if (id === hover && (mode === "build" || internal.has(id))) return C.hover;
  if (mode === "build" && !isBoundary) return "rgba(148,163,184,0.55)"; // internal, dim
  if (mode === "build" && isBoundary) return "#f0abfc";                  // free edge, bright
  return isBoundary ? C.framingStroke : C.nodeStroke;
}

// ── polygon (disk) view ─────────────────────────────────────────────────────
function PolygonView({ layout, mode, sel, internal, hover, setHover, onEdge, onTriangle, selTriangle }) {
  return (
    <g>
      {layout.triangles.map((t) => (
        <polygon key={t.id} points={triPts(layout, t)}
          fill={t.id === selTriangle ? "rgba(56,189,248,0.18)" : "rgba(96,165,250,0.06)"}
          stroke="none"
          style={{ cursor: mode === "build" ? "pointer" : "default" }}
          onPointerDown={() => mode === "build" && onTriangle?.(t.id)} />
      ))}
      {layout.edges.map((e) => {
        const clickable = mode === "build" || internal.has(e.id);
        const stroke = edgeStroke({ id: e.id, isBoundary: e.boundary, mode, sel, internal, hover });
        return (
          <g key={e.id}>
            <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={stroke} strokeWidth={sel.has(e.id) ? 4 : e.boundary ? 3.4 : 2}
              style={{ cursor: clickable ? "pointer" : "default" }}
              onPointerDown={(ev) => { ev.stopPropagation(); clickable && onEdge?.(e.id); }}
              onPointerEnter={() => setHover(e.id)} onPointerLeave={() => setHover(-1)} />
            <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 3} textAnchor="middle" fontSize="10"
              fill={C.dim} fontFamily="ui-monospace, monospace"
              style={{ pointerEvents: "none", userSelect: "none" }}>{e.id}</text>
          </g>
        );
      })}
      {layout.verts.map((v) => (
        <g key={v.id}>
          <rect x={v.x - 5} y={v.y - 5} width="10" height="10" rx="2" fill={C.framingFill} stroke={C.framingStroke} strokeWidth="1.6" />
          <text x={v.x} y={v.y - 10} textAnchor="middle" fontSize="11" fill={C.dim}
            style={{ pointerEvents: "none", userSelect: "none" }}>{v.id}</text>
        </g>
      ))}
    </g>
  );
}
function triPts(layout, t) {
  const vs = t.corners.map((v) => layout.verts.find((w) => w.id === v)).filter(Boolean);
  return vs.map((v) => `${v.x},${v.y}`).join(" ");
}

// ── developed (unfolded, identified sides) view ─────────────────────────────
function DevelopedView({ layout, mode, sel, internal, hover, setHover, onEdge, onTriangle, selTriangle }) {
  return (
    <g>
      {layout.triangles.map((t) => (
        <polygon key={t.id} points={t.pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
          fill={t.id === selTriangle ? "rgba(56,189,248,0.16)" : "rgba(96,165,250,0.05)"}
          stroke="none"
          style={{ cursor: mode === "build" ? "pointer" : "default" }}
          onPointerDown={() => mode === "build" && onTriangle?.(t.id)} />
      ))}
      {layout.sides.map((s, i) => {
        const clickable = mode === "build" || internal.has(s.edge);
        const identified = s.role === "identified";
        const isBoundary = s.role === "boundary";
        let col = edgeStroke({ id: s.edge, isBoundary, mode, sel, internal, hover });
        if (identified && !sel.has(s.edge) && s.edge !== hover && mode !== "build") col = pairColor(s.edge);
        const w = sel.has(s.edge) ? 4 : isBoundary ? 3.4 : identified ? 3 : 1.8;
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        return (
          <g key={i} style={{ color: col }}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={col} strokeWidth={w}
              strokeDasharray={s.role === "interior" ? "5 4" : undefined}
              markerEnd={identified ? "url(#idar)" : undefined}
              style={{ cursor: clickable ? "pointer" : "default" }}
              onPointerDown={(ev) => { ev.stopPropagation(); clickable && onEdge?.(s.edge); }}
              onPointerEnter={() => setHover(s.edge)} onPointerLeave={() => setHover(-1)} />
            <text x={mx} y={my - 4} textAnchor="middle" fontSize="10"
              fill={identified ? col : C.dim} fontFamily="ui-monospace, monospace"
              style={{ pointerEvents: "none", userSelect: "none" }}>{s.edge}</text>
          </g>
        );
      })}
    </g>
  );
}

// ── dual exchange-quiver view ───────────────────────────────────────────────
function QuiverView({ layout, mode, sel, internal, hover, setHover, onEdge }) {
  const R = 15;
  const nodeAt = (i) => layout.nodes[i];
  return (
    <g>
      {layout.arrows.map((a, k) => {
        const f = nodeAt(a.from), t = nodeAt(a.to);
        const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len, px = -uy, py = ux;
        const sx = f.x + R * ux, sy = f.y + R * uy, tx = t.x - R * ux, ty = t.y - R * uy;
        const shown = Math.min(a.mult, 3), spread = (shown - 1) / 2;
        return (
          <g key={k}>
            {Array.from({ length: shown }, (_, m) => {
              const off = (m - spread) * 5;
              return <line key={m} x1={sx + px * off} y1={sy + py * off} x2={tx + px * off} y2={ty + py * off}
                stroke={C.arrow} strokeWidth="1.5" markerEnd="url(#tah)" />;
            })}
            {a.mult > 3 && <text x={(sx + tx) / 2 + px * 10} y={(sy + ty) / 2 + py * 10} textAnchor="middle"
              fontSize="11" fill={C.arrow}>{`×${a.mult}`}</text>}
          </g>
        );
      })}
      {layout.nodes.map((nd) => {
        const clickable = mode === "build" || internal.has(nd.id);
        const isSel = sel.has(nd.id);
        const stroke = isSel ? C.selected : nd.id === hover && clickable ? C.hover : nd.boundary ? C.framingStroke : C.nodeStroke;
        return (
          <g key={nd.id} style={{ cursor: clickable ? "pointer" : "default" }}
            onPointerDown={() => clickable && onEdge?.(nd.id)}
            onPointerEnter={() => setHover(nd.id)} onPointerLeave={() => setHover(-1)}>
            {nd.boundary
              ? <rect x={nd.x - R} y={nd.y - R} width={2 * R} height={2 * R} rx="4" fill={C.framingFill} stroke={stroke} strokeWidth={isSel ? 3.5 : 2} />
              : <circle cx={nd.x} cy={nd.y} r={R} fill={C.nodeFill} stroke={stroke} strokeWidth={isSel ? 3.5 : 2} />}
            <text x={nd.x} y={nd.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text}
              style={{ pointerEvents: "none", userSelect: "none" }}>{nd.id}</text>
          </g>
        );
      })}
    </g>
  );
}
