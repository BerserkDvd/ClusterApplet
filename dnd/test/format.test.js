import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/dice.js";
import {
  columnsFor,
  denominatorOf,
  denominatorNote,
  useFractions,
  approxBig,
  fraction,
  exportAs,
  EXPORTERS,
  pct,
  pctExact,
  oneIn,
} from "../src/format.js";

const payload = (formula, display = "percent") => {
  const r = analyze(formula);
  return { formula: r.canonical, rows: r.rows, stats: r.stats, display };
};

/* ------------------------------------------------------------- fractions */

test("every row of a formula shares one denominator", () => {
  const { rows, stats } = payload("2d6");
  const denom = denominatorOf(stats);
  assert.equal(denom.text, "36");
  assert.equal(denom.long, false);
  const cells = rows.map((r) => fraction(r.ways, denom));
  assert.equal(cells[0], "1/36");
  assert.equal(cells[5], "6/36"); // total 7, the peak — deliberately unreduced
  assert.ok(cells.every((c) => c.endsWith("/36")));
  // The numerators sum to the denominator: that is P(1) = 1.
  const sum = rows.reduce((s, r) => s + r.ways, 0n);
  assert.equal(sum.toString(), denom.text);
});

test("numerator mode replaces the ways column and the percentages", () => {
  const { rows, stats } = payload("2d6");
  const cols = columnsFor("fraction", stats);
  assert.deepEqual(cols.map((c) => c.head), ["Total", "P(=)", "P(>=)", "P(<=)"]);
  // Bare counts — the denominator is said once, not stamped on every cell.
  assert.deepEqual(cols.map((c) => c.get(rows[5])), ["7", "6", "21", "21"]);
  for (const c of cols) assert.ok(!c.get(rows[0]).includes("/"), "no per-cell denominator");
  const pctCols = columnsFor("percent", stats).map((c) => c.head);
  assert.deepEqual(pctCols, ["Total", "Ways", "P(=) %", "P(>=) %", "P(<=) %"]);
});

test("cumulative counts are exact and monotone over the same denominator", () => {
  const { rows, stats } = payload("3d4 + 2d20 + 4");
  const denom = denominatorOf(stats);
  assert.equal(denom.text, "25600");
  assert.match(denominatorNote(denom), /out of 25,600/);
  assert.equal(rows[0].leWays, rows[0].ways);
  assert.equal(rows[0].geWays.toString(), denom.text);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].leWays > rows[i - 1].leWays, "P(<=) rises");
    assert.ok(rows[i].geWays < rows[i - 1].geWays, "P(>=) falls");
  }
});

test("an unprintable denominator falls back to percentages and says why", () => {
  const { rows, stats } = payload("200d100");
  const denom = denominatorOf(stats);
  assert.equal(denom.long, true);
  assert.equal(denom.digits, 401);
  // Not just the denominator: the cumulative numerators are 400 digits too,
  // so there is no cell rendering that helps — fall back, do not truncate.
  assert.equal(useFractions("fraction", stats), false);
  const cols = columnsFor("fraction", stats);
  assert.deepEqual(cols.map((c) => c.head), ["Total", "Ways", "P(=) %", "P(>=) %", "P(<=) %"]);
  assert.match(denominatorNote(denom), /401 digits/);
  // On screen no cell may explode the layout; the export keeps full precision.
  const screen = columnsFor("fraction", stats, { compact: true });
  const mid = rows[Math.floor(rows.length / 2)];
  for (const r of [rows[0], mid]) {
    for (const c of screen) assert.ok(c.get(r).length < 24, `cell far too wide: ${c.get(r).slice(0, 40)}…`);
  }
  assert.match(screen[1].get(mid), /^\d\.\d{4}\u00d710\^\d+$/);
  assert.ok(cols[1].get(mid).length > 400, "the export keeps every digit");
});

test("a merely large denominator still gets real fractions", () => {
  const { stats } = payload("20d6"); // 3,656,158,440,062,976 — 16 digits
  assert.equal(useFractions("fraction", stats), true);
  assert.equal(columnsFor("fraction", stats, { grouped: false })[1].get({ ways: 1n }), "1");
});

/* --------------------------------------------------------------- exports */

test("every exporter produces output in both display modes", () => {
  for (const kind of Object.keys(EXPORTERS)) {
    for (const display of ["percent", "fraction"]) {
      const text = exportAs(kind, payload("2d6 + 1", display));
      assert.ok(text.length > 40, `${kind}/${display} produced nothing`);
      assert.ok(text.includes("2d6 + 1"), `${kind}/${display} lost the formula`);
    }
  }
});

test("CSV stays rectangular and RFC-4180 quoted", () => {
  for (const display of ["percent", "fraction"]) {
    const csv = exportAs("csv", payload("3d4 + 2d20 + 4", display));
    const lines = csv.trimEnd().split("\n");
    const fieldsOf = (line) => {
      // Split on commas outside quotes.
      const out = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (quoted && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else quoted = !quoted;
        } else if (c === "," && !quoted) {
          out.push(cur);
          cur = "";
        } else cur += c;
      }
      out.push(cur);
      return out;
    };
    const preamble = lines.filter((l) => l.startsWith('"#') || l.startsWith("#"));
    for (const l of preamble) assert.equal(fieldsOf(l).length, 1, `ragged preamble: ${l}`);
    const body = lines.slice(preamble.length);
    const width = fieldsOf(body[0]).length;
    for (const l of body) assert.equal(fieldsOf(l).length, width, `ragged row: ${l}`);
    // Data cells carry no thousands separators, so none of them needs quoting.
    for (const l of body.slice(1)) {
      assert.ok(!l.includes('"'), `a data cell needed quoting: ${l}`);
      for (const f of fieldsOf(l)) assert.ok(!/^\d{1,3}(,\d{3})+$/.test(f), `grouped number: ${f}`);
    }
  }
});

test("the LaTeX table keeps its column count and a legal label", () => {
  const four = exportAs("latex", payload("2d6", "fraction"));
  assert.match(four, /\\begin\{tabular\}\{rrrr\}/);
  assert.match(four, /\\big\/ 36\$/); // denominator in the head, not the cells
  assert.match(four, /^    7 & 6 & 21 & 21 \\\\$/m);
  const five = exportAs("latex", payload("2d6", "percent"));
  assert.match(five, /\\begin\{tabular\}\{rrrrr\}/);
  // A leading-minus formula must not produce "\label{tab:dice--1d8-2}"
  const neg = exportAs("latex", payload("-1d8 + 2"));
  const label = /\\label\{([^}]*)\}/.exec(neg)[1];
  assert.match(label, /^tab:dice-[0-9a-z-]+$/);
  assert.ok(!label.includes("--"), label);
});

/* --------------------------------------------------- generating function */

test("the generating function factors out the common denominator", () => {
  const tex = exportAs("genfun", payload("2d6"));
  assert.match(tex, /\\frac\{1\}\{36\}/);
  assert.match(tex, /x\^\{2\}/); // lowest total, coefficient 1 → no leading "1"
  assert.ok(!tex.includes("1x^{2}"), "a unit coefficient should not be written");
  assert.match(tex, /6x\^\{7\}/); // the peak of 2d6
  assert.match(tex, /\\begin\{equation\*\}/);
});

test("the plain generating function evaluates to 1 at x = 1", () => {
  for (const formula of ["2d6", "3d4 + 2d20 + 4", "4d6kh3", "1d6 - 1d6"]) {
    const { stats } = payload(formula);
    const text = exportAs("genfuntext", payload(formula));
    // Skip the "# P(x) = sum_n p_n x^n" comment; take the expression itself.
    const expr = text.slice(text.indexOf("P(x) = (1/") + 7);
    const value = new Function("x", `return ${expr.replace(/\n\s*/g, " ").replace(/\)\s*$/, ")")}`)(1);
    assert.ok(Math.abs(value - 1) < 1e-9, `${formula}: P(1) = ${value}`);
    // …and its derivative at 1 is the mean.
    const h = 1e-5;
    const f = new Function("x", `return ${expr.replace(/\n\s*/g, " ")}`);
    const mean = (f(1 + h) - f(1 - h)) / (2 * h);
    assert.ok(Math.abs(mean - stats.mean) < 1e-3, `${formula}: P'(1) = ${mean}, mean ${stats.mean}`);
  }
});

test("negative totals become negative exponents, not a broken polynomial", () => {
  const text = exportAs("genfuntext", payload("1d6 - 1d6"));
  assert.match(text, /x\*\*\(-5\)/);
  const tex = exportAs("genfun", payload("1d6 - 1d6"));
  assert.match(tex, /x\^\{-5\}/);
  assert.match(tex, /\\frac\{1\}\{36\}/);
});

/* ---------------------------------------------------------- small stuff */

test("percentage and odds formatting stay readable at the extremes", () => {
  assert.equal(pct(0), "0");
  assert.equal(pct(1), "100.0000");
  assert.equal(pct(1 / 3), "33.3333");
  assert.match(pct(1e-12), /e-/);
  assert.equal(oneIn(0), "never");
  assert.equal(oneIn(1), "always");
  assert.equal(oneIn(1 / 216), "1 in 216");
});

test("screen-width counts stay exact until they cannot be read", () => {
  assert.equal(approxBig(1296n), "1,296");
  assert.equal(approxBig(10n ** 20n), "100,000,000,000,000,000,000");
  assert.equal(approxBig(10n ** 30n), "1.0000\u00d710^30");
  assert.equal(approxBig(123456789n ** 5n), "2.8679\u00d710^40");
});

test("odds and tiny percentages survive counts past Number range", () => {
  const { rows, stats } = payload("200d100");
  const mid = rows[Math.floor(rows.length / 2)];
  // Number(mid.ways) is Infinity — the odds must still come out of BigInt.
  assert.equal(Number(mid.ways), Infinity);
  assert.match(oneIn(mid.p, mid.ways, stats.total), /^1 in 102[0-9]$/);
  assert.equal(oneIn(rows[0].p, rows[0].ways, stats.total), "1 in 1.0000×10^400");
  assert.equal(oneIn(rows[0].ge, rows[0].geWays, stats.total), "always");
  // …and a probability far below the smallest double is not reported as zero.
  assert.equal(pctExact(rows[0].ways, stats.total), "1.000e-398");
  assert.equal(rows[0].p, 0, "the double really has underflowed");
});

test("odds stay right for ordinary rolls", () => {
  const { rows, stats } = payload("2d6");
  assert.equal(oneIn(rows[0].p, rows[0].ways, stats.total), "1 in 36");
  assert.equal(oneIn(rows[5].p, rows[5].ways, stats.total), "1 in 6.00");
  assert.equal(oneIn(rows[0].ge, rows[0].geWays, stats.total), "always");
});
