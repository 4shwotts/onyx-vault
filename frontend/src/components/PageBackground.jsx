import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function PageBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false, // Performance boost to prevent GPU context loss
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      console.warn('WebGL not supported or context lost on init:', e);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Optimized High-Gloss Liquid Chrome Shader (Lighter on GPU memory)
    const fragmentShader = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;

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

      float map(vec2 st) {
        float d = snoise(st * 1.1) * 0.5;
        float edge = smoothstep(0.2, 1.2, st.x + (1.0 - st.y));
        return mix(d, sin(st.x * 2.5 + st.y * 1.8) * 0.7, edge);
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;

        vec2 e = vec2(0.008, 0.0);
        vec3 normal = normalize(vec3(
          map(st + e.xy) - map(st - e.xy),
          map(st + e.yx) - map(st - e.yx),
          0.02
        ));

        vec3 lightDir = normalize(vec3(0.5, 0.7, 1.0));
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 reflDir = reflect(-lightDir, normal);

        float spec1 = pow(max(dot(reflDir, viewDir), 0.0), 24.0);
        float spec2 = pow(max(dot(reflDir, viewDir), 0.0), 3.0);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);

        vec3 darkGrey = vec3(0.06, 0.07, 0.09);
        vec3 midSilver = vec3(0.42, 0.45, 0.50);
        vec3 brightChrome = vec3(0.95, 0.98, 1.0);

        vec3 col = mix(darkGrey, midSilver, smoothstep(-0.25, 0.25, normal.x + normal.y));
        col = mix(col, brightChrome, spec1 * 1.1);
        col += vec3(0.8) * spec2 * 0.25;
        col += brightChrome * fresnel * 0.5;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const uniforms = {
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_time: { value: 0 }
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Prevent GPU Context Loss crashes
    const handleContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(animationFrameId);
    };

    const handleContextRestored = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      render(0);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    let animationFrameId;
    const render = (time) => {
      uniforms.u_time.value = time * 0.0003;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };
    render(0);

    const handleResize = () => {
      if (!renderer) return;
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      cancelAnimationFrame(animationFrameId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        backgroundColor: '#0d0e10'
      }}
    />
  );
}