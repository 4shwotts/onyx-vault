import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Builds the actual bipyramid geometry once (not on every render): two
// low-poly cones (4 radial segments, so the sides read as flat faceted
// planes rather than a smooth cone) joined base-to-base, rotated 45°
// so the square cross-section reads as a diamond outline matching the
// original flat mark.
//
// variant controls shading so the gem stays legible against whichever
// background it sits on: "light" (the chrome nav pill) can afford deep
// shadow facets since the light backdrop keeps them readable; "dark"
// (the near-black login card) needs a brighter base tone plus a touch
// of emissive self-glow, otherwise shadowed facets sink to the same
// near-black as the card itself and the shape disappears.
function GemMesh({ variant }) {
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

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.012;
  });

  const isDark = variant === 'dark';
  const baseColor = isDark ? '#d6d8db' : '#aaaeb3';
  const emissive = isDark ? '#3a3d42' : '#000000';
  const emissiveIntensity = isDark ? 0.5 : 0;

  return (
    <group ref={groupRef}>
      <mesh geometry={topGeometry} position={[0, 0.775, 0]}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.8}
          roughness={0.25}
          flatShading
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <mesh geometry={bottomGeometry} position={[0, 0.775, 0]}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.8}
          roughness={0.25}
          flatShading
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </group>
  );
}

// variant: "light" (default) for use on the chrome nav pill's light
// metal background; "dark" for use on the near-black login card. Both
// use the same geometry/rotation, only material brightness, emissive
// glow, and ambient/hemisphere fill differ, tuned so shadowed facets
// stay visibly lighter than whatever backdrop they sit on.
export default function SpinningGem({ size = 36, variant = 'light' }) {
  const isDark = variant === 'dark';

  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 0, 4.3], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <hemisphereLight
          skyColor={isDark ? '#f5f5f6' : '#e8e9eb'}
          groundColor={isDark ? '#6a6a6e' : '#3a3a3d'}
          intensity={isDark ? 0.75 : 0.55}
        />
        <ambientLight intensity={isDark ? 0.4 : 0.22} />
        <directionalLight position={[-3, 2, 4]} intensity={isDark ? 1.6 : 1.9} />
        <directionalLight position={[3, -1, 2]} intensity={isDark ? 0.55 : 0.4} />
        <directionalLight position={[0, 3, -4]} intensity={0.35} color="#8e44ad" />
        <GemMesh variant={variant} />
      </Canvas>
    </div>
  );
}