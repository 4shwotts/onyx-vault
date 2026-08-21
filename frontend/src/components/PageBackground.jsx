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

  // Height field — frequencies raised significantly so several full
  // fold cycles are actually visible across the screen (the previous
  // values only spanned a fraction of one sine period across the 0-1
  // UV range, which is why it barely showed).
  float heightAt(vec2 p) {
    float h = 0.0;
    h += sin(p.x * 9.0 + uTime * 0.15) * 0.5;
    h += sin(p.x * 14.0 - uTime * 0.1 + 1.7) * 0.28;
    h += sin(p.y * 6.0 + uTime * 0.08 + 0.6) * 0.22;
    return h;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float epsN = 0.0025;
    float hC = heightAt(uv);
    float hX = heightAt(uv + vec2(epsN, 0.0));
    float hY = heightAt(uv + vec2(0.0, epsN));
    // Slope multiplier raised (0.22 -> 1.0) for real, visible tilt.
    vec3 normal = normalize(vec3(-(hX - hC) / epsN * 1.0, -(hY - hC) / epsN * 1.0, 1.0));

    // Light direction now grazing (mostly along x, low z) instead of
    // pointing near-straight at the viewer — that's what makes the
    // specular concentrate only on steep fold ridges rather than
    // lighting up flat areas broadly.
    vec3 lightDir = normalize(vec3(0.75, 0.3, 0.3));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float diff = max(dot(normal, lightDir), 0.0);
    float spec = pow(max(dot(normal, halfDir), 0.0), 26.0);

    // Darker baseline so the folds' contrast actually reads, rather
    // than a bright wash with subtle variation.
    float tone = clamp(0.16 + diff * 0.55 + spec * 0.95, 0.0, 1.0);

    vec3 shadowColor = vec3(0.09, 0.10, 0.12);
    vec3 highColor = vec3(0.97, 0.98, 0.99);
    vec3 base = mix(shadowColor, highColor, tone);

    float grain = noise(uv * vec2(1100.0, 70.0)) * 0.6 + noise(uv * vec2(160.0, 900.0)) * 0.4;
    base += (grain - 0.5) * 0.03;

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