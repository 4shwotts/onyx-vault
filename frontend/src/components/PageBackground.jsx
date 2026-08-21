import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Complete change of technique: dense flowing contour lines (like a
// topographic map or fingerprint), static, no animation.
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

  // Static height field — no time term anywhere. Coefficients opened
  // up for bigger, fewer, more dramatic sweeping shapes.
  float heightAt(vec2 p) {
    vec2 center = vec2(0.38, 0.32);

    vec2 warp1 = vec2(fbm(p * 1.0), fbm(p * 1.0 + vec2(4.2, 1.7))) - 0.5;
    vec2 pw = p + warp1 * 0.8;
    vec2 warp2 = vec2(fbm(pw * 2.1 + 5.0), fbm(pw * 2.1 - 3.0)) - 0.5;
    pw += warp2 * 0.4;

    vec2 d = pw - center;
    float radius = length(d);
    float angle = atan(d.y, d.x);
    return radius * 1.4 + angle * 0.12;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float h = heightAt(aspectUv);

    // Filled marble bands instead of thin isolines: fill grey
    // wherever the fractional band value is below a threshold, white
    // otherwise — that asymmetric threshold (not 0.5/0.5) is what
    // gives more white than grey overall, matching the reference.
    // Thickness naturally varies with the field's local steepness —
    // steep areas produce several close thin bands, flat areas
    // produce one big solid region — with no extra work needed for
    // that variation, it falls straight out of the threshold-fill
    // approach.
    float freq = 9.0;
    float v = h * freq;
    float band = fract(v);
    float aa = fwidth(v) + 0.006;
    float fill = 1.0 - smoothstep(0.32 - aa, 0.32 + aa, band);

    vec3 whiteBg = vec3(0.99, 0.99, 0.995);
    vec3 greyFill = vec3(0.84, 0.85, 0.86);
    vec3 color = mix(whiteBg, greyFill, fill);

    float vignette = 1.0 - length(aspectUv - 0.5) * 0.15;
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