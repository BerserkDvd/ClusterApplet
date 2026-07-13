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
// Clicking an internal (flippable) edge performs the diagonal flip ≡ mutation.

// distinct hues for identified side-pairs (matched by edge id)
const PAIR_HUES = [190, 45, 320, 150, 265, 20, 95, 230, 350, 120];
const pairColor = (edge) => `hsl(${PAIR_HUES[edge % PAIR_HUES.length]} 70% 60%)`;

export default function TriangulationCanvas({ tri, view, selected, onFlip, onSelectEdge }) {
  const [hover, setHover] = useState(-1);

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
  const clickEdge = (e) => {
    if (internal.has(e)) onFlip?.(e);
    else onSelectEdge?.(e);
  };

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

      {layout.kind === "polygon" && (
        <PolygonView layout={layout} tri={tri} internal={internal} selected={selected}
          hover={hover} setHover={setHover} clickEdge={clickEdge} />
      )}
      {layout.kind === "developed" && (
        <DevelopedView layout={layout} tri={tri} internal={internal} selected={selected}
          hover={hover} setHover={setHover} clickEdge={clickEdge} />
      )}
      {layout.kind === "quiver" && (
        <QuiverView layout={layout} tri={tri} internal={internal} selected={selected}
          hover={hover} setHover={setHover} clickEdge={clickEdge} />
      )}
    </svg>
  );
}

// ── polygon (disk) view ─────────────────────────────────────────────────────
function PolygonView({ layout, internal, selected, hover, setHover, clickEdge }) {
  return (
    <g>
      {layout.triangles.map((t) => (
        <polygon key={t.id} points={triPts(layout, t)} fill="rgba(96,165,250,0.06)" stroke="none" />
      ))}
      {layout.edges.map((e) => {
        const isInt = internal.has(e.id);
        const isSel = e.id === selected, isHov = e.id === hover;
        const stroke = isSel ? C.selected : isHov && isInt ? C.hover : e.boundary ? C.framingStroke : C.nodeStroke;
        return (
          <g key={e.id}>
            <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={stroke} strokeWidth={e.boundary ? 3.4 : isSel || isHov ? 3 : 2}
              style={{ cursor: isInt ? "pointer" : "default" }}
              onPointerDown={() => clickEdge(e.id)}
              onPointerEnter={() => setHover(e.id)} onPointerLeave={() => setHover(-1)} />
            <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 3} textAnchor="middle" fontSize="10"
              fill={isInt ? C.dim : "#6b7c93"} fontFamily="ui-monospace, monospace"
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
function DevelopedView({ layout, internal, selected, hover, setHover, clickEdge }) {
  return (
    <g>
      {layout.triangles.map((t) => (
        <polygon key={t.id} points={t.pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
          fill="rgba(96,165,250,0.05)" stroke="none" />
      ))}
      {layout.sides.map((s, i) => {
        const isInt = internal.has(s.edge);
        const isSel = s.edge === selected, isHov = s.edge === hover;
        const identified = s.role === "identified";
        const col = identified ? pairColor(s.edge)
          : s.role === "boundary" ? C.framingStroke
          : isSel ? C.selected : isHov ? C.hover : "rgba(148,163,184,0.5)";
        const w = s.role === "boundary" ? 3.4 : identified ? 3 : isSel || isHov ? 2.6 : 1.6;
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        return (
          <g key={i} style={{ color: col }}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={col} strokeWidth={w}
              strokeDasharray={s.role === "interior" ? "5 4" : undefined}
              markerEnd={identified ? "url(#idar)" : undefined}
              style={{ cursor: isInt ? "pointer" : "default" }}
              onPointerDown={() => clickEdge(s.edge)}
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
function QuiverView({ layout, internal, selected, hover, setHover, clickEdge }) {
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
        const isInt = internal.has(nd.id);
        const isSel = nd.id === selected, isHov = nd.id === hover;
        const stroke = isSel ? C.selected : isHov && isInt ? C.hover : nd.boundary ? C.framingStroke : C.nodeStroke;
        return (
          <g key={nd.id} style={{ cursor: isInt ? "pointer" : "default" }}
            onPointerDown={() => clickEdge(nd.id)}
            onPointerEnter={() => setHover(nd.id)} onPointerLeave={() => setHover(-1)}>
            {nd.boundary
              ? <rect x={nd.x - R} y={nd.y - R} width={2 * R} height={2 * R} rx="4" fill={C.framingFill} stroke={stroke} strokeWidth={isSel || isHov ? 3 : 2} />
              : <circle cx={nd.x} cy={nd.y} r={R} fill={C.nodeFill} stroke={stroke} strokeWidth={isSel || isHov ? 3 : 2} />}
            <text x={nd.x} y={nd.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text}
              style={{ pointerEvents: "none", userSelect: "none" }}>{nd.id}</text>
          </g>
        );
      })}
    </g>
  );
}
