import { useEffect, useState } from "react";
import { C } from "./quiver-core";

const MONO = "'Menlo','Consolas','Monaco',monospace";

// `trigger` is a value that changes (e.g. an incrementing counter) each time we
// want to play the celebration. Pass `count` (BPS states) and optional `method`.
export function Celebration({ trigger, count, method }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 1900);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  const sparkles = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
    const dist = 220 + Math.random() * 160;
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    const size = 6 + Math.random() * 6;
    const color = i % 2 ? C.specgen : C.green;
    const delay = Math.random() * 0.25;
    return { dx, dy, size, color, delay, key: i };
  });

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5000,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes ca-pulse {
          0% { transform: scale(0.35) rotate(-3deg); opacity: 0; }
          25% { transform: scale(1.18) rotate(2deg); opacity: 1; }
          55% { transform: scale(0.98) rotate(-0.5deg); opacity: 1; }
          75% { transform: scale(1.04) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.10) rotate(0deg); opacity: 0; }
        }
        @keyframes ca-radial {
          0% { transform: scale(0.1); opacity: 0.85; }
          60% { opacity: 0.4; }
          100% { transform: scale(3.6); opacity: 0; }
        }
        @keyframes ca-ring {
          0% { transform: scale(0.2); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes ca-sparkle {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          12%  { opacity: 1; transform: translate(0,0) scale(1); }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
        @keyframes ca-shake {
          0%, 100% { transform: translate(0,0); }
          10% { transform: translate(-3px, 1px); }
          20% { transform: translate(3px, -2px); }
          30% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, 1px); }
          50% { transform: translate(-1px, -1px); }
          60% { transform: translate(1px, 0); }
        }
      `}</style>

      {/* radial glow */}
      <div style={{
        position: "absolute", width: 320, height: 320, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.specgen}cc 0%, ${C.specgen}33 35%, transparent 70%)`,
        animation: "ca-radial 1.6s ease-out forwards",
        filter: "blur(2px)",
      }}/>

      {/* expanding rings */}
      {[0, 0.15, 0.3].map((d, i) => (
        <div key={i} style={{
          position: "absolute", width: 160, height: 160, borderRadius: "50%",
          border: `3px solid ${i % 2 ? C.green : C.specgen}`,
          animation: `ca-ring 1.4s ease-out ${d}s forwards`,
        }}/>
      ))}

      {/* sparkles */}
      {sparkles.map(s => (
        <div key={s.key} style={{
          position: "absolute",
          width: s.size, height: s.size, borderRadius: "50%",
          background: s.color,
          boxShadow: `0 0 ${s.size * 2}px ${s.color}, 0 0 ${s.size * 4}px ${s.color}55`,
          animation: `ca-sparkle 1.3s ease-out ${s.delay}s forwards`,
          ["--dx"]: `${s.dx}px`,
          ["--dy"]: `${s.dy}px`,
        }}/>
      ))}

      {/* banner */}
      <div style={{
        position: "relative", textAlign: "center",
        animation: "ca-pulse 1.9s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        textShadow: `0 0 24px ${C.specgen}, 0 0 48px ${C.specgen}aa, 0 4px 20px rgba(0,0,0,0.5)`,
        fontFamily: MONO,
      }}>
        <div style={{
          display: "inline-block",
          animation: "ca-shake 0.6s ease-in-out 0.15s 1",
        }}>
          <div style={{
            fontSize: "clamp(28px, 8vw, 56px)", fontWeight: 800, color: C.specgen,
            letterSpacing: 2, lineHeight: 1,
          }}>
            ✦ S FOUND ✦
          </div>
          <div style={{
            fontSize: "clamp(18px, 4.5vw, 28px)", color: C.green,
            marginTop: 10, fontWeight: 700, letterSpacing: 0.5,
          }}>
            {count} BPS state{count === 1 ? "" : "s"}
          </div>
          {method && (
            <div style={{
              fontSize: "clamp(11px, 2.5vw, 14px)", color: C.dim,
              marginTop: 8, letterSpacing: 1, textTransform: "uppercase",
            }}>
              via {method}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
