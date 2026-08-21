import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// A genuine WebGL fragment shader rather than layered CSS gradients —
// CSS radial gradients can approximate light/dark banding but can't
// produce real procedural roughness or a moving specular response,
// which is what actually reads as "rendered metal" rather than "grey
// gradient". Uses Three.js, already a dependency here via SpinningGem.
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
  uniform float uTime;
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

  // Fewer octaves (5 -> 3) — each extra octave adds finer, busier
  // detail, and the previous version had too much of it.
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

  // Scale dropped substantially (2.2 -> 0.5) so features are much
  // larger — a handful of broad folds across the whole screen, not
  // dozens of small ripples. Warp strength also cut (1.8 -> 0.6) so
  // the folds stay large and readable rather than getting chopped up
  // into chaotic camo-like detail.
  float heightAt(vec2 p) {
    vec2 q = p * 0.5;
    vec2 warp = vec2(
      fbm(q + uTime * 0.012),
      fbm(q + vec2(5.2, 1.3) - uTime * 0.01)
    );
    float h = fbm(q + warp * 0.6);
    return h - 0.5;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float epsN = 0.004;
    float hC = heightAt(uv);
    float hX = heightAt(uv + vec2(epsN, 0.0));
    float hY = heightAt(uv + vec2(0.0, epsN));
    vec3 normal = normalize(vec3(-(hX - hC) / epsN * 4.5, -(hY - hC) / epsN * 4.5, 1.0));

    vec3 lightDir = normalize(vec3(0.7, 0.35, 0.35));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float diff = max(dot(normal, lightDir), 0.0);
    float spec = pow(max(dot(normal, halfDir), 0.0), 18.0);

    float tone = clamp(0.22 + diff * 0.5 + spec * 0.8, 0.0, 1.0);

    vec3 shadowColor = vec3(0.14, 0.15, 0.17);
    vec3 highColor = vec3(0.96, 0.97, 0.98);
    vec3 base = mix(shadowColor, highColor, tone);

    float grain = noise(uv * vec2(1100.0, 70.0)) * 0.6 + noise(uv * vec2(160.0, 900.0)) * 0.4;
    base += (grain - 0.5) * 0.02;

    float vignette = 1.0 - length(aspectUv - 0.5) * 0.28;
    base *= vignette;

    gl_FragColor = vec4(base, 1.0);
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
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
    };

    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId;
    const clock = new THREE.Clock();

    function animate() {
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="page-background" />;
}