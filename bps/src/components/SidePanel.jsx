import React from "react";
import { addArrow, toConstructorPayload, toPythonSnippet, validateQuiver } from "../model/quiver.js";

// Right-hand inspector: exchange matrix editor, charges, spec status, and the
// live BPSKAlgebra(...) constructor payload (what will feed the real algebra
// once the Pyodide compute path lands — Plan 39 v1 T1.3+).
export default function SidePanel({ quiver, onChange, onCopy }) {
  const v = validateQuiver(quiver);
  const n = quiver.nodes.length;

  function cellClick(i, j, e) {
    e.preventDefault();
    if (i === j) return;
    onChange(addArrow(quiver, i, j, e.type === "contextmenu" ? -1 : 1));
  }

  return (
    <div className="side-panel">
      {(!v.ok || v.warnings.length > 0) && (
        <div className={`banner ${v.ok ? "warn" : "err"}`}>
          {!v.ok
            ? `⚠ ${v.errors[0]}${v.errors.length > 1 ? ` (+${v.errors.length - 1} more)` : ""}`
            : `⚠ ${v.warnings[0]}`}
        </div>
      )}

      <section>
        <h3>Exchange matrix B</h3>
        <p className="hint">B[i][j] = #arrows γ<sub>i</sub>→γ<sub>j</sub> = ⟨γ<sub>i</sub>,γ<sub>j</sub>⟩ (antisymmetric). Click a cell +1 · right-click −1.</p>
        {n === 0 ? (
          <p className="dim">No nodes yet.</p>
        ) : (
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th></th>
                  {quiver.nodes.map((_, j) => <th key={j}>γ{j + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {quiver.B.map((row, i) => (
                  <tr key={i}>
                    <th>γ{i + 1}</th>
                    {row.map((val, j) => (
                      <td
                        key={j}
                        className={`cell ${i === j ? "diag" : val > 0 ? "pos" : val < 0 ? "neg" : ""}`}
                        onClick={(e) => cellClick(i, j, e)}
                        onContextMenu={(e) => cellClick(i, j, e)}
                        title={i === j ? "diagonal (fixed 0)" : `⟨γ${i + 1},γ${j + 1}⟩`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3>Node charges</h3>
        <p className="hint">Charge vectors in Γ (default: canonical basis γ<sub>i</sub>). Frozen nodes shown dashed on the canvas.</p>
        {n === 0 ? <p className="dim">—</p> : (
          <ul className="charges">
            {quiver.nodes.map((nd, i) => (
              <li key={nd.id}>
                <span className="tag">{nd.frozen ? "frozen" : "mutable"}</span>
                γ<sub>{i + 1}</sub> = ({nd.charge.join(", ")})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Spectrum generator S</h3>
        {quiver.spec && quiver.spec.charges?.length ? (
          <p className="mono small">S = {quiver.spec.charges.map((c) => `E_q(X_(${c.join(",")}))`).join(" · ")}</p>
        ) : (
          <p className="dim">Not computed. The <b>S-finder</b> (real BPSKAlgebra) will compute it — coming in the compute path.</p>
        )}
      </section>

      <section>
        <h3>Constructor payload</h3>
        <p className="hint">The exact arguments for the real algebra:</p>
        <pre className="snippet">{toPythonSnippet(quiver)}</pre>
        <div className="row">
          <button onClick={() => onCopy(JSON.stringify(toConstructorPayload(quiver), null, 2), "payload JSON")}>
            Copy payload JSON
          </button>
        </div>
      </section>
    </div>
  );
}
