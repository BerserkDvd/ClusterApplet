import React from "react";
import { presetTree } from "../model/presets.js";

// A collapsible folder tree of presets.  Folders use native <details> so they
// are keyboard-accessible and need no state; presets are buttons.
export default function PresetTree({ onPick, activeKey }) {
  return <div className="preset-tree">{renderNodes(presetTree(), onPick, activeKey, 0)}</div>;
}

function renderNodes(nodes, onPick, activeKey, depth) {
  return nodes.map((node, i) =>
    node.type === "folder" ? (
      <details key={`f${depth}-${i}-${node.label}`} open={depth === 0}>
        <summary>{node.label}</summary>
        <div className="tree-children">{renderNodes(node.children, onPick, activeKey, depth + 1)}</div>
      </details>
    ) : (
      <button
        key={`p-${node.key}`}
        className={`tree-leaf ${node.key === activeKey ? "active" : ""}`}
        onClick={() => onPick(node.key)}
      >
        {node.name}
      </button>
    )
  );
}
