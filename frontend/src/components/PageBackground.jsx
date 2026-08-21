import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Static fingerprint-style contour lines.
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

  // Static height field — no time term anywhere. A spiral around an
  // off-centre focus point, with a bit of fbm-based domain warp so
  // it isn't a perfect mechanical circle.
  float heightAt(vec2 p) {
    vec2 center = vec2(0.38, 0.32);
    vec2 d = p - center;
    vec2 warp = vec2(fbm(p * 1.8), fbm(p * 1.8 + vec2(4.2, 1.7))) - 0.5;
    d += warp * 0.4;
    float angle = atan(d.y, d.x);
    float radius = length(d);

    return sin(angle * 2.0 + radius * 5.2);
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

    // The centre congestion wasn't actually fixed by slowing the
    // radius frequency — the angle term sweeps a full 360 degrees at
    // ANY radius, however small, so tracing even a tiny circle around
    // the focal point still crosses the pattern many times regardless
    // of how "calm" the radius term is made. Fixing that properly
    // means not fighting the math — just fade the lines to nothing
    // within a small radius of the focal point, leaving a clean blank
    // area there instead.
    vec2 focus = vec2(0.38, 0.32);
    float distToFocus = length(aspectUv - focus);
    line *= smoothstep(0.0, 0.14, distToFocus);

    // Two independent, plain concentric-ring sources (no angle term
    // at all, so no seam risk) added on the left and top-right,
    // composited via max() rather than summed into the height field —
    // max() of two separately-rendered line masks can't produce the
    // interference/seam artifacts that summing two height fields did
    // before, since neither pattern's own math is ever touched by
    // the other.
    float distLeft = length(aspectUv - vec2(-0.05, 0.55));
    float vLeft = distLeft * 8.0;
    float fLeft = abs(fract(vLeft) - 0.5) * 2.0;
    float lineLeft = (1.0 - smoothstep(0.0, fwidth(vLeft) * 1.5 + 0.01, fLeft)) * 0.75;

    float distTR = length(aspectUv - vec2(1.55, 0.08));
    float vTR = distTR * 8.0;
    float fTR = abs(fract(vTR) - 0.5) * 2.0;
    float lineTR = (1.0 - smoothstep(0.0, fwidth(vTR) * 1.5 + 0.01, fTR)) * 0.75;

    line = max(line, max(lineLeft, lineTR));

    vec3 baseColor = vec3(0.80, 0.81, 0.82);
    float lineBrightness = 0.55 + 0.45 * (h * 0.5 + 0.5);
    vec3 lineColor = mix(vec3(0.55, 0.56, 0.57), vec3(0.99, 0.99, 1.0), lineBrightness);

    vec3 color = mix(baseColor, lineColor, line);

    // Vignette removed entirely — even the softened 0.08 version was
    // only a 5-10% brightness difference near the edges, not enough
    // to actually read as "the pattern reaches further." No fade now,
    // full pattern strength edge to edge.
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