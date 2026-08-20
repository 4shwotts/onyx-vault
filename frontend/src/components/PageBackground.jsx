import React from 'react';

function CircuitNode({ x, y, radius = 3, color = '#8e44ad', glow = false }) {
  return (
    <g>
      <circle cx={x} cy={y} r={radius} fill={glow ? color : '#2a2e35'} />
      {glow && (
        <circle cx={x} cy={y} r={radius * 2.5} fill={color} opacity="0.25" />
      )}
    </g>
  );
}

function ReticleTarget({ x, y, size = 18, color = 'rgba(255,255,255,0.15)' }) {
  return (
    <g stroke={color} strokeWidth="1" fill="none">
      <circle cx={x} cy={y} r={size} strokeDasharray="4 2" />
      <line x1={x - size - 4} y1={y} x2={x + size + 4} y2={y} />
      <line x1={x} y1={y - size - 4} x2={x} y2={y + size + 4} />
    </g>
  );
}

export default function PageBackground() {
  const lineStroke = 'rgba(255, 255, 255, 0.05)';
  const accentStroke = 'rgba(142, 68, 173, 0.4)';

  return (
    <div className="page-background">
      <div className="page-background__base" />
      <div className="page-background__grid" />

      <svg
        className="onyx-bg-svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        {/* Sci-Fi HUD Crosshairs & Markers */}
        <ReticleTarget x={150} y={120} size={14} />
        <ReticleTarget x={1450} y={120} size={14} />
        <ReticleTarget x={1400} y={780} size={20} />

        {/* Tech Circuit Traces */}
        <path
          d="M -50 200 L 300 200 L 400 300 L 700 300"
          stroke={lineStroke}
          strokeWidth="1.5"
        />
        <path
          d="M 400 300 L 400 500 L 550 650"
          stroke={accentStroke}
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <path
          d="M 1650 250 L 1250 250 L 1150 350 L 1150 600 L 1000 750"
          stroke={lineStroke}
          strokeWidth="1.5"
        />
        <path
          d="M 1250 250 L 1250 150 L 1100 150"
          stroke={accentStroke}
          strokeWidth="1"
        />

        {/* Diagonal Tech Framing Corner Accents */}
        <path d="M 30 0 L 0 30" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        <path d="M 1570 0 L 1600 30" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        <path d="M 0 870 L 30 900" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        <path d="M 1600 870 L 1570 900" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

        {/* Glowing Circuit Junction Nodes */}
        <CircuitNode x={300} y={200} />
        <CircuitNode x={400} y={300} glow />
        <CircuitNode x={700} y={300} />
        <CircuitNode x={1250} y={250} glow />
        <CircuitNode x={1150} y={350} />
      </svg>
    </div>
  );
}