/* Pyodide compute kernel for the BPS applet — runs on a Web Worker so the UI
 * never blocks.  Adapted from the proven kalgebra-lab worker: loads Pyodide
 * from the jsdelivr CDN, unpacks the KAlgebra src bundle, puts every src/
 * subdir on sys.path (the run_tests.py convention), and runs Python cells.
 *
 * The src bundle is fetched from `./kalgebra-src.zip` if the app ships its own,
 * else it falls back to the sibling `../kalgebra-lab/kalgebra-src.zip` that the
 * lab already deploys on the same Pages site.
 */
"use strict";

const PYODIDE_VERSION = "0.26.2";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
importScripts(INDEX_URL + "pyodide.js");

let pyodide = null;
let runCell = null;

// Jupyter-style cell runner: exec statements, eval a trailing expression,
// capture stdout; return (stdout, result_repr, traceback).
const RUNNER = `
import ast, io, contextlib, traceback
_NS = {"__name__": "__main__"}
def _run_cell(src):
    out = io.StringIO()
    try:
        mod = ast.parse(src)
        trailing = mod.body.pop() if (mod.body and isinstance(mod.body[-1], ast.Expr)) else None
        result = None
        with contextlib.redirect_stdout(out):
            if mod.body:
                exec(compile(mod, "<cell>", "exec"), _NS)
            if trailing is not None:
                result = eval(compile(ast.Expression(trailing.value), "<cell>", "eval"), _NS)
        return (out.getvalue(), "" if result is None else repr(result), "")
    except Exception:
        return (out.getvalue(), "", traceback.format_exc())
`;

// Put every src/<layer>/ dir on sys.path so bare-name imports resolve.
const BOOTSTRAP = `
import sys, pathlib
_src = pathlib.Path("src")
sys.path[:0] = [str(p) for p in _src.rglob("*") if p.is_dir() and p.name != "__pycache__"]
import warnings
warnings.simplefilter("default")
`;

function post(m) { self.postMessage(m); }

async function fetchBundle() {
  for (const url of ["./kalgebra-src.zip", "../kalgebra-lab/kalgebra-src.zip"]) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return { buf: await resp.arrayBuffer(), url };
    } catch (e) { /* try next */ }
  }
  throw new Error("could not fetch kalgebra-src.zip (tried ./ and ../kalgebra-lab/)");
}

async function init() {
  try {
    post({ type: "status", msg: "Loading Pyodide (Python in WebAssembly)… (~6 MB, first load only)" });
    pyodide = await loadPyodide({ indexURL: INDEX_URL });

    post({ type: "status", msg: "Fetching the KAlgebra source bundle…" });
    const { buf, url } = await fetchBundle();
    pyodide.unpackArchive(buf, "zip");        // extracts src/ into the working dir

    pyodide.runPython(BOOTSTRAP);
    pyodide.runPython(RUNNER);
    runCell = pyodide.globals.get("_run_cell");
    // Seed the cell namespace so diagnostics can report the runtime provenance.
    pyodide.runPython(
      "_NS['_BUNDLE_SOURCE'] = " + JSON.stringify(url) +
      "; _NS['_PYODIDE_VERSION'] = " + JSON.stringify(PYODIDE_VERSION)
    );
    post({ type: "ready", bundleSource: url });
  } catch (err) {
    post({ type: "fatal", msg: (err && err.message) ? err.message : String(err) });
  }
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type !== "run") return;
  if (!runCell) { post({ type: "result", id: msg.id, stdout: "", result: "", err: "kernel not ready" }); return; }
  let proxy = null;
  try {
    proxy = runCell(msg.src);
    const arr = proxy.toJs();                 // (stdout, result_repr, traceback)
    post({ type: "result", id: msg.id, stdout: arr[0], result: arr[1], err: arr[2] });
  } catch (err) {
    post({ type: "result", id: msg.id, stdout: "", result: "", err: (err && err.message) ? err.message : String(err) });
  } finally {
    if (proxy && proxy.destroy) proxy.destroy();
  }
};

init();
