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

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

    // Base metal tone.
    vec3 base = vec3(0.83, 0.84, 0.85);

    // Brushed-metal roughness: fine directional grain, horizontal
    // strokes dominant (like a brushed aluminium sheet).
    float grain = noise(uv * vec2(1100.0, 70.0)) * 0.6 + noise(uv * vec2(160.0, 900.0)) * 0.4;
    base += (grain - 0.5) * 0.045;

    // Soft background light-catch bands — kept subtle, just ambient
    // variation underneath the glossy swooshes below.
    float band1 = smoothstep(0.0, 1.0, 1.0 - abs(uv.x - 0.12) * 3.2);
    float band3 = smoothstep(0.0, 1.0, 1.0 - abs(uv.x - 0.86) * 3.2);
    base += band1 * 0.05 + band3 * 0.05;

    // Glossy liquid-chrome swooshes: curved (sine-path) specular
    // highlights, not straight bands — this is what actually reads as
    // liquid/fluid rather than plain brushed metal. Each follows a
    // curved path across the surface and drifts slowly over time.
    float curve1 = 0.42 + 0.16 * sin(uv.x * 2.6 + uTime * 0.12) + sin(uTime * 0.05) * 0.05;
    float dist1 = abs(uv.y - curve1);
    float swoosh1 = smoothstep(0.05, 0.0, dist1);
    base += swoosh1 * 0.32;

    float curve2 = 0.62 + 0.12 * sin(uv.x * 3.4 - uTime * 0.09 + 2.0) - sin(uTime * 0.04) * 0.06;
    float dist2 = abs(uv.y - curve2);
    float swoosh2 = smoothstep(0.035, 0.0, dist2);
    base += swoosh2 * 0.22;

    // A third, thinner, faster-moving glint for extra liquidity.
    float curve3 = 0.25 + 0.1 * sin(uv.x * 4.5 + uTime * 0.22);
    float dist3 = abs(uv.y - curve3);
    float swoosh3 = smoothstep(0.018, 0.0, dist3);
    base += swoosh3 * 0.16;

    // Gentle vignette for a slightly domed, dimensional read rather
    // than a flat sheet.
    float vignette = 1.0 - length(aspectUv - 0.5) * 0.32;
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