export default function PageBackground() {
  const ribbonPath = "M 1780 -60 L 1500 200 L 1660 400 L 1440 610 L 1720 960";
  const accentPath = "M 1500 200 L 1660 400 L 1440 610";

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
          <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d0e10" />
            <stop offset="45%" stopColor="#08090a" />
            <stop offset="75%" stopColor="#0a0b0d" />
            <stop offset="100%" stopColor="#0f1012" />
          </linearGradient>
          <filter id="bgGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>
        </defs>

        <path d={ribbonPath} stroke="url(#ribbonGradient)" strokeWidth="120" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />

        <path d={accentPath} stroke="#8e44ad" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" transform="translate(-22 32)" />

        <path d={ribbonPath} stroke="#000000" strokeWidth="120" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#bgGrain)" opacity="0.05" style={{ mixBlendMode: 'overlay' }} />
      </svg>
    </div>
  );
}