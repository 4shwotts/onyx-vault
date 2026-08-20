import React from 'react';

export default function PageBackground() {
  return (
    <div className="page-background">
      <div className="page-background__base" />

      <svg
        className="onyx-bg-svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          {/* Heavy 3D Steel Surface Gradients */}
          <linearGradient id="chassisDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#212428" />
            <stop offset="50%" stopColor="#121316" />
            <stop offset="100%" stopColor="#08090a" />
          </linearGradient>

          <linearGradient id="bevelLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3a3e45" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="innerRecess" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#050506" />
            <stop offset="100%" stopColor="#1a1c1f" />
          </linearGradient>

          {/* Deep 3D Drop Shadow Filter */}
          <filter id="heavy3dShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="25" stdDeviation="20" floodColor="#000000" floodOpacity="0.8" />
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* --- CONTINUOUS 3D OUTER CHASSIS FRAME --- */}
        <g filter="url(#heavy3dShadow)">
          {/* Outer Steel Structural Frame */}
          <path
            d="M -50 -50 
               L 1650 -50 
               L 1650 950 
               L -50 950 Z 
               M 70 80 
               L 1530 80 
               L 1530 820 
               L 70 820 Z"
            fill="url(#chassisDark)"
            fillRule="evenodd"
            stroke="#2e3238"
            strokeWidth="2"
          />

          {/* Inner Recessed Bevel Lip */}
          <path
            d="M 68 78 
               L 1532 78 
               L 1532 822 
               L 68 822 Z"
            fill="none"
            stroke="url(#bevelLight)"
            strokeWidth="2.5"
          />
        </g>

        {/* --- RECESSED CORNER ARCHITECTURE (3D Depth Cuts) --- */}
        {/* Top-Left Chamfer Support */}
        <path
          d="M -50 -50 L 220 -50 L -50 220 Z"
          fill="url(#innerRecess)"
          stroke="#33373e"
          strokeWidth="1.5"
        />

        {/* Bottom-Right Chamfer Support */}
        <path
          d="M 1650 950 L 1380 950 L 1650 680 Z"
          fill="url(#innerRecess)"
          stroke="#33373e"
          strokeWidth="1.5"
        />

        {/* Structural Heavy Seam Lines */}
        <line x1="70" y1="200" x2="-50" y2="200" stroke="#0a0b0c" strokeWidth="4" />
        <line x1="70" y1="201" x2="-50" y2="201" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
        
        <line x1="1530" y1="700" x2="1650" y2="700" stroke="#0a0b0c" strokeWidth="4" />
        <line x1="1530" y1="701" x2="1650" y2="701" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
      </svg>
    </div>
  );
}