import { useMemo } from 'react';

const SIZE_DEFAULT = 36;

// Geometry for a square bipyramid (8 triangular faces: 4 upper meeting
// at a top apex, 4 lower meeting at a bottom apex, sharing a square
// "equator") — an actual 3D solid rather than a flat image, so it can
// rotate a full 360° and look solid instead of going edge-on/invisible.
//   H     = apex height above/below the equator
//   B     = base edge length of the equator square
//   r     = apothem (distance from center axis to the middle of a base edge)
//   L     = slant height of each triangular face
//   theta = angle each face tilts inward from vertical so its apex
//           converges on the central axis (derived from L·sinθ = r)
function computeGeometry(size) {
  const H = size * 0.5;
  const B = size * 0.66;
  const r = B / 2;
  const L = Math.sqrt(H * H + r * r);
  const theta = Math.atan2(r, H) * (180 / Math.PI);
  return { B, r, L, theta };
}

const ANGLES = [0, 90, 180, 270];
const LIGHT_ANGLE = -35; // degrees — a fixed light source roughly front-left

// Flat-shades each face by how directly it faces the fixed light
// source, so adjacent faces read as distinct planes catching light
// differently. Kept within the same metallic grey band the rest of
// the chrome UI uses (roughly 30–65% lightness) rather than swinging
// to near-black/near-white, which read as a jarring flip rather than
// a metal surface catching light.
function shadeFor(angle, baseLightness) {
  const rad = (angle - LIGHT_ANGLE) * (Math.PI / 180);
  const b = 0.5 + 0.5 * Math.cos(rad);
  const lightness = baseLightness + b * (62 - baseLightness);
  return `hsl(220, 5%, ${lightness}%)`;
}

export default function SpinningGem({ size = SIZE_DEFAULT }) {
  const { B, r, L, theta } = useMemo(() => computeGeometry(size), [size]);

  return (
    <div className="gem-solid-wrap" style={{ width: size, height: size }}>
      <div className="gem-solid-inner">
        {ANGLES.map((angle) => (
          <div
            key={`t-${angle}`}
            className="gem-face-top"
            style={{
              width: B,
              height: L,
              marginLeft: -B / 2,
              marginTop: -L,
              background: shadeFor(angle, 32),
              // Reading right-to-left: rotateX tilts the face inward
              // first, translateZ pushes it out to the equator radius,
              // then rotateY places it at its compass position.
              transform: `rotateY(${angle}deg) translateZ(${r}px) rotateX(${theta}deg)`,
            }}
          />
        ))}
        {ANGLES.map((angle) => (
          <div
            key={`b-${angle}`}
            className="gem-face-bottom"
            style={{
              width: B,
              height: L,
              marginLeft: -B / 2,
              marginTop: 0,
              background: shadeFor(angle, 24),
              // Mirrors the top face's tilt (negative theta) so the
              // apex converges downward instead of upward. If the
              // solid renders inverted or collapsed, this is the sign
              // to flip first.
              transform: `rotateY(${angle}deg) translateZ(${r}px) rotateX(${-theta}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}