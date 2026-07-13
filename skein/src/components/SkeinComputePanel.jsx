import React, { useEffect, useState } from "react";
import { connectSkein, skeinMultiply, skeinInnerProduct } from "../compute/skein.js";

// The compute panel: connect the built chart to the REAL SkeinKAlgebra (run in
// Pyodide) and demonstrate the O(𝖖) axioms live — structure constants, the Schur
// pairing I_{a,b} = δ + O(𝖖), Tr(1), and the verifier battery.
const fmt = (t) => (t ? `(${t.join(",")})` : "—");

export default function SkeinComputePanel({ rec, kernel }) {
  const [K, setK] = useState(6);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState([]);         // up to 2 generator labels [a,b]
  const [mult, setMult] = useState("");
  const [ip, setIp] = useState("");

  const key = rec.ok ? rec.ctor : rec.reason;
  useEffect(() => { setData(null); setErr(""); setSel([]); setMult(""); setIp(""); }, [key]);

  async function doConnect() {
    setBusy(true); setErr(""); setMult(""); setIp("");
    try {
      const d = await connectSkein(rec, K);
      setData(d); setSel([d.a, d.b]);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }
  async function doMultiply() {
    if (sel.length !== 2) return;
    setBusy(true); setErr("");
    try { setMult(await skeinMultiply(rec, sel[0], sel[1])); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }
  async function doIP() {
    if (sel.length !== 2) return;
    setBusy(true); setErr("");
    try { setIp(await skeinInnerProduct(rec, sel[0], sel[1], K)); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }
  function pickGen(g) {
    setSel((cur) => {
      const has = cur.findIndex((x) => fmt(x) === fmt(g));
      if (has >= 0) return cur.filter((_, i) => i !== has);
      return [...cur, g].slice(-2);
    });
    setMult(""); setIp("");
  }

  if (!rec.ok) {
    return (
      <aside className="side-panel compute">
        <section>
          <h3>Connect to SkeinKAlgebra</h3>
          <div className="banner warn">{rec.reason}</div>
        </section>
      </aside>
    );
  }

  const V = data?.verifiers || {};
  return (
    <aside className="side-panel compute">
      <section>
        <h3>Connect to SkeinKAlgebra</h3>
        <p className="hint">This chart is <b>{rec.theory}</b> = <code>{rec.ctor}</code>. Runs the <b>real</b> K_𝖖 engine in-browser (Pyodide).</p>
        <div className="row" style={{ alignItems: "center" }}>
          <button className="primary" onClick={doConnect} disabled={busy}>
            {busy ? "Computing…" : data ? "↻ Recompute" : "Connect ▶"}
          </button>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            K <input type="number" min="2" max="12" value={K} onChange={(e) => setK(Math.max(2, Math.min(12, +e.target.value || 6)))} style={{ width: 46 }} />
          </label>
        </div>
        {kernel.status === "loading" && <p className="small dim">⏳ {kernel.statusMsg}</p>}
        {kernel.status === "error" && <div className="banner err">{kernel.statusMsg}</div>}
        {err && <div className="banner err">⚠ {err}</div>}
      </section>

      {data && (
        <>
          <section>
            <div className="kv">
              <span>algebra</span><span>{data.name}</span>
              <span>coefficient ring</span><span className="mono">{data.coeff_ring}</span>
            </div>
          </section>

          <section>
            <h3>Generators · pick two</h3>
            <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
              {data.gens.map((g, i) => (
                <button key={i} className={`chip-btn ${sel.some((x) => fmt(x) === fmt(g)) ? "on" : ""}`} onClick={() => pickGen(g)}>{fmt(g)}</button>
              ))}
            </div>
            <p className="small dim" style={{ marginTop: 6 }}>a = <b className="mono">{fmt(sel[0])}</b> · b = <b className="mono">{fmt(sel[1])}</b></p>
            <div className="row">
              <button onClick={doMultiply} disabled={sel.length !== 2 || busy}>× Multiply</button>
              <button onClick={doIP} disabled={sel.length !== 2 || busy}>⟨·,·⟩ Inner product</button>
            </div>
            {mult && <p className="mono small result">L_a · L_b = {mult}</p>}
            {ip && <p className="mono small result">I(a,b) = {ip}</p>}
          </section>

          <section>
            <h3>The O(𝖖) axioms, live</h3>
            <p className="mono small">L<sub>a</sub>·L<sub>b</sub> = <b>{data.multiply_ab}</b></p>
            <p className="mono small">Tr(1) = {data.trace_1}</p>
            <p className="mono small">I(a,a) = {data.ip_aa} <span className="axiom-ok">→ 1 + O(𝖖)</span></p>
            <p className="mono small">I(a,b) = {data.ip_ab} <span className="axiom-ok">→ O(𝖖)</span></p>
            <p className="small dim">Orthonormality I<sub>a,b</sub> = δ<sub>a,b</sub> + O(𝖖) is the central conjecture (Goal 2.1) — shown here, not assumed.</p>
          </section>

          <section>
            <h3>Verifiers</h3>
            <ul className="verifiers">
              <Ver ok={V.orthonormality_diag} name="orthonormality (diag)" note="I(a,a)[q⁰]=1" />
              <Ver ok={V.orthonormality_offdiag} name="orthonormality (off-diag)" note="I(a,b)[q⁰]=0" />
              <Ver ok={V.bar_involution} name="bar involution" note="antimultiplicative" />
              <Ver ok={V.rho_automorphism} name="ρ automorphism" note="ρ(ab)=ρ(a)ρ(b)" />
              <Ver ok={V.rho2_twisted_trace} name="ρ²-twisted trace" note="Tr(ab)=Tr(ρ²(b)a)" />
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}

function Ver({ ok, name, note }) {
  return (
    <li>
      <span className={`vbadge ${ok ? "pass" : "fail"}`}>{ok ? "✓" : "✗"}</span>
      <span className="vname">{name}</span> <span className="dim small">{note}</span>
    </li>
  );
}
