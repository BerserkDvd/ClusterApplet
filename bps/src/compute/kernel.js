// kernel.js — client for the Pyodide compute worker (src/../public/worker.js).
// Lazy-starts the worker on first use (Pyodide cold start ~5–10 s, cached
// after), exposes a promise-based run(src, {timeoutMs}), and broadcasts status.
//
// The worker is single-threaded: a long-running Python call (e.g. an exact
// build_S that blows up on higher rank) blocks every queued run().  killKernel()
// terminates such a runaway worker and lets the next run() cold-start a fresh
// one; run(..., {timeoutMs}) bounds a call so a busy/stuck kernel surfaces as an
// error instead of hanging forever.

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

function rejectAll(msg) {
  for (const [, r] of pending) r.reject(new Error(msg));
  pending.clear();
}

function ensureWorker() {
  if (worker) return;
  status = "loading"; statusMsg = "Starting the Python kernel…"; ready = false; emit();
  const base = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "./";
  worker = new Worker(`${base}worker.js`);
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === "status") { statusMsg = m.msg; emit(); }
    else if (m.type === "ready") { ready = true; status = "ready"; statusMsg = "Kernel ready"; bundleSource = m.bundleSource || null; emit(); }
    else if (m.type === "fatal") {
      status = "error"; statusMsg = m.msg; emit();
      rejectAll(m.msg);
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
    rejectAll(statusMsg);
  };
}

// Kick off the Pyodide load without running anything (so the UI can warm it up).
export function startKernel() { ensureWorker(); }

// Terminate a busy/hung worker (e.g. a runaway build_S) and reset.  Pending
// runs reject; the next run() cold-starts a fresh worker.
export function killKernel(reason = "compute cancelled — kernel restarted") {
  if (worker) { try { worker.terminate(); } catch { /* already gone */ } }
  worker = null; ready = false; status = "idle"; statusMsg = "";
  rejectAll(reason);
  emit();
}

// Run a Python cell; resolves { stdout, result, err } once the kernel is ready.
// Optional timeoutMs bounds the wait — a busy or stuck kernel rejects with a
// status-tagged message rather than hanging (the worker keeps running; use
// killKernel to actually reclaim it).
export function run(src, { timeoutMs = 0 } = {}) {
  ensureWorker();
  const id = ++idCounter;
  return new Promise((resolve, reject) => {
    let done = false, timer = null;
    const finish = (isErr, v) => {
      if (done) return; done = true;
      if (timer) clearTimeout(timer);
      pending.delete(id);
      isErr ? reject(v) : resolve(v);
    };
    pending.set(id, { resolve: (m) => finish(false, m), reject: (e) => finish(true, e) });
    if (timeoutMs > 0) {
      timer = setTimeout(
        () => finish(true, new Error(
          `kernel did not respond within ${Math.round(timeoutMs / 1000)}s ` +
          `(status=${status}${statusMsg ? ": " + statusMsg : ""}). ` +
          `If a slow exact compute is running, use Cancel to reclaim the kernel.`)),
        timeoutMs);
    }
    const trySend = () => {
      if (done) return;
      if (ready) worker.postMessage({ type: "run", id, src });
      else if (status === "error") finish(true, new Error(statusMsg || "kernel error"));
      else setTimeout(trySend, 120);
    };
    trySend();
  });
}
