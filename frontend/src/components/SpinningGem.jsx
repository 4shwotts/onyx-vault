import { useState } from 'react';

// Flat fallback if OnyxGem.svg fails to load.
function OnyxMark({ size = 32, lineColor = '#101112', offsetColor = 'rgba(255,255,255,0.6)' }) {
  const gemPath = 'M12 3 L22 9 L12 21 L2 9 Z';
  const facetLine = 'M2 9 L22 9';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <g transform="translate(0.6,0.8)">
        <path d={gemPath} stroke={offsetColor} strokeWidth="2" strokeLinejoin="round" />
        <path d={facetLine} stroke={offsetColor} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <path d={gemPath} stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      <path d={facetLine} stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// A single etched OnyxGem mask that oscillates through a partial arc
// (not a full 360° spin) via rotateY, with a shine pass timed to peak
// at the steepest point of the turn. A flat plane spun through a full
// rotation goes edge-on and vanishes at 90°, and layering multiple
// copies to fake volume (a six-face "drum") turned into visual noise
// at this icon size — both were the wrong technique for something this
// small. Swinging back and forth within a range that never reaches
// true edge-on stays legible throughout while still reading as
// "turning to catch the light."
export default function SpinningGem({ size = 36 }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <OnyxMark size={size} />;
  }

  return (
    <div
      className="gem-spin-wrap"
      style={{ width: size, height: size, '--gem-mask': "url('/icons/OnyxGem.svg')" }}
    >
      <img
        src="/icons/OnyxGem.svg"
        alt=""
        onError={() => setFailed(true)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <div className="gem-swing-inner">
        <div className="gem-mask-layer gem-mask-back" />
        <div className="gem-mask-layer gem-mask-front" />
        <div className="gem-mask-layer gem-shine" />
      </div>
    </div>
  );
}