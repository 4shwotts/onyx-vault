import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Builds the actual bipyramid geometry once (not on every render): two
// low-poly cones (4 radial segments, so the sides read as flat faceted
// planes rather than a smooth cone) joined base-to-base, rotated 45°
// so the square cross-section reads as a diamond outline matching the
// original flat mark.
function GemMesh() {
  const groupRef = useRef();

  const { topGeometry, bottomGeometry } = useMemo(() => {
    const topCone = new THREE.ConeGeometry(1.1, 1.3, 4, 1);
    const bottomCone = new THREE.ConeGeometry(1.1, 1.3, 4, 1);
    bottomCone.rotateX(Math.PI);
    bottomCone.translate(0, -1.3, 0);
    topCone.rotateY(Math.PI / 4);
    bottomCone.rotateY(Math.PI / 4);
    return { topGeometry: topCone, bottomGeometry: bottomCone };
  }, []);

  // Real full 360° rotation, driven every frame — this is genuine
  // geometry turning in 3D space, not a flat image faking depth, so
  // there's no edge-on disappearing point anywhere in the cycle.
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.012;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={topGeometry} position={[0, 0.65, 0]}>
        <meshStandardMaterial color="#9a9ea3" metalness={0.85} roughness={0.22} flatShading />
      </mesh>
      <mesh geometry={bottomGeometry} position={[0, 0.65, 0]}>
        <meshStandardMaterial color="#9a9ea3" metalness={0.85} roughness={0.22} flatShading />
      </mesh>
    </group>
  );
}

// Three-point lighting so adjacent facets genuinely shade differently
// as the mesh turns: a strong key light, a softer fill from the
// opposite side, and a subtle purple rim light tying it back to the
// app's accent color, plus low ambient so no facet ever goes fully
// black. This is real per-pixel lighting computed by the GPU, the
// thing no flat-image/CSS-mask approach could produce.
export default function SpinningGem({ size = 36 }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[-3, 2, 4]} intensity={1.6} />
        <directionalLight position={[3, -1, 2]} intensity={0.6} />
        <directionalLight position={[0, 3, -4]} intensity={0.5} color="#8e44ad" />
        <GemMesh />
      </Canvas>
    </div>
  );
}