import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Facets come from a Voronoi cell field — each cell's offset-to-center
// vector doubles as a rough surface normal, so neighboring cells tilt
// differently and catch light differently, the way real cut facets do.
// The light direction sweeps across via uTime. Red/green/blue specular
// terms are computed against three slightly different light angles,
// which is what actually produces a moving color fringe rather than a
// painted-on gradient.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec3 voronoi(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float minDist = 8.0;
  vec2 minOffset = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(ip + neighbor);
      vec2 diff = neighbor + point - fp;
      float dist = length(diff);
      if (dist < minDist) {
        minDist = dist;
        minOffset = diff;
      }
    }
  }
  return vec3(minOffset, minDist);
}

void main() {
  vec2 uv = vUv;
  vec2 aspectUv = vec2(uv.x * uResolution.x / uResolution.y, uv.y);
  vec2 p = aspectUv * 7.0;

  vec3 vor = voronoi(p);
  vec2 cellOffset = vor.xy;
  float edgeDist = vor.z;

  vec3 normal = normalize(vec3(cellOffset * 1.5, 1.0));

  float sweepX = mod(uTime * 0.55, 4.6) - 1.8;
  vec3 lightDir = normalize(vec3(sweepX - aspectUv.x * 2.2, 0.35, 0.85));

  vec3 lightDirR = normalize(lightDir + vec3(0.05, 0.0, 0.0));
  vec3 lightDirB = normalize(lightDir - vec3(0.05, 0.0, 0.0));

  float diff = max(dot(normal, lightDir), 0.0);
  float specR = pow(max(dot(normal, lightDirR), 0.0), 20.0);
  float specG = pow(diff, 24.0);
  float specB = pow(max(dot(normal, lightDirB), 0.0), 20.0);

  vec3 baseColor = vec3(0.72, 0.52, 0.95);
  vec3 col = baseColor * diff * 0.45;
  col += vec3(specR, specG, specB) * 2.0;

  float edge = smoothstep(0.0, 0.05, edgeDist);
  col *= mix(0.5, 1.0, edge);

  float alpha = clamp(diff * 0.35 + (specR + specG + specB) * 0.55, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`;

export default function CrystalShine() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    function compile(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'uTime');
    const uResolution = gl.getUniformLocation(program, 'uResolution');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let raf;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, canvas.clientWidth * dpr);
      const h = Math.max(1, canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function render(t) {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', mixBlendMode: 'screen',
      }}
    />
  );
}