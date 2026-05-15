# ClusterApplet → Cluster (sibling session) coordination

Branch: `claude/adapt-clusterapplet-bps-quivers-7yC4h`

## Status (initial)

### Path B — URL-hash JSON import / paste / share — SHIPPED

A `⇄ Share` button in the toolbar opens a modal with:

- **Import**
  - Textarea accepting any of:
    - raw JSON object (preset shape)
    - full URL with `#<URI-encoded-JSON>`
    - bare `#`-fragment or `#q=<URI-encoded-JSON>` fragment
  - Validation: requires `n` (or derives from B), B is `n×n` integer,
    antisymmetric. `positions` auto-generated as circular layout if absent.
    `frozen` defaults to all-false. `charges` optional.
- **Export current state**
  - "Copy shareable URL" → `${origin}${pathname}${search}#${encodeURIComponent(JSON)}`
  - "Copy JSON" → indented JSON of `{name, n, positions, frozen, B, charges}`
- **Auto-load on mount**: if `window.location.hash` is non-empty, parse it
  with the same validator and append to the preset dropdown as the active
  preset (named `"Imported"` if `name` absent).

Preset JSON shape accepted (identical to PRESETS entry plus optional `charges`):

```json
{
  "name": "K=4 amalgam (Yin/Yin)",
  "n": 9,
  "positions": [[x, y], ...],
  "frozen": [false, ...],
  "B": [[0, ...], ...],
  "charges": [[1,0,...], ...]      // optional; defaults to canonical basis δ_ij
}
```

So your diagnostic dumps can emit a one-click `https://.../#<URI-encoded-JSON>`
URL and the user gets the quiver instantly.

### Path A — hardcoded amalgam presets — COMPLETE

Available from the dropdown (in addition to the built-in physics examples):

**Binary amalgams (2× FG-K_K Yin/Yin, K-1 amalgam-row nodes):**

- `A₂ amalgam: 2× FG-K3 (Yin/Yin)`              n=4    (predicted spec 5)
- `A₃ amalgam: 2× FG-K4 (Yin/Yin)`              n=9    (predicted spec 17)
- `A₄ amalgam: 2× FG-K5 (Yin/Yin)`              n=16   (predicted spec 36)
- `A₅ amalgam: 2× FG-K6 (Yin/Yin)`              n=25   (predicted spec 65)

**Pure Yin triangles (T(K−3) internal quiver, no amalgam):**

- `FG-K3 Yin triangle`                          n=1    (single node)
- `FG-K4 Yin triangle`                          n=3    (oriented 3-cycle on T(1))
- `FG-K5 Yin triangle`                          n=6    (hex on T(2))

**Pentagon (fan) amalgams (3× FG-K_K Yin, two pairs of glued edges):**

- `K=3 pentagon: 3× FG-K3 (Yin/Yin/Yin)`        n=7    (verified spec 11)
- `K=4 pentagon: 3× FG-K4 (Yin/Yin/Yin)`        n=15   (geometric construction)

Pentagons include the V_1-vertex edge `g_LM_0 → g_MR_0` between the
amalgam-row endpoints coincident at the fan apex.

All B matrices verified antisymmetric, integer, of correct dimension.
K=6 amalgam derived programmatically from a constructor that reproduces
K=3/4/5 exactly. K=4 pentagon uses M's a=0 ↔ L's a=0 and M's b=0 ↔ R's a=0
(distinct edges of M sharing corner M_0 at V_1).

## URL share template

The sibling Cluster session can emit one-click visualization links of the form

```
https://berserkdvd.github.io/ClusterApplet/#<urlencoded-JSON>
```

where `<urlencoded-JSON>` is `encodeURIComponent(JSON.stringify(preset))` with
the preset shape

```json
{
  "name": "<descriptive>",
  "n": <integer>,
  "positions": [[x, y], ...],
  "frozen": [false, ...],
  "B": [[0, ...], ...],
  "charges": [[1,0,...], ...],          // optional; default canonical basis δ_ij
  "mutLog": [{"index": k, "charge": [...]}, ...],   // optional; restores Mutation Sequence panel
  "spec": {"seq": [...], "charges": [[...]], "method": "..."}  // optional; auto-found S
}
```

Opening such a URL auto-imports the quiver and appends it to the preset
dropdown as the active selection. `⇄ Share → Copy shareable URL` in the
applet emits the same form for round-trips back to the sibling session.

## Quick-test recipe (for the user)

After `npm run dev`:

1. Click `⇄ Share` in the toolbar.
2. Paste this minimal K=3 amalgam URL fragment into the Import textarea and click Load:

   ```
   #{"name":"K=3 amalgam test","n":4,"positions":[[300,350],[500,350],[400,200],[400,500]],"frozen":[false,false,false,false],"B":[[0,0,-1,1],[0,0,1,-1],[1,-1,0,0],[-1,1,0,0]]}
   ```
3. The dropdown gains a new entry; the SVG renders the 4-node amalgam.

## Next handshake

When the K=4/K=5 entries land (either as preset JSX or shareable URLs), I'll:

- Add them to the hardcoded PRESETS array.
- Verify the build.
- Push, and ping back in this file.

When the user finds a K-flip mutation sequence visually, paste the
sequence of 1-based or 0-based node indices here (specify which) and I'll
relay it in a commit message / PR comment back.

## Pentagon presets — note on the V_1-vertex edge

Both pentagon presets received a `g_LM_0 → g_MR_0` edge between the two
amalgam-row endpoints adjacent to the fan-apex vertex V_1:

- K=3 pentagon: `B[3][5] = +1` (1-based: arrow `4 → 6`). Closes the
  3-cycle `T_1 → g_LM_0 → g_MR_0 → T_1`.
- K=4 pentagon: `B[9][12] = +1` (1-based: arrow `10 → 13`).

Orientation choice (vs the reverse) is the user's call; flip the sign if
the canonical convention requires `g_MR_0 → g_LM_0`.

## K=3 pentagon — VERIFIED spectrum generator (11 mutations) ✓

User verified in-applet that all 7 charges negate after the following
sequence, confirming the V_1-edge orientation `g_LM_0 → g_MR_0`
(i.e. `B[3][5] = +1`, 1-based arrow `4 → 6`).

0-based node indices:

```
4, 3, 1, 0, 6, 5, 2, 5, 3, 6, 4    # alternate but equivalent first two
```
or
```
3, 4, 1, 0, 6, 5, 3, 2, 5, 6, 4    # original
```

(The first two mutations are at independent canonical generators γ_4 and
γ_3, so they commute — either order works. After step 2 the orderings
diverge but produce the same multiset of BPS charges.)

1-based labels:

```
5, 4, 2, 1, 7, 6, 3, 6, 4, 7, 5
```

Verified charge sequence (user's notation, 7-tuples):

```
μ(0,0,0,0,1,0,0) ·   # γ_5
μ(0,0,0,1,0,0,0) ·   # γ_4
μ(0,1,0,1,0,0,0) ·   # γ_2 + γ_4
μ(1,0,0,0,1,0,0) ·   # γ_1 + γ_5
μ(0,0,0,0,0,0,1) ·   # γ_7
μ(0,0,0,0,0,1,0) ·   # γ_6
μ(0,0,1,0,0,1,0) ·   # γ_3 + γ_6
μ(0,1,0,0,0,0,1) ·   # γ_2 + γ_7
μ(0,0,1,0,0,0,0) ·   # γ_3
μ(0,1,0,0,0,0,0) ·   # γ_2
μ(1,0,0,0,0,0,0)     # γ_1
```

Total: 11 BPS states. Plausibly decomposes as 5 + 5 + 1 — the two
binary FG-K3 amalgams each have a 5-step pentagon spec, plus the
single extra state at the V_1 glue.

Ready for the sibling session to feed into
`BPSQuiver.verify_spectrum_generator`.

## K=5 pentagon — VERIFIED spectrum generator (70 mutations) ✓

Hand-derived in the applet on the FG K-subdivision K=5 pentagon (n=26,
mutable-only, post-frozen-drop). All 26 charges negate after the
following sequence (extracted from the share URL's `mutLog`).

0-based node indices:

```
13, 12, 11, 10, 22, 24, 25, 21, 23, 20, 16, 15, 14, 18, 17, 19, 11, 12,
24, 15, 0, 1, 2, 3, 6, 5, 4, 7, 8, 9, 18, 16, 13, 22, 12, 21, 2, 1, 5,
16, 10, 25, 14, 23, 11, 17, 10, 25, 14, 10, 3, 13, 6, 22, 2, 8, 3, 13,
6, 3, 7, 1, 4, 12, 18, 0, 7, 1, 4, 7
```

1-based labels (for cross-checking against the SVG):

```
14, 13, 12, 11, 23, 25, 26, 22, 24, 21, 17, 16, 15, 19, 18, 20, 12, 13,
25, 16, 1, 2, 3, 4, 7, 6, 5, 8, 9, 10, 19, 17, 14, 23, 13, 22, 3, 2, 6,
17, 11, 26, 15, 24, 12, 18, 11, 26, 15, 11, 4, 14, 7, 23, 3, 9, 4, 14,
7, 4, 8, 2, 5, 13, 19, 1, 8, 2, 5, 8
```

Total: 70 BPS states. Structure looks like a roughly three-part
decomposition: first ~20 mutations sweep one triangle's interior + the
two amalgam rows from the V_1 side, next ~10 walk the other diagonal,
then ~40 finish the remaining two triangles and close.

Ready for the sibling session to verify against
`BPSQuiver.verify_spectrum_generator`.
