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

  // Ultra-smooth low-frequency ripple displacement
  float heightAt(vec2 p) {
    // Large, gentle sine waves running diagonally
    float wave1 = sin(p.x * 2.5 + p.y * 2.0);
    float wave2 = cos(p.x * 1.8 - p.y * 2.2);
    
    // Broad warp to bend lines into smooth liquid ribbons
    vec2 warp = vec2(wave1, wave2) * 0.35;
    vec2 pw = p + warp;

    return sin(pw.x * 3.2 + pw.y * 2.8) * 0.5 + 0.5;
  }

  void main() {
    vec2 st = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) + 0.5;

    // Sample height field
    float h = heightAt(st * 1.2);

    // Low frequency isoline rings (keeps lines spaced out and clear)
    float freq = 14.0;
    float val = h * freq;
    
    // Smooth, anti-aliased line rendering
    float f = abs(fract(val) - 0.5) * 2.0;
    float df = fwidth(val);
    float line = 1.0 - smoothstep(0.0, df * 1.8 + 0.08, f);

    // Liquid chrome metallic palette matching reference image
    vec3 baseBg = vec3(0.72, 0.74, 0.76);
    vec3 darkShadow = vec3(0.20, 0.22, 0.25);
    vec3 brightHighlight = vec3(0.98, 0.99, 1.0);

    // Subtle lighting gradient across lines
    float shadowMask = smoothstep(0.0, 0.5, fract(val));
    vec3 lineColor = mix(darkShadow, brightHighlight, shadowMask);

    // Blend base background with metallic ripples
    vec3 color = mix(baseBg, lineColor, line * 0.85);

    // Soft, clean lighting vignette
    float vignette = 1.0 - length(vUv - 0.5) * 0.15;
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