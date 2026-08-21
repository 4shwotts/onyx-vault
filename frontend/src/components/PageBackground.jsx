import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Complete change of technique: dense flowing contour lines (like a
// topographic map or fingerprint), static, no animation. This reuses
// the same height-field idea from the liquid-metal attempts, but
// instead of lighting the surface, it draws thin lines at regular
// intervals of the height value — the standard "isoline" rendering
// technique, which is what actually produces this look. A spiral/
// polar domain warp around an off-centre point gives the whorled
// fingerprint structure rather than straight or simple radial bands.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      value += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  // Static height field — no time term anywhere.
  float heightAt(vec2 p) {
    vec2 center = vec2(0.38, 0.32);
    vec2 d = p - center;

    // Extra density on the left is now done by amplifying the SAME
    // domain warp there, not by adding a second independent wave
    // layer on top. Summing two differently-phased fields (the
    // previous approach) creates sharp seam/crease artifacts exactly
    // where they clash — that's the "torn" look from last time.
    // Warping one coherent field's coordinates more strongly in one
    // region avoids that entirely, since there's only ever one field.
    float leftMask = smoothstep(0.65, 0.0, p.x);
    vec2 warp = vec2(fbm(p * 1.8), fbm(p * 1.8 + vec2(4.2, 1.7))) - 0.5;
    d += warp * (0.4 + leftMask * 0.5);

    float angle = atan(d.y, d.x);
    float radius = length(d);

    // Soften the true singularity at radius 0 (angle is meaningless
    // there) by fading the angular term in gradually with radius,
    // rather than using it at full strength right at the vortex —
    // keeps the very centre as smooth soft rings, not an infinitely
    // dense pinch.
    float angleWeight = smoothstep(0.0, 0.18, radius);
    return sin(angle * 2.0 * angleWeight + radius * 5.2);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float h = heightAt(aspectUv);

    // Isoline rendering: draw a thin line wherever h crosses one of a
    // regular series of thresholds. fwidth() gives the on-screen rate
    // of change of h, which is what keeps the lines a consistent
    // pixel width (anti-aliased) regardless of how steep the
    // underlying field is at that point.
    float freq = 13.0;
    float v = h * freq;
    float f = abs(fract(v) - 0.5) * 2.0;
    float aa = fwidth(v) * 1.5 + 0.01;
    float line = 1.0 - smoothstep(0.0, aa, f);

    // Base is a light neutral grey; lines vary between soft grey and
    // near-white depending on the underlying height, so not every
    // line reads identically bright — matching the reference's mix
    // of bright and muted lines rather than one flat line colour.
    vec3 baseColor = vec3(0.80, 0.81, 0.82);
    float lineBrightness = 0.55 + 0.45 * (h * 0.5 + 0.5);
    vec3 lineColor = mix(vec3(0.55, 0.56, 0.57), vec3(0.99, 0.99, 1.0), lineBrightness);

    vec3 color = mix(baseColor, lineColor, line);

    float vignette = 1.0 - length(aspectUv - 0.5) * 0.2;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function PageBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const uniforms = {
      uResolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
    };

    // extensions.derivatives enables fwidth() — needed for the
    // anti-aliased contour lines above, and not guaranteed available
    // by default on every WebGL1 context (WebGL2 has it natively, but
    // this makes sure it works either way).
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      extensions: { derivatives: true },
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Static image — render once, no animation loop needed.
    renderer.render(scene, camera);

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
      renderer.render(scene, camera);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="page-background" />;
}