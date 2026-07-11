import React, { useRef, useState } from "react";
import { C, NODE_R, ARROW_HEAD, ARROW_GAP } from "../ui/theme.js";
import { addNode, moveNode, addArrow, removeNode, toggleFrozen, arrowsFromB } from "../model/quiver.js";

// Interactive SVG canvas for building/editing a BPS quiver.
//
// EDIT mode:
//   · click empty space  → add a node
//   · click node A, then node B → add an arrow A→B (right-click a node to
//     start a "reverse" arrow, i.e. remove one A→B / add B→A)
//   · double-click node  → toggle frozen (flavour) / mutable
//   · shift-click node   → delete
// MOVE mode:
//   · drag a node to reposition (display only; does not touch B)
export default function QuiverCanvas({ quiver, onChange, mode, selected, onSelect }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(-1);
  const [connectFrom, setConnectFrom] = useState(-1);
  const [drag, setDrag] = useState(null); // { index, dx, dy }
  const arrows = arrowsFromB(quiver.B);

  function pt(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    if (mode === "move") {
      if (i >= 0) {
        setDrag({ index: i, dx: quiver.nodes[i].x - x, dy: quiver.nodes[i].y - y });
        onSelect?.(i);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      return;
    }
    // EDIT mode
    if (i < 0) {
      onChange(addNode(quiver, Math.round(x), Math.round(y)));
      return;
    }
    if (e.shiftKey) {
      onChange(removeNode(quiver, i));
      if (selected === i) onSelect?.(-1);
      setConnectFrom(-1);
      return;
    }
    const dir = e.button === 2 ? -1 : 1; // right-click starts a reverse arrow
    if (connectFrom < 0) {
      setConnectFrom(i);
      onSelect?.(i);
    } else if (connectFrom === i) {
      setConnectFrom(-1);
    } else {
      onChange(addArrow(quiver, connectFrom, i, dir));
      setConnectFrom(-1);
    }
  }

  function onPointerMove(e) {
    const { x, y } = pt(e);
    setHover(nodeAt(x, y));
    if (drag) onChange(moveNode(quiver, drag.index, Math.round(x + drag.dx), Math.round(y + drag.dy)));
  }
  function onPointerUp() {
    setDrag(null);
  }
  function onDoubleClick(e) {
    const { x, y } = pt(e);
    const i = nodeAt(x, y);
    if (i >= 0) onChange(toggleFrozen(quiver, i));
  }

  return (
    <svg
      ref={svgRef}
      className="quiver-canvas"
      style={{ background: C.bg, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { setHover(-1); setDrag(null); }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <marker id="ah" markerWidth={ARROW_HEAD} markerHeight={ARROW_HEAD} refX={ARROW_HEAD - 1}
          refY={ARROW_HEAD / 2} orient="auto" markerUnits="userSpaceOnUse">
          <path d={`M0,0 L${ARROW_HEAD},${ARROW_HEAD / 2} L0,${ARROW_HEAD} Z`} fill={C.arrow} />
        </marker>
      </defs>

      {arrows.map((a, k) => (
        <Arrow key={k} from={quiver.nodes[a.from]} to={quiver.nodes[a.to]} mult={a.mult} />
      ))}

      {quiver.nodes.map((nd, i) => {
        const active = i === hover || i === selected || i === connectFrom;
        return (
          <g key={nd.id}>
            <circle
              cx={nd.x}
              cy={nd.y}
              r={NODE_R}
              fill={nd.frozen ? C.frozenFill : C.nodeFill}
              stroke={connectFrom === i ? C.selected : active ? C.hover : nd.frozen ? C.frozenStroke : C.nodeStroke}
              strokeWidth={active ? 3 : 2}
              strokeDasharray={nd.frozen ? "5 4" : "none"}
              style={{ cursor: mode === "move" ? "grab" : "pointer" }}
            />
            <text x={nd.x} y={nd.y + 5} textAnchor="middle" fontSize="14" fontWeight="700"
              fill={C.text} style={{ pointerEvents: "none", userSelect: "none" }}>
              {`γ${i + 1}`}
            </text>
          </g>
        );
      })}

      {quiver.nodes.length === 0 && (
        <text x="50%" y="50%" textAnchor="middle" fill={C.dim} fontSize="15">
          Click to add a node, or load a preset →
        </text>
      )}
    </svg>
  );
}

function Arrow({ from, to, mult }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  if (len < 2 * NODE_R + 4) return null;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux; // perpendicular
  const sx = from.x + NODE_R * ux, sy = from.y + NODE_R * uy;
  const tx = to.x - NODE_R * ux, ty = to.y - NODE_R * uy;
  const lines = [];
  const shown = Math.min(mult, 4);
  const spread = (shown - 1) / 2;
  for (let m = 0; m < shown; m++) {
    const off = (m - spread) * ARROW_GAP;
    lines.push(
      <line key={m} x1={sx + px * off} y1={sy + py * off} x2={tx + px * off} y2={ty + py * off}
        stroke={C.arrow} strokeWidth="1.6" markerEnd="url(#ah)" />
    );
  }
  const midx = (sx + tx) / 2, midy = (sy + ty) / 2;
  return (
    <g>
      {lines}
      {mult > 4 && (
        <text x={midx + px * 12} y={midy + py * 12} textAnchor="middle" fontSize="12"
          fill={C.arrow} style={{ userSelect: "none" }}>{`×${mult}`}</text>
      )}
    </g>
  );
}
