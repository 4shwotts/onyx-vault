const PANEL0_D = "M1097.26 0L1385.24 2.31425C1401.71 2.44664 1415 15.8388 1415 32.3133V482.868C1415 499.178 1401.97 512.5 1385.66 512.86L805.528 525.691C796.66 525.887 788.16 522.148 782.311 515.48L751.799 480.692C742.558 470.156 741.843 454.625 750.078 443.284L777.528 405.48L1079.59 8.75839C1083.79 3.23961 1090.33 0 1097.26 0Z";
const PANEL1_D = "M41.5451 499.394C18.8647 500.271 0 482.121 0 459.424V47.4085C0 25.4284 17.7353 7.56628 39.7148 7.40957L1049.82 0.208062C1060.93 0.128799 1066.81 13.3339 1059.31 21.5396L888.143 238.474L800.288 351.813L713.247 459.717C705.993 468.71 695.204 474.127 683.658 474.573L41.5451 499.394Z";
const PANEL2_D = "M1374.03 526.986C1396.5 526.445 1415 544.506 1415 566.975V965C1415 987.091 1397.09 1005 1375 1005H385.914C380.161 1005 375.498 1000.34 375.498 994.584C375.498 991.959 376.489 989.43 378.273 987.504L780.513 553.395C787.855 545.471 798.091 540.853 808.891 540.593L1374.03 526.986Z";
const PANEL3_D = "M356.934 989.536C349.244 997.81 338.414 1002.45 327.12 1002.3L49.0514 998.71C27.1633 998.427 9.56787 980.603 9.56787 958.713L9.56789 553.014C9.56789 531.583 26.4575 513.96 47.8686 513.05L350.574 500.179L708.363 485.79C718.16 485.396 727.761 488.614 735.341 494.833L738.996 497.831C740.9 499.393 742.655 501.127 744.24 503.012L752.31 512.609C765.31 528.067 764.745 550.792 750.994 565.586L356.934 989.536Z";

function CornerBracket({ x, y, size = 26, flipX = false, flipY = false, color, strokeWidth = 1.4 }) {
  const dx = flipX ? -1 : 1;
  const dy = flipY ? -1 : 1;
  return (
    <path
      d={`M ${x} ${y + size * dy} L ${x} ${y} L ${x + size * dx} ${y}`}
      fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="square"
    />
  );
}

function CircuitTrace({ points, color, strokeWidth = 1.2, nodeRadius = 2.5 }) {
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={nodeRadius} fill={color} />
      ))}
    </g>
  );
}

export default function PageBackground() {
  const decalColor = 'rgba(142,68,173,0.55)';
  const decalColorFaint = 'rgba(142,68,173,0.3)';

  return (
    <div className="page-background">
      <svg
        className="onyx-bg-svg"
        viewBox="0 0 1415 1007"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="paint0_linear_189_83" x1="539.5" y1="0" x2="539.5" y2="499" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D9D9D9" />
            <stop offset="1" stopColor="#4B4B4B" />
          </linearGradient>
          <linearGradient id="paint1_linear_189_83" x1="895.248" y1="526" x2="895.248" y2="1005" gradientUnits="userSpaceOnUse">
            <stop stopColor="#707070" />
            <stop offset="0.394231" stopColor="#7D7D7D" />
            <stop offset="1" stopColor="#5C5C5C" />
          </linearGradient>
          <radialGradient id="paint2_radial_189_83" cx="0" cy="0" r="1" gradientTransform="matrix(-468.911 337.464 -373.375 -510.084 600.048 670.487)" gradientUnits="userSpaceOnUse">
            <stop offset="0.370192" stopColor="#1C1C1C" />
            <stop offset="1" stopColor="#5C5C5C" />
          </radialGradient>

          <filter id="lightGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>

          <filter id="panelShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="4" dy="7" stdDeviation="9" floodColor="#000000" floodOpacity="0.28" />
          </filter>

          <clipPath id="clipPanel0"><path d={PANEL0_D} /></clipPath>
          <clipPath id="clipPanel1"><path d={PANEL1_D} /></clipPath>
          <clipPath id="clipPanel2"><path d={PANEL2_D} /></clipPath>
          <clipPath id="clipPanel3"><path d={PANEL3_D} /></clipPath>
        </defs>

        <path d={PANEL0_D} fill="#9E9E9E" filter="url(#panelShadow)" />
        <path d={PANEL1_D} fill="url(#paint0_linear_189_83)" filter="url(#panelShadow)" />
        <path d={PANEL2_D} fill="url(#paint1_linear_189_83)" filter="url(#panelShadow)" />
        <path d={PANEL3_D} fill="url(#paint2_radial_189_83)" filter="url(#panelShadow)" />

        <g clipPath="url(#clipPanel0)"><rect x="0" y="0" width="1415" height="1007" fill="url(#lightGrain)" opacity="0.05" style={{ mixBlendMode: 'overlay' }} /></g>
        <g clipPath="url(#clipPanel1)"><rect x="0" y="0" width="1415" height="1007" fill="url(#lightGrain)" opacity="0.05" style={{ mixBlendMode: 'overlay' }} /></g>
        <g clipPath="url(#clipPanel2)"><rect x="0" y="0" width="1415" height="1007" fill="url(#lightGrain)" opacity="0.05" style={{ mixBlendMode: 'overlay' }} /></g>
        <g clipPath="url(#clipPanel3)"><rect x="0" y="0" width="1415" height="1007" fill="url(#lightGrain)" opacity="0.07" style={{ mixBlendMode: 'overlay' }} /></g>

        <CornerBracket x={22} y={22} size={26} color={decalColor} />
        <CornerBracket x={1393} y={22} size={26} flipX color={decalColor} />
        <CornerBracket x={22} y={985} size={26} flipY color={decalColor} />
        <CornerBracket x={1393} y={985} size={26} flipX flipY color={decalColor} />

        <CircuitTrace points={[[760, 528], [800, 500], [860, 500]]} color={decalColorFaint} />
        <CircuitTrace points={[[380, 500], [340, 470], [340, 420]]} color={decalColorFaint} />
      </svg>
    </div>
  );
}