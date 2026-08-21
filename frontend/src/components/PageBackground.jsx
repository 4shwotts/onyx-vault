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

  // Fewer octaves, used only for subtle organic irregularity now
  // rather than the main shape.
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

  // Back to a few large, controlled sine waves as the main shape —
  // predictable, big, few folds — with a small amount of fbm layered
  // on top just for organic irregularity, not as the primary
  // structure. Pure fbm at any scale kept either flattening out
  // (too subtle) or fragmenting into many small folds (too busy);
  // controlled large curves give reliable, big, few folds instead.
  float heightAt(vec2 p) {
    float h = 0.0;
    h += sin(p.x * 2.6 + p.y * 0.6 + uTime * 0.05) * 0.55;
    h += sin(p.x * 4.1 - p.y * 0.9 + uTime * 0.035 + 1.3) * 0.3;
    h += (fbm(p * 1.3 + uTime * 0.02) - 0.5) * 0.12;
    return h;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float epsN = 0.003;
    float hC = heightAt(uv);
    float hX = heightAt(uv + vec2(epsN, 0.0));
    float hY = heightAt(uv + vec2(0.0, epsN));
    vec3 normal = normalize(vec3(-(hX - hC) / epsN * 2.4, -(hY - hC) / epsN * 2.4, 1.0));

    vec3 lightDir = normalize(vec3(0.55, 0.4, 0.5));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);

    // Soft, broad diffuse gradient for the body of each wave — this
    // is what stays smooth and grey across most of the surface.
    float diff = dot(normal, lightDir);
    float toneBase = 0.58 + diff * 0.3;

    // Sharp, tight paired lines right at the curve edges: a bright
    // specular line where the surface catches the light straight on,
    // and a dark "anti-specular" line immediately next to it where
    // the surface has just tipped past that angle. That paired
    // thin bright/dark line — not a broad glow — is the actual
    // signature of the reference, and needs a much higher specular
    // power (60 here vs 18-26 before) to stay thin rather than
    // spreading out.
    float spec = pow(max(dot(normal, halfDir), 0.0), 100.0);
    float antiSpec = pow(max(dot(-normal, halfDir), 0.0), 100.0);

    float tone = clamp(toneBase + spec * 0.85 - antiSpec * 0.45, 0.0, 1.0);

    vec3 shadowColor = vec3(0.15, 0.16, 0.18);
    vec3 highColor = vec3(0.97, 0.98, 0.99);
    vec3 base = mix(shadowColor, highColor, tone);

    float grain = noise(uv * vec2(1100.0, 70.0)) * 0.6 + noise(uv * vec2(160.0, 900.0)) * 0.4;
    base += (grain - 0.5) * 0.018;

    float vignette = 1.0 - length(aspectUv - 0.5) * 0.25;
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