import React, { useRef, useState } from "react";
import { C, NODE_R } from "../ui/theme.js";
import { addNode, moveNode, removeNode, addArrow, arrowsFromB, nodeLabel } from "../model/quiver.js";

// Interactive SVG canvas for a BPS quiver.
//   CONSTRUCT — · drag from one node to another = add an arrow (drag the
//                 reverse direction to remove / flip one)
//               · click empty space  = add a gauge node
//               · click a node       = select it
//               · right-click a node = delete it
//   ARRANGE   — drag nodes to reposition (does not touch B).
// The matrix panel mirrors the arrows for precise/bulk edits.
export default function QuiverCanvas({ quiver, onChange, onMutate, mode, selected, onSelect }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(-1);
  const [drag, setDrag] = useState(null);      // arrange: {index,dx,dy}
  const [connect, setConnect] = useState(null); // construct: {from,cx,cy,moved}
  const arrows = arrowsFromB(quiver.B);

  const pt = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nodeAt = (x, y) => {
    for (let i = quiver.nodes.length - 1; i >= 0; i--) {
      const nd = quiver.nodes[i];
      if ((nd.x - x) ** 2 + (nd.y - y) ** 2 <= NODE_R * NODE_R) return i;
    }
    return -1;
  };

  function onPointerDown(e) {
    const { x, y } = pt(e);
    const i = nodeAt(x, y);
    if (mode === "mutate") {
      if (i >= 0) onMutate?.(i, e.button === 2 ? -1 : 1); // left = forward, right = inverse
      return;
    }
    if (mode === "arrange") {
      if (i >= 0) {
        setDrag({ index: i, dx: quiver.nodes[i].x - x, dy: quiver.nodes[i].y - y });
        onSelect?.(i);
        svgRef.current.setPointerCapture?.(e.pointerId);
      }
      return;
    }
    // CONSTRUCT
    if (e.button === 2) { if (i >= 0) { onChange(removeNode(quiver, i)); onSelect?.(-1); } return; }
    if (i >= 0) {
      setConnect({ from: i, cx: x, cy: y, moved: false });
      svgRef.current.setPointerCapture?.(e.pointerId);
    } else {
      onChange(addNode(quiver, Math.round(x), Math.round(y)));
      onSelect?.(quiver.nodes.length);
    }
  }

  function onPointerMove(e) {
    const { x, y } = pt(e);
    setHover(nodeAt(x, y));
    if (drag) onChange(moveNode(quiver, drag.index, Math.round(x + drag.dx), Math.round(y + drag.dy)));
    if (connect) {
      const from = quiver.nodes[connect.from];
      const moved = connect.moved || (x - from.x) ** 2 + (y - from.y) ** 2 > (NODE_R + 6) ** 2;
      setConnect({ ...connect, cx: x, cy: y, moved });
    }
  }

  function onPointerUp(e) {
    if (connect) {
      const { x, y } = pt(e);
      const target = nodeAt(x, y);
      if (!connect.moved && target === connect.from) {
        onSelect?.(connect.from === selected ? -1 : connect.from);
      } else if (target >= 0 && target !== connect.from) {
        const both = quiver.nodes[connect.from].kind === "framing" && quiver.nodes[target].kind === "framing";
        if (!both) onChange(addArrow(quiver, connect.from, target, 1));
      }
      setConnect(null);
    }
    setDrag(null);
  }

  const rubber = connect && connect.moved ? quiver.nodes[connect.from] : null;

  return (
    <svg
      ref={svgRef}
      className="quiver-canvas"
      style={{ background: C.bg, touchAction: "none", cursor: mode === "arrange" ? "grab" : mode === "mutate" ? "pointer" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { setHover(-1); setDrag(null); setConnect(null); }}
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

      {rubber && (
        <line x1={rubber.x} y1={rubber.y} x2={connect.cx} y2={connect.cy}
          stroke={C.accent} strokeWidth="1.8" strokeDasharray="5 4" opacity="0.8" />
      )}

      {quiver.nodes.map((nd, i) => {
        const isSel = i === selected, isHover = i === hover;
        const framing = nd.kind === "framing";
        const stroke = isSel ? C.selected : isHover ? C.hover : framing ? C.framingStroke : C.nodeStroke;
        const label = nodeLabel(quiver, i).text;
        const s = NODE_R * 1.8;
        return (
          <g key={nd.id}>
            {isSel && (framing
              ? <rect x={nd.x - s / 2 - 5} y={nd.y - s / 2 - 5} width={s + 10} height={s + 10} rx="5" fill="none" stroke={C.selected} strokeWidth="2" opacity="0.6" />
              : <circle cx={nd.x} cy={nd.y} r={NODE_R + 5} fill="none" stroke={C.selected} strokeWidth="2" opacity="0.6" />)}
            {framing ? (
              <rect x={nd.x - s / 2} y={nd.y - s / 2} width={s} height={s} rx="4"
                fill={C.framingFill} stroke={stroke} strokeWidth={isSel || isHover ? 3 : 2} />
            ) : (
              <circle cx={nd.x} cy={nd.y} r={NODE_R} fill={C.nodeFill} stroke={stroke} strokeWidth={isSel || isHover ? 3 : 2} />
            )}
            <text x={nd.x} y={nd.y + 5} textAnchor="middle" fontSize="13" fontWeight="700"
              fill={C.text} style={{ pointerEvents: "none", userSelect: "none" }}>{label}</text>
            {mode === "mutate" && (
              <text x={nd.x} y={nd.y + NODE_R + 15} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace"
                fill={nd.charge.every((c) => c <= 0) && nd.charge.some((c) => c < 0) ? C.selected : C.dim}
                style={{ pointerEvents: "none", userSelect: "none" }}>({nd.charge.join(",")})</text>
            )}
          </g>
        );
      })}

      {quiver.nodes.length === 0 && (
        <text x="50%" y="50%" textAnchor="middle" fill={C.dim} fontSize="15">
          Click to add a node · drag between nodes to draw an arrow · or open Presets →
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
