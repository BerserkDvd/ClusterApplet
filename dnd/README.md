# Dice Lab — D&D dice probabilities

Deployed at `…/ClusterApplet/dnd/`. Type a dice formula, get the **exact**
probability of every possible total: a table, text/LaTeX exports, and a plot.

No build step and no dependencies — plain ES modules, opened straight by the
browser. It is a standalone folder: nothing here imports from the rest of the
repo, and the repo imports nothing from here.

```bash
cd dnd
npm test                       # 27 engine tests (node --test, no deps)
python3 -m http.server 5180    # then open http://localhost:5180/
```

(A server is needed only because ES modules do not load over `file://`.)

## What it does

- **Notation** — `NdX` groups, `+`/`-`, flat modifiers, `d%`, and keep/drop:
  `4d6kh3` (keep highest 3), `2d20kl1` (disadvantage), `4d6dl1` (drop lowest).
  A subtracted group (`1d8 - 1d6`, or clicking a die past zero) is a genuinely
  negative contribution, not an error.
- **Clickable dice** — left-click a die in the tray to add it, right-click to
  take one away; the `±` buttons do the same for touch and keyboard. Clicks
  merge into the existing group (`3d20` → `4d20`) and the text box stays in
  sync both ways.
- **Probabilities as whole numbers** — the `%` / `n⁄N` toggle rewrites every
  probability as a count of ways over the common denominator. Since a
  distribution is a count of equally likely outcomes, every row of a formula is
  a whole number over the *same* total, so the denominator is said once above
  the table and the columns carry bare numerators (`172`, not `172/1296`).
  Rolls whose counts run to hundreds of digits fall back to percentages and say
  why.
- **Exports** — plain text, CSV, Markdown, a `booktabs` LaTeX `table`, a
  `pgfplots` chart, and the **probability generating function**
  P(x) = Σₙ pₙ xⁿ with the common denominator factored out — so the
  coefficients are exact integers that sum to N (that is P(1) = 1), in LaTeX or
  in a SymPy-pasteable plain form. Copy or download; exports always carry every
  row even when the on-page table is capped.
- **Plot** — probability of exactly / at least / at most each total, with a
  hover-and-keyboard tooltip, a mean marker, and an optional target line. Dense
  ranges switch from columns to a line + wash automatically.
- **Roll it** — one honest roll, showing each die and which ones a keep/drop
  group discarded.
- **Simulate 100 / 10,000 / 1,000,000 ×** — rolls the formula that many times
  and draws the empirical distribution over the exact one, reporting the sample
  mean, the largest gap, and the total-variation distance. Watching the orange
  line converge onto the blue bars as the count grows is the whole point.
- **Share** — the formula lives in the URL hash.

## How the numbers are computed

Everything is exact integer arithmetic; there is no sampling anywhere in the
probability path (the simulator is a separate, clearly-labelled overlay).

- A distribution is a dense array of **BigInt outcome counts** indexed from its
  minimum, so a probability is a ratio of whole numbers right up to the final
  division. `200d100` has 100²⁰⁰ outcomes — 401 digits — and its mean still
  comes out exactly 10100.
- Adding one `dX` is a **sliding-window sum**, O(range) per die rather than
  O(range·X); a subtracted die is the same window with a different minimum.
- **Keep/drop** (`4d6kh3`) uses a DP that walks the face values in preference
  order and chooses how many dice show each value, so the kept sum falls out
  without enumerating N-tuples. It is checked against brute-force enumeration
  in the tests.
- The BigInt→double conversion shifts by a power of two before dividing, so
  ratios stay correctly rounded instead of drifting (`10.5`, not
  `10.499999999999998`).

Limits are enforced rather than left to hang, and they are calibrated against
measurements rather than guessed. What costs time is not the number of rows but
**rows × the width of the BigInt in each** — `21d1000` spans 20,980 totals and
takes 16 ms, while `500d41` spans 20,001 and takes 900 ms, because its counts
are 807 digits wide. So the gates are a bins ceiling (the table and exports
have to carry them), a bins × digits budget, and a loose estimate for the
keep/drop DP that only rejects the absurd instantly.

No static model captures that DP across shapes, so behind all three sits a
**wall-clock deadline**: whatever the estimates get wrong, computation stops
and says the time budget was exceeded — never that the answer is inexact, which
would be false. Every one of these is computed exactly; the only question is
whether it fits in the budget.

## Layout

| File | What it is |
|---|---|
| `src/dice.js` | parser, exact distribution engine, stats, sampler |
| `src/format.js` | number formatting + the seven export writers |
| `src/chart.js` | the SVG plot (marks, axes, tooltip, overlay) |
| `src/app.js` | UI wiring: tray, presets, simulation, exports |
| `test/dice.test.js` | engine tests, incl. brute-force cross-checks |
| `test/format.test.js` | numerator mode, exports, CSV validity, P(x) at x=1 |

Chart colours follow a two-slot categorical palette validated for both light
and dark surfaces (contrast, and separation under colour-vision deficiency).
