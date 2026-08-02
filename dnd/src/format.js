// format.js — number formatting and the export writers (text / CSV / Markdown
// / LaTeX table / pgfplots / generating function).
//
// Probabilities can be written two ways, and both are exact. As percentages,
// or — since every distribution here is a count of equally likely outcomes —
// as whole numbers of ways over one common denominator. In that mode the
// denominator is said once, at the top, and the columns carry bare numerators:
// repeating "/1296" on every row of every column buys nothing.

/** Probability as a percentage *number* (the unit lives in the column header). */
export function pct(p, digits = 4) {
  if (!Number.isFinite(p)) return "—";
  if (p === 0) return "0";
  const v = p * 100;
  if (v >= 10 ** -digits) return v.toFixed(digits);
  return v.toExponential(3);
}

/** Big outcome counts, grouped: 1296 → "1,296". */
export function bigStr(v) {
  const s = v.toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Same, but for the screen: a count with hundreds of digits (100^200 has 401)
 * is not a number anyone reads, and it wrecks the table layout — so past a
 * width it becomes 1.0000×10^400. Exports never use this; a file can hold the
 * exact integer.
 */
export function approxBig(v, maxChars = 21) {
  const s = v.toString();
  if (s.length <= maxChars) return bigStr(v);
  return `${s[0]}.${s.slice(1, 5)}×10^${s.length - 1}`;
}

/**
 * "1 in 216" — the way players actually think about long odds. Given the exact
 * counts it uses them, so odds past the reach of a double (1 in 10^90 is an
 * ordinary row of 200d100) still come out right, and short enough for a cell.
 */
export function oneIn(p, ways, total) {
  if (ways != null && total != null) {
    if (ways <= 0n) return "never";
    if (ways >= total) return "always";
    const q = total / ways;
    if (q >= 1000000n) return `1 in ${approxBig(q, 12)}`;
    // Stay in BigInt for the decimal too: the counts themselves can be past
    // Number range (9.7e396 becomes Infinity) even when the odds are ~1 in 10.
    const n = Number((total * 100n) / ways) / 100;
    return `1 in ${n < 10 ? n.toFixed(2) : n.toFixed(0)}`;
  }
  if (!Number.isFinite(p) || p <= 0) return "never";
  if (p >= 1) return "always";
  const n = 1 / p;
  return `1 in ${n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(n < 10 ? 2 : 0)}`;
}

/**
 * Percentage of an exact ratio of counts.
 *
 * `ways/total` can fall far below the smallest double (1/100^200 is 10^-400),
 * where the ordinary path prints a flat "0" for something that is not zero.
 * Dividing in BigInt first keeps the leading digits and the true exponent.
 */
const POW10 = new Map();
const pow10 = (k) => {
  let v = POW10.get(k);
  // Recomputing 10n**410n once per cell dominated the render of a big table.
  if (v === undefined) POW10.set(k, (v = 10n ** BigInt(k)));
  return v;
};

export function pctExact(ways, total, digits = 4) {
  if (ways <= 0n) return "0";
  if (ways >= total) return (100).toFixed(digits);
  const k = Math.max(0, total.toString().length - ways.toString().length) + 10;
  const q = ((ways * pow10(k)) / total).toString();
  const exp = q.length - 1 + (2 - k); // exponent of the leading digit, as a %
  if (exp >= -digits) return (Number(`${q[0]}.${q.slice(1, 12)}`) * 10 ** exp).toFixed(digits);
  return `${q[0]}.${q.slice(1, 4)}e${exp}`;
}

export function num(v, digits = 3) {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

// Past this many digits the numerators are as unreadable as the denominator
// (for 200d100 both run to ~400 digits), so numerator mode has nothing left to
// show and falls back to percentages, saying why.
export const LONG_DENOMINATOR = 30;

// Rows that still fit one page inside a float; past this the LaTeX writer
// switches to longtable so nothing falls off the bottom.
const PAGE_ROWS = 36;

/** The shared denominator of every probability for one formula. */
export function denominatorOf(stats) {
  const text = stats.total.toString();
  return { text, grouped: bigStr(stats.total), digits: text.length, long: text.length > LONG_DENOMINATOR };
}

/** Whether probabilities can actually be written as whole numbers right now. */
export function useFractions(display, stats) {
  return display === "fraction" && !denominatorOf(stats).long;
}

/** One probability as an exact fraction — for single readouts, not columns. */
export function fraction(ways, denom) {
  return `${ways}/${denom.text}`;
}

/** The sentence that carries the denominator, said once. */
export function denominatorNote(denom) {
  return denom.long
    ? `This roll has ${denom.digits} digits' worth of outcomes, so exact counts are ` +
        `far too long to tabulate — percentages shown instead. The generating function ` +
        `export keeps the exact integer coefficients.`
    : `Every probability below is a whole number of ways out of ${denom.grouped} — ` +
        `the same denominator for every row and every column.`;
}

/**
 * Column set for the current display mode.
 * `grouped: false` drops thousands separators (CSV); `compact: true` shortens
 * counts too wide to read on screen.
 */
export function columnsFor(display, stats, { grouped = true, compact = false } = {}) {
  const big = (v) => (compact ? approxBig(v) : grouped ? bigStr(v) : v.toString());
  if (!useFractions(display, stats)) {
    return [
      { head: "Total", get: (r) => String(r.value) },
      { head: "Ways", get: (r) => big(r.ways) },
      { head: "P(=) %", get: (r) => pctExact(r.ways, stats.total) },
      { head: "P(>=) %", get: (r) => pctExact(r.geWays, stats.total) },
      { head: "P(<=) %", get: (r) => pctExact(r.leWays, stats.total) },
    ];
  }
  return [
    { head: "Total", get: (r) => String(r.value) },
    { head: "P(=)", get: (r) => big(r.ways) },
    { head: "P(>=)", get: (r) => big(r.geWays) },
    { head: "P(<=)", get: (r) => big(r.leWays) },
  ];
}

function header(formula, stats, display) {
  const denom = denominatorOf(stats);
  const fractions = useFractions(display, stats);
  const lines = [
    `Formula      ${formula}`,
    `Range        ${stats.min} to ${stats.max}  (${stats.bins} totals)`,
    `Outcomes     ${denom.grouped}`,
    `Mean         ${stats.mean.toFixed(4)}`,
    `Std. dev.    ${stats.stdev.toFixed(4)}`,
    `Median       ${stats.median}`,
    `Most likely  ${stats.modes.join(" ")}  (${
      fractions
        ? `${bigStr(stats.modeWays ?? 0n)} of ${denom.grouped}`
        : `${pctExact(stats.modeWays ?? 0n, stats.total)}%`
    })`,
  ];
  if (display === "fraction") lines.push(denominatorNote(denom));
  return lines;
}

function asText({ formula, rows, stats, display }) {
  const cols = columnsFor(display, stats);
  const cells = [cols.map((c) => c.head), ...rows.map((r) => cols.map((c) => c.get(r)))];
  const w = cols.map((_, i) => Math.max(...cells.map((row) => row[i].length)));
  const line = (row) => row.map((s, i) => s.padStart(w[i])).join("   ");
  const rule = w.map((n) => "-".repeat(n)).join("---");
  return [
    ...header(formula, stats, display).map((l) => `# ${l}`),
    "",
    line(cells[0]),
    rule,
    ...cells.slice(1).map(line),
    "",
  ].join("\n");
}

// RFC 4180: quote a field containing a comma, quote or newline, doubling inner
// quotes. The preamble lines go out as single quoted fields so the file stays
// rectangular even for parsers that ignore a comment character.
const csvField = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function asCsv({ formula, rows, stats, display }) {
  const cols = columnsFor(display, stats, { grouped: false });
  return (
    [
      ...header(formula, stats, display).map((l) => csvField(`# ${l.replace(/\s+/g, " ")}`)),
      cols.map((c) => csvField(c.head)).join(","),
      ...rows.map((r) => cols.map((c) => csvField(c.get(r))).join(",")),
    ].join("\n") + "\n"
  );
}

function asMarkdown({ formula, rows, stats, display }) {
  const cols = columnsFor(display, stats);
  const denom = denominatorOf(stats);
  return [
    `**${formula}** — mean ${stats.mean.toFixed(3)}, σ ${stats.stdev.toFixed(3)}, ` +
      `range ${stats.min}–${stats.max}, ${denom.grouped} outcomes`,
    ...(display === "fraction" ? ["", denominatorNote(denom)] : []),
    "",
    `| ${cols.map((c) => c.head).join(" | ")} |`,
    `| ${cols.map(() => "---:").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => c.get(r)).join(" | ")} |`),
    "",
  ].join("\n");
}

const TEX_ESCAPES = { "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", $: "\\$", "#": "\\#", _: "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
const tex = (s) => String(s).replace(/[\\&%$#_{}~^]/g, (c) => TEX_ESCAPES[c]);

/** A \label that is always legal, whatever the formula looks like. */
function texLabel(formula) {
  const slug = formula
    .replace(/\+/g, "p")
    .replace(/-/g, "m")
    .replace(/[^0-9a-zA-Z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `tab:dice-${slug || "roll"}`;
}

function asLatex({ formula, rows, stats, display }) {
  const denom = denominatorOf(stats);
  const fractions = useFractions(display, stats);
  const spec = fractions ? "rrrr" : "rrrrr";
  // In numerator mode the denominator rides in the column heads, so no row
  // repeats it: the cells are the exact integer counts.
  const over = `\\big/ ${denom.text}$`;
  const head = fractions
    ? `Total & $P(X=x)\\, ${over} & $P(X\\geq x)\\, ${over} & $P(X\\leq x)\\, ${over} \\\\`
    : "Total & Ways & $P(X=x)$ \\% & $P(X\\geq x)$ \\% & $P(X\\leq x)$ \\% \\\\";
  const body = rows.map((r) =>
    fractions
      ? `    ${r.value} & ${r.ways} & ${r.geWays} & ${r.leWays} \\\\`
      : `    ${r.value} & ${bigStr(r.ways)} & ${pctExact(r.ways, stats.total)} & ` +
        `${pctExact(r.geWays, stats.total)} & ${pctExact(r.leWays, stats.total)} \\\\`
  );
  const caption =
    `Distribution of \\texttt{${tex(formula)}}: mean $${stats.mean.toFixed(4)}$, ` +
    `standard deviation $${stats.stdev.toFixed(4)}$, ` +
    `${denom.grouped} equally likely outcomes` +
    (fractions
      ? `. Every entry is an exact count of those outcomes: divide by $${denom.text}$ for the probability.`
      : ".");
  // A `tabular` inside a float is one unbreakable box: past a page of rows
  // LaTeX reports "Float too large" and typesets the overflow off the page,
  // so long distributions go out as a longtable instead — which is also why
  // the caption/label move inside it.
  if (rows.length > PAGE_ROWS) {
    return [
      "% Requires \\usepackage{booktabs,longtable,amsmath}.",
      `\\begin{longtable}{${spec}}`,
      `  \\caption{${caption}}`,
      `  \\label{${texLabel(formula)}} \\\\`,
      "  \\toprule",
      `  ${head}`,
      "  \\midrule",
      "  \\endfirsthead",
      "  \\toprule",
      `  ${head}`,
      "  \\midrule",
      "  \\endhead",
      "  \\midrule",
      `  \\multicolumn{${spec.length}}{r}{\\emph{continued on the next page}} \\\\`,
      "  \\endfoot",
      "  \\bottomrule",
      "  \\endlastfoot",
      ...body,
      "\\end{longtable}",
      "",
    ].join("\n");
  }
  return [
    "% Requires \\usepackage{booktabs,amsmath}.",
    "\\begin{table}[htbp]",
    "  \\centering",
    `  \\caption{${caption}}`,
    `  \\label{${texLabel(formula)}}`,
    `  \\begin{tabular}{${spec}}`,
    "    \\toprule",
    `    ${head}`,
    "    \\midrule",
    ...body,
    "    \\bottomrule",
    "  \\end{tabular}",
    "\\end{table}",
    "",
  ].join("\n");
}

function asPgfplots({ formula, rows, stats }) {
  const coords = rows.map((r) => `(${r.value},${(r.p * 100).toPrecision(8)})`);
  const wrapped = [];
  for (let i = 0; i < coords.length; i += 8) wrapped.push("        " + coords.slice(i, i + 8).join(" "));
  return [
    "% Requires \\usepackage{pgfplots} and \\pgfplotsset{compat=1.18}",
    "\\begin{tikzpicture}",
    "  \\begin{axis}[",
    `      title={\\texttt{${tex(formula)}}},`,
    "      xlabel={Total}, ylabel={Probability (\\%)},",
    // Plain `ybar`, not `ybar interval`: under `interval` a coordinate is a bin
    // *edge*, so N coordinates draw N−1 bars — the highest total vanished and
    // every bar sat half a bin to the right of the total it belongs to.
    "      ymin=0, axis lines=left, ybar,",
    `      bar width=${(10.5 / Math.max(rows.length, 1)).toFixed(3)}cm,`,
    "      width=12cm, height=7cm, tick align=outside,",
    `      xtick distance=${Math.max(1, Math.round(stats.bins / 10))},`,
    "    ]",
    "    \\addplot+[draw=none] coordinates {",
    ...wrapped,
    "    };",
    "  \\end{axis}",
    "\\end{tikzpicture}",
    "",
  ].join("\n");
}

/**
 * Probability generating function, P(x) = Σₙ pₙ xⁿ.
 *
 * Because every pₙ is a count over one common denominator, the whole thing is
 * an integer polynomial with 1/N pulled out front — the coefficients below are
 * exact whole numbers, and P(1) = 1 is visible as "they sum to N". Subtracted
 * dice give negative totals, making it a Laurent polynomial; the exponents
 * carry that faithfully.
 */
function genTerms(rows, { tex: asTex }) {
  const out = [];
  for (const r of rows) {
    if (r.ways === 0n) continue;
    const c = r.ways.toString();
    const e = r.value;
    if (asTex) {
      const pow = e === 0 ? "" : e === 1 ? "x" : `x^{${e}}`;
      out.push(pow === "" ? c : `${c === "1" ? "" : c}${pow}`);
    } else {
      const pow = e === 0 ? "" : e === 1 ? "x" : `x**(${e})`;
      out.push(pow === "" ? c : `${c === "1" ? "" : c + "*"}${pow}`);
    }
  }
  return out;
}

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

function asGenFunLatex({ formula, rows, stats }) {
  const denom = denominatorOf(stats);
  const lines = chunk(genTerms(rows, { tex: true }), 6);
  const body = lines.map((group, i) =>
    i === 0
      ? `    P(x) = \\frac{1}{${denom.text}} \\Bigl( & ${group.join(" + ")}`
      : `      & {}+ ${group.join(" + ")}`
  );
  return [
    `% Probability generating function of ${formula}`,
    "% P(x) = \\sum_n p_n x^n, with the common denominator factored out, so every",
    `% coefficient below is a whole number of ways and they sum to ${denom.grouped}.`,
    `% P(1) = 1,  E[X] = P'(1) = ${stats.mean.toFixed(6)},  Var[X] = ${stats.variance.toFixed(6)}.`,
    "% Requires \\usepackage{amsmath}.",
    "\\begin{equation*}",
    "  \\begin{split}",
    body.join(" \\\\\n") + " \\Bigr)",
    "  \\end{split}",
    "\\end{equation*}",
    "",
  ].join("\n");
}

function asGenFunText({ formula, rows, stats }) {
  const denom = denominatorOf(stats);
  const lines = chunk(genTerms(rows, { tex: false }), 6).map((g) => "    " + g.join(" + "));
  return [
    `# Probability generating function of ${formula}`,
    `# P(x) = sum_n p_n x^n, common denominator ${denom.grouped} factored out.`,
    `# P(1) = 1,  E[X] = P'(1) = ${stats.mean.toFixed(6)},  Var[X] = ${stats.variance.toFixed(6)}.`,
    "# Pasteable into SymPy: x = symbols('x'); P = <the expression below>",
    "",
    `P(x) = (1/${denom.text}) * (`,
    lines.join("\n  +\n"),
    ")",
    "",
  ].join("\n");
}

export const EXPORTERS = {
  text: { label: "Plain text", ext: "txt", mime: "text/plain", render: asText },
  csv: { label: "CSV", ext: "csv", mime: "text/csv", render: asCsv },
  markdown: { label: "Markdown", ext: "md", mime: "text/markdown", render: asMarkdown },
  latex: { label: "LaTeX table", ext: "tex", mime: "text/x-tex", render: asLatex },
  pgfplots: { label: "LaTeX plot (pgfplots)", ext: "tex", mime: "text/x-tex", render: asPgfplots },
  genfun: { label: "Generating function P(x) — LaTeX", ext: "tex", mime: "text/x-tex", render: asGenFunLatex },
  genfuntext: { label: "Generating function P(x) — plain", ext: "txt", mime: "text/plain", render: asGenFunText },
};

export function exportAs(kind, payload) {
  const writer = EXPORTERS[kind] ?? EXPORTERS.text;
  return writer.render({ display: "percent", ...payload });
}
