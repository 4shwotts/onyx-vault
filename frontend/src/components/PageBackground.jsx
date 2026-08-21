import { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

  // Ultra-smooth 2D value noise (avoids high-frequency grain)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Fluid organic height displacement (swirling liquid marble)
  float heightAt(vec2 p) {
    // Primary fluid swirl vectors
    vec2 q = vec2(
      smoothNoise(p * 0.75 + vec2(0.0, 0.0)),
      smoothNoise(p * 0.75 + vec2(5.2, 1.3))
    );

    // Secondary warp pass to create randomized bends and ripples
    vec2 r = vec2(
      smoothNoise(p + 1.4 * q + vec2(1.7, 9.2)),
      smoothNoise(p + 1.4 * q + vec2(8.3, 2.8))
    );

    return smoothNoise(p + 1.8 * r);
  }

  void main() {
    vec2 st = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) + 0.5;

    // Sample randomized fluid height
    float h = heightAt(st * 1.5);

    // Dynamic frequency for isoline bands
    float freq = 16.0;
    float val = h * freq;

    // Calculate derivative for smooth anti-aliased line rendering
    float f = abs(fract(val) - 0.5) * 2.0;
    float df = fwidth(val);
    
    // Dynamic line width matching liquid chrome thickness variations
    float lineWidth = mix(0.15, 0.35, smoothNoise(st * 3.0));
    float line = 1.0 - smoothstep(0.0, df * 2.0 + lineWidth, f);

    // Silver metallic palette
    vec3 baseBg = vec3(0.70, 0.72, 0.74);
    vec3 darkEdge = vec3(0.22, 0.24, 0.27);
    vec3 brightHighlight = vec3(0.98, 0.99, 1.0);

    // Subtle edge shading across individual ribbon bands
    float bandGradient = smoothstep(0.0, 0.6, fract(val));
    vec3 lineColor = mix(darkEdge, brightHighlight, bandGradient);

    // Blend base plate with metallic swirl lines
    vec3 color = mix(baseBg, lineColor, line * 0.82);

    // Edge vignette
    float vignette = 1.0 - length(vUv - 0.5) * 0.18;
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
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="page-background" />;
}