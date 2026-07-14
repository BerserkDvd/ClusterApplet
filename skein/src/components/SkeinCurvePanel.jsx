import React, { useEffect, useMemo, useState } from "react";
import { curveF, interiorPunctures } from "../compute/skein_curves.js";

// Curve → tropical charge + F.  A simple closed curve on the chart (a peripheral
// loop around an interior puncture, or one given by its per-edge crossing
// numbers) → its crossed edges, tropical charge γ = [γ₋, γ⁺] (the Newton
// corners of F), and the exact quantum trace F in the Y_Δ shear coordinates.
export default function SkeinCurvePanel({ tri, kernel }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [coords, setCoords] = useState(() => Array(tri.nEdges).fill(0));

  const interior = useMemo(() => interiorPunctures(tri), [tri]);
  const chartKey = `${tri.nPunctures}|${tri.nEdges}|${tri.triangleEdges.map((t) => t.join("")).join(",")}`;
  useEffect(() => { setRes(null); setErr(""); setCoords(Array(tri.nEdges).fill(0)); }, [chartKey]); // eslint-disable-line

  async function go(spec) {
    setBusy(true); setErr(""); setRes(null);
    try {
      const out = await curveF(tri, spec);
      setRes(out);
      if (out.error) setErr(out.error);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }
  const setCoord = (i, v) => setCoords((c) => c.map((x, k) => (k === i ? Math.max(0, Math.trunc(+v) || 0) : x)));
  const someCrossing = coords.some((c) => c > 0);

  return (
    <aside className="side-panel curve">
      <section>
        <h3>Curve → charge + F</h3>
        <p className="hint">A simple closed curve on this surface → its tropical charge γ and quantum trace <b>F</b> (the geometric F in Y<sub>Δ</sub>). Works on any built chart — the intrinsic skein engine.</p>
        {kernel.status === "loading" && <p className="small dim">⏳ {kernel.statusMsg}</p>}
        {kernel.status === "error" && <div className="banner err">{kernel.statusMsg}</div>}
      </section>

      <section>
        <h3>Peripheral loops</h3>
        {interior.length ? (
          <>
            <p className="small dim">the loop around an interior puncture:</p>
            <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
              {interior.map((p) => (
                <button key={p} className="chip-btn" disabled={busy} onClick={() => go({ kind: "peripheral", puncture: p })}>◯ p{p}</button>
              ))}
            </div>
          </>
        ) : (
          <p className="small dim">this chart has no interior punctures — a disk has no essential closed curves (its line operators are the arcs / diagonals; arc → F is the next step). Try a closed or punctured surface, or enter crossing numbers below.</p>
        )}
      </section>

      <section>
        <h3>By edge-crossing numbers</h3>
        <p className="small dim">how many times the curve crosses each edge:</p>
        <div className="coord-grid">
          {coords.map((c, i) => (
            <label key={i} className="coord-cell">
              <span className="dim">e{i}</span>
              <input type="number" min="0" max="9" value={c} disabled={busy} onChange={(e) => setCoord(i, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="primary" disabled={busy || !someCrossing} onClick={() => go({ kind: "coords", coords })}>Compute charge + F</button>
        </div>
      </section>

      {err && <section><div className="banner warn">{err}</div></section>}

      {res && !res.error && (
        <section>
          <h3>Result</h3>
          <div className="kv">
            <span>crossing numbers</span><span className="mono">({res.coords.join(",")})</span>
            <span>crossed edges</span><span className="mono">[{res.crossed_edges.join(", ")}]</span>
            <span>components</span><span>{res.n_components}</span>
          </div>
          <p className="mono small" style={{ marginTop: 8 }}>tropical charge γ:</p>
          <p className="mono small result">γ₋ = ({res.gamma_lower.join(",")})<br />γ₊ = ({res.gamma_upper.join(",")})</p>
          <p className="mono small" style={{ marginTop: 8 }}>F ({res.n_terms} term{res.n_terms === 1 ? "" : "s"}) in Y<sub>Δ</sub>:</p>
          <p className="mono small result">{res.F}</p>
        </section>
      )}
    </aside>
  );
}
