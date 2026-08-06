// Fixed, app-wide backdrop for "Onyx Vault": a hand-built (not imported)
// cluster of concentric rings reading as an interlocking vault mechanism.
//
// Three things give this depth instead of flat outlines:
//  1. WEIGHT CONTRAST — a few "hero" rings per cluster are drawn bolder/
//     darker in front; the rest sit fainter behind them, so there's an
//     actual foreground/background instead of everything at one weight.
//  2. DIAL TICKS — the largest ring in each main cluster gets tick marks
//     around its rim, like a combination-lock dial, the most literal nod
//     to "vault" in the whole design.
//  3. RIVETS — small solid dots at a few ring intersections, like bolts
//     holding the mechanism together.
//
// Each ring still spins independently (own speed + direction) via CSS.

function ringPath(cx, cy, r, gapDeg, gapStartDeg) {
  if (gapDeg <= 0) {
    return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy}`;
  }
  const startDeg = gapStartDeg + gapDeg / 2;
  const endDeg = gapStartDeg - gapDeg / 2 + 360;
  const toXY = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startDeg);
  const [x2, y2] = toXY(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2}`;
}

// Tick marks around a ring's rim, like a combination-lock dial.
function DialTicks({ cx, cy, r, count = 36, majorEvery = 6 }) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const deg = (360 / count) * i;
    const rad = (deg * Math.PI) / 180;
    const isMajor = i % majorEvery === 0;
    const len = isMajor ? 14 : 7;
    const inner = r - len;
    ticks.push({
      x1: cx + inner * Math.cos(rad),
      y1: cy + inner * Math.sin(rad),
      x2: cx + r * Math.cos(rad),
      y2: cy + r * Math.sin(rad),
      isMajor,
    });
  }
  return (
    <g>
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#1a1c1f"
          strokeWidth={t.isMajor ? 1.4 : 1}
          strokeLinecap="round"
          opacity={t.isMajor ? 0.22 : 0.12}
        />
      ))}
    </g>
  );
}

// weight: 'hero' | 'mid' | 'faint' — controls stroke weight + opacity so
// rings read as being at different depths rather than all the same.
const WEIGHTS = {
  hero: { strokeA: 1.8, opA: 0.26, strokeB: 1.3, opB: 0.15 },
  mid:  { strokeA: 1.3, opA: 0.16, strokeB: 1,   opB: 0.09 },
  faint:{ strokeA: 1,   opA: 0.09, strokeB: 0.8, opB: 0.05 },
};

function Ring({ ring }) {
  const w = WEIGHTS[ring.weight || 'mid'];
  const gapPx = 4;
  return (
    <g
      style={{
        transformOrigin: `${ring.cx}px ${ring.cy}px`,
        animation: `pageBgSpin ${ring.duration}s linear infinite`,
        animationDirection: ring.dir < 0 ? 'reverse' : 'normal',
      }}
    >
      <path
        d={ringPath(ring.cx, ring.cy, ring.r, ring.gap, ring.gapStart)}
        fill="none"
        stroke="#1a1c1f"
        strokeWidth={w.strokeA}
        strokeLinecap="round"
        opacity={w.opA}
      />
      <path
        d={ringPath(ring.cx, ring.cy, ring.r - gapPx, ring.gap, ring.gapStart)}
        fill="none"
        stroke="#1a1c1f"
        strokeWidth={w.strokeB}
        strokeLinecap="round"
        opacity={w.opB}
      />
      {ring.dial && <DialTicks cx={ring.cx} cy={ring.cy} r={ring.r + 10} />}
    </g>
  );
}

function Rivet({ cx, cy }) {
  return <circle cx={cx} cy={cy} r={2.6} fill="#1a1c1f" opacity="0.3" />;
}

const CLUSTERS = [
  {
    // main top-right cluster — hero ring gets the dial ticks
    rings: [
      { cx: 1780, cy: 90,  r: 150, gap: 0,  gapStart: 0,   duration: 42, dir: 1,  weight: 'hero', dial: true },
      { cx: 1780, cy: 90,  r: 110, gap: 70, gapStart: 200, duration: 34, dir: -1, weight: 'mid' },
      { cx: 1660, cy: 210, r: 130, gap: 60, gapStart: 40,  duration: 50, dir: 1,  weight: 'mid' },
      { cx: 1660, cy: 210, r: 90,  gap: 0,  gapStart: 0,   duration: 26, dir: -1, weight: 'faint' },
      { cx: 1550, cy: 340, r: 115, gap: 55, gapStart: 300, duration: 38, dir: 1,  weight: 'faint' },
      { cx: 1830, cy: 300, r: 95,  gap: 0,  gapStart: 0,   duration: 30, dir: -1, weight: 'faint' },
    ],
    rivets: [{ cx: 1730, cy: 145 }, { cx: 1600, cy: 265 }],
  },
  {
    // lower-middle, larger, bleeds toward the bottom — hero ring, dial ticks
    rings: [
      { cx: 1350, cy: 480, r: 170, gap: 65, gapStart: 120, duration: 55, dir: -1, weight: 'hero', dial: true },
      { cx: 1350, cy: 480, r: 120, gap: 0,  gapStart: 0,   duration: 40, dir: 1,  weight: 'mid' },
      { cx: 1470, cy: 560, r: 140, gap: 50, gapStart: 250, duration: 46, dir: -1, weight: 'faint' },
      { cx: 1230, cy: 560, r: 100, gap: 0,  gapStart: 0,   duration: 32, dir: 1,  weight: 'faint' },
    ],
    rivets: [{ cx: 1400, cy: 555 }, { cx: 1275, cy: 500 }],
  },
  {
    // small far-right lower cluster
    rings: [
      { cx: 1900, cy: 610, r: 90, gap: 60, gapStart: 80, duration: 36, dir: 1,  weight: 'mid' },
      { cx: 1900, cy: 610, r: 60, gap: 0,  gapStart: 0,  duration: 24, dir: -1, weight: 'faint' },
    ],
    rivets: [],
  },
  {
    // top-left cluster
    rings: [
      { cx: 120, cy: 40,  r: 120, gap: 0,  gapStart: 0,   duration: 44, dir: 1,  weight: 'hero', dial: true },
      { cx: 120, cy: 40,  r: 85,  gap: 65, gapStart: 150, duration: 33, dir: -1, weight: 'mid' },
      { cx: 240, cy: 160, r: 100, gap: 50, gapStart: 300, duration: 39, dir: 1,  weight: 'faint' },
      { cx: 40,  cy: 220, r: 70,  gap: 0,  gapStart: 0,   duration: 27, dir: -1, weight: 'faint' },
    ],
    rivets: [{ cx: 175, cy: 100 }],
  },
  {
    // bottom-left cluster
    rings: [
      { cx: 180, cy: 760, r: 160, gap: 60, gapStart: 200, duration: 52, dir: 1,  weight: 'hero', dial: true },
      { cx: 180, cy: 760, r: 110, gap: 0,  gapStart: 0,   duration: 37, dir: -1, weight: 'mid' },
      { cx: 340, cy: 850, r: 120, gap: 55, gapStart: 40,  duration: 43, dir: 1,  weight: 'faint' },
      { cx: 60,  cy: 870, r: 75,  gap: 0,  gapStart: 0,   duration: 28, dir: -1, weight: 'faint' },
    ],
    rivets: [{ cx: 255, cy: 805 }],
  },
];

export default function PageBackground() {
  return (
    <div className="page-background">
      <div className="page-background__base" />
      <svg
        className="page-background__circles"
        viewBox="0 0 2000 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        {CLUSTERS.flatMap((cluster, ci) => [
          ...cluster.rings.map((ring, i) => (
            <Ring key={`ring-${ci}-${i}`} ring={ring} />
          )),
          ...cluster.rivets.map((rv, i) => (
            <Rivet key={`rivet-${ci}-${i}`} cx={rv.cx} cy={rv.cy} />
          )),
        ])}
      </svg>
    </div>
  );
}