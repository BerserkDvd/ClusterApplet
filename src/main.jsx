import React from 'react'
import ReactDOM from 'react-dom/client'
import QuiverMutationApp from './QuiverMutationApp'
import MobileQuiverApp from './MobileQuiverApp'

function pickComponent() {
  if (typeof window === "undefined") return QuiverMutationApp;
  const params = new URLSearchParams(window.location.search);
  const flag = params.get("mobile");
  if (flag === "1" || flag === "true") return MobileQuiverApp;
  if (flag === "0" || flag === "false") return QuiverMutationApp;
  // Auto-detect: coarse-pointer device with a narrow viewport.
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 800;
  return (coarse && narrow) ? MobileQuiverApp : QuiverMutationApp;
}

const App = pickComponent();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
