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

  // Smooth Simplex-style Perlin Noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Broad fluid domain-warping for sweeping marble curves
  float heightAt(vec2 p) {
    vec2 q = vec2(snoise(p * 0.85), snoise(p * 0.85 + vec2(5.2, 1.3)));
    vec2 r = vec2(snoise(p + 1.8 * q + vec2(1.7, 9.2)), snoise(p + 1.8 * q + vec2(8.3, 2.8)));
    return snoise(p + 2.2 * r);
  }

  void main() {
    vec2 st = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) + 0.5;

    // Height field and partial derivatives for dynamic surface slope
    float h = heightAt(st * 1.8);
    vec2 e = vec2(0.003, 0.0);
    float dhx = (heightAt((st + e.xy) * 1.8) - heightAt((st - e.xy) * 1.8)) / (2.0 * e.x);
    float dhy = (heightAt((st + e.yx) * 1.8) - heightAt((st - e.yx) * 1.8)) / (2.0 * e.x);
    float slope = length(vec2(dhx, dhy));

    // Contour isoline frequency
    float freq = 11.0;
    float val = h * freq;
    float wave = abs(fract(val) - 0.5) * 2.0;

    // Variable line thickness based on local height slope (matches reference swell)
    float lineThickness = mix(0.12, 0.45, smoothstep(0.2, 1.8, slope));
    float line = 1.0 - smoothstep(lineThickness - 0.08, lineThickness + 0.08, wave);

    // Light direction (top-left studio light)
    vec2 lightDir = normalize(vec2(-0.6, 0.8));
    float specular = max(0.0, dot(normalize(vec2(dhx, dhy)), lightDir));

    // Metallic foil palette matching the silver reference
    vec3 matteGrey = vec3(0.68, 0.70, 0.72);
    vec3 darkSteel = vec3(0.25, 0.27, 0.30);
    vec3 brightChrome = vec3(0.98, 0.99, 1.0);

    // Base background tone with soft gradient
    vec3 color = mix(vec3(0.60, 0.62, 0.65), vec3(0.78, 0.80, 0.83), st.y);

    // Apply fluid ribbon lines with chrome highlights and dark shadow edges
    vec3 ribbonColor = mix(darkSteel, brightChrome, pow(specular, 2.0) * 0.85);
    color = mix(color, ribbonColor, line);

    // Hotspot specular highlights on peak curve edges
    float glint = pow(specular, 6.0) * line;
    color += brightChrome * glint * 0.6;

    // Subtle corner vignette
    float vignette = smoothstep(1.2, 0.2, length(vUv - 0.5));
    color = mix(color * 0.88, color, vignette);

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