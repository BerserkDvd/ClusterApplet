/* Pyodide kernel — runs on a Web Worker thread so the page UI never blocks. */
"use strict";

const PYODIDE_VERSION = "0.26.2";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
importScripts(INDEX_URL + "pyodide.js");

let pyodide = null;
let runCell = null;

const RUNNER = `
import ast, io, contextlib, traceback
_NS = {"__name__": "__main__"}
def _run_cell(src):
    out = io.StringIO()
    mod = ast.parse(src)
    trailing = mod.body.pop() if (mod.body and isinstance(mod.body[-1], ast.Expr)) else None
    result = None
    try:
        with contextlib.redirect_stdout(out):
            if mod.body:
                exec(compile(mod, "<cell>", "exec"), _NS)
            if trailing is not None:
                result = eval(compile(ast.Expression(trailing.value), "<cell>", "eval"), _NS)
    except Exception:
        return (out.getvalue(), "", traceback.format_exc())
    return (out.getvalue(), "" if result is None else repr(result), "")
`;

function post(m) { self.postMessage(m); }

async function init() {
  try {
    post({ type: "status", msg: "Loading Pyodide (Python in WebAssembly)… (~10 MB, first load only)" });
    pyodide = await loadPyodide({ indexURL: INDEX_URL });

    post({ type: "status", msg: "Fetching the KAlgebra source bundle…" });
    const resp = await fetch("./kalgebra-src.zip");
    if (!resp.ok) throw new Error("could not fetch kalgebra-src.zip (" + resp.status + ")");
    const buf = await resp.arrayBuffer();
    pyodide.unpackArchive(buf, "zip");          // extracts src/ into the working dir

    pyodide.runPython(RUNNER);
    runCell = pyodide.globals.get("_run_cell");
    post({ type: "ready" });
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
    const arr = proxy.toJs();                   // Python tuple -> [stdout, result_repr, err]
    post({ type: "result", id: msg.id, stdout: arr[0], result: arr[1], err: arr[2] });
  } catch (err) {
    post({ type: "result", id: msg.id, stdout: "", result: "",
           err: (err && err.message) ? err.message : String(err) });
  } finally {
    if (proxy && proxy.destroy) proxy.destroy();
  }
};

init();
