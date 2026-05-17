export const R = 24, AH = 9, ARR_GAP = 8;

export const C = {
  bg: "#0f172a", card: "#1e293b", border: "#334155",
  nodeFill: "#1e3a5f", nodeStroke: "#60a5fa", frozenStroke: "#64748b",
  arrow: "#cbd5e1", hover: "#fbbf24", mutFlash: "#f59e0b",
  text: "#f1f5f9", dim: "#94a3b8", pos: "#3b82f6", neg: "#ef4444",
  accent: "#60a5fa", green: "#34d399", drawArrow: "#f59e0b",
  specgen: "#c084fc",
};

export const PRESETS = [
  { name: "Empty", n: 0, positions: [], frozen: [], B: [] },
  { name: "A₂ – Pentagon ([A₁,A₂] AD)", n: 2,
    positions: [[180,220],[420,220]], frozen: [false,false],
    B: [[0,1],[-1,0]] },
  { name: "Â₁ – Kronecker (SU(2) SW)", n: 2,
    positions: [[180,220],[420,220]], frozen: [false,false],
    B: [[0,2],[-2,0]] },
  { name: "A₃ chain", n: 3,
    positions: [[100,220],[300,220],[500,220]], frozen: [false,false,false],
    B: [[0,1,0],[-1,0,1],[0,-1,0]] },
  { name: "SU(2) Nf=1", n: 3,
    positions: [[170,130],[430,130],[300,340]], frozen: [false,false,false],
    B: [[0,2,-1],[-2,0,1],[1,-1,0]] },
  { name: "SU(3) pure", n: 4,
    positions: [[140,130],[460,130],[460,340],[140,340]], frozen: [false,false,false,false],
    B: [[0,2,0,-1],[-2,0,1,0],[0,-1,0,2],[1,0,-2,0]] },
  { name: "SU(2)×SU(2) + bifund.", n: 5,
    positions: [[80,130],[80,340],[520,130],[520,340],[300,235]], frozen: [false,false,false,false,false],
    B: [[0,2,0,0,-1],[-2,0,0,0,1],[0,0,0,2,-1],[0,0,-2,0,1],[1,-1,1,-1,0]] },
  { name: "A₅ chain", n: 5,
    positions: [[60,220],[180,220],[300,220],[420,220],[540,220]],
    frozen: [false,false,false,false,false],
    B: [[0,1,0,0,0],[-1,0,1,0,0],[0,-1,0,1,0],[0,0,-1,0,1],[0,0,0,-1,0]] },
  // -----------------------------------------------------------------
  // FG K-subdivision construction (sibling session, 2026-05-15).
  // For each macro-triangle, lay down the K-subdivision lattice T(K).
  // Each elementary up-triangle contributes a ccw 3-cycle; legs touching
  // a macro-corner are dropped. Lattice points are identified across
  // shared internal edges by geometric position.
  // Mutable-only — frozen boundary nodes from the sibling's construction
  // have been dropped per user request; remaining nodes are the BPS-quiver
  // interior + amalgam-row nodes.
  // -----------------------------------------------------------------
  { name: "FG K=3 triangle (Yin)", n: 1,
    positions: [[400,417]],
    frozen: [false],
    B: [[0]] },
  { name: "FG K=4 triangle (Yin)", n: 3,
    positions: [[462,450],[400,350],[338,450]],
    frozen: [false,false,false],
    B: [[0,-1,1],[1,0,-1],[-1,1,0]] },
  { name: "FG K=5 triangle (Yin)", n: 6,
    positions: [[500,470],[450,390],[400,310],[400,470],[350,390],[300,470]],
    frozen: [false,false,false,false,false,false],
    B: [[0,-1,0,1,0,0],[1,0,-1,-1,1,0],[0,1,0,0,-1,0],[-1,1,0,0,-1,1],[0,-1,1,1,0,-1],[0,0,0,-1,1,0]] },
  { name: "FG K=3 bitriangle (Yin/Yin amalgam)", n: 4,
    positions: [[400,400],[400,300],[317,350],[483,350]],
    frozen: [false,false,false,false],
    B: [[0,0,1,-1],[0,0,-1,1],[-1,1,0,0],[1,-1,0,0]] },
  { name: "FG K=4 bitriangle (Yin/Yin amalgam)", n: 9,
    positions: [[400,425],[400,350],[400,275],[338,388],[338,312],[275,350],[462,312],[462,388],[525,350]],
    frozen: [false,false,false,false,false,false,false,false,false],
    B: [[0,0,0,1,0,0,0,-1,0],[0,0,0,-1,1,0,-1,1,0],[0,0,0,0,-1,0,1,0,0],[-1,1,0,0,-1,1,0,0,0],[0,-1,1,1,0,-1,0,0,0],[0,0,0,-1,1,0,0,0,0],[0,1,-1,0,0,0,0,-1,1],[1,-1,0,0,0,0,1,0,-1],[0,0,0,0,0,0,-1,1,0]] },
  { name: "FG K=5 bitriangle (Yin/Yin amalgam)", n: 16,
    positions: [[400,440],[400,380],[400,320],[400,260],[350,410],[350,350],[350,290],[300,380],[300,320],[250,350],[450,290],[450,350],[450,410],[500,320],[500,380],[550,350]],
    frozen: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    B: [[0,0,0,0,1,0,0,0,0,0,0,0,-1,0,0,0],[0,0,0,0,-1,1,0,0,0,0,0,-1,1,0,0,0],[0,0,0,0,0,-1,1,0,0,0,-1,1,0,0,0,0],[0,0,0,0,0,0,-1,0,0,0,1,0,0,0,0,0],[-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0],[0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0],[0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0],[0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0],[0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0],[0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0],[0,0,1,-1,0,0,0,0,0,0,0,-1,0,1,0,0],[0,1,-1,0,0,0,0,0,0,0,1,0,-1,-1,1,0],[1,-1,0,0,0,0,0,0,0,0,0,1,0,0,-1,0],[0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1],[0,0,0,0,0,0,0,0,0,0,0,-1,1,1,0,-1],[0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0]] },
  { name: "FG K=3 pentagon (3× Yin, fan at P_0)", n: 7,
    positions: [[300,433],[350,267],[233,433],[500,433],[450,267],[400,433],[567,433]],
    frozen: [false,false,false,false,false,false,false],
    B: [[0,0,1,0,0,-1,0],[0,0,-1,0,-1,1,0],[-1,1,0,0,0,0,0],[0,0,0,0,0,1,-1],[0,1,0,0,0,-1,1],[1,-1,0,-1,1,0,0],[0,0,0,1,-1,0,0]] },
  { name: "FG K=4 pentagon (3× Yin, fan at P_0)", n: 15,
    positions: [[288,475],[325,350],[362,225],[238,475],[275,350],[188,475],[512,475],[475,350],[438,225],[438,475],[400,350],[362,475],[612,475],[525,350],[562,475]],
    frozen: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    B: [[0,0,0,1,0,0,0,0,0,0,0,-1,0,0,0],[0,0,0,-1,1,0,0,0,0,0,-1,1,0,0,0],[0,0,0,0,-1,0,0,0,-1,0,1,0,0,0,0],[-1,1,0,0,-1,1,0,0,0,0,0,0,0,0,0],[0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0],[0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,1,0,0,0,0,-1],[0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1],[0,0,1,0,0,0,0,0,0,0,-1,0,0,1,0],[0,0,0,0,0,0,-1,1,0,0,-1,1,0,0,0],[0,1,-1,0,0,0,0,-1,1,1,0,-1,0,0,0],[1,-1,0,0,0,0,0,0,0,-1,1,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1],[0,0,0,0,0,0,0,1,-1,0,0,0,1,0,-1],[0,0,0,0,0,0,1,-1,0,0,0,0,-1,1,0]] },
  { name: "FG K=5 pentagon (3× Yin, fan at P_0)", n: 26,
    positions: [[240,569],[288,435],[349,310],[425,197],[193,477],[227,351],[285,200],[108,360],[157,240],[44,266],[672,599],[631,453],[606,327],[584,186],[557,576],[525,434],[483,307],[460,570],[399,428],[333,571],[901,279],[788,263],[691,227],[841,386],[729,366],[775,501]],
    frozen: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    B: [[0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0],[0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0],[0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,-1,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0],[-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,-1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,-1,1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,-1,0,1,0],[0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,1,0,0,0],[0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0],[0,0,1,-1,0,0,0,0,0,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0],[0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0],[1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,-1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0,0,1,0,0,-1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1],[0,0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0,0,0,-1,1,1,0,-1],[0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,-1,1,0]] },
  // K=6 entries (extrapolated from the verified K=3/4/5 sibling presets;
  // the FG K-subdivision construction continues unambiguously).
  // FG K=6 bitriangle is byte-identical to the previously-shipped
  // 'A_5 amalgam: 2x FG-K6 (Yin/Yin)' — renamed for consistency.
  // FG K=6 triangle is its L-block (T(3) Yin internal quiver).
  // FG K=6 pentagon constructed by the same rule that verified for
  // the K=4 and K=5 pentagons.
  { name: "FG K=6 triangle (Yin)", n: 10,
    positions: [[550,470],[500,390],[450,310],[400,230],[450,470],[400,390],[350,310],[350,470],[300,390],[250,470]],
    frozen: [false,false,false,false,false,false,false,false,false,false],
    B: [[0,-1,0,0,1,0,0,0,0,0],[1,0,-1,0,-1,1,0,0,0,0],[0,1,0,-1,0,-1,1,0,0,0],[0,0,1,0,0,0,-1,0,0,0],[-1,1,0,0,0,-1,0,1,0,0],[0,-1,1,0,1,0,-1,-1,1,0],[0,0,-1,1,0,1,0,0,-1,0],[0,0,0,0,-1,1,0,0,-1,1],[0,0,0,0,0,-1,1,1,0,-1],[0,0,0,0,0,0,0,-1,1,0]] },
  { name: "FG K=6 bitriangle (Yin/Yin amalgam)", n: 25,
    positions: [[350,260],[350,320],[350,380],[350,440],[300,290],[300,350],[300,410],[250,320],[250,380],[200,350],[450,260],[450,320],[450,380],[450,440],[500,290],[500,350],[500,410],[550,320],[550,380],[600,350],[400,230],[400,290],[400,350],[400,410],[400,470]],
    frozen: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    B: [[0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0],[1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0],[0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0],[0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1],[-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,1,-1],[0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,1,-1,0],[0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,1,-1,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,1,-1,0,0,0],[0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0],[-1,1,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0],[0,-1,1,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,-1,1,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,-1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0]] },
  { name: "FG K=6 pentagon (3× Yin, fan at P_0)", n: 40,
    positions: [[200,500],[185,450],[170,400],[155,350],[170,500],[155,450],[140,400],[140,500],[125,450],[110,500],[450,500],[435,450],[420,400],[405,350],[420,500],[405,450],[390,400],[390,500],[375,450],[360,500],[700,500],[685,450],[670,400],[655,350],[670,500],[655,450],[640,400],[640,500],[625,450],[610,500],[300,100],[290,175],[280,250],[270,325],[260,400],[525,100],[535,175],[545,250],[555,325],[565,400]],
    frozen: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    B: [[0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0],[1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0],[0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0],[0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0],[-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,-1,1,0,0,0],[0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0],[0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,1,-1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,1,-1,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,1,-1,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],[-1,1,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,-1,1,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,-1,1,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,-1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,-1,0,0,0,1,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]] },
  { name: "FG K=4 centered heptagon (7x Yin, fan at centre)", n: 63,
    positions: [[576,185],[518,156],[459,128],[576,260],[518,232],[459,203],[400,175],[518,306],[459,278],[400,250],[459,353],[400,325],[678,404],[664,340],[649,276],[619,450],[605,387],[590,323],[546,434],[532,370],[473,417],[570,619],[611,568],[652,518],[498,602],[538,552],[578,501],[465,535],[506,484],[432,468],[335,670],[400,670],[465,670],[302,602],[368,602],[432,602],[335,535],[400,535],[368,468],[148,518],[189,568],[230,619],[181,450],[222,501],[262,552],[254,434],[294,484],[327,417],[151,276],[136,340],[122,404],[224,260],[210,323],[195,387],[282,306],[268,370],[341,353],[341,128],[282,156],[224,185],[341,203],[282,232],[341,278]],
    frozen: [true,true,true,false,false,false,false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,true,true,true,false,false,false],
    B: [[0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,1,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[1,0,0,0,-1,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[-1,1,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,-1,1,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,-1,0,0],[0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1],[0,0,0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,1],[0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,-1,0,0,0,1,0,0,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,0,-1,0,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,-1,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,0,-1,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,-1,0,0,0,0,0,0,-1,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,1,0,-1,-1,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,-1,1,0,1,0,0,-1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,-1,1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,0,-1,1,1,0,-1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,-1],[0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,-1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,-1,0],[0,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,0,-1,1],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,1,0,0,0,-1,1,1,0,-1],[0,0,0,0,0,0,0,0,0,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,0,0,0,-1,1,0]] },
];

export function dc(o) { return JSON.parse(JSON.stringify(o)); }

export function makeInitial(preset) {
  const { n, positions, frozen, B, charges } = preset;
  const nodes = positions.map((p, i) => ({
    id: i, x: p[0], y: p[1], frozen: !!frozen[i],
    charge: charges && charges[i]
      ? [...charges[i]]
      : Array.from({ length: n }, (_, j) => j === i ? 1 : 0),
  }));
  return { nodes, B: dc(B) };
}

/* ── Preset import/export (Path B: shareable URL + paste) ── */
export function validatePreset(obj) {
  if (!obj || typeof obj !== "object") throw new Error("expected a JSON object");
  const n = Number.isInteger(obj.n) ? obj.n
          : (Array.isArray(obj.B) ? obj.B.length : null);
  if (!Number.isInteger(n) || n < 0) throw new Error("missing or invalid n");
  if (!Array.isArray(obj.B) || obj.B.length !== n)
    throw new Error(`B must be a ${n}×${n} matrix`);
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(obj.B[i]) || obj.B[i].length !== n)
      throw new Error(`B row ${i+1} must have length ${n}`);
    for (let j = 0; j < n; j++) {
      if (!Number.isInteger(obj.B[i][j]))
        throw new Error(`B[${i+1}][${j+1}] is not an integer`);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (obj.B[i][j] + obj.B[j][i] !== 0)
      throw new Error(`B not antisymmetric at (${i+1},${j+1}): ${obj.B[i][j]} vs ${obj.B[j][i]}`);
  }
  let positions = obj.positions;
  if (!Array.isArray(positions) || positions.length !== n) {
    const cx = 300, cy = 235, r = Math.max(80, Math.min(180, 50 + 14 * n));
    positions = Array.from({ length: n }, (_, i) => {
      if (n <= 1) return [cx, cy];
      const a = 2 * Math.PI * i / n - Math.PI / 2;
      return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
    });
  } else {
    positions = positions.map((p, i) => {
      if (!Array.isArray(p) || p.length !== 2)
        throw new Error(`position ${i+1} must be [x,y]`);
      return [Number(p[0]), Number(p[1])];
    });
  }
  let frozen = obj.frozen;
  if (frozen == null) frozen = Array(n).fill(false);
  if (!Array.isArray(frozen) || frozen.length !== n)
    throw new Error("frozen must have length n");
  frozen = frozen.map(Boolean);
  let charges = obj.charges;
  if (charges != null) {
    if (!Array.isArray(charges) || charges.length !== n)
      throw new Error("charges must have length n");
    charges = charges.map((c, i) => {
      if (!Array.isArray(c) || c.length !== n)
        throw new Error(`charges[${i+1}] must have length ${n}`);
      return c.map(v => {
        const x = Number(v);
        if (!Number.isFinite(x)) throw new Error(`charges[${i+1}] has non-numeric entry`);
        return x;
      });
    });
  }
  let mutLogIn = obj.mutLog;
  if (mutLogIn != null) {
    if (!Array.isArray(mutLogIn)) throw new Error("mutLog must be an array");
    mutLogIn = mutLogIn.map((m, i) => {
      if (!m || typeof m !== "object") throw new Error(`mutLog[${i}] must be an object`);
      if (!Number.isInteger(m.index)) throw new Error(`mutLog[${i}].index must be an integer`);
      const c = Array.isArray(m.charge) ? m.charge.map(Number) : [];
      return { index: m.index, charge: c };
    });
  }
  let specIn = obj.spec;
  if (specIn != null) {
    if (typeof specIn !== "object" || !Array.isArray(specIn.seq))
      throw new Error("spec must be {seq:[...], charges?:[[...]], method?:string}");
    specIn = {
      seq: specIn.seq.map(v => {
        if (!Number.isInteger(v)) throw new Error("spec.seq entries must be integers");
        return v;
      }),
      charges: Array.isArray(specIn.charges) ? specIn.charges.map(c => Array.isArray(c) ? c.map(Number) : []) : [],
      method: typeof specIn.method === "string" ? specIn.method : "imported",
    };
  }
  const preset = {
    name: (typeof obj.name === "string" && obj.name.trim()) ? obj.name.trim() : "Imported",
    n, positions, frozen, B: obj.B,
  };
  if (charges) preset.charges = charges;
  if (mutLogIn) preset.mutLog = mutLogIn;
  if (specIn) preset.spec = specIn;
  return preset;
}

export function parsePresetText(text) {
  let s = (text || "").trim();
  if (!s) throw new Error("empty input");
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0 && /^https?:\/\//i.test(s)) s = s.slice(hashIdx + 1);
  else if (s.startsWith("#")) s = s.slice(1);
  if (s.startsWith("q=")) s = s.slice(2);
  if (!s.startsWith("{") && !s.startsWith("[")) {
    try { s = decodeURIComponent(s); } catch { /* leave as-is */ }
  }
  let obj;
  try { obj = JSON.parse(s); }
  catch (e) { throw new Error("invalid JSON: " + e.message); }
  return validatePreset(obj);
}

export function presetToJSON(preset) {
  const obj = {
    name: preset.name,
    n: preset.n,
    positions: preset.positions,
    frozen: preset.frozen,
    B: preset.B,
  };
  if (preset.charges) obj.charges = preset.charges;
  if (preset.mutLog) obj.mutLog = preset.mutLog;
  if (preset.spec) obj.spec = preset.spec;
  return JSON.stringify(obj, null, 2);
}

export function buildShareURL(preset) {
  const compact = JSON.stringify({
    name: preset.name,
    n: preset.n,
    positions: preset.positions,
    frozen: preset.frozen,
    B: preset.B,
    ...(preset.charges ? { charges: preset.charges } : {}),
    ...(preset.mutLog ? { mutLog: preset.mutLog } : {}),
    ...(preset.spec ? { spec: preset.spec } : {}),
  });
  const loc = (typeof window !== "undefined" && window.location) ? window.location : { origin: "", pathname: "", search: "" };
  return loc.origin + loc.pathname + loc.search + "#" + encodeURIComponent(compact);
}

export function mutateQuiver(nodesIn, Bin, k) {
  const n = Bin.length, B = dc(Bin), nodes = dc(nodesIn);
  const Bn = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === k || j === k) Bn[i][j] = -B[i][j];
      else Bn[i][j] = B[i][j] + Math.max(B[i][k],0)*Math.max(B[k][j],0)
                                - Math.max(-B[i][k],0)*Math.max(-B[k][j],0);
    }
  const ck = [...nodes[k].charge];
  for (let j = 0; j < n; j++) {
    if (j === k) nodes[j].charge = ck.map(c => -c);
    else {
      const co = Math.max(B[j][k], 0);
      if (co > 0) nodes[j].charge = nodes[j].charge.map((c, i) => c + co * ck[i]);
    }
  }
  return { nodes, B: Bn };
}

/* ── Positive cone check via Gaussian elimination ── */
export function inPositiveCone(charge, generators) {
  const nGen = generators.length;
  if (nGen === 0) return charge.every(x => x === 0);
  const rank = charge.length;
  // Build augmented matrix [generators^T | charge]
  const A = [];
  for (let i = 0; i < rank; i++) {
    const row = [];
    for (let j = 0; j < nGen; j++) row.push(generators[j][i]);
    row.push(charge[i]);
    A.push(row);
  }
  // Gaussian elimination
  const pivotCols = [];
  let row = 0;
  for (let col = 0; col < nGen && row < rank; col++) {
    let pivot = -1;
    for (let r = row; r < rank; r++) { if (A[r][col] !== 0) { pivot = r; break; } }
    if (pivot < 0) continue;
    pivotCols.push(col);
    [A[row], A[pivot]] = [A[pivot], A[row]];
    for (let r = 0; r < rank; r++) {
      if (r === row) continue;
      if (A[r][col] !== 0) {
        const factor = A[r][col] / A[row][col];
        for (let c = 0; c <= nGen; c++) A[r][c] -= factor * A[row][c];
      }
    }
    row++;
  }
  for (let r = row; r < rank; r++) if (Math.abs(A[r][nGen]) > 1e-12) return false;
  const coeffs = Array(nGen).fill(0);
  for (let idx = 0; idx < pivotCols.length; idx++) {
    coeffs[pivotCols[idx]] = A[idx][nGen] / A[idx][pivotCols[idx]];
  }
  return coeffs.every(c => c >= -1e-12);
}

/* ── Spectrum generator search (BFS + random walk hybrid) ── */
export function chargeKey(nodes) {
  return nodes.map(nd => nd.charge.join(",")).join("|");
}

export function findSpecGen(nodesInit, Binit, maxMs = 5000, origGensOverride = null) {
  const n = Binit.length;
  const mutableIdx = [];
  for (let i = 0; i < n; i++) if (!nodesInit[i].frozen) mutableIdx.push(i);
  const origGens = origGensOverride
    ? origGensOverride.map(c => [...c])
    : mutableIdx.map(i => [...nodesInit[i].charge]);
  // Compare charges projected onto the mutable index subspace, so frozen
  // boundary components don't block the match.
  const negSet = new Set(origGens.map(c => mutableIdx.map(j => -c[j]).join(",")));

  function isDone(nodes) {
    const curSet = new Set(mutableIdx.map(i => mutableIdx.map(j => nodes[i].charge[j]).join(",")));
    if (curSet.size !== negSet.size) return false;
    for (const s of negSet) if (!curSet.has(s)) return false;
    return true;
  }

  const t0 = performance.now();
  
  // Phase 1: BFS for short sequences (up to depth ~12)
  const bfsLimit = Math.min(12, n <= 4 ? 15 : 10);
  const queue = [{ nodes: dc(nodesInit), B: dc(Binit), path: [] }];
  const visited = new Set();
  visited.add(chargeKey(nodesInit));
  let head = 0;

  while (head < queue.length && performance.now() - t0 < maxMs * 0.6) {
    const { nodes, B, path } = queue[head++];
    if (path.length > bfsLimit) break;
    if (isDone(nodes)) {
      const charges = [];
      let cn = dc(nodesInit), cb = dc(Binit);
      for (const k of path) {
        charges.push([...cn[k].charge]);
        const r = mutateQuiver(cn, cb, k);
        cn = r.nodes; cb = r.B;
      }
      return { seq: path, charges, method: "BFS" };
    }
    for (const k of mutableIdx) {
      if (!inPositiveCone(nodes[k].charge, origGens)) continue;
      const r = mutateQuiver(nodes, B, k);
      const key = chargeKey(r.nodes);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ nodes: r.nodes, B: r.B, path: [...path, k] });
      }
    }
  }

  // Phase 2: Random walk for longer sequences
  let best = null;
  const rng = () => Math.random();
  let trials = 0;
  while (performance.now() - t0 < maxMs) {
    trials++;
    let cn = dc(nodesInit), cb = dc(Binit);
    const seq = [];
    const maxSteps = best ? best.seq.length - 1 : 30;
    for (let step = 0; step < maxSteps; step++) {
      const eligible = mutableIdx.filter(k => inPositiveCone(cn[k].charge, origGens));
      if (eligible.length === 0) break;
      const k = eligible[Math.floor(rng() * eligible.length)];
      seq.push(k);
      const r = mutateQuiver(cn, cb, k);
      cn = r.nodes; cb = r.B;
      if (isDone(cn)) {
        const charges = [];
        let cn2 = dc(nodesInit), cb2 = dc(Binit);
        for (const k2 of seq) {
          charges.push([...cn2[k2].charge]);
          const r2 = mutateQuiver(cn2, cb2, k2);
          cn2 = r2.nodes; cb2 = r2.B;
        }
        if (!best || seq.length < best.seq.length) {
          best = { seq: [...seq], charges, method: `random (${trials} trials)` };
        }
        break;
      }
    }
  }
  return best;
}

export function fmtVec(v) { return "(" + v.join(",") + ")"; }
export function fmtCharge(c) {
  let s = "";
  for (let i = 0; i < c.length; i++) {
    if (c[i] === 0) continue;
    const abs = Math.abs(c[i]);
    const sign = c[i] > 0 ? (s ? "+" : "") : "−";
    const coeff = abs === 1 ? "" : String(abs);
    s += sign + coeff + `γ${i+1}`;
  }
  return s || "0";
}
export function fmtChargeNeg(c) {
  return fmtCharge(c.map(x => -x));
}

export function getEdges(nodes, B) {
  const edges = [];
  const n = B.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const v = B[i][j];
      if (v === 0) continue;
      const from = v > 0 ? i : j, to = v > 0 ? j : i, count = Math.abs(v);
      const x1 = nodes[from].x, y1 = nodes[from].y;
      const x2 = nodes[to].x, y2 = nodes[to].y;
      const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy);
      if (len < 2*R+4) continue;
      const ux = dx/len, uy = dy/len, px = -uy, py = ux;
      edges.push({ sx: x1+R*ux, sy: y1+R*uy, tx: x2-R*ux, ty: y2-R*uy, ux, uy, px, py, count });
    }
  return edges;
}

export function svgPt(svgEl, e) {
  const rect = svgEl.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export function nodeAt(nodes, x, y, r = R) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const dx = nodes[i].x - x, dy = nodes[i].y - y;
    if (dx*dx + dy*dy <= r*r) return i;
  }
  return -1;
}

// True iff the multiset of mutable-node charges, projected onto the mutable-index
// subspace, equals { -e_p : p = 0..|mutable|-1 } — i.e. every gauge charge has
// been negated and frozen flavour components are ignored. Same test used by the
// in-render banner and by the spec-gen "isDone" check.
export function isAllNegated(nodes) {
  if (!nodes || nodes.length === 0) return false;
  const mutableIdx = [];
  for (let i = 0; i < nodes.length; i++) if (!nodes[i].frozen) mutableIdx.push(i);
  if (mutableIdx.length === 0) return false;
  const M = mutableIdx.length;
  const negSet = new Set();
  for (let p = 0; p < M; p++) {
    const v = Array(M).fill(0); v[p] = -1;
    negSet.add(v.join(","));
  }
  const curSet = new Set(mutableIdx.map(i =>
    mutableIdx.map(j => nodes[i].charge[j]).join(",")));
  if (curSet.size !== negSet.size) return false;
  for (const s of negSet) if (!curSet.has(s)) return false;
  return true;
}
