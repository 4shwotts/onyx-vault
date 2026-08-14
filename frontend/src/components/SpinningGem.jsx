import { useState } from 'react';

// Flat fallback if OnyxGem.svg fails to load — same two-tone etched
// look as the 3D version below, just static.
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

const FACE_COUNT = 6;
const FACE_ANGLE = 360 / FACE_COUNT;

// Arranges six copies of the same etched OnyxGem mask around a small
// hexagonal drum (each face pushed outward via translateZ at a fixed
// rotateY offset), rather than spinning a single flat plane. A flat
// plane goes edge-on and disappears at 90° — real physics for a flat
// card, wrong for something meant to read as a solid faceted object.
// With six faces spaced 60° apart, there's always at least one face
// turned enough toward the viewer to stay visible through the whole
// rotation, giving a genuine sense of volume with pure CSS.
export default function SpinningGem({ size = 36 }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <OnyxMark size={size} />;
  }

  const radius = size * 0.32;

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
      <div className="gem-spin-inner">
        {Array.from({ length: FACE_COUNT }).map((_, i) => (
          <div
            key={i}
            className="gem-face"
            style={{ transform: `rotateY(${i * FACE_ANGLE}deg) translateZ(${radius}px)` }}
          >
            <div className="gem-mask-layer gem-mask-back" />
            <div className="gem-mask-layer gem-mask-front" />
          </div>
        ))}
        <div className="gem-mask-layer gem-shine" />
      </div>
    </div>
  );
}