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
          {/* Metallic Silver Gradients */}
          <linearGradient id="metalDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1c1e" />
            <stop offset="50%" stopColor="#0d0e0f" />
            <stop offset="100%" stopColor="#161719" />
          </linearGradient>

          <linearGradient id="metalLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#d2d6db" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#8a9098" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="metalBevel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2c3035" />
            <stop offset="100%" stopColor="#0a0a0b" />
          </linearGradient>
        </defs>

        {/* Top Right Chunky Angled Panel Block */}
        <path
          d="M 1050 -50 L 1650 -50 L 1650 420 L 1400 670 L 1220 670 L 1050 500 Z"
          fill="url(#metalDark)"
          stroke="#3d4248"
          strokeWidth="1.5"
        />
        
        {/* Layered Inner Bevels (Reference 2 style) */}
        <path
          d="M 1100 -50 L 1650 -50 L 1650 380 L 1420 610 L 1250 610 L 1100 460 Z"
          fill="url(#metalBevel)"
          stroke="url(#metalLight)"
          strokeWidth="1"
          opacity="0.9"
        />

        <path
          d="M 1150 -50 L 1650 -50 L 1650 340 L 1440 550 L 1280 550 L 1150 420 Z"
          fill="#0d0e10"
        />

        {/* Left Sweeping Industrial Channels (Reference 1 style) */}
        <path
          d="M -100 250 L 350 250 L 650 550 L 650 950 L 520 950 L 520 580 L 270 330 L -100 330 Z"
          fill="url(#metalDark)"
          stroke="url(#metalLight)"
          strokeWidth="1.5"
        />

        <path
          d="M -100 380 L 230 380 L 450 600 L 450 950 L 370 950 L 370 630 L 180 440 L -100 440 Z"
          fill="#121315"
          stroke="#2d3136"
          strokeWidth="1"
        />

        {/* Bottom Corner Block Outlines */}
        <path
          d="M 1300 950 L 1050 700 L 780 700 L 700 780 L 700 950 Z"
          fill="url(#metalBevel)"
          stroke="#3d4248"
          strokeWidth="1.5"
        />

        {/* Structural Accent Cutlines */}
        <line x1="650" y1="550" x2="1050" y2="550" stroke="#2a2d32" strokeWidth="3" />
        <line x1="1220" y1="670" x2="1220" y2="950" stroke="#2a2d32" strokeWidth="2" strokeDasharray="12 6" />
      </svg>
    </div>
  );
}