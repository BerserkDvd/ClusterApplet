// chart.js — the distribution plot: a column chart over the achievable totals,
// degrading to an area+line when the range is too dense for readable columns.
// One measure on one axis, per-mark hover/focus tooltip, table view alongside.

const NS = "http://www.w3.org/2000/svg";
const MARGIN = { top: 18, right: 18, bottom: 52, left: 62 };

const el = (tag, attrs = {}, text = null) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== null) node.textContent = text;
  return node;
};

const MODES = {
  pmf: { label: "Probability of exactly this total", axis: "P(total = x)", pick: (r) => r.p, sim: "p" },
  ge: { label: "Probability of at least this total", axis: "P(total ≥ x)", pick: (r) => r.ge, sim: "ge" },
  le: { label: "Probability of at most this total", axis: "P(total ≤ x)", pick: (r) => r.le, sim: "le" },
};

function niceCeil(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (v <= step * mag * 1.0000001) return step * mag;
  }
  return 10 * mag;
}

function xStep(count, maxLabels) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]) {
    if (count / s <= maxLabels) return s;
  }
  return Math.ceil(count / maxLabels);
}

export function createChart(container) {
  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  const svg = el("svg", { class: "chart", role: "img", tabindex: "0" });
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  wrap.append(svg, tip);
  container.append(wrap, legend);

  let state = null;
  let focus = -1;
  let geom = null;

  const fmtPct = (p) => {
    const v = p * 100;
    if (v === 0) return "0%";
    if (v >= 0.01) return `${v.toFixed(2)}%`;
    if (v >= 0.0001) return `${v.toFixed(4)}%`;
    return `${v.toExponential(2)}%`;
  };

  function showTip(i, clientX, clientY) {
    if (!state || i < 0 || i >= state.rows.length) return hideTip();
    const r = state.rows[i];
    tip.replaceChildren();
    const head = document.createElement("div");
    head.className = "chart-tip__head";
    head.textContent = `Total ${r.value}`;
    tip.append(head);
    const lines = [
      ["exactly", fmtPct(r.p)],
      ["at least", fmtPct(r.ge)],
      ["at most", fmtPct(r.le)],
      ["ways", r.ways.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")],
    ];
    if (state.sim) {
      const key = (MODES[state.mode] ?? MODES.pmf).sim;
      lines.splice(1, 0, ["rolled", fmtPct(state.sim[key][i])]);
    }
    for (const [label, value] of lines) {
      const row = document.createElement("div");
      row.className = "chart-tip__row";
      const v = document.createElement("span");
      v.className = "chart-tip__value";
      v.textContent = value;
      const l = document.createElement("span");
      l.className = "chart-tip__label";
      l.textContent = label;
      row.append(v, l);
      tip.append(row);
    }
    tip.hidden = false;
    const box = wrap.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = clientX - box.left + 14;
    let y = clientY - box.top - th - 12;
    if (x + tw > box.width - 4) x = clientX - box.left - tw - 14;
    if (y < 4) y = clientY - box.top + 18;
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${Math.max(4, y)}px`;
    highlight(i);
  }

  function hideTip() {
    tip.hidden = true;
    highlight(-1);
  }

  function highlight(i) {
    focus = i;
    const marks = svg.querySelectorAll("[data-i]");
    for (const m of marks) m.classList.toggle("is-focus", Number(m.dataset.i) === i);
    const ring = svg.querySelector(".focus-ring");
    if (!ring || !geom) return;
    if (i < 0 || i >= state.rows.length) {
      ring.setAttribute("opacity", "0");
      return;
    }
    const { x, w } = geom.slot(i);
    ring.setAttribute("opacity", "1");
    ring.setAttribute("x", x);
    ring.setAttribute("width", w);
    ring.setAttribute("y", geom.y0);
    ring.setAttribute("height", geom.y1 - geom.y0);
  }

  function draw() {
    svg.replaceChildren();
    legend.replaceChildren();
    if (!state || !state.rows.length) return;

    const { rows, stats, mode, target, formula, sim } = state;
    const spec = MODES[mode] ?? MODES.pmf;
    const W = Math.max(280, container.clientWidth || 720);
    const H = Math.min(460, Math.max(300, Math.round(W * 0.42)));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute(
      "aria-label",
      `${spec.label} for ${formula}. ${rows.length} possible totals from ${stats.min} to ${stats.max}, ` +
        `mean ${stats.mean.toFixed(2)}. Full values are in the table below.`
    );

    const x0 = MARGIN.left;
    const x1 = W - MARGIN.right;
    const y0 = MARGIN.top;
    const y1 = H - MARGIN.bottom;
    const n = rows.length;
    const band = (x1 - x0) / n;
    const values = rows.map(spec.pick);
    const simValues = sim ? sim[spec.sim] : null;
    const peak = Math.max(Math.max(...values), simValues ? Math.max(...simValues) : 0, 1e-12);
    const yMax = niceCeil(peak);
    const xc = (i) => x0 + band * (i + 0.5);
    const yv = (p) => y1 - (p / yMax) * (y1 - y0);
    geom = {
      y0,
      y1,
      slot: (i) => ({ x: x0 + band * i, w: Math.max(band, 1) }),
    };

    // ---- gridlines + y axis -------------------------------------------
    const ticks = 5;
    const gridG = el("g", { class: "grid" });
    const axisG = el("g", { class: "axis" });
    for (let t = 0; t <= ticks; t++) {
      const p = (yMax * t) / ticks;
      const y = yv(p);
      if (t > 0) gridG.append(el("line", { x1: x0, x2: x1, y1: y, y2: y, class: "grid-line" }));
      axisG.append(
        el("text", { x: x0 - 10, y: y + 4, class: "tick tick--y" }, `${+(p * 100).toPrecision(3)}%`)
      );
    }
    gridG.append(el("line", { x1: x0, x2: x1, y1: y1, y2: y1, class: "axis-line" }));
    svg.append(gridG);

    // ---- x ticks --------------------------------------------------------
    const step = xStep(n, Math.max(3, Math.floor((x1 - x0) / 64)));
    const first = Math.ceil(stats.min / step) * step;
    for (let v = first; v <= stats.max; v += step) {
      const i = v - stats.min;
      axisG.append(el("text", { x: xc(i), y: y1 + 20, class: "tick tick--x" }, String(v)));
    }
    axisG.append(el("text", { x: (x0 + x1) / 2, y: H - 10, class: "axis-title" }, "Total"));
    axisG.append(
      el(
        "text",
        { x: -(y0 + y1) / 2, y: 16, class: "axis-title", transform: "rotate(-90)" },
        spec.axis
      )
    );
    svg.append(axisG);

    // ---- marks ----------------------------------------------------------
    const marks = el("g", { class: "marks" });
    // With a simulation on screen the second hue belongs to the sampled series,
    // so the target split falls back to its marker line and the hero stat.
    const splitTarget = target != null && mode === "pmf" && !sim;
    const hit = (i) => splitTarget && rows[i].value >= target;
    if (band >= 3) {
      // Columns: capped thickness, 2px of surface between neighbours, 4px
      // rounded data-end squared off at the baseline.
      const w = Math.min(24, Math.max(1, band - 2));
      for (let i = 0; i < n; i++) {
        const h = y1 - yv(values[i]);
        if (h <= 0) continue;
        const x = xc(i) - w / 2;
        const y = y1 - h;
        const r = Math.min(4, w / 2, h);
        const d =
          `M${x} ${y1} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} ` +
          `Q${x + w} ${y} ${x + w} ${y + r} V${y1} Z`;
        marks.append(el("path", { d, class: `bar${hit(i) ? " bar--hit" : ""}`, "data-i": i }));
      }
    } else {
      // Dense range: one 2px line over a 10%-opacity wash.
      const seg = (from, to, cls) => {
        if (to <= from) return;
        let d = `M${xc(from)} ${y1}`;
        for (let i = from; i <= to; i++) d += ` L${xc(i)} ${yv(values[i])}`;
        d += ` L${xc(to)} ${y1} Z`;
        marks.append(el("path", { d, class: `area${cls}` }));
        let l = `M${xc(from)} ${yv(values[from])}`;
        for (let i = from + 1; i <= to; i++) l += ` L${xc(i)} ${yv(values[i])}`;
        marks.append(el("path", { d: l, class: `line${cls}` }));
      };
      let split = n - 1;
      if (splitTarget) {
        split = Math.max(0, Math.min(n - 1, target - stats.min));
        seg(0, split, "");
        seg(split, n - 1, " is-hit");
      } else {
        seg(0, n - 1, "");
      }
    }
    // The sampled distribution rides on top of the exact one, same axis, same
    // units — a 2px line with end-dots where the bands are wide enough.
    if (simValues) {
      let d = `M${xc(0)} ${yv(simValues[0])}`;
      for (let i = 1; i < n; i++) d += ` L${xc(i)} ${yv(simValues[i])}`;
      marks.append(el("path", { d, class: "sim-line" }));
      if (band >= 14) {
        for (let i = 0; i < n; i++)
          marks.append(el("circle", { cx: xc(i), cy: yv(simValues[i]), r: 4, class: "sim-dot" }));
      }
    }
    svg.append(marks);

    // ---- markers ---------------------------------------------------------
    const overlay = el("g", { class: "overlay" });
    if (mode === "pmf" && Number.isFinite(stats.mean)) {
      const mx = xc(stats.mean - stats.min);
      overlay.append(el("line", { x1: mx, x2: mx, y1: y0 + 12, y2: y1, class: "marker" }));
      overlay.append(
        el("text", { x: mx, y: y0 + 8, class: "marker-label" }, `mean ${stats.mean.toFixed(2)}`)
      );
    }
    if (target != null && target > stats.min && target <= stats.max) {
      const tx = x0 + band * (target - stats.min);
      overlay.append(el("line", { x1: tx, x2: tx, y1: y0, y2: y1, class: "marker marker--target" }));
    }
    overlay.append(el("rect", { class: "focus-ring", opacity: 0, x: 0, y: 0, width: 0, height: 0 }));
    svg.append(overlay);

    // ---- hit layer -------------------------------------------------------
    const hitRect = el("rect", {
      x: x0,
      y: y0,
      width: Math.max(1, x1 - x0),
      height: Math.max(1, y1 - y0),
      class: "chart-hit",
    });
    hitRect.addEventListener("pointermove", (e) => {
      const box = svg.getBoundingClientRect();
      const px = ((e.clientX - box.left) / box.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - x0) / band)));
      showTip(i, e.clientX, e.clientY);
    });
    hitRect.addEventListener("pointerleave", hideTip);
    svg.append(hitRect);

    // ---- legend (only once two things are being told apart) --------------
    const entries = [];
    if (sim) {
      entries.push(["swatch--base", "exact probability"]);
      entries.push(["swatch--line", `rolled ${sim.rolls.toLocaleString()}×`]);
    } else if (splitTarget) {
      entries.push(["swatch--hit", `total ≥ ${target}`]);
      entries.push(["swatch--base", `total < ${target}`]);
    }
    for (const [cls, text] of entries) {
      const item = document.createElement("span");
      item.className = "chart-legend__item";
      const sw = document.createElement("span");
      sw.className = `chart-legend__swatch ${cls}`;
      const label = document.createElement("span");
      label.textContent = text;
      item.append(sw, label);
      legend.append(item);
    }

    if (focus >= 0 && focus < n) highlight(focus);
  }

  svg.addEventListener("keydown", (e) => {
    if (!state || !state.rows.length) return;
    const n = state.rows.length;
    let i = focus < 0 ? Math.floor(n / 2) : focus;
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "Escape") return hideTip();
    else return;
    e.preventDefault();
    const box = svg.getBoundingClientRect();
    const W = Number(svg.getAttribute("width")) || box.width;
    const scale = box.width / W;
    const { x, w } = geom.slot(i);
    showTip(i, box.left + (x + w / 2) * scale, box.top + geom.y0 * scale + 40);
  });
  svg.addEventListener("blur", hideTip);

  if (typeof ResizeObserver !== "undefined") {
    let last = container.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - last) < 8) return;
      last = container.clientWidth;
      draw();
    }).observe(container);
  }

  return {
    update(next) {
      state = next;
      focus = -1;
      hideTip();
      draw();
    },
    redraw: draw,
    svgElement: svg,
  };
}
