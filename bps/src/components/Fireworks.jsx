import React, { useEffect, useState } from "react";
import { C } from "../ui/theme.js";

// A self-contained celebration overlay for reaching a spectrum generator —
// radial glow, expanding rings, sparkles, and a shaking banner.  Ported from the
// original ClusterApplet's Celebration, retuned to this palette (gold head +
// green).  `trigger` is an incrementing counter: each bump replays the burst.
export default function Fireworks({ trigger = 0, count = 0, method = "" }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 2000);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  const GOLD = C.head, GREEN = C.green;
  // deterministic-ish spread keyed by index (no reliance on Math.random for layout)
  const sparkles = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 + (i % 3) * 0.14;
    const dist = 200 + (i % 5) * 40;
    return {
      key: i, dx: Math.cos(a) * dist, dy: Math.sin(a) * dist,
      size: 6 + (i % 4) * 2, color: i % 2 ? GOLD : GREEN, delay: (i % 6) * 0.04,
    };
  });

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5000,
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      <style>{`
        @keyframes fw-pulse {
          0% { transform: scale(0.35) rotate(-3deg); opacity: 0; }
          25% { transform: scale(1.18) rotate(2deg); opacity: 1; }
          55% { transform: scale(0.98); opacity: 1; }
          75% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1.10); opacity: 0; }
        }
        @keyframes fw-radial { 0% { transform: scale(0.1); opacity: 0.85; } 60% { opacity: 0.4; } 100% { transform: scale(3.6); opacity: 0; } }
        @keyframes fw-ring { 0% { transform: scale(0.2); opacity: 0; } 20% { opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes fw-sparkle {
          0% { transform: translate(0,0) scale(0); opacity: 0; }
          12% { opacity: 1; transform: translate(0,0) scale(1); }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
        @keyframes fw-shake {
          0%,100% { transform: translate(0,0); } 10% { transform: translate(-3px,1px); }
          20% { transform: translate(3px,-2px); } 30% { transform: translate(-2px,2px); }
          40% { transform: translate(2px,1px); } 50% { transform: translate(-1px,-1px); } 60% { transform: translate(1px,0); }
        }
      `}</style>

      <div style={{
        position: "absolute", width: 320, height: 320, borderRadius: "50%",
        background: `radial-gradient(circle, ${GOLD}cc 0%, ${GOLD}33 35%, transparent 70%)`,
        animation: "fw-radial 1.7s ease-out forwards", filter: "blur(2px)",
      }} />

      {[0, 0.15, 0.3].map((d, i) => (
        <div key={i} style={{
          position: "absolute", width: 160, height: 160, borderRadius: "50%",
          border: `3px solid ${i % 2 ? GREEN : GOLD}`, animation: `fw-ring 1.5s ease-out ${d}s forwards`,
        }} />
      ))}

      {sparkles.map((s) => (
        <div key={s.key} style={{
          position: "absolute", width: s.size, height: s.size, borderRadius: "50%", background: s.color,
          boxShadow: `0 0 ${s.size * 2}px ${s.color}, 0 0 ${s.size * 4}px ${s.color}55`,
          animation: `fw-sparkle 1.4s ease-out ${s.delay}s forwards`,
          ["--dx"]: `${s.dx}px`, ["--dy"]: `${s.dy}px`,
        }} />
      ))}

      <div style={{
        position: "relative", textAlign: "center", fontFamily: "var(--mono, ui-monospace, monospace)",
        animation: "fw-pulse 2s cubic-bezier(0.22,1,0.36,1) forwards",
        textShadow: `0 0 24px ${GOLD}, 0 0 48px ${GOLD}aa, 0 4px 20px rgba(0,0,0,0.5)`,
      }}>
        <div style={{ display: "inline-block", animation: "fw-shake 0.6s ease-in-out 0.15s 1" }}>
          <div style={{ fontSize: "clamp(26px, 7vw, 52px)", fontWeight: 800, color: GOLD, letterSpacing: 2, lineHeight: 1 }}>
            ✦ SPECTRUM FOUND ✦
          </div>
          <div style={{ fontSize: "clamp(17px, 4vw, 26px)", color: GREEN, marginTop: 10, fontWeight: 700 }}>
            {count} BPS state{count === 1 ? "" : "s"}
          </div>
          {method && (
            <div style={{ fontSize: "clamp(11px, 2.5vw, 14px)", color: C.dim, marginTop: 8, letterSpacing: 1, textTransform: "uppercase" }}>
              via {method}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
