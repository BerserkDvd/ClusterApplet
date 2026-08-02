// dice.js — exact probability engine for D&D dice notation.
//
// Everything is computed with BigInt outcome counts, so the numbers are exact
// integers (no floating-point drift): a distribution is stored as a dense array
// of "ways" indexed from `min`, and probabilities are only ever produced at the
// very end by an exact scaled division.
//
// No dependencies, no build step: this module is loaded straight by the browser
// and by `node --test`.

export class DiceError extends Error {
  constructor(message, at = null) {
    super(message);
    this.name = "DiceError";
    this.at = at;
  }
}

export const LIMITS = {
  maxTerms: 40,
  maxTotalDice: 500,
  maxFaces: 1000,
  maxBins: 20001, // distinct totals the result may span
  maxKeepDice: 60, // dice in a single keep/drop term
  maxKeepOps: 2.5e7, // DP work budget for a keep/drop term
  maxConvOps: 5e7,
};

/* ------------------------------------------------------------------ parsing */

const TERM_RE = /^(\d*)[dD](\d+|%)(?:(kh|kl|dh|dl)(\d*))?/i;
const CONST_RE = /^\d+/;

/**
 * Parse a flat dice expression: a signed sum of dice groups and constants.
 *
 *   3d4 + 2d20 + 4        4d6kh3        2d20kh1 - 1        d% + 7
 *
 * Supported per group: `NdX`, `d%` (= d100), and the keep/drop suffixes
 * `khK` / `klK` (keep highest / lowest K) and `dhK` / `dlK` (drop highest /
 * lowest K). Returns a list of terms; throws DiceError on anything else.
 */
export function parseFormula(input) {
  const src = String(input ?? "").replace(/[−–—]/g, "-").replace(/\s+/g, "");
  const terms = [];
  let pos = 0;
  let totalDice = 0;

  while (pos < src.length) {
    let sign = 1;
    const ch = src[pos];
    if (ch === "+" || ch === "-") {
      sign = ch === "-" ? -1 : 1;
      pos += 1;
      if (pos >= src.length) throw new DiceError(`Dangling "${ch}" at the end of the formula`, pos);
    } else if (terms.length > 0) {
      throw new DiceError(`Expected + or - before "${src.slice(pos)}"`, pos);
    }

    const rest = src.slice(pos);
    const dice = TERM_RE.exec(rest);
    if (dice) {
      const count = dice[1] === "" ? 1 : Number(dice[1]);
      const faces = dice[2] === "%" ? 100 : Number(dice[2]);
      if (count < 1) throw new DiceError("A dice group needs at least one die", pos);
      if (faces < 1) throw new DiceError("A die needs at least one face", pos);
      if (faces > LIMITS.maxFaces) throw new DiceError(`d${faces} is above the d${LIMITS.maxFaces} limit`, pos);
      totalDice += count;
      if (totalDice > LIMITS.maxTotalDice)
        throw new DiceError(`Too many dice (limit ${LIMITS.maxTotalDice})`, pos);

      let keep = null;
      if (dice[3]) {
        const kind = dice[3].toLowerCase();
        const arg = dice[4] === "" ? 1 : Number(dice[4]);
        if (count > LIMITS.maxKeepDice)
          throw new DiceError(`Keep/drop is limited to ${LIMITS.maxKeepDice} dice per group`, pos);
        if (arg > count)
          throw new DiceError(`Cannot ${kind}${arg} out of only ${count} dice`, pos);
        const k = kind === "kh" || kind === "kl" ? arg : count - arg;
        const mode = kind === "kh" || kind === "dl" ? "kh" : "kl";
        keep = { mode, k, raw: `${kind}${arg}` };
      }
      terms.push({ kind: "dice", sign, count, faces, keep });
      pos += dice[0].length;
    } else {
      const num = CONST_RE.exec(rest);
      if (!num) throw new DiceError(`Cannot read "${rest}" — expected something like 2d6 or 3`, pos);
      terms.push({ kind: "const", sign, value: Number(num[0]) });
      pos += num[0].length;
    }
    if (terms.length > LIMITS.maxTerms) throw new DiceError(`Too many terms (limit ${LIMITS.maxTerms})`, pos);
  }
  return terms;
}

/** Render terms back to canonical notation, e.g. `3d4 + 2d20 + 4`. */
export function formatTerms(terms) {
  if (!terms.length) return "";
  return terms
    .map((t, i) => {
      const body = t.kind === "dice" ? `${t.count}d${t.faces}${t.keep ? t.keep.raw : ""}` : String(t.value);
      if (i === 0) return (t.sign < 0 ? "-" : "") + body;
      return (t.sign < 0 ? " - " : " + ") + body;
    })
    .join("");
}

/* ------------------------------------------------- distribution arithmetic */

const zeros = (n) => new Array(n).fill(0n);

/**
 * Convolve a distribution with one uniform die.
 * A `+dX` shifts the support up by 1..X, a `-dX` down by X..1; both are the
 * same sliding-window sum, only the new minimum differs — so this is O(range)
 * per die instead of O(range·X).
 */
function convolveDie(dist, faces, sign) {
  const src = dist.counts;
  const n = src.length;
  const out = zeros(n + faces - 1);
  let window = 0n;
  for (let j = 0; j < out.length; j++) {
    if (j < n) window += src[j];
    const drop = j - faces;
    if (drop >= 0 && drop < n) window -= src[drop];
    out[j] = window;
  }
  return { min: sign > 0 ? dist.min + 1 : dist.min - faces, counts: out };
}

/** Full convolution of two distributions. */
function convolve(a, b) {
  if (a.counts.length * b.counts.length > LIMITS.maxConvOps)
    throw new DiceError("This combination is too large to compute exactly");
  const out = zeros(a.counts.length + b.counts.length - 1);
  for (let i = 0; i < a.counts.length; i++) {
    const ai = a.counts[i];
    if (ai === 0n) continue;
    for (let j = 0; j < b.counts.length; j++) {
      const bj = b.counts[j];
      if (bj !== 0n) out[i + j] += ai * bj;
    }
  }
  return { min: a.min + b.min, counts: out };
}

function negate(dist) {
  const counts = dist.counts.slice().reverse();
  return { min: -(dist.min + dist.counts.length - 1), counts };
}

function trim(dist) {
  let lo = 0;
  let hi = dist.counts.length - 1;
  while (lo < hi && dist.counts[lo] === 0n) lo++;
  while (hi > lo && dist.counts[hi] === 0n) hi--;
  return { min: dist.min + lo, counts: dist.counts.slice(lo, hi + 1) };
}

function binomials(n) {
  const C = [];
  for (let i = 0; i <= n; i++) {
    C[i] = zeros(i + 1);
    C[i][0] = 1n;
    for (let j = 1; j <= i; j++) C[i][j] = (C[i - 1][j - 1] ?? 0n) + (C[i - 1][j] ?? 0n);
  }
  return C;
}

/**
 * Exact distribution of "sum of the K highest (or lowest) of N dX".
 *
 * Walks the face values in order of preference (highest-first for `kh`), and
 * at each value chooses how many of the still-unassigned dice show it. Because
 * the values are visited in preference order, the dice that land in the kept
 * set are exactly the first K encountered — so the kept sum is determined
 * without ever enumerating the N-tuples.
 */
function keepDistribution(n, faces, keep) {
  const k = Math.min(keep.k, n);
  if (k === 0) return { min: 0, counts: [BigInt(faces) ** BigInt(n)] };
  if (k === n) {
    let d = { min: 0, counts: [1n] };
    for (let i = 0; i < n; i++) d = convolveDie(d, faces, 1);
    return d;
  }
  const size = k * faces + 1;
  const est = faces * (n + 1) * (k + 1) * (n / 2 + 1) * size;
  if (est > LIMITS.maxKeepOps)
    throw new DiceError(`${n}d${faces}${keep.raw} is too large to compute exactly — use fewer or smaller dice`);

  const C = binomials(n);
  const W = k + 1;
  let dp = new Array((n + 1) * W).fill(null);
  dp[0] = zeros(size);
  dp[0][0] = 1n;

  const order = [];
  if (keep.mode === "kh") for (let v = faces; v >= 1; v--) order.push(v);
  else for (let v = 1; v <= faces; v++) order.push(v);

  for (const v of order) {
    const ndp = new Array((n + 1) * W).fill(null);
    for (let m = 0; m <= n; m++) {
      for (let j = 0; j < W; j++) {
        const cur = dp[m * W + j];
        if (!cur) continue;
        const remaining = n - m;
        for (let c = 0; c <= remaining; c++) {
          const take = Math.min(c, k - j);
          const add = v * take;
          if (add >= size) continue;
          const idx = (m + c) * W + (j + take);
          let dst = ndp[idx];
          if (!dst) ndp[idx] = dst = zeros(size);
          const w = C[remaining][c];
          for (let s = 0; s + add < size; s++) {
            const val = cur[s];
            if (val !== 0n) dst[s + add] += val * w;
          }
        }
      }
    }
    dp = ndp;
  }

  const counts = zeros(size);
  for (let j = 0; j < W; j++) {
    const cur = dp[n * W + j];
    if (!cur) continue;
    for (let s = 0; s < size; s++) counts[s] += cur[s];
  }
  return trim({ min: 0, counts });
}

/** Number of distinct totals the formula can produce. */
export function spanOf(terms) {
  let span = 0;
  for (const t of terms) {
    if (t.kind !== "dice") continue;
    const kept = t.keep ? Math.min(t.keep.k, t.count) : t.count;
    span += kept * (t.faces - 1);
  }
  return span + 1;
}

/** Exact distribution of a parsed formula: `{ min, counts: BigInt[], total }`. */
export function distribution(terms) {
  const span = spanOf(terms);
  if (span > LIMITS.maxBins)
    throw new DiceError(
      `That spans ${span.toLocaleString()} possible totals — above the ${LIMITS.maxBins.toLocaleString()} limit`
    );

  let acc = { min: 0, counts: [1n] };
  for (const t of terms) {
    if (t.kind === "const") {
      acc = { min: acc.min + t.sign * t.value, counts: acc.counts };
      continue;
    }
    if (!t.keep) {
      for (let i = 0; i < t.count; i++) acc = convolveDie(acc, t.faces, t.sign);
    } else {
      const d = keepDistribution(t.count, t.faces, t.keep);
      acc = convolve(acc, t.sign > 0 ? d : negate(d));
    }
  }
  let total = 0n;
  for (const c of acc.counts) total += c;
  return { min: acc.min, counts: acc.counts, total };
}

/* ------------------------------------------------------- exact → floating */

// Approximate bit length — never underestimates, which is all the scaling below
// needs (four bits of slack cost nothing).
const bitLen = (x) => (x === 0n ? 0 : x.toString(16).length * 4);

/**
 * Exact BigInt ratio → Number. Outcome counts routinely run past 1e308
 * (100^200 has 401 digits), so the division is done in BigInt after shifting
 * the numerator up by a power of two — binary scaling, so the final multiply
 * back down introduces no rounding of its own.
 */
export function ratio(a, b) {
  if (b === 0n) return NaN;
  if (a === 0n) return 0;
  const neg = a < 0n !== b < 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  let shift = Math.max(0, 70 - (bitLen(x) - bitLen(y)));
  let v = Number((x << BigInt(shift)) / y);
  while (shift > 1000) {
    v *= 2 ** -1000;
    shift -= 1000;
  }
  v *= 2 ** -shift;
  return neg ? -v : v;
}

/**
 * One row per achievable total: exact ways plus P(=), P(≥) and P(≤).
 */
export function tabulate(dist) {
  const { min, counts, total } = dist;
  const rows = new Array(counts.length);
  let below = 0n;
  for (let i = 0; i < counts.length; i++) {
    const ways = counts[i];
    below += ways;
    rows[i] = {
      value: min + i,
      ways,
      p: ratio(ways, total),
      le: ratio(below, total),
      ge: 0,
      geWays: 0n,
      leWays: below,
    };
  }
  let above = 0n;
  for (let i = counts.length - 1; i >= 0; i--) {
    above += counts[i];
    rows[i].geWays = above;
    rows[i].ge = ratio(above, total);
  }
  return rows;
}

/** Mean, spread, median and mode — mean/variance from exact integer moments. */
export function summarize(dist, rows) {
  const { min, counts, total } = dist;
  let s1 = 0n;
  let s2 = 0n;
  let best = -1n;
  for (let i = 0; i < counts.length; i++) {
    const v = BigInt(min + i);
    const c = counts[i];
    s1 += v * c;
    s2 += v * v * c;
    if (c > best) best = c;
  }
  const mean = ratio(s1, total);
  // Var = (T·Σx² − (Σx)²) / T²
  const variance = ratio(total * s2 - s1 * s1, total * total);
  const modes = [];
  for (let i = 0; i < counts.length; i++) if (counts[i] === best) modes.push(min + i);

  let median = min;
  let acc = 0n;
  for (let i = 0; i < counts.length; i++) {
    acc += counts[i];
    if (acc * 2n >= total) {
      median = min + i;
      break;
    }
  }
  return {
    min,
    max: min + counts.length - 1,
    total,
    mean,
    variance,
    stdev: Math.sqrt(Math.max(0, variance)),
    median,
    modes,
    modeP: ratio(best, total),
    modeWays: best,
    bins: counts.length,
  };
}

/** Parse → distribute → tabulate → summarize, in one call. */
export function analyze(input) {
  const terms = parseFormula(input);
  if (!terms.length) throw new DiceError("Enter a formula, e.g. 3d4 + 2d20 + 4");
  const dist = distribution(terms);
  const rows = tabulate(dist);
  return { terms, dist, rows, stats: summarize(dist, rows), canonical: formatTerms(terms) };
}

/* ------------------------------------------------------ formula editing */

/**
 * Add (`delta > 0`) or remove (`delta < 0`) dice of one size, merging into an
 * existing plain group of that size when there is one. A group whose signed
 * count reaches zero disappears; a negative count becomes a subtracted group.
 */
export function adjustDie(terms, faces, delta) {
  const next = terms.map((t) => ({ ...t, keep: t.keep ? { ...t.keep } : null }));
  const hit = next.find((t) => t.kind === "dice" && t.faces === faces && !t.keep);
  if (hit) {
    const signed = hit.sign * hit.count + delta;
    if (signed === 0) return next.filter((t) => t !== hit);
    hit.sign = signed < 0 ? -1 : 1;
    hit.count = Math.abs(signed);
    return next;
  }
  if (delta === 0) return next;
  next.push({ kind: "dice", sign: delta < 0 ? -1 : 1, count: Math.abs(delta), faces, keep: null });
  return next;
}

/** Same idea for the flat modifier. */
export function adjustConst(terms, delta) {
  const next = terms.map((t) => ({ ...t, keep: t.keep ? { ...t.keep } : null }));
  const hit = next.find((t) => t.kind === "const");
  if (hit) {
    const signed = hit.sign * hit.value + delta;
    if (signed === 0) return next.filter((t) => t !== hit);
    hit.sign = signed < 0 ? -1 : 1;
    hit.value = Math.abs(signed);
    return next;
  }
  if (delta === 0) return next;
  next.push({ kind: "const", sign: delta < 0 ? -1 : 1, value: Math.abs(delta) });
  return next;
}

/** How many dice of one size the formula currently holds (signed). */
export function dieCount(terms, faces) {
  const hit = terms.find((t) => t.kind === "dice" && t.faces === faces && !t.keep);
  return hit ? hit.sign * hit.count : 0;
}

/* ---------------------------------------------------------------- rolling */

/**
 * Build a fast sampler for the formula: no allocation per roll, no detail —
 * just the total. This is what the "roll it a million times" button drives.
 */
export function compileSampler(terms, rand = Math.random) {
  let constant = 0;
  const plain = [];
  const keeps = [];
  for (const t of terms) {
    if (t.kind === "const") constant += t.sign * t.value;
    else if (!t.keep) plain.push({ sign: t.sign, count: t.count, faces: t.faces });
    else
      keeps.push({
        sign: t.sign,
        faces: t.faces,
        count: t.count,
        k: Math.min(t.keep.k, t.count),
        hi: t.keep.mode === "kh",
        buf: new Int32Array(t.count),
      });
  }
  return function sample() {
    let total = constant;
    for (let g = 0; g < plain.length; g++) {
      const t = plain[g];
      let s = 0;
      for (let i = 0; i < t.count; i++) s += 1 + ((rand() * t.faces) | 0);
      total += t.sign * s;
    }
    for (let g = 0; g < keeps.length; g++) {
      const t = keeps[g];
      for (let i = 0; i < t.count; i++) t.buf[i] = 1 + ((rand() * t.faces) | 0);
      t.buf.sort(); // ascending
      let s = 0;
      if (t.hi) for (let i = t.count - t.k; i < t.count; i++) s += t.buf[i];
      else for (let i = 0; i < t.k; i++) s += t.buf[i];
      total += t.sign * s;
    }
    return total;
  };
}

/** Roll the formula once, keeping the per-group detail. */
export function rollTerms(terms, rand = Math.random) {
  const parts = [];
  let total = 0;
  for (const t of terms) {
    if (t.kind === "const") {
      total += t.sign * t.value;
      parts.push({ label: String(t.value), sign: t.sign, rolls: [], subtotal: t.value });
      continue;
    }
    const rolls = [];
    for (let i = 0; i < t.count; i++) rolls.push(1 + Math.floor(rand() * t.faces));
    let kept = rolls.map((v, i) => i);
    if (t.keep) {
      const order = kept.slice().sort((a, b) => (t.keep.mode === "kh" ? rolls[b] - rolls[a] : rolls[a] - rolls[b]));
      kept = order.slice(0, Math.min(t.keep.k, t.count));
    }
    const keptSet = new Set(kept);
    const subtotal = rolls.reduce((s, v, i) => s + (keptSet.has(i) ? v : 0), 0);
    total += t.sign * subtotal;
    parts.push({
      label: `${t.count}d${t.faces}${t.keep ? t.keep.raw : ""}`,
      sign: t.sign,
      rolls: rolls.map((v, i) => ({ v, kept: keptSet.has(i) })),
      subtotal,
    });
  }
  return { total, parts };
}
