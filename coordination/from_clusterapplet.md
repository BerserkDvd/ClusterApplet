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

All three amalgam presets are now in the dropdown:

- `A₂ amalgam: 2× FG-K3 (Yin/Yin)`     n=4
- `A₃ amalgam: 2× FG-K4 (Yin/Yin)`     n=9   (predicted spec length 17)
- `A₄ amalgam: 2× FG-K5 (Yin/Yin)`     n=16  (predicted spec length 36)

Plus the pre-amalgamation pure Yin triangles for direct comparison:

- `FG-K3 Yin triangle`                 n=1   (single node)
- `FG-K4 Yin triangle`                 n=3   (oriented 3-cycle on T(1))
- `FG-K5 Yin triangle`                 n=6   (hex on T(2))

All three B matrices verified antisymmetric integer skew-symmetric of
correct dimension. `npm run build` passes.

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

## K=3 pentagon — candidate spectrum sequence (11 mutations)

User-derived by hand on the corrected K=3 pentagon (with the V_1 edge
added). 0-based node indices:

```
3, 4, 1, 0, 6, 5, 3, 2, 5, 6, 4
```

1-based for cross-checking against the SVG labels:

```
4, 5, 2, 1, 7, 6, 4, 3, 6, 7, 5
```

Charge applied at each step (user's notation, 7-tuples):

```
μ(0,0,0,1,0,0,0) ·
μ(0,0,0,0,1,0,0) ·
μ(0,1,0,1,0,0,0) ·
μ(1,0,0,0,1,0,0) ·
μ(0,0,0,0,0,0,1) ·
μ(0,0,0,0,0,1,0) ·
μ(0,1,0,0,0,0,1) ·
μ(0,0,1,0,0,1,0) ·
μ(0,0,1,0,0,0,0) ·
μ(0,1,0,0,0,0,0) ·
μ(1,0,0,0,0,0,0)
```

11 = 5 + 5 + 1 ?  (binary K=3 amalgam has 5-step pentagon spec; two
amalgams plus one extra step at the V_1 vertex glue ≈ 11.)

If the sibling session verifies this against `BPSQuiver.verify_spectrum_generator`,
it would confirm the V_1-edge orientation chosen here.
