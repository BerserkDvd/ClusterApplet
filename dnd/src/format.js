// format.js — number formatting and the export writers (text / CSV / Markdown
// / LaTeX table / pgfplots).

/** Probability as a percentage *number* (the unit lives in the column header). */
export function pct(p, digits = 4) {
  if (!Number.isFinite(p)) return "—";
  if (p === 0) return "0";
  const v = p * 100;
  if (v >= 10 ** -digits) return v.toFixed(digits);
  return v.toExponential(3);
}

/** "1 in 216" — the way players actually think about long odds. */
export function oneIn(p) {
  if (!Number.isFinite(p) || p <= 0) return "never";
  if (p >= 1) return "always";
  const n = 1 / p;
  return `1 in ${n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(n < 10 ? 2 : 0)}`;
}

export function num(v, digits = 3) {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

/** Big outcome counts, grouped: 1296 → "1,296". */
export function bigStr(v) {
  const s = v.toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const COLUMNS = [
  { key: "value", head: "Total", get: (r) => String(r.value) },
  { key: "ways", head: "Ways", get: (r) => r.ways.toString() },
  { key: "p", head: "P(=) %", get: (r) => pct(r.p) },
  { key: "ge", head: "P(>=) %", get: (r) => pct(r.ge) },
  { key: "le", head: "P(<=) %", get: (r) => pct(r.le) },
];

function header(formula, stats) {
  return [
    `Formula      ${formula}`,
    `Range        ${stats.min} to ${stats.max}  (${stats.bins} totals)`,
    `Outcomes     ${bigStr(stats.total)}`,
    `Mean         ${stats.mean.toFixed(4)}`,
    `Std. dev.    ${stats.stdev.toFixed(4)}`,
    `Median       ${stats.median}`,
    `Most likely  ${stats.modes.join(", ")}  (${pct(stats.modeP)}%)`,
  ];
}

function asText({ formula, rows, stats }) {
  const cells = [COLUMNS.map((c) => c.head), ...rows.map((r) => COLUMNS.map((c) => c.get(r)))];
  const w = COLUMNS.map((_, i) => Math.max(...cells.map((row) => row[i].length)));
  const line = (row) => row.map((s, i) => s.padStart(w[i])).join("   ");
  const rule = w.map((n) => "-".repeat(n)).join("---");
  return [
    ...header(formula, stats).map((l) => `# ${l}`),
    "",
    line(cells[0]),
    rule,
    ...cells.slice(1).map(line),
    "",
  ].join("\n");
}

function asCsv({ formula, rows, stats }) {
  const out = [
    ...header(formula, stats).map((l) => `# ${l}`),
    COLUMNS.map((c) => c.head).join(","),
    ...rows.map((r) => COLUMNS.map((c) => c.get(r)).join(",")),
  ];
  return out.join("\n") + "\n";
}

function asMarkdown({ formula, rows, stats }) {
  const head = COLUMNS.map((c) => c.head);
  return [
    `**${formula}** — mean ${stats.mean.toFixed(3)}, σ ${stats.stdev.toFixed(3)}, ` +
      `range ${stats.min}–${stats.max}, ${bigStr(stats.total)} outcomes`,
    "",
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---:").join(" | ")} |`,
    ...rows.map((r) => `| ${COLUMNS.map((c) => c.get(r)).join(" | ")} |`),
    "",
  ].join("\n");
}

const TEX_ESCAPES = { "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", $: "\\$", "#": "\\#", _: "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
const tex = (s) => String(s).replace(/[\\&%$#_{}~^]/g, (c) => TEX_ESCAPES[c]);

function asLatex({ formula, rows, stats }) {
  const body = rows.map(
    (r) => `    ${r.value} & ${bigStr(r.ways)} & ${pct(r.p)} & ${pct(r.ge)} & ${pct(r.le)} \\\\`
  );
  return [
    "% Requires \\usepackage{booktabs} (and longtable if the table spans pages).",
    "\\begin{table}[htbp]",
    "  \\centering",
    `  \\caption{Distribution of \\texttt{${tex(formula)}}: mean $${stats.mean.toFixed(4)}$, ` +
      `standard deviation $${stats.stdev.toFixed(4)}$, ` +
      `${bigStr(stats.total)} equally likely outcomes.}`,
    `  \\label{tab:dice-${formula.replace(/[^0-9a-zA-Z]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}}`,
    "  \\begin{tabular}{rrrrr}",
    "    \\toprule",
    "    Total & Ways & $P(X=x)$ \\% & $P(X\\geq x)$ \\% & $P(X\\leq x)$ \\% \\\\",
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
    "      ymin=0, axis lines=left, ybar interval=0.9,",
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

export const EXPORTERS = {
  text: { label: "Plain text", ext: "txt", mime: "text/plain", render: asText },
  csv: { label: "CSV", ext: "csv", mime: "text/csv", render: asCsv },
  markdown: { label: "Markdown", ext: "md", mime: "text/markdown", render: asMarkdown },
  latex: { label: "LaTeX table", ext: "tex", mime: "text/x-tex", render: asLatex },
  pgfplots: { label: "LaTeX plot (pgfplots)", ext: "tex", mime: "text/x-tex", render: asPgfplots },
};

export function exportAs(kind, payload) {
  const writer = EXPORTERS[kind] ?? EXPORTERS.text;
  return writer.render(payload);
}
