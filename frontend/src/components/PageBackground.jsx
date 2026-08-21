import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Complete change of technique: dense flowing contour lines (like a
// topographic map or fingerprint), static, no animation. This reuses
// the same height-field idea from the liquid-metal attempts, but
// instead of lighting the surface, it draws thin lines at regular
// intervals of the height value — the standard "isoline" rendering
// technique, which is what actually produces this look.
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

    vec2 warp1 = vec2(fbm(p * 1.1), fbm(p * 1.1 + vec2(4.2, 1.7))) - 0.5;
    vec2 pw = p + warp1 * 0.5;
    vec2 warp2 = vec2(fbm(pw * 2.3 + 5.0), fbm(pw * 2.3 - 3.0)) - 0.5;
    pw += warp2 * 0.22;

    vec2 d = pw - center;
    float radius = length(d);
    float angle = atan(d.y, d.x);

    // atan() has a hard discontinuity — it jumps from +pi to -pi
    // along one ray from the centre. The previous version multiplied
    // that jump by a radius-dependent weight (meant to soften the
    // centre), but a *varying* jump size breaks the clean wraparound
    // a spiral needs, producing a whole cluster of nearby broken
    // seams rather than one clean line — that's the jagged crack in
    // the screenshot. Using a constant, gentle coefficient here keeps
    // the field a proper uniform spiral: at most one thin, barely
    // noticeable seam, not a mess of them.
    return radius * 3.0 + angle * 0.12;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float h = heightAt(aspectUv);

    float freq = 22.0;
    float v = h * freq;
    float f = abs(fract(v) - 0.5) * 2.0;
    float aa = fwidth(v) * 1.5 + 0.01;
    float line = 1.0 - smoothstep(0.0, aa, f);

    vec3 baseColor = vec3(0.80, 0.81, 0.82);
    float lineBrightness = 0.45 + 0.55 * fract(h * 1.7);
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

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      extensions: { derivatives: true },
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

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