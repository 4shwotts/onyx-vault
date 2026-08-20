import React from 'react';

export default function PageBackground() {
  return (
    <div className="page-background">
      <div className="page-background__base" />

      <svg
        className="onyx-bg-svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          {/* Inner Frame Drop Shadow */}
          <filter id="frameShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000000" floodOpacity="0.85" />
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
          </filter>

          {/* Chamfer Bevel Highlight */}
          <linearGradient id="bevelLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1a1c1f" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="darkOuterFrame" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1c1e" />
            <stop offset="50%" stopColor="#0d0e10" />
            <stop offset="100%" stopColor="#050506" />
          </linearGradient>
        </defs>

        {/* --- UNIFIED RECESSED OUTER FRAME --- */}
        <g filter="url(#frameShadow)">
          {/* Outer Border Bevel Ring */}
          <rect
            x="35"
            y="35"
            width="1530"
            height="830"
            rx="12"
            fill="none"
            stroke="url(#bevelLight)"
            strokeWidth="2"
          />

          {/* Deep Recessed Dark Outer Shell */}
          <path
            d="M 0 0 
               L 1600 0 
               L 1600 900 
               L 0 900 Z 
               M 40 40 
               L 1560 40 
               L 1560 860 
               L 40 860 Z"
            fill="url(#darkOuterFrame)"
            fillRule="evenodd"
          />
        </g>

        {/* Diagonal Corner Cut Accents (Clean 3D Frame Corners) */}
        <line x1="40" y1="40" x2="120" y2="120" stroke="#000000" strokeWidth="3" opacity="0.6" />
        <line x1="1560" y1="40" x2="1480" y2="120" stroke="#000000" strokeWidth="3" opacity="0.6" />
        <line x1="40" y1="860" x2="120" y2="780" stroke="#000000" strokeWidth="3" opacity="0.6" />
        <line x1="1560" y1="860" x2="1480" y2="780" stroke="#000000" strokeWidth="3" opacity="0.6" />
      </svg>
    </div>
  );
}