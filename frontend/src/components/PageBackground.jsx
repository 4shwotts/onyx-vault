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
          {/* Heavy Steel Panel Gradients */}
          <linearGradient id="darkSteel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e2023" />
            <stop offset="40%" stopColor="#111214" />
            <stop offset="100%" stopColor="#080809" />
          </linearGradient>

          <linearGradient id="cutShadow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0a0b0c" />
            <stop offset="100%" stopColor="#25282d" />
          </linearGradient>

          <linearGradient id="brightEdge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#60656c" stopOpacity="0.2" />
          </linearGradient>

          {/* Rough Industrial Steel Texture Pattern */}
          <pattern id="brushedTexture" width="200" height="200" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="200" y2="200" stroke="#ffffff" strokeWidth="0.5" opacity="0.08" />
            <line x1="0" y1="50" x2="200" y2="250" stroke="#000000" strokeWidth="0.8" opacity="0.15" />
            <line x1="50" y1="0" x2="250" y2="200" stroke="#ffffff" strokeWidth="0.5" opacity="0.06" />
          </pattern>

          {/* Panel Drop Shadow Filter */}
          <filter id="panelShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="10" dy="18" stdDeviation="12" floodColor="#000000" floodOpacity="0.65" />
          </filter>
        </defs>

        {/* Top Right Chunky Angled Steel Panel with Heavy Shadow */}
        <g filter="url(#panelShadow)">
          <path
            d="M 1050 -50 L 1650 -50 L 1650 420 L 1400 670 L 1220 670 L 1050 500 Z"
            fill="url(#darkSteel)"
            stroke="#3a3e45"
            strokeWidth="2"
          />
          {/* Internal Texture Overlay */}
          <path
            d="M 1050 -50 L 1650 -50 L 1650 420 L 1400 670 L 1220 670 L 1050 500 Z"
            fill="url(#brushedTexture)"
          />
        </g>

        {/* Layered Inner Bevel Cuts */}
        <path
          d="M 1100 -50 L 1650 -50 L 1650 380 L 1420 610 L 1250 610 L 1100 460 Z"
          fill="url(#cutShadow)"
          stroke="url(#brightEdge)"
          strokeWidth="1.5"
        />

        <path
          d="M 1150 -50 L 1650 -50 L 1650 340 L 1440 550 L 1280 550 L 1150 420 Z"
          fill="#090a0b"
        />

        {/* Left Sweeping Industrial Channels */}
        <g filter="url(#panelShadow)">
          <path
            d="M -100 250 L 350 250 L 650 550 L 650 950 L 520 950 L 520 580 L 270 330 L -100 330 Z"
            fill="url(#darkSteel)"
            stroke="url(#brightEdge)"
            strokeWidth="2"
          />
          <path
            d="M -100 250 L 350 250 L 650 550 L 650 950 L 520 950 L 520 580 L 270 330 L -100 330 Z"
            fill="url(#brushedTexture)"
          />
        </g>

        <path
          d="M -100 380 L 230 380 L 450 600 L 450 950 L 370 950 L 370 630 L 180 440 L -100 440 Z"
          fill="#0c0d0f"
          stroke="#272a2e"
          strokeWidth="1"
        />

        {/* Bottom Corner Block Outlines */}
        <path
          d="M 1300 950 L 1050 700 L 780 700 L 700 780 L 700 950 Z"
          fill="url(#cutShadow)"
          stroke="#3a3e45"
          strokeWidth="2"
          filter="url(#panelShadow)"
        />

        {/* Structural Accent Cutlines & Grooves */}
        <line x1="650" y1="550" x2="1050" y2="550" stroke="#181a1c" strokeWidth="4" />
        <line x1="650" y1="551" x2="1050" y2="551" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
        <line x1="1220" y1="670" x2="1220" y2="950" stroke="#1d2023" strokeWidth="3" strokeDasharray="14 8" />
      </svg>
    </div>
  );
}