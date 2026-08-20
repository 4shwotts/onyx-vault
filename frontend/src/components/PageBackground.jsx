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
          {/* Top-Left Matte Light Silver Gradient */}
          <radialGradient id="silverMatte" cx="30%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#e8ebef" />
            <stop offset="60%" stopColor="#d1d5db" />
            <stop offset="100%" stopColor="#b0b5bd" />
          </radialGradient>

          {/* Bottom-Left Dark Spotlight Gradient */}
          <radialGradient id="darkSpotlight" cx="35%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#80858c" />
            <stop offset="45%" stopColor="#2c2e33" />
            <stop offset="100%" stopColor="#0f1012" />
          </radialGradient>

          {/* Top-Right Diffused Blur Gradient */}
          <radialGradient id="blurGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#9aa0a6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1a1c1e" stopOpacity="0.9" />
          </radialGradient>

          {/* Bottom-Right Clean Silver Plate */}
          <linearGradient id="silverPlate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e6eb" />
            <stop offset="100%" stopColor="#c0c5cc" />
          </linearGradient>

          {/* Depth Inner Shadow Filter */}
          <filter id="panelInnerShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feOffset dx="0" dy="4" />
            <feGaussianBlur stdDeviation="8" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="#000000" floodOpacity="0.4" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* --- PANEL 1: TOP-LEFT (Large Light Silver Shape) --- */}
        <path
          d="M 15 15 
             L 1150 15 
             C 1180 15, 1200 25, 1180 50 
             C 1000 280, 800 420, 780 435 
             C 770 442, 755 440, 740 435 
             C 500 350, 150 420, 15 450 
             Z"
          fill="url(#silverMatte)"
          filter="url(#panelInnerShadow)"
        />

        {/* --- PANEL 2: BOTTOM-LEFT (Dark Metallic Curved Shape) --- */}
        <path
          d="M 15 480 
             C 150 450, 500 380, 720 455 
             C 735 460, 745 470, 735 485 
             C 550 700, 380 820, 350 885 
             L 15 885 
             Z"
          fill="url(#darkSpotlight)"
          filter="url(#panelInnerShadow)"
        />

        {/* --- PANEL 3: TOP-RIGHT (Diffused Textured Lens Shape) --- */}
        <path
          d="M 1210 15 
             L 1585 15 
             L 1585 450 
             C 1400 480, 950 480, 800 450 
             C 785 445, 785 435, 795 425 
             C 1010 230, 1180 50, 1210 15 
             Z"
          fill="url(#blurGlow)"
          filter="url(#panelInnerShadow)"
        />

        {/* --- PANEL 4: BOTTOM-RIGHT (Base Silver Panel Shape) --- */}
        <path
          d="M 760 485 
             C 770 475, 785 475, 795 480 
             C 950 510, 1400 510, 1585 480 
             L 1585 885 
             L 380 885 
             C 410 820, 580 700, 760 485 
             Z"
          fill="url(#silverPlate)"
          filter="url(#panelInnerShadow)"
        />
      </svg>
    </div>
  );
}