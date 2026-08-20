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
          {/* Chrome Specular Gradient - Multi-stop high contrast for liquid sheen */}
          <linearGradient id="chromeGloss" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="15%" stopColor="#22252a" />
            <stop offset="30%" stopColor="#e2e8f0" />
            <stop offset="45%" stopColor="#0d0e11" />
            <stop offset="65%" stopColor="#ffffff" />
            <stop offset="80%" stopColor="#1a1c22" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="edgeGleam" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#000000" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="75%" stopColor="#111215" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
          </linearGradient>

          {/* Liquid Pinch Shadow */}
          <filter id="liquidShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="-10" dy="15" stdDeviation="12" floodColor="#000000" floodOpacity="0.85" />
          </filter>
        </defs>

        {/* --- LIQUID CHROME EDGE FOLDS --- */}
        <g filter="url(#liquidShadow)">
          {/* Top Liquid Flow Wave */}
          <path
            d="M -50 -50 
               C 400 150, 900 -80, 1650 120 
               L 1650 -50 Z"
            fill="url(#chromeGloss)"
          />

          {/* Right Main Liquid Pinch Contour (Matching reference right-side convergence) */}
          <path
            d="M 1650 -50 
               C 1300 200, 1350 450, 1200 600 
               C 1050 750, 800 850, 0 950 
               L 1650 950 Z"
            fill="url(#chromeGloss)"
            opacity="0.9"
          />

          {/* High-Contrast Liquid Edge Highlight Stream */}
          <path
            d="M 1650 50 
               C 1380 250, 1420 480, 1240 620 
               C 1100 730, 820 830, -50 920"
            stroke="url(#edgeGleam)"
            strokeWidth="35"
            fill="none"
            strokeLinecap="round"
          />

          {/* Inner Sharp Specular Highlight Ribbon */}
          <path
            d="M 1650 70 
               C 1400 260, 1435 470, 1250 610 
               C 1120 720, 840 820, -50 905"
            stroke="#ffffff"
            strokeWidth="6"
            fill="none"
            opacity="0.9"
          />

          {/* Bottom Left Pinch Flow Accent */}
          <path
            d="M -50 650 
               C 200 780, 450 820, 700 950 
               L -50 950 Z"
            fill="url(#chromeGloss)"
            opacity="0.75"
          />
        </g>
      </svg>
    </div>
  );
}