import React from "react";
import { addArrow, toConstructorPayload, toPythonSnippet, validateQuiver, flavourRank, nodeLabel } from "../model/quiver.js";

// Right-hand inspector: exchange-matrix editor, the flavour lattice
// Γ_f = ker(B), and the live BPSKAlgebra(...) constructor payload.
export default function SidePanel({
  quiver, onChange, onCopy, mutLog = [], spectrum = { complete: false, specCharges: [] },
  onUndoMutation, onClearMutations,
  kernel = { status: "idle" }, computing = false, exactS = null, computeMsg = "",
  onFindSpecBFS, onFindSExact, onFindSpec, onCancel,
  onDiagnostics, diagJson = "", onCopyDiag,
}) {
  const v = validateQuiver(quiver);
  const n = quiver.nodes.length;
  const f = n ? flavourRank(quiver) : 0;

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

      {mutLog.length > 0 && (
        <section>
          <h3>Mutation sequence ({mutLog.length})</h3>
          <p className="hint">μ<sub>k</sub> = mutation at node γ<sub>k</sub> (⁻¹ = inverse). Read left→right.</p>
          <div className="mut-seq">
            {mutLog.map((s, i) => (
              <span key={i} className="mut-step">μ<sub>{s.index + 1}</sub>{s.dir < 0 ? "⁻¹" : ""}</span>
            ))}
          </div>
          {spectrum.complete && (
            <div className="banner ok">✓ Spectrum generator found — all charges negated.
              <div className="mono small" style={{ marginTop: 4 }}>S = {spectrum.specCharges.map((c) => `E_q(X_(${c.join(",")}))`).join(" · ")}</div>
            </div>
          )}
          <div className="row">
            <button onClick={onUndoMutation}>↶ Undo</button>
            <button onClick={onClearMutations}>Clear</button>
          </div>
        </section>
      )}

      <section>
        <h3>Exchange matrix B</h3>
        <p className="hint">B[i][j] = ⟨γ<sub>i</sub>, γ<sub>j</sub>⟩ = #arrows γ<sub>i</sub>→γ<sub>j</sub> (antisymmetric). Click a cell <b>+1</b> · right-click <b>−1</b>.</p>
        {n === 0 ? <p className="dim">No nodes yet.</p> : (
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr><th></th>{quiver.nodes.map((_, j) => <th key={j}>{nodeLabel(quiver, j).text}</th>)}</tr>
              </thead>
              <tbody>
                {quiver.B.map((row, i) => (
                  <tr key={i}>
                    <th>{nodeLabel(quiver, i).text}</th>
                    {row.map((val, j) => {
                      const cls = i === j ? "diag" : val > 0 ? "pos" : val < 0 ? "neg" : "zero";
                      return (
                        <td key={j} className={`cell ${cls}`}
                          onClick={(e) => cellClick(i, j, e)} onContextMenu={(e) => cellClick(i, j, e)}
                          title={i === j ? "diagonal (0)" : `⟨${nodeLabel(quiver, i).text},${nodeLabel(quiver, j).text}⟩`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3>Flavour lattice Γ_f = ker(B)</h3>
        {n === 0 ? <p className="dim">—</p> : f > 0 ? (
          <p className="small"><b style={{ color: "var(--green)" }}>rank f = {f}</b> — B is degenerate, so the algebra is flavoured: <span className="mono">R = AbelianZPlusRing(rank={f})</span>.</p>
        ) : (
          <p className="small">rank f = 0 — B is non-degenerate, so <span className="mono">R = Z</span> (unflavoured).</p>
        )}
        <p className="hint">Flavour comes from a <b>degenerate B</b> (a kernel direction) — <span className="mono">Γ_f = ker(B)</span>, auto-extracted by BPSKAlgebra.</p>
      </section>

      <section>
        <h3>Spectrum generator S</h3>
        {quiver.spec && quiver.spec.charges?.length ? (
          <>
            <p className="hint">{quiver.spec.charges.length} BPS states{quiver.spec.method ? ` · ${quiver.spec.method}` : ""}</p>
            <p className="mono small">S = {quiver.spec.charges.map((c) => `E_q(X_(${c.join(",")}))`).join(" · ")}</p>
          </>
        ) : (
          <p className="dim">Not computed. Use <b>Find spec (S→spec)</b> below (exact), or mutate to a spectrum generator.</p>
        )}
      </section>

      <section>
        <h3>Compute — real BPSKAlgebra <span className="badge">exact · in-browser</span></h3>
        <p className="hint">Runs the actual Python algebra in your browser (Pyodide). First run loads the kernel (~10 s, then cached).</p>

        <p className="hint" style={{ marginTop: 6 }}><b>Find the spectrum</b> — the ordered BPS charges [γ<sub>1</sub>,…,γ<sub>N</sub>]:</p>
        <div className="row">
          <button className="primary" disabled={computing || !v.ok || n === 0} onClick={onFindSpecBFS}
            title="Bidirectional BFS over the mutation graph for a negating sequence — fast, no build_S. Recommended.">
            {computing ? "Computing…" : "⚙ Find spec (BFS)"}
          </button>
          <button disabled={computing || !v.ok || n === 0} onClick={onFindSpec}
            title="Exact via build_S then S→spec extraction. Can blow up on rank ≥ 5 — prefer BFS.">
            Find spec (exact S)
          </button>
        </div>

        <p className="hint" style={{ marginTop: 10 }}><b>Build the S element</b> — S = Σ c<sub>γ</sub>(𝖖) X<sub>γ</sub> (exact, recursive node-removal; <b>slow / can block on higher rank</b>):</p>
        <div className="row">
          <button disabled={computing || !v.ok || n === 0} onClick={onFindSExact}
            title="Recursive build_S (the F-finder). Exact but expensive; use Cancel if it runs away.">
            Find S (exact)
          </button>
          {computing && <button onClick={onCancel} title="Terminate the running compute and restart the kernel">⛔ Cancel</button>}
        </div>

        {kernel.status === "loading" && <p className="hint" style={{ marginTop: 8 }}>{kernel.statusMsg}</p>}
        {kernel.status === "error" && <div className="banner err" style={{ marginTop: 8 }}>⚠ {kernel.statusMsg}</div>}
        {computeMsg && kernel.status !== "error" && <div className="banner warn" style={{ marginTop: 8 }}>{computeMsg}</div>}
        {exactS && exactS.terms.length > 0 && (
          <>
            <p className="hint" style={{ marginTop: 8 }}>S = Σ c<sub>γ</sub>(𝖖) X<sub>γ</sub> to 𝖖<sup>{exactS.K}</sup> — recursive node-removal (the F-finder):</p>
            <pre className="snippet">{exactS.terms.map(([g, c]) => `X_(${g.join(",")}) : ${c}`).join("\n")}</pre>
          </>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={onDiagnostics}
            title="Run a self-test on the loaded kernel and copy a JSON report to paste back for debugging">
            🩺 Export diagnostics
          </button>
          {diagJson && <button onClick={onCopyDiag}>Copy report</button>}
        </div>
        {diagJson && (
          <>
            <p className="hint" style={{ marginTop: 8 }}>Copied to clipboard — paste this back if compute misbehaves:</p>
            <pre className="snippet" style={{ maxHeight: 220, overflow: "auto" }}>{diagJson}</pre>
          </>
        )}
      </section>

      <section>
        <h3>Constructor payload</h3>
        <p className="hint">The exact arguments for the real algebra:</p>
        <pre className="snippet">{toPythonSnippet(quiver)}</pre>
        <div className="row">
          <button onClick={() => onCopy(JSON.stringify(toConstructorPayload(quiver), null, 2), "payload JSON")}>Copy payload JSON</button>
        </div>
      </section>
    </div>
  );
}
