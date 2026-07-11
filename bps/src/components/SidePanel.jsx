import React from "react";
import {
  addArrow, toConstructorPayload, toPythonSnippet, validateQuiver,
  flavourRank, nodeLabel, framingRows, gaugeIndices,
} from "../model/quiver.js";

// Right-hand inspector: exchange-matrix editor, the flavour lattice
// Γ_f = ker(B) of the gauge quiver, framing (extended-charge) rows, and the
// live BPSKAlgebra(...) constructor payload.
export default function SidePanel({ quiver, onChange, onCopy }) {
  const v = validateQuiver(quiver);
  const n = quiver.nodes.length;
  const nGauge = gaugeIndices(quiver).length;
  const f = nGauge ? flavourRank(quiver) : 0;
  const framing = framingRows(quiver);

  function cellClick(i, j, e) {
    e.preventDefault();
    if (i === j) return;
    if (quiver.nodes[i].kind === "framing" && quiver.nodes[j].kind === "framing") return;
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
        <p className="hint">B[i][j] = ⟨node<sub>i</sub>,node<sub>j</sub>⟩ (antisymmetric). <b>Click +1 · right-click −1.</b> γ = gauge (BPS), <span style={{ color: "var(--violet)" }}>f = framing</span> (rows = ⟨γ,γ<sub>i</sub>⟩; framing↔framing disabled).</p>
        {n === 0 ? <p className="dim">No nodes yet — add some in Construct mode.</p> : (
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr><th></th>{quiver.nodes.map((_, j) => {
                  const l = nodeLabel(quiver, j);
                  return <th key={j} className={l.kind === "framing" ? "fhead" : ""}>{l.text}</th>;
                })}</tr>
              </thead>
              <tbody>
                {quiver.B.map((row, i) => {
                  const li = nodeLabel(quiver, i);
                  return (
                    <tr key={i}>
                      <th className={li.kind === "framing" ? "fhead" : ""}>{li.text}</th>
                      {row.map((val, j) => {
                        const ff = quiver.nodes[i].kind === "framing" && quiver.nodes[j].kind === "framing";
                        const cls = i === j ? "diag" : ff ? "ff" : val > 0 ? "pos" : val < 0 ? "neg" : "";
                        return (
                          <td key={j} className={`cell ${cls}`}
                            onClick={(e) => cellClick(i, j, e)} onContextMenu={(e) => cellClick(i, j, e)}
                            title={i === j ? "diagonal (0)" : ff ? "framing↔framing (not used)" : `⟨${li.text},${nodeLabel(quiver, j).text}⟩`}>
                            {ff ? "·" : val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3>Flavour lattice Γ_f = ker(B)</h3>
        {nGauge === 0 ? <p className="dim">—</p> : f > 0 ? (
          <p className="small"><b style={{ color: "var(--green)" }}>rank f = {f}</b> — the gauge B is degenerate, so the algebra is flavoured: <span className="mono">R = AbelianZPlusRing(rank={f})</span>.</p>
        ) : (
          <p className="small">rank f = 0 — the gauge B is non-degenerate, so <span className="mono">R = Z</span> (unflavoured).</p>
        )}
        <p className="hint">Flavour comes from a <b>degenerate B</b> (a kernel direction) — <span className="mono">Γ_f = ker(B)</span>, auto-extracted by BPSKAlgebra.</p>
      </section>

      {framing.length > 0 && (
        <section>
          <h3>Framing — extended F<sub>γ</sub></h3>
          <p className="hint">Each framing node is an extended charge γ outside the BPS lattice, fixed by ⟨γ,γ<sub>i</sub>⟩. Its <b>F<sub>γ</sub> is findable</b> (F<sub>γ</sub>·S = X<sub>γ</sub> + O(𝖖)) but <b>cannot be multiplied</b> with others.</p>
          <ul className="charges">
            {framing.map((fr) => (
              <li key={fr.label}><span className="tag violet">{fr.label}</span>⟨γ,γ<sub>i</sub>⟩ = ({fr.pairing.join(", ")})</li>
            ))}
          </ul>
        </section>
      )}

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
        <p className="hint">The exact arguments for the real algebra (gauge quiver; framing listed separately):</p>
        <pre className="snippet">{toPythonSnippet(quiver)}</pre>
        <div className="row">
          <button onClick={() => onCopy(JSON.stringify(toConstructorPayload(quiver), null, 2), "payload JSON")}>Copy payload JSON</button>
        </div>
      </section>
    </div>
  );
}
