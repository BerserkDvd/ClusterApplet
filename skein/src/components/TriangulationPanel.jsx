import React from "react";
import {
  sigma, topology, punctureSummary, flavourRank, validateTriangulation,
} from "../model/triangulation.js";
import { toPythonSnippet } from "../model/triangulation.js";

// The inspection panel for a triangulation: topology, the regular/irregular
// puncture census, the exchange matrix σ_Δ (mutable block highlighted), flip
// history, and the bridge to the BPS-quiver applet.
export default function TriangulationPanel({
  tri, presetNote, flipLog, onUndo, onReset, onCopyJSON, onCopyURL, onCopyBpsJSON, onOpenBps,
}) {
  const S = sigma(tri);
  const topo = topology(tri);
  const punc = punctureSummary(tri);
  const val = validateTriangulation(tri);
  const internal = new Set(tri.internalEdgeIds);
  const fRank = flavourRank(tri);

  return (
    <aside className="side-panel">
      {!val.ok && <div className="banner err">⚠ {val.errors[0]}</div>}
      {val.ok && val.warnings.length > 0 && <div className="banner warn">{val.warnings[0]}</div>}

      <section>
        <h3>Surface</h3>
        <p className="small dim" style={{ marginTop: 0 }}>{presetNote || "an ideal triangulation"}</p>
        <div className="kv">
          <span>kind</span><span>{tri.isBordered ? "bordered" : "closed"}{topo.genus != null ? ` · genus ${topo.genus}` : ""}</span>
          <span>vertices V</span><span>{topo.V}</span>
          <span>edges E</span><span>{topo.E} <span className="dim">({tri.internalEdgeIds.length} internal · {tri.boundaryEdgeIds.length} boundary)</span></span>
          <span>triangles F</span><span>{topo.F}</span>
          <span>χ = V−E+F</span><span>{topo.chi}</span>
        </div>
      </section>

      <section>
        <h3>Punctures</h3>
        <ul className="glyph-list">
          <li><span className="glyph reg">●</span> regular (interior) punctures: <b>{punc.regular}</b> <span className="dim">— flavour SU(2)/U(1), charge in ker σ</span></li>
          <li><span className="glyph bnd">▢</span> boundary marked points: <b>{punc.markedPoints}</b></li>
          <li><span className="glyph hole">◠</span> n-boundaries (irregular punctures): <b>{punc.nBoundaries}</b>
            {punc.boundaryComponents.length > 0 && (
              <span className="dim"> — {punc.boundaryComponents.map((c) => `${c.marks}-boundary`).join(", ")}</span>
            )}
          </li>
        </ul>
      </section>

      <section>
        <h3>Exchange matrix σ<sub>Δ</sub></h3>
        <p className="hint">The BPS Dirac pairing. Internal (mutable) edges shaded; boundary edges are frozen. flip(e) ≡ mutation μ<sub>e</sub>.</p>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr><th></th>{S.map((_, j) => <th key={j} className={internal.has(j) ? "int" : ""}>{j}</th>)}</tr>
            </thead>
            <tbody>
              {S.map((row, i) => (
                <tr key={i}>
                  <th className={internal.has(i) ? "int" : ""}>{i}</th>
                  {row.map((v, j) => (
                    <td key={j} className={cellClass(v, i, j, internal)}>{v || ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small dim">flavour rank = corank of mutable block = <b>{fRank}</b></p>
      </section>

      <section>
        <h3>Flips</h3>
        {flipLog.length === 0
          ? <p className="hint">Click an internal edge to flip it (≡ a cluster mutation). Boundary edges are frozen.</p>
          : <div className="mut-seq">{flipLog.map((e, k) => <span key={k} className="mut-step">e{e}</span>)}</div>}
        <div className="row">
          <button onClick={onUndo} disabled={flipLog.length === 0}>↶ Undo flip</button>
          <button onClick={onReset} disabled={flipLog.length === 0}>⟲ Reset</button>
        </div>
      </section>

      <section>
        <h3>Feed the BPS applet</h3>
        <p className="hint">σ<sub>Δ</sub> <b>is</b> a BPS-quiver exchange matrix: internal edges → gauge nodes, boundary edges → framing. Open it in the BPS applet to run the S-finder, canonical basis, and verifiers.</p>
        <div className="row">
          <button className="primary" onClick={onOpenBps}>Open in BPS applet ↗</button>
          <button onClick={onCopyBpsJSON}>Copy BPS JSON</button>
        </div>
      </section>

      <section>
        <h3>Export</h3>
        <div className="row">
          <button onClick={onCopyJSON}>Copy JSON</button>
          <button onClick={onCopyURL}>Copy URL</button>
        </div>
        <h3 style={{ marginTop: 16 }}>Python</h3>
        <pre className="snippet">{toPythonSnippet(tri)}</pre>
      </section>
    </aside>
  );
}

function cellClass(v, i, j, internal) {
  if (i === j) return "diag";
  const base = v > 0 ? "pos" : v < 0 ? "neg" : "zero";
  const mut = internal.has(i) && internal.has(j) ? " int" : "";
  return `cell ${base}${mut}`;
}
