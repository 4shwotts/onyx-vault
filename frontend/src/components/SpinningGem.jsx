import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

  // Slowed from 0.012 to 0.006 — roughly half the previous speed.
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.006;
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