import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Static fingerprint-style contour lines. Two fixes from annotations
// on this base:
//
// 1. Centre focal point ramped: ring frequency starts calm right at
//    the focal point and increases with radius, widened and lowered
//    significantly from the first attempt — that one was real but
//    confined to too small an area to actually be visible.
//
// 2. Vignette removed entirely — the previous softened version was
//    still only a 5-10% brightness difference, not enough to read as
//    "the pattern reaches further" toward the edges.
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

    // Ring frequency ramps from calm near the centre to full density
    // further out. Widened and lowered substantially from the first
    // attempt (0.3 radius / 2.0 start -> 0.55 radius / 0.6 start) —
    // that version's effect was real but confined to too small an
    // area to actually notice.
    float ringFreq = mix(0.6, 5.2, smoothstep(0.0, 0.55, radius));
    return sin(angle * 2.0 + radius * ringFreq);
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