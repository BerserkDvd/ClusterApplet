// app.js — wiring: formula ⇄ dice tray, exact analysis, plot, table, exports.

import {
  analyze,
  parseFormula,
  formatTerms,
  adjustDie,
  adjustConst,
  dieCount,
  rollTerms,
  compileSampler,
  DiceError,
} from "./dice.js";
import {
  EXPORTERS,
  exportAs,
  pct,
  oneIn,
  bigStr,
  approxBig,
  columnsFor,
  denominatorOf,
  denominatorNote,
  useFractions,
  fraction,
} from "./format.js";
import { createChart } from "./chart.js";

const $ = (id) => document.getElementById(id);
const TABLE_CAP = 5000; // rows rendered; exports always carry every row

const DICE = [4, 6, 8, 10, 12, 20, 100];

const PRESETS = [
  ["Attack +5", "1d20 + 5"],
  ["Advantage", "2d20kh1 + 5"],
  ["Disadvantage", "2d20kl1 + 5"],
  ["Ability score", "4d6kh3"],
  ["Greatsword", "2d6 + 4"],
  ["Fireball", "8d6"],
  ["Sneak attack", "1d6 + 3d6 + 4"],
  ["Percentile", "1d%"],
];

// Die silhouettes: a triangle for the d4 up to a rounded d100, each drawn in
// one 44×44 box so the tray reads as a row of dice rather than a row of chips.
const SHAPES = {
  4: "M22 5 L40 37 H4 Z",
  6: "M7 7 H37 V37 H7 Z",
  8: "M22 4 L39 22 L22 40 L5 22 Z",
  10: "M22 4 L39 18 L22 40 L5 18 Z",
  12: "M22 4 L39 17 L32.5 38 H11.5 L5 17 Z",
  20: "M22 4 L38 13.5 V30.5 L22 40 L6 30.5 V13.5 Z",
  100: "M22 4 L39 18 L22 40 L5 18 Z",
};
const INNER = {
  20: "M22 4 L30 26 L22 40 L14 26 Z",
  12: "M22 14 L30.5 20 L27 30 H17 L13.5 20 Z",
  100: "M22 4 V40 M5 18 H39",
};

// How many rolls the simulate buttons throw, and the work ceiling that keeps
// the page responsive (rolls × dice, not rolls).
const SIM_RUNS = [100, 10000, 1000000];
const SIM_BUDGET = 6e7;

const state = {
  terms: parseFormula("3d4 + 2d20 + 4"),
  mode: "pmf",
  target: null,
  format: "text",
  display: "percent", // "percent" | "fraction" — how probabilities are written
  last: null,
  sim: null,
};

const chart = createChart($("chart"));

/* --------------------------------------------------------------- tray */

function dieSvg(faces) {
  const inner = INNER[faces] ? `<path d="${INNER[faces]}" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55" stroke-linejoin="round"/>` : "";
  return (
    `<svg viewBox="0 0 44 44" width="40" height="40" aria-hidden="true">` +
    `<path d="${SHAPES[faces]}" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>` +
    inner +
    `</svg>`
  );
}

function buildTray() {
  const tray = $("dice-tray");
  tray.replaceChildren();
  for (const faces of DICE) {
    const cell = document.createElement("div");
    cell.className = "die";
    cell.dataset.die = String(faces);
    const label = faces === 100 ? "d%" : `d${faces}`;
    cell.innerHTML =
      `<button class="die__face" type="button" data-faces="${faces}" data-delta="1" ` +
      `title="Left-click to add a ${label}, right-click to take one away" ` +
      `aria-label="Add one ${label}">${dieSvg(faces)}` +
      `<span class="die__name">${label}</span></button>` +
      `<div class="die__row">` +
      `<button class="btn btn--icon" type="button" data-faces="${faces}" data-delta="-1" aria-label="Subtract one ${label}">−</button>` +
      `<span class="die__count" data-count="${faces}">0</span>` +
      `<button class="btn btn--icon" type="button" data-faces="${faces}" data-delta="1" aria-label="Add one ${label}">+</button>` +
      `</div>`;
    tray.append(cell);
  }
  tray.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-faces]");
    if (!btn) return;
    state.terms = adjustDie(state.terms, Number(btn.dataset.faces), Number(btn.dataset.delta));
    pushFormula();
  });
  // Right-click a die to take one away — the ± buttons stay for touch and
  // keyboard, where there is no second mouse button.
  tray.addEventListener("contextmenu", (e) => {
    const face = e.target.closest(".die__face");
    if (!face) return;
    e.preventDefault();
    state.terms = adjustDie(state.terms, Number(face.dataset.faces), -1);
    pushFormula();
  });
}

function buildPresets() {
  const box = $("presets");
  box.replaceChildren();
  for (const [name, formula] of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "preset";
    b.textContent = name;
    b.title = formula;
    b.addEventListener("click", () => {
      state.terms = parseFormula(formula);
      pushFormula();
    });
    box.append(b);
  }
}

function syncTray() {
  for (const faces of DICE) {
    const n = dieCount(state.terms, faces);
    const cell = document.querySelector(`.die[data-die="${faces}"]`);
    const out = document.querySelector(`[data-count="${faces}"]`);
    if (out) {
      out.textContent = n === 0 ? "0" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
      out.classList.toggle("die__count--set", n !== 0);
    }
    if (cell) cell.classList.toggle("die--active", n !== 0);
  }
  const k = state.terms.find((t) => t.kind === "const");
  const v = k ? k.sign * k.value : 0;
  $("const-value").textContent = v > 0 ? `+${v}` : String(v);
}

/* ------------------------------------------------------------- render */

/** One probability, written the way the display toggle asks for. */
function prob(ways, p, stats) {
  return useFractions(state.display, stats) ? fraction(ways, denominatorOf(stats)) : `${pct(p, 2)}%`;
}

function tiles(stats) {
  const modes = stats.modes.length > 3 ? `${stats.modes[0]}…${stats.modes[stats.modes.length - 1]}` : stats.modes.join(", ");
  return [
    ["Mean", stats.mean.toFixed(2), `median ${stats.median}`],
    ["Std. deviation", stats.stdev.toFixed(2), "spread around the mean"],
    ["Most likely", modes, `${prob(stats.modeWays, stats.modeP, stats)} of rolls`],
    ["Range", `${stats.min} to ${stats.max}`, `${stats.bins} possible totals`],
    [
      "Equally likely outcomes",
      approxBig(stats.total),
      denominatorOf(stats).long
        ? `${denominatorOf(stats).digits} digits — denominator of every row`
        : "denominator of every row",
    ],
  ];
}

function renderSummary(result) {
  const box = $("tiles");
  box.replaceChildren();
  for (const [label, value, note] of tiles(result.stats)) {
    const tile = document.createElement("div");
    tile.className = "tile";
    for (const [cls, text] of [["tile__label", label], ["tile__value", value], ["tile__note", note]]) {
      const s = document.createElement("div");
      s.className = cls;
      s.textContent = text;
      tile.append(s);
    }
    box.append(tile);
  }

  const hero = $("hero");
  if (state.target == null) {
    hero.hidden = true;
    return;
  }
  const { rows, stats } = result;
  const i = state.target - stats.min;
  const p = i <= 0 ? 1 : i >= rows.length ? 0 : rows[i].ge;
  const ways = i <= 0 ? stats.total : i >= rows.length ? 0n : rows[i].geWays;
  const denom = denominatorOf(stats);
  const asFraction = useFractions(state.display, stats);
  hero.hidden = false;
  $("hero-label").textContent = `Chance of hitting ${state.target}+`;
  const odds = oneIn(p, ways, stats.total);
  $("hero-value").textContent = asFraction ? fraction(ways, denom) : `${pct(p, 2)}%`;
  $("hero-note").textContent = asFraction ? `${pct(p, 2)}% · ${odds}` : odds;
}

function renderTable(result) {
  const { rows, stats } = result;
  const cols = columnsFor(state.display, stats, { compact: true });
  const shown = Math.min(rows.length, TABLE_CAP);

  const head = document.createElement("tr");
  for (const c of [...cols, { head: "Odds" }]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = c.head.replace(">=", "≥").replace("<=", "≤");
    head.append(th);
  }
  $("table-head").replaceChildren(head);

  const parts = new Array(shown);
  for (let i = 0; i < shown; i++) {
    const r = rows[i];
    const hit = state.target != null && r.value >= state.target;
    parts[i] =
      `<tr${hit ? ' class="is-hit"' : ""}>` +
      cols.map((c) => `<td>${c.get(r)}</td>`).join("") +
      `<td>${oneIn(r.p, r.ways, stats.total)}</td></tr>`;
  }
  // Every cell is a number this module formatted itself — no external strings.
  $("table-body").innerHTML = parts.join("");

  const denom = denominatorOf(stats);
  const note = $("denom-note");
  note.hidden = state.display !== "fraction";
  note.textContent = state.display === "fraction" ? denominatorNote(denom) : "";

  $("table-note").textContent =
    shown < rows.length
      ? `showing the first ${shown.toLocaleString()} of ${rows.length.toLocaleString()} totals — exports include all of them`
      : `${rows.length.toLocaleString()} totals`;
}

function renderExport(result) {
  $("export-text").value = exportAs(state.format, {
    formula: result.canonical,
    rows: result.rows,
    stats: result.stats,
    display: state.display,
  });
}

function render() {
  const error = $("formula-error");
  let result;
  try {
    result = analyze(formatTerms(state.terms));
  } catch (err) {
    if (!(err instanceof DiceError)) throw err;
    error.hidden = false;
    error.textContent = err.message;
    state.last = null;
    return;
  }
  error.hidden = true;
  state.last = result;

  $("chart-title").textContent = `Distribution of ${result.canonical}`;
  chart.update({
    rows: result.rows,
    stats: result.stats,
    mode: state.mode,
    target: state.target,
    formula: result.canonical,
    sim: state.sim,
    display: state.display,
    denom: denominatorOf(result.stats),
  });
  renderSummary(result);
  renderTable(result);
  renderExport(result);
}

/* ------------------------------------------------- formula in / out */

/** Tray/preset edits write back into the text box, then re-render. */
function pushFormula() {
  $("formula").value = formatTerms(state.terms);
  dropSim();
  syncTray();
  writeHash();
  render();
}

let timer = null;
function onType() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const text = $("formula").value;
    try {
      state.terms = parseFormula(text);
    } catch (err) {
      if (!(err instanceof DiceError)) throw err;
      $("formula-error").hidden = false;
      $("formula-error").textContent = err.message;
      state.last = null;
      return;
    }
    dropSim();
    syncTray();
    writeHash();
    render();
  }, 140);
}

function writeHash() {
  const f = formatTerms(state.terms).replace(/\s+/g, "");
  const hash = f ? `#${encodeURIComponent(f)}` : "";
  if (hash !== location.hash) history.replaceState(null, "", location.pathname + location.search + hash);
}

function readHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, "")).trim();
  if (!raw) return;
  try {
    state.terms = parseFormula(raw);
    $("formula").value = formatTerms(state.terms);
  } catch {
    /* keep the default formula */
  }
}

/* --------------------------------------------------------------- roll */

function doRoll() {
  const box = $("roll-result");
  if (!state.terms.length) {
    box.hidden = true;
    return;
  }
  const { total, parts } = rollTerms(state.terms);
  box.replaceChildren();
  const head = document.createElement("div");
  const strong = document.createElement("span");
  strong.className = "roll__total";
  strong.textContent = String(total);
  head.append(strong);
  const tail = document.createElement("span");
  tail.textContent = state.last
    ? `  ·  ${pct(state.last.rows[total - state.last.stats.min]?.p ?? 0, 2)}% chance of exactly this, ` +
      `${pct(state.last.rows[total - state.last.stats.min]?.ge ?? 0, 2)}% of this or better`
    : "";
  head.append(tail);
  box.append(head);

  const detail = document.createElement("div");
  for (const part of parts) {
    const group = document.createElement("span");
    const lead = document.createElement("span");
    lead.textContent = `${part.sign < 0 ? " − " : " + "}${part.label}: `;
    group.append(lead);
    if (!part.rolls.length) {
      const c = document.createElement("span");
      c.className = "roll__die";
      c.textContent = String(part.subtotal);
      group.append(c);
    }
    for (const r of part.rolls) {
      const d = document.createElement("span");
      d.className = `roll__die${r.kept ? "" : " roll__die--dropped"}`;
      d.textContent = String(r.v);
      group.append(d);
    }
    detail.append(group);
  }
  box.append(detail);
  box.hidden = false;
}

/* --------------------------------------------------------- simulation */

let simToken = 0;

/** Forget any sampled overlay (it belongs to the previous formula). */
function dropSim() {
  simToken++;
  state.sim = null;
  const box = $("sim-report");
  if (box) box.hidden = true;
  document.querySelectorAll("[data-sim]").forEach((b) => b.setAttribute("aria-pressed", "false"));
}

function clearSim() {
  dropSim();
  if (state.last) render();
}

function reportBusy(done, total) {
  const box = $("sim-report");
  box.hidden = false;
  box.className = "sim-report sim-report--busy";
  box.textContent = `rolling… ${Math.round((done / total) * 100)}% (${done.toLocaleString()} of ${total.toLocaleString()})`;
}

function reportSim(sim, stats, requested) {
  const box = $("sim-report");
  box.hidden = false;
  box.className = "sim-report";
  box.replaceChildren();
  const add = (label, value) => {
    const span = document.createElement("span");
    span.append(document.createTextNode(`${label} `));
    const b = document.createElement("b");
    b.textContent = value;
    span.append(b);
    box.append(span);
  };
  add("rolls", sim.rolls.toLocaleString());
  add("sample mean", `${sim.mean.toFixed(3)}`);
  add("exact mean", stats.mean.toFixed(3));
  add("sample σ", sim.stdev.toFixed(3));
  add("largest gap", `${(sim.maxGap * 100).toFixed(3)} pp`);
  add("total variation", `${(sim.tvd * 100).toFixed(3)}%`);
  if (requested > sim.rolls) {
    const note = document.createElement("span");
    note.textContent = `(capped from ${requested.toLocaleString()} — too many dice per roll)`;
    box.append(note);
  }
}

/** Roll the formula `n` times, time-sliced so the page never locks up. */
function simulate(requested) {
  const result = state.last;
  if (!result || !state.terms.length) return;
  const perRoll = state.terms.reduce((s, t) => s + (t.kind === "dice" ? t.count : 0), 0) || 1;
  const n = Math.max(1, Math.min(requested, Math.floor(SIM_BUDGET / perRoll)));
  const token = ++simToken;
  const { stats } = result;
  const counts = new Float64Array(stats.bins);
  const sample = compileSampler(state.terms);
  let done = 0;
  let sum = 0;
  let sumSq = 0;

  const finish = () => {
    const p = new Float64Array(stats.bins);
    const ge = new Float64Array(stats.bins);
    const le = new Float64Array(stats.bins);
    let acc = 0;
    for (let i = 0; i < stats.bins; i++) {
      p[i] = counts[i] / n;
      acc += p[i];
      le[i] = acc;
    }
    acc = 0;
    for (let i = stats.bins - 1; i >= 0; i--) {
      acc += p[i];
      ge[i] = acc;
    }
    let maxGap = 0;
    let tvd = 0;
    for (let i = 0; i < stats.bins; i++) {
      const gap = Math.abs(p[i] - result.rows[i].p);
      if (gap > maxGap) maxGap = gap;
      tvd += gap;
    }
    const mean = sum / n;
    state.sim = {
      p,
      ge,
      le,
      rolls: n,
      mean,
      stdev: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
      maxGap,
      tvd: tvd / 2,
    };
    render();
    reportSim(state.sim, stats, requested);
  };

  const step = () => {
    if (token !== simToken) return;
    const until = performance.now() + 12;
    while (done < n) {
      const end = Math.min(n, done + 4000);
      for (; done < end; done++) {
        const v = sample();
        counts[v - stats.min]++;
        sum += v;
        sumSq += v * v;
      }
      if (performance.now() >= until) break;
    }
    if (done < n) {
      reportBusy(done, n);
      requestAnimationFrame(step);
    } else {
      finish();
    }
  };

  document
    .querySelectorAll("[data-sim]")
    .forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.sim) === requested)));
  reportBusy(0, n);
  requestAnimationFrame(step);
}

function buildSimControls() {
  const box = $("sim-controls");
  for (const n of SIM_RUNS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn--sim";
    b.dataset.sim = String(n);
    b.setAttribute("aria-pressed", "false");
    b.textContent = `${n.toLocaleString()}×`;
    b.title = `Roll the formula ${n.toLocaleString()} times and plot how it actually landed`;
    b.addEventListener("click", () => simulate(n));
    box.append(b);
  }
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "btn btn--ghost btn--sim";
  reset.textContent = "reset";
  reset.addEventListener("click", clearSim);
  box.append(reset);
}

/* ------------------------------------------------------------- events */

function buildFormats() {
  const sel = $("export-format");
  for (const [key, writer] of Object.entries(EXPORTERS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = writer.label;
    sel.append(opt);
  }
  sel.value = state.format;
  sel.addEventListener("change", () => {
    state.format = sel.value;
    if (state.last) renderExport(state.last);
  });
}

function flash(msg) {
  const s = $("copy-status");
  s.textContent = msg;
  setTimeout(() => {
    if (s.textContent === msg) s.textContent = "";
  }, 2200);
}

function initTheme() {
  const saved = localStorage.getItem("dicelab-theme");
  if (saved) document.documentElement.dataset.theme = saved;
  const label = () => {
    const dark =
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector("[data-theme-label]").textContent = dark ? "Light" : "Dark";
  };
  label();
  $("theme-toggle").addEventListener("click", () => {
    const dark =
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    localStorage.setItem("dicelab-theme", dark ? "light" : "dark");
    label();
    chart.redraw();
  });
}

function syncDisplayButtons() {
  document
    .querySelectorAll("[data-display]")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.display === state.display)));
}

function init() {
  buildTray();
  buildPresets();
  buildFormats();
  buildSimControls();
  initTheme();
  const savedDisplay = localStorage.getItem("dicelab-display");
  if (savedDisplay === "fraction" || savedDisplay === "percent") state.display = savedDisplay;
  syncDisplayButtons();
  readHash();

  $("formula").addEventListener("input", onType);
  $("formula").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doRoll();
  });
  $("roll").addEventListener("click", doRoll);
  $("clear").addEventListener("click", () => {
    state.terms = [];
    $("roll-result").hidden = true;
    pushFormula();
  });

  document.querySelectorAll("[data-const]").forEach((b) =>
    b.addEventListener("click", () => {
      state.terms = adjustConst(state.terms, Number(b.dataset.const));
      pushFormula();
    })
  );

  document.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      state.mode = b.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      if (state.last) render();
    })
  );

  document.querySelectorAll("[data-display]").forEach((b) =>
    b.addEventListener("click", () => {
      state.display = b.dataset.display;
      localStorage.setItem("dicelab-display", state.display);
      syncDisplayButtons();
      if (state.last) render();
    })
  );

  $("genfun").addEventListener("click", () => {
    state.format = "genfun";
    $("export-format").value = "genfun";
    if (state.last) renderExport(state.last);
    $("export-text").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("target").addEventListener("input", () => {
    const raw = $("target").value.trim();
    const v = Number(raw);
    state.target = raw === "" || !Number.isFinite(v) ? null : Math.round(v);
    if (state.last) render();
  });

  $("copy").addEventListener("click", async () => {
    const text = $("export-text").value;
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied to clipboard");
    } catch {
      $("export-text").select();
      flash("Press ⌘/Ctrl+C to copy");
    }
  });

  $("download").addEventListener("click", () => {
    if (!state.last) return;
    const writer = EXPORTERS[state.format];
    const blob = new Blob([$("export-text").value], { type: `${writer.mime};charset=utf-8` });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.last.canonical.replace(/[^0-9a-z]+/gi, "-").replace(/^-|-$/g, "") || "dice"}.${writer.ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash(`Saved ${a.download}`);
  });

  window.addEventListener("hashchange", () => {
    readHash();
    syncTray();
    render();
  });

  syncTray();
  render();
}

init();
