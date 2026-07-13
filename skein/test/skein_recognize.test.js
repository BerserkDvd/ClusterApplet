import { test } from "node:test";
import assert from "node:assert/strict";
import { recognizeSkeinKAlgebra } from "../src/model/skein_recognize.js";
import { presetByKey, fanPolygon } from "../src/model/triangulation_presets.js";

// ── polygon disks connect to SkeinKAlgebra.polygon(n) ───────────────────────
test("polygon disks recognize as SkeinKAlgebra.polygon(n)", () => {
  for (let n = 4; n <= 11; n++) {
    const r = recognizeSkeinKAlgebra(fanPolygon(n));
    assert.equal(r.ok, true, `P${n} should connect`);
    assert.equal(r.kind, "polygon");
    assert.equal(r.n, n);
    assert.equal(r.ctor, `SkeinKAlgebra.polygon(${n})`);
  }
  // the pentagon preset names the right theory
  const p5 = recognizeSkeinKAlgebra(presetByKey("p5"));
  assert.match(p5.theory, /A₁, A2/);
});

// ── non-polygon / out-of-range charts honest-fail with a reason ─────────────
test("closed / punctured / oversized charts honest-fail", () => {
  for (const key of ["tetrahedron", "torus", "csaszar", "nf3disk"]) {
    const r = recognizeSkeinKAlgebra(presetByKey(key));
    assert.equal(r.ok, false, `${key} should not connect`);
    assert.ok(r.reason && r.reason.length > 0, `${key} needs a reason`);
  }
  // a single triangle: too small
  const tri = recognizeSkeinKAlgebra(presetByKey("triangle"));
  assert.equal(tri.ok, false);
  // an oversized polygon: honest-fail past the cap
  const big = recognizeSkeinKAlgebra(fanPolygon(14));
  assert.equal(big.ok, false);
  assert.match(big.reason, /supports n/);
});
