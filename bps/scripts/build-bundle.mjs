// build-bundle.mjs — produce public/kalgebra-src.zip, the Python source bundle
// the Pyodide worker unpacks (it expects the archive to unpack to `src/<layer>/…`,
// matching run_tests.py's sys.path convention).
//
// Runs as a `prebuild` step.  Defensive by design so the same script works in
// three settings:
//   1. canonical build (this webapp lives in the KAlgebra export tree, so the
//      Python source is the sibling `../src`)  -> (re)build the zip from it;
//   2. vendored testbed (no sibling `../src`) with a committed bundle already in
//      public/                                 -> keep it, do nothing;
//   3. neither                                 -> warn; the worker will fall back
//      to the co-hosted ../kalgebra-lab bundle at runtime.
//
// Building shells out to `zip` (present on GitHub Actions ubuntu runners); any
// failure is non-fatal — we never break the JS build over the Python bundle.

import { existsSync, statSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webappRoot = resolve(here, "..");
const srcDir = resolve(webappRoot, "..", "src");          // the KAlgebra Python tree
const target = resolve(webappRoot, "public", "kalgebra-src.zip");

function log(msg) { console.log(`[build-bundle] ${msg}`); }

// Only build from ../src when it is genuinely the KAlgebra Python tree — a
// sibling named `src` also exists in the vendored testbed (the root React app's
// JS source), and zipping that would corrupt the bundle.  A sentinel module the
// worker must import settles it unambiguously.
const isKAlgebraTree = existsSync(resolve(srcDir, "bps", "bps_kalgebra.py"));

if (isKAlgebraTree) {
  try {
    // Replace, don't append: `zip -rq` merges into an existing archive, so a
    // stale target would survive.  Start clean every time.
    if (existsSync(target)) rmSync(target);
    // zip from the src's parent so entries are `src/…` (what the worker unpacks).
    execFileSync(
      "zip",
      ["-rq", target, "src", "-x", "*/__pycache__/*", "-x", "*.pyc"],
      { cwd: dirname(srcDir), stdio: "inherit" }
    );
    const mb = (statSync(target).size / 1e6).toFixed(1);
    log(`built kalgebra-src.zip from ${srcDir} (${mb} MB)`);
  } catch (e) {
    log(`WARNING: could not build the bundle (${e.message}).`);
    if (existsSync(target)) log("keeping the existing public/kalgebra-src.zip.");
    else log("no bundle present — compute will fall back to ../kalgebra-lab/kalgebra-src.zip at runtime.");
  }
} else if (existsSync(target)) {
  log("no KAlgebra ../src (vendored build); keeping the committed public/kalgebra-src.zip.");
} else {
  log("no KAlgebra ../src and no committed bundle — compute will fall back to ../kalgebra-lab/kalgebra-src.zip at runtime.");
}
