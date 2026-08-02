import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFormula,
  formatTerms,
  distribution,
  tabulate,
  summarize,
  analyze,
  adjustDie,
  adjustConst,
  dieCount,
  constTotal,
  rollTerms,
  compileSampler,
  ratio,
  DiceError,
} from "../src/dice.js";

const dist = (s) => distribution(parseFormula(s));
const waysAt = (d, v) => d.counts[v - d.min] ?? 0n;

/* ------------------------------------------------------------------ parsing */

test("parses a mixed formula", () => {
  const t = parseFormula("3d4 + 2d20+4");
  assert.equal(t.length, 3);
  assert.deepEqual(
    t.map((x) => [x.kind, x.sign, x.count ?? x.value, x.faces ?? null]),
    [
      ["dice", 1, 3, 4],
      ["dice", 1, 2, 20],
      ["const", 1, 4, null],
    ]
  );
});

test("accepts implicit counts, d%, unicode minus and leading sign", () => {
  assert.equal(formatTerms(parseFormula("d20")), "1d20");
  assert.equal(formatTerms(parseFormula("d% + 7")), "1d100 + 7");
  assert.equal(formatTerms(parseFormula("2d6 − 1")), "2d6 - 1");
  assert.equal(formatTerms(parseFormula("-1d8+2")), "-1d8 + 2");
});

test("parses keep/drop suffixes and normalises drops to keeps", () => {
  assert.deepEqual(parseFormula("4d6kh3")[0].keep, { mode: "kh", k: 3, raw: "kh3" });
  assert.deepEqual(parseFormula("4d6dl1")[0].keep, { mode: "kh", k: 3, raw: "dl1" });
  assert.deepEqual(parseFormula("2d20kl1")[0].keep, { mode: "kl", k: 1, raw: "kl1" });
  assert.deepEqual(parseFormula("4d6dh1")[0].keep, { mode: "kl", k: 3, raw: "dh1" });
  assert.deepEqual(parseFormula("2d20kh")[0].keep, { mode: "kh", k: 1, raw: "kh1" });
});

test("rejects malformed input", () => {
  for (const bad of ["3d6 2d4", "d", "2d6 +", "0d6", "4d6kh5", "d1001", "junk"]) {
    assert.throws(() => parseFormula(bad), DiceError, `expected "${bad}" to fail`);
  }
});

test("round-trips canonical notation", () => {
  assert.equal(formatTerms(parseFormula("3d4+2d20+4")), "3d4 + 2d20 + 4");
  assert.equal(formatTerms(parseFormula("4d6kh3-2")), "4d6kh3 - 2");
});

/* ------------------------------------------------------------ distributions */

test("1d6 is uniform", () => {
  const d = dist("1d6");
  assert.equal(d.min, 1);
  assert.equal(d.total, 6n);
  assert.deepEqual(d.counts, [1n, 1n, 1n, 1n, 1n, 1n]);
});

test("2d6 is the classic 1..6..1 triangle", () => {
  const d = dist("2d6");
  assert.equal(d.min, 2);
  assert.deepEqual(d.counts, [1n, 2n, 3n, 4n, 5n, 6n, 5n, 4n, 3n, 2n, 1n]);
  assert.equal(d.total, 36n);
});

test("3d6 matches the known counts, and a constant only shifts it", () => {
  const d = dist("3d6");
  assert.equal(d.total, 216n);
  assert.equal(waysAt(d, 3), 1n);
  assert.equal(waysAt(d, 10), 27n);
  assert.equal(waysAt(d, 11), 27n);
  assert.equal(waysAt(d, 18), 1n);
  const shifted = dist("3d6+4");
  assert.equal(shifted.min, d.min + 4);
  assert.deepEqual(shifted.counts, d.counts);
});

test("subtraction mirrors the distribution", () => {
  const plus = dist("2d6");
  const minus = dist("0 - 2d6");
  assert.equal(minus.min, -12);
  assert.deepEqual(minus.counts, plus.counts.slice().reverse());
  const mixed = dist("1d6 - 1d6");
  assert.equal(mixed.min, -5);
  assert.equal(waysAt(mixed, 0), 6n);
  assert.equal(mixed.total, 36n);
});

test("totals always account for every outcome", () => {
  for (const [f, n] of [["3d4 + 2d20 + 4", 4n ** 3n * 20n ** 2n], ["4d6kh3", 6n ** 4n], ["2d20kl1 + 1d8 - 2", 20n ** 2n * 8n]]) {
    assert.equal(dist(f).total, n, f);
  }
});

test("brute force agrees on a mixed formula", () => {
  // 2d4 - 1d3 + 2, enumerated directly
  const map = new Map();
  for (let a = 1; a <= 4; a++)
    for (let b = 1; b <= 4; b++)
      for (let c = 1; c <= 3; c++) {
        const v = a + b - c + 2;
        map.set(v, (map.get(v) ?? 0) + 1);
      }
  const d = dist("2d4 - 1d3 + 2");
  for (const [v, n] of map) assert.equal(waysAt(d, v), BigInt(n), `total ${v}`);
  assert.equal(d.total, 48n);
});

/* --------------------------------------------------------------- keep/drop */

function bruteKeep(n, faces, k, highest) {
  const map = new Map();
  const dice = new Array(n).fill(1);
  const step = (i) => {
    if (i === n) {
      const sorted = dice.slice().sort((a, b) => (highest ? b - a : a - b));
      const v = sorted.slice(0, k).reduce((s, x) => s + x, 0);
      map.set(v, (map.get(v) ?? 0) + 1);
      return;
    }
    for (let f = 1; f <= faces; f++) {
      dice[i] = f;
      step(i + 1);
    }
  };
  step(0);
  return map;
}

test("keep-highest matches brute force (4d6kh3, the ability-score roll)", () => {
  const d = dist("4d6kh3");
  const brute = bruteKeep(4, 6, 3, true);
  assert.equal(d.total, 1296n);
  for (const [v, n] of brute) assert.equal(waysAt(d, v), BigInt(n), `total ${v}`);
  // Known value: the mean of 4d6kh3 is 15869/1296 ≈ 12.2446
  assert.equal(summarize(d).mean.toFixed(4), "12.2446");
});

test("keep-lowest and multi-die keeps match brute force", () => {
  for (const [n, faces, k, hi, notation] of [
    [2, 20, 1, true, "2d20kh1"],
    [2, 20, 1, false, "2d20kl1"],
    [5, 4, 2, true, "5d4kh2"],
    [5, 4, 3, false, "5d4kl3"],
    [3, 8, 2, false, "3d8dh1"],
  ]) {
    const d = dist(notation);
    const brute = bruteKeep(n, faces, k, hi);
    assert.equal(d.total, BigInt(faces) ** BigInt(n), notation);
    for (const [v, c] of brute) assert.equal(waysAt(d, v), BigInt(c), `${notation} total ${v}`);
  }
});

test("advantage on a d20 beats a flat d20", () => {
  const flat = summarize(dist("1d20")).mean;
  const adv = summarize(dist("2d20kh1")).mean;
  const dis = summarize(dist("2d20kl1")).mean;
  assert.equal(flat, 10.5);
  assert.equal(adv.toFixed(4), "13.8250"); // 5530/400
  assert.equal(dis.toFixed(4), "7.1750");
  assert.ok(dis < flat && flat < adv);
});

test("keeping every die is the same as rolling them all", () => {
  assert.deepEqual(dist("3d6kh3").counts, dist("3d6").counts);
  assert.deepEqual(dist("3d6dl0").counts, dist("3d6").counts);
});

/* ------------------------------------------------------- tables and stats */

test("cumulative columns are consistent", () => {
  const { rows, dist: d } = analyze("3d4 + 2d20 + 4");
  const sum = rows.reduce((s, r) => s + r.ways, 0n);
  assert.equal(sum, d.total);
  assert.equal(rows[0].leWays, rows[0].ways);
  assert.equal(rows[rows.length - 1].geWays, rows[rows.length - 1].ways);
  assert.equal(rows[0].geWays, d.total);
  for (const r of rows) assert.equal(r.leWays + r.geWays - r.ways, d.total);
  assert.ok(Math.abs(rows[rows.length - 1].le - 1) < 1e-12);
});

test("summary statistics are exact for 3d6", () => {
  const s = summarize(dist("3d6"));
  assert.equal(s.mean, 10.5);
  assert.equal(s.variance.toFixed(6), (35 / 12 * 3).toFixed(6));
  assert.equal(s.median, 10);
  assert.deepEqual(s.modes, [10, 11]);
  assert.equal(s.min, 3);
  assert.equal(s.max, 18);
  assert.equal(s.bins, 16);
});

test("mean and variance are additive across terms", () => {
  const s = summarize(dist("3d4 + 2d20 + 4"));
  assert.equal(s.mean.toFixed(10), (3 * 2.5 + 2 * 10.5 + 4).toFixed(10));
  const varDie = (f) => (f * f - 1) / 12;
  assert.equal(s.variance.toFixed(8), (3 * varDie(4) + 2 * varDie(20)).toFixed(8));
});

test("stays exact where doubles would not", () => {
  // 200d100 has 100^200 outcomes — far past Number range.
  const s = summarize(dist("200d100"));
  assert.equal(s.mean.toFixed(6), (200 * 50.5).toFixed(6));
  assert.equal(s.total.toString().length, 401);
  assert.ok(Number.isFinite(s.stdev) && s.stdev > 0);
});

test("ratio survives counts far beyond Number.MAX_VALUE", () => {
  const big = 10n ** 400n;
  assert.equal(ratio(big, big * 4n), 0.25);
  assert.equal(ratio(0n, big), 0);
});

/* ------------------------------------------------------- formula editing */

test("clicking dice merges into existing groups", () => {
  let t = parseFormula("3d4 + 2d20 + 4");
  t = adjustDie(t, 20, 1);
  assert.equal(formatTerms(t), "3d4 + 3d20 + 4");
  t = adjustDie(t, 6, 1);
  assert.equal(formatTerms(t), "3d4 + 3d20 + 4 + 1d6");
  t = adjustDie(t, 6, -1);
  assert.equal(formatTerms(t), "3d4 + 3d20 + 4");
  t = adjustConst(t, -6);
  assert.equal(formatTerms(t), "3d4 + 3d20 - 2");
});

test("subtracting past zero flips a group negative", () => {
  let t = parseFormula("1d8");
  t = adjustDie(t, 8, -1);
  assert.equal(formatTerms(t), "");
  t = adjustDie(t, 8, -1);
  assert.equal(formatTerms(t), "-1d8");
  t = adjustDie(t, 8, -1);
  assert.equal(formatTerms(t), "-2d8");
  t = adjustDie(t, 8, 3);
  assert.equal(formatTerms(t), "1d8");
});

test("keep groups are left alone by the dice tray", () => {
  let t = parseFormula("4d6kh3");
  t = adjustDie(t, 6, 1);
  assert.equal(formatTerms(t), "4d6kh3 + 1d6");
});

/* ----------------------------------------------------------------- rolling */

test("rolls land inside the distribution's support", () => {
  const terms = parseFormula("3d4 + 2d20kh1 - 2");
  const d = distribution(terms);
  let seed = 1;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 500; i++) {
    const { total, parts } = rollTerms(terms, rand);
    assert.ok(total >= d.min && total <= d.min + d.counts.length - 1, `total ${total}`);
    assert.ok(waysAt(d, total) > 0n);
    assert.equal(parts[1].rolls.filter((r) => r.kept).length, 1);
  }
});

/* ------------------------------------------------------------------ limits */

test("refuses work it cannot do exactly", () => {
  assert.throws(() => dist("501d6"), DiceError);
  assert.throws(() => dist("400d100"), DiceError); // too many distinct totals
  assert.throws(() => dist("60d100kh30"), DiceError); // keep DP too large
});

/* -------------------------------------------------------------- sampling */

test("the fast sampler agrees with the exact distribution", () => {
  const terms = parseFormula("2d6 + 1d4 - 2");
  const d = distribution(terms);
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const sample = compileSampler(terms, rand);
  const hits = new Map();
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const v = sample();
    assert.ok(waysAt(d, v) > 0n, `sampled an impossible total ${v}`);
    hits.set(v, (hits.get(v) ?? 0) + 1);
  }
  // Every achievable total should show up, at roughly the right rate.
  for (let i = 0; i < d.counts.length; i++) {
    const v = d.min + i;
    const exact = ratio(d.counts[i], d.total);
    const seen = (hits.get(v) ?? 0) / N;
    assert.ok(Math.abs(seen - exact) < 0.01, `total ${v}: sampled ${seen}, exact ${exact}`);
  }
});

test("the sampler honours keep/drop and signs", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const adv = compileSampler(parseFormula("2d20kh1"), rand);
  const dis = compileSampler(parseFormula("2d20kl1"), rand);
  const neg = compileSampler(parseFormula("0 - 1d6"), rand);
  let a = 0;
  let b = 0;
  for (let i = 0; i < 20000; i++) {
    a += adv();
    b += dis();
    const v = neg();
    assert.ok(v >= -6 && v <= -1);
  }
  assert.ok(a / 20000 > 13 && a / 20000 < 14.6, "advantage mean near 13.825");
  assert.ok(b / 20000 > 6.4 && b / 20000 < 7.9, "disadvantage mean near 7.175");
});

/* ------------------------------------------------- audit regression tests */

test("a missing operator is an error, not a different die", () => {
  // "1d20 5" used to become "1d205" once whitespace was stripped.
  assert.throws(() => parseFormula("1d20 5"), DiceError);
  assert.throws(() => parseFormula("2d6 3d4"), DiceError);
  assert.throws(() => parseFormula("3 4"), DiceError);
  // …while whitespace inside a group is still fine.
  assert.equal(formatTerms(parseFormula("3 d 6")), "3d6");
  assert.equal(formatTerms(parseFormula("4d6 kh3")), "4d6kh3");
  assert.equal(formatTerms(parseFormula("  2d6  +  1  ")), "2d6 + 1");
});

test("constants are bounded, so formatTerms never emits something unparseable", () => {
  assert.throws(() => parseFormula("1d6 + 99999999999999999999"), DiceError);
  const ok = parseFormula("1d6 + 1000000000");
  assert.equal(formatTerms(ok), "1d6 + 1000000000");
  assert.deepEqual(parseFormula(formatTerms(ok)), ok);
});

test("every formula formats to something that parses back identically", () => {
  for (const f of ["3d4+2d20+4", "-1d8+2", "4d6kh3-2", "1d6-1d6", "d%+7", "2d20kl1", "1d6 + 3d6 + 4"]) {
    const terms = parseFormula(f);
    const text = formatTerms(terms);
    assert.deepEqual(parseFormula(text), terms, `round trip failed for ${f}`);
    assert.equal(formatTerms(parseFormula(text)), text);
  }
});

test("the tray sees every group of a die size, not just the first", () => {
  // "Sneak attack" is a shipped preset with two separate d6 groups.
  const terms = parseFormula("1d6 + 3d6 + 4");
  assert.equal(dieCount(terms, 6), 4, "badge must count all four d6");
  assert.equal(constTotal(terms), 4);
  const plus = adjustDie(terms, 6, 1);
  assert.equal(dieCount(plus, 6), 5, "a click must move the total by exactly one");
  assert.equal(formatTerms(plus), "1d6 + 4d6 + 4");
  const minus = adjustDie(terms, 6, -1);
  assert.equal(dieCount(minus, 6), 3);
  // Mixed signs still add up the way the badge says.
  const mixed = parseFormula("3d6 - 1d6");
  assert.equal(dieCount(mixed, 6), 2);
  assert.equal(dieCount(adjustDie(mixed, 6, 1), 6), 3);
});

test("constants merge from the last term, and several constants sum", () => {
  const t = parseFormula("1d6 + 2 + 3");
  assert.equal(constTotal(t), 5);
  assert.equal(constTotal(adjustConst(t, 1)), 6);
  assert.equal(formatTerms(adjustConst(t, 1)), "1d6 + 2 + 4");
});

test("work is budgeted across the whole formula, not just per term", () => {
  // Every group here passes the per-term limits; together they used to grind
  // for seconds with no error, no progress and no way to cancel.
  for (const heavy of [
    Array(30).fill("6d100kh3").join(" + "),
    Array(16).fill("20d20kh10").join(" + "),
    Array(30).fill("15d20kl8").join(" + "),
  ]) {
    const started = Date.now();
    assert.throws(() => distribution(parseFormula(heavy)), DiceError, heavy.slice(0, 30));
    assert.ok(Date.now() - started < 2000, "the refusal must be fast, not a timeout");
  }
});

test("nothing the limits accept blocks for long", () => {
  for (const f of [
    "3d4 + 2d20 + 4",
    "4d6kh3",
    "8d6",
    "40d20 + 10d6 - 5",
    "2d20kh1 + 5",
    "500d4",
    "200d100",
    "20d20kh10",
    Array(4).fill("10d100kh5").join(" + "),
  ]) {
    const started = Date.now();
    assert.ok(distribution(parseFormula(f)).total > 0n, f);
    const ms = Date.now() - started;
    assert.ok(ms < 1500, `${f} took ${ms}ms`);
  }
});
