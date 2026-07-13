import React from "react";

// The build-mode action panel: turns the current canvas selection into a
// construction op (attach a triangle to a free edge, glue two free edges, cut
// an internal edge) plus puncture surgery.  All ops honest-fail with a reason.
export default function BuildPanel({ tri, selFree, selInternal, selTriangle, interiorPunctures, build }) {
  const nFree = tri.boundaryEdgeIds.length;
  return (
    <aside className="side-panel build">
      <section>
        <h3>Build by hand</h3>
        <p className="hint">
          Click <b className="free-swatch">free edges</b> on the canvas: one → <b>attach a triangle</b>, two → <b>glue</b>.
          Click an internal edge to <b>cut</b> it; click a triangle to <b>add a puncture</b>.
        </p>

        <div className="build-sel">
          <span className="dim">selected free edges:</span>{" "}
          {selFree.length ? selFree.map((e) => <span key={e} className="mut-step">e{e}</span>) : <span className="dim">none</span>}
          {selInternal.length > 0 && <> · <span className="dim">internal:</span> {selInternal.map((e) => <span key={e} className="mut-step">e{e}</span>)}</>}
        </div>

        <div className="build-actions">
          <button className="primary" disabled={selFree.length !== 1} onClick={build.attach}
            title="Glue a fresh triangle onto the selected free edge">＋ Attach triangle</button>
          <button disabled={selFree.length !== 2} onClick={build.glue}
            title="Identify the two selected free edges into one internal edge">⋈ Glue free edges</button>
          <button disabled={selInternal.length !== 1} onClick={build.cut}
            title="Un-glue the selected internal edge into two free edges">✂ Cut edge</button>
        </div>
      </section>

      <section>
        <h3>Puncture surgery</h3>
        <div className="build-actions">
          <button disabled={selTriangle < 0} onClick={() => build.addPuncture(selTriangle)}
            title="Insert a regular puncture inside the selected triangle (subdivide into 3)">
            ● Add puncture {selTriangle >= 0 ? `in △${selTriangle}` : ""}
          </button>
        </div>
        {interiorPunctures.length > 0 ? (
          <div className="build-punctures">
            <span className="dim small">remove an interior puncture:</span>
            <div className="row" style={{ flexWrap: "wrap", gap: 5, marginTop: 4 }}>
              {interiorPunctures.map((v) => (
                <button key={v.label} className="chip-btn" onClick={() => build.removePuncture(v.label)}
                  title={`Contract the degree-3 interior puncture v${v.label}`}>● v{v.label} ✕</button>
              ))}
            </div>
          </div>
        ) : <p className="small dim">no interior punctures to remove.</p>}
      </section>

      <section>
        <p className="small dim">
          Every op yields a valid ideal triangulation or fails with a reason (e.g. a glue that would
          self-fold a triangle, or a topology that isn't an orientable surface). {nFree} free edge{nFree === 1 ? "" : "s"} available.
        </p>
      </section>
    </aside>
  );
}
