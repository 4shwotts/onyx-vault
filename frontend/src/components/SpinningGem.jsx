import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Builds the actual bipyramid geometry once (not on every render): two
// low-poly cones (4 radial segments, so the sides read as flat faceted
// planes rather than a smooth cone) joined base-to-base, rotated 45°
// so the square cross-section reads as a diamond outline matching the
// original flat mark. Sized slightly larger than before so it fills
// more of its bounding box at small icon sizes.
function GemMesh() {
  const groupRef = useRef();

  const { topGeometry, bottomGeometry } = useMemo(() => {
    const topCone = new THREE.ConeGeometry(1.25, 1.55, 4, 1);
    const bottomCone = new THREE.ConeGeometry(1.25, 1.55, 4, 1);
    bottomCone.rotateX(Math.PI);
    bottomCone.translate(0, -1.55, 0);
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
      <mesh geometry={topGeometry} position={[0, 0.775, 0]}>
        <meshStandardMaterial color="#aaaeb3" metalness={0.8} roughness={0.25} flatShading />
      </mesh>
      <mesh geometry={bottomGeometry} position={[0, 0.775, 0]}>
        <meshStandardMaterial color="#aaaeb3" metalness={0.8} roughness={0.25} flatShading />
      </mesh>
    </group>
  );
}

// Lighting rebalanced from the previous pass: that version dropped
// ambient/fill so low that shadowed faces went nearly black and merged
// visually into the background, leaving only a couple of thin lit
// edges visible (which is why it read as a tiny plus-sign rather than
// a solid diamond). A hemisphere light adds soft, direction-independent
// fill (sky tone above, ground tone below) so every face stays legible
// as a distinct grey, while the key light still stays strong enough
// that lit vs shadowed facets clearly contrast against each other.
export default function SpinningGem({ size = 36 }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 0, 4.3], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <hemisphereLight skyColor="#e8e9eb" groundColor="#3a3a3d" intensity={0.55} />
        <ambientLight intensity={0.22} />
        <directionalLight position={[-3, 2, 4]} intensity={1.9} />
        <directionalLight position={[3, -1, 2]} intensity={0.4} />
        <directionalLight position={[0, 3, -4]} intensity={0.35} color="#8e44ad" />
        <GemMesh />
      </Canvas>
    </div>
  );
}