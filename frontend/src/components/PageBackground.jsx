import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
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

    vec3 base = vec3(0.83, 0.84, 0.85);

    float grain = noise(uv * vec2(1100.0, 70.0)) * 0.6 + noise(uv * vec2(160.0, 900.0)) * 0.4;
    base += (grain - 0.5) * 0.045;

    float band1 = smoothstep(0.0, 1.0, 1.0 - abs(uv.x - 0.12) * 3.2);
    float band2 = smoothstep(0.0, 1.0, 1.0 - abs(uv.x - 0.48) * 3.2);
    float band3 = smoothstep(0.0, 1.0, 1.0 - abs(uv.x - 0.86) * 3.2);
    base += band1 * 0.11 + band2 * 0.08 + band3 * 0.11;

    float sweepPos = mod(uTime * 0.025, 1.8) - 0.4;
    float sweep = smoothstep(0.0, 1.0, 1.0 - abs((uv.x + uv.y * 0.35) - sweepPos) * 5.5);
    base += sweep * 0.07;

    float vignette = 1.0 - length(aspectUv - 0.5) * 0.32;
    base *= vignette;

    vec3 normal = normalize(vNormal);
    vec3 keyDir = normalize(vec3(-0.5, 0.4, 0.8));
    vec3 fillDir = normalize(vec3(0.6, -0.3, 0.6));
    float diffKey = max(dot(normal, keyDir), 0.0);
    float diffFill = max(dot(normal, fillDir), 0.0) * 0.35;
    float lighting = 0.55 + diffKey * 0.65 + diffFill * 0.3;

    base *= lighting;

    gl_FragColor = vec4(clamp(base, 0.0, 1.0), 1.0);
  }
`;

function buildFacetedPlane(width, height, segX, segY, jitterAmt, bumpAmt) {
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
  const posAttr = geometry.attributes.position;
  const cellW = width / segX;
  const cellH = height / segY;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const onEdgeX = Math.abs(x) > width / 2 - 1e-4;
    const onEdgeY = Math.abs(y) > height / 2 - 1e-4;
    const jx = onEdgeX ? 0 : (Math.random() - 0.5) * cellW * jitterAmt;
    const jy = onEdgeY ? 0 : (Math.random() - 0.5) * cellH * jitterAmt;
    const jz = (Math.random() - 0.5) * bumpAmt;
    posAttr.setXYZ(i, x + jx, y + jy, jz);
  }

  const nonIndexed = geometry.toNonIndexed();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

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

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    });

    const geometry = buildFacetedPlane(2, 2, 9, 6, 0.4, 0.32);
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