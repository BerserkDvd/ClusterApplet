// kernel.js — client for the Pyodide compute worker (src/../public/worker.js).
// Lazy-starts the worker on first use (Pyodide cold start ~5–10 s, cached
// after), exposes a promise-based run(src), and broadcasts status changes.

let worker = null;
let ready = false;
let status = "idle";       // idle | loading | ready | error
let statusMsg = "";
let bundleSource = null;   // which kalgebra-src.zip URL the worker loaded
let idCounter = 0;
const pending = new Map();
const listeners = new Set();

function emit() { const s = { status, statusMsg, ready, bundleSource }; for (const l of listeners) l(s); }

export function onKernelStatus(fn) {
  listeners.add(fn);
  fn({ status, statusMsg, ready, bundleSource });
  return () => listeners.delete(fn);
}
export function kernelStatus() { return { status, statusMsg, ready, bundleSource }; }

function ensureWorker() {
  if (worker) return;
  status = "loading"; statusMsg = "Starting the Python kernel…"; emit();
  const base = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "./";
  worker = new Worker(`${base}worker.js`);
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === "status") { statusMsg = m.msg; emit(); }
    else if (m.type === "ready") { ready = true; status = "ready"; statusMsg = "Kernel ready"; bundleSource = m.bundleSource || null; emit(); }
    else if (m.type === "fatal") {
      status = "error"; statusMsg = m.msg; emit();
      for (const [, r] of pending) r.reject(new Error(m.msg));
      pending.clear();
    } else if (m.type === "result") {
      const r = pending.get(m.id);
      if (r) { pending.delete(m.id); r.resolve(m); }
    }
  };
  worker.onerror = (e) => {
    status = "error";
    statusMsg = "Couldn't load the Python kernel (network/CDN). Check your connection and retry.";
    if (e && e.message) console.error("kernel worker error:", e.message);
    emit();
  };
}

// Kick off the Pyodide load without running anything (so the UI can warm it up).
export function startKernel() { ensureWorker(); }

// Run a Python cell; resolves { stdout, result, err } once the kernel is ready.
export function run(src) {
  ensureWorker();
  const id = ++idCounter;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const trySend = () => {
      if (ready) worker.postMessage({ type: "run", id, src });
      else if (status === "error") { pending.delete(id); reject(new Error(statusMsg || "kernel error")); }
      else setTimeout(trySend, 120);
    };
    trySend();
  });
}
