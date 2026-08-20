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
          {/* Photorealistic Liquid Chrome Gradient 1 (Main Fold) */}
          <linearGradient id="liquidChromePrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="8%" stopColor="#dbe1e8" />
            <stop offset="18%" stopColor="#111215" />
            <stop offset="28%" stopColor="#8a929e" />
            <stop offset="38%" stopColor="#ffffff" />
            <stop offset="48%" stopColor="#1a1c20" />
            <stop offset="62%" stopColor="#e2e8f0" />
            <stop offset="78%" stopColor="#08090a" />
            <stop offset="90%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* Liquid Chrome Edge Reflection (High Contrast Specular) */}
          <linearGradient id="chromeEdgeGlint" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="20%" stopColor="#000000" />
            <stop offset="40%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#15171a" />
            <stop offset="80%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#0a0b0d" />
          </linearGradient>

          {/* Ambient Edge Occlusion Drop Shadow */}
          <filter id="chromeDepthShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="-20" dy="25" stdDeviation="25" floodColor="#000000" floodOpacity="0.9" />
            <feDropShadow dx="-5" dy="8" stdDeviation="10" floodColor="#000000" floodOpacity="0.7" />
          </filter>
        </defs>

        {/* --- LIQUID CHROME Draped Edge Layers --- */}
        <g filter="url(#chromeDepthShadow)">
          {/* Top Liquid Curve Frame Accent */}
          <path
            d="M -50 -50 
               C 350 80, 850 -60, 1650 90 
               L 1650 -50 Z"
            fill="url(#liquidChromePrimary)"
          />

          {/* Sharp White Specular Rim for Top Curve */}
          <path
            d="M -50 -45 
               C 350 85, 850 -55, 1650 95"
            stroke="#ffffff"
            strokeWidth="3"
            fill="none"
            opacity="0.85"
          />

          {/* Main Organic Right-to-Bottom Fluid Convergence Sweep */}
          <path
            d="M 1650 -50 
               C 1380 180, 1420 420, 1260 580 
               C 1080 750, 750 830, -50 960 
               L 1650 960 Z"
            fill="url(#liquidChromePrimary)"
          />

          {/* High-Gloss Mirror Highlight Band */}
          <path
            d="M 1650 15 
               C 1400 220, 1440 450, 1275 600 
               C 1100 760, 770 840, -50 940"
            stroke="url(#chromeEdgeGlint)"
            strokeWidth="28"
            fill="none"
            strokeLinecap="round"
          />

          {/* Razor-Thin Liquid Hotspot Specular Line */}
          <path
            d="M 1650 30 
               C 1410 230, 1450 455, 1282 608 
               C 1110 765, 780 845, -50 930"
            stroke="#ffffff"
            strokeWidth="5"
            fill="none"
            opacity="0.95"
          />

          {/* Bottom Left Secondary Fluid Fold */}
          <path
            d="M -50 720 
               C 180 820, 420 840, 680 960 
               L -50 960 Z"
            fill="url(#liquidChromePrimary)"
            opacity="0.8"
          />
        </g>
      </svg>
    </div>
  );
}