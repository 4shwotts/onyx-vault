import { useEffect, useState } from 'react';

// Decides whether the animated WebGL extras (the brushed-metal background
// and the spinning gem) should run. They are decoration only, so they are
// skipped — in favour of still CSS/SVG versions — whenever:
// - the browser has no working WebGL (old devices, some locked-down
//   corporate browsers, or WebGL turned off), or
// - the visitor has asked for reduced motion in their system settings.

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let webglSupport;

export function hasWebGL() {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webglSupport = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

export function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// True when the animated WebGL versions should be shown. Re-renders if the
// reduced-motion setting changes while the page is open.
export function useRichGraphics() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (e) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !reduced && hasWebGL();
}

// Test helper: forget the cached WebGL check.
export function resetGraphicsCacheForTests() {
  webglSupport = undefined;
}
