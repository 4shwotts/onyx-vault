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
          {/* Subtle 3D shadow for the tracks */}
          <filter id="trackShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        <g filter="url(#trackShadow)">
          {/* --- SET 1: TOP RIGHT TO BOTTOM BENDING TRACKS (Matching reference image) --- */}
          {/* Inner Track */}
          <path
            d="M 1320 -50 
               L 1320 520 
               L 920 820 
               L -50 820"
            stroke="#1a1b1d"
            strokeWidth="50"
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            fill="none"
          />
          {/* Outer Track */}
          <path
            d="M 1430 -50 
               L 1430 550 
               L 1000 870 
               L -50 870"
            stroke="#1a1b1d"
            strokeWidth="50"
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            fill="none"
          />

          {/* Thin accent guideline alongside inner track */}
          <path
            d="M 1285 -50 
               L 1285 500 
               L 890 795 
               L -50 795"
            stroke="#0d0e0f"
            strokeWidth="3"
            fill="none"
            opacity="0.8"
          />

          {/* --- SET 2: SECOND PAIR OF DOUBLE TRACKS (Top-Left diagonal across canvas) --- */}
          {/* Inner Track 2 */}
          <path
            d="M -50 180 
               L 450 180 
               L 800 440 
               L 800 950"
            stroke="#1a1b1d"
            strokeWidth="40"
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            fill="none"
          />
          {/* Outer Track 2 */}
          <path
            d="M -50 110 
               L 480 110 
               L 860 390 
               L 860 950"
            stroke="#1a1b1d"
            strokeWidth="40"
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            fill="none"
          />

          {/* --- SET 3: THIRD PAIR OF DOUBLE TRACKS (Subtle corner accents) --- */}
          <path
            d="M 1650 250 L 1100 -50"
            stroke="#1a1b1d"
            strokeWidth="30"
            fill="none"
          />
          <path
            d="M 1650 310 L 1180 -50"
            stroke="#1a1b1d"
            strokeWidth="30"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}