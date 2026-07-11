import React, { useRef, useState } from "react";
import { C, NODE_R } from "../ui/theme.js";
import { addNode, moveNode, removeNode, arrowsFromB, nodeLabel } from "../model/quiver.js";

// Interactive SVG canvas for a BPS quiver.  Two explicit modes:
//   CONSTRUCT — click empty space to add a node; click a node to select it
//               (then use the matrix panel to add arrows, or Delete to remove).
//   ARRANGE   — drag nodes to reposition (display only; does not touch B).
// Arrows are built in the matrix panel (unambiguous), not by dragging between
// nodes.  Frozen nodes (only from imported quivers) render dashed, read-only.
export default function QuiverCanvas({ quiver, onChange, mode, selected, onSelect }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(-1);
  const [drag, setDrag] = useState(null);
  const arrows = arrowsFromB(quiver.B);

  function pt(e) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function nodeAt(x, y) {
    for (let i = quiver.nodes.length - 1; i >= 0; i--) {
      const nd = quiver.nodes[i];
      if ((nd.x - x) ** 2 + (nd.y - y) ** 2 <= NODE_R * NODE_R) return i;
    }
    return -1;
  }

  function onPointerDown(e) {
    const { x, y } = pt(e);
    const i = nodeAt(x, y);
    if (mode === "arrange") {
      if (i >= 0) {
        setDrag({ index: i, dx: quiver.nodes[i].x - x, dy: quiver.nodes[i].y - y });
        onSelect?.(i);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      return;
    }
    // CONSTRUCT
    if (e.button === 2) {                       // right-click a node = delete it
      if (i >= 0) { onChange(removeNode(quiver, i)); onSelect?.(-1); }
      return;
    }
    if (i >= 0) onSelect?.(i === selected ? -1 : i);
    else { onChange(addNode(quiver, Math.round(x), Math.round(y))); onSelect?.(quiver.nodes.length); }
  }
  function onPointerMove(e) {
    const { x, y } = pt(e);
    setHover(nodeAt(x, y));
    if (drag) onChange(moveNode(quiver, drag.index, Math.round(x + drag.dx), Math.round(y + drag.dy)));
  }

  return (
    <svg
      ref={svgRef}
      className="quiver-canvas"
      style={{ background: C.bg, touchAction: "none", cursor: mode === "arrange" ? "grab" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => { setHover(-1); setDrag(null); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <marker id="ah" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L9,4.5 L0,9 Z" fill={C.arrow} />
        </marker>
      </defs>

      {arrows.map((a, k) => (
        <Arrow key={k} from={quiver.nodes[a.from]} to={quiver.nodes[a.to]} mult={a.mult} />
      ))}

      {quiver.nodes.map((nd, i) => {
        const isSel = i === selected, isHover = i === hover;
        const framing = nd.kind === "framing";
        const stroke = isSel ? C.selected : isHover ? C.hover : framing ? C.framingStroke : C.nodeStroke;
        const label = nodeLabel(quiver, i).text;
        const s = NODE_R * 1.8; // square side
        return (
          <g key={nd.id}>
            {isSel && (framing
              ? <rect x={nd.x - s / 2 - 5} y={nd.y - s / 2 - 5} width={s + 10} height={s + 10} rx="5" fill="none" stroke={C.selected} strokeWidth="2" opacity="0.7" />
              : <circle cx={nd.x} cy={nd.y} r={NODE_R + 5} fill="none" stroke={C.selected} strokeWidth="2" opacity="0.7" />)}
            {framing ? (
              <rect x={nd.x - s / 2} y={nd.y - s / 2} width={s} height={s} rx="4"
                fill={C.framingFill} stroke={stroke} strokeWidth={isSel || isHover ? 3 : 2} />
            ) : (
              <circle cx={nd.x} cy={nd.y} r={NODE_R} fill={C.nodeFill} stroke={stroke} strokeWidth={isSel || isHover ? 3 : 2} />
            )}
            <text x={nd.x} y={nd.y + 5} textAnchor="middle" fontSize="13" fontWeight="700"
              fill={C.text} style={{ pointerEvents: "none", userSelect: "none" }}>{label}</text>
          </g>
        );
      })}

      {quiver.nodes.length === 0 && (
        <text x="50%" y="50%" textAnchor="middle" fill={C.dim} fontSize="15">
          Construct mode: click to add a gauge node · or open Presets →
        </text>
      )}
    </svg>
  );
}

function Arrow({ from, to, mult }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  if (len < 2 * NODE_R + 4) return null;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const sx = from.x + NODE_R * ux, sy = from.y + NODE_R * uy;
  const tx = to.x - NODE_R * ux, ty = to.y - NODE_R * uy;
  const shown = Math.min(mult, 4), spread = (shown - 1) / 2, GAP = 7;
  const lines = [];
  for (let m = 0; m < shown; m++) {
    const off = (m - spread) * GAP;
    lines.push(<line key={m} x1={sx + px * off} y1={sy + py * off} x2={tx + px * off} y2={ty + py * off}
      stroke={C.arrow} strokeWidth="1.6" markerEnd="url(#ah)" />);
  }
  return (
    <g>
      {lines}
      {mult > 4 && (
        <text x={(sx + tx) / 2 + px * 12} y={(sy + ty) / 2 + py * 12} textAnchor="middle" fontSize="12"
          fill={C.arrow} style={{ userSelect: "none" }}>{`×${mult}`}</text>
      )}
    </g>
  );
}
