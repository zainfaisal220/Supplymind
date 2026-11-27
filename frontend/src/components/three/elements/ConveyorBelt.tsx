import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const CONVEYOR_FRAME = 0x162032
const BELT_COLOR = 0x060911
const ACCENT_CYAN = 0x06b6d4
const SCANNER_EMERALD = 0x10b981

const PKG_PALETTE = [
  0x0284c7, // vibrant cyber blue
  0x7c3aed, // electric violet
  0x059669, // industrial emerald
  0xd97706, // logistics amber
  0x0891b2, // cyan
  0x475569, // slate tote
]

interface ConveyorBeltProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  length?: number
  width?: number
  speed?: number
  packageCount?: number
  onClick?: () => void
}

export function ConveyorBelt({
  position = [0, 0.6, 0],
  rotation = [0, 0, 0],
  length = 38,
  width = 3.4,
  speed = 4.2,
  packageCount = 14,
  onClick,
}: ConveyorBeltProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const scannerLightRef = useRef<THREE.PointLight>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Generate deterministic parcel characteristics (sizes, offsets)
  const packages = useMemo(() => {
    return Array.from({ length: packageCount }).map((_, i) => ({
      offset: i / packageCount,
      scaleX: 1.25 + (i % 3) * 0.28,
      scaleY: 0.85 + (i % 2) * 0.35,
      scaleZ: 1.25 + (i % 4) * 0.22,
      color: new THREE.Color(PKG_PALETTE[i % PKG_PALETTE.length]),
      wobbleSeed: i * 1.7,
    }))
  }, [packageCount])

  useFrame((state) => {
    if (!instancedMeshRef.current) return

    const t = state.clock.elapsedTime

    for (let i = 0; i < packageCount; i++) {
      const pkg = packages[i]
      // Move continuously from -length/2 to +length/2
      const currentProgress = (pkg.offset + (t * speed) / length) % 1.0
      const x = -length / 2 + currentProgress * length
      const y = 0.55 + pkg.scaleY / 2
      const z = Math.sin(x * 0.1 + pkg.wobbleSeed) * 0.1

      dummy.position.set(x, y, z)
      dummy.scale.set(pkg.scaleX, pkg.scaleY, pkg.scaleZ)
      dummy.rotation.set(0, (i % 2 === 0 ? 0.04 : -0.04), 0)
      dummy.updateMatrix()

      instancedMeshRef.current.setMatrixAt(i, dummy.matrix)
      instancedMeshRef.current.setColorAt(i, pkg.color)
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true
    if (instancedMeshRef.current.instanceColor) {
      instancedMeshRef.current.instanceColor.needsUpdate = true
    }

    // Laser scanner pulse
    if (scannerLightRef.current) {
      scannerLightRef.current.intensity = 2.2 + Math.sin(t * 8) * 0.9
    }
  })

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Heavy Steel Support Legs */}
      {Array.from({ length: Math.floor(length / 7) + 1 }).map((_, idx) => {
        const legX = -length / 2 + idx * 7
        return (
          <group key={`leg-${idx}`} position={[legX, -0.6, 0]}>
            <mesh position={[0, 0.3, -width / 2 + 0.15]} castShadow>
              <boxGeometry args={[0.32, 1.2, 0.32]} />
              <meshStandardMaterial color={CONVEYOR_FRAME} metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.3, width / 2 - 0.15]} castShadow>
              <boxGeometry args={[0.32, 1.2, 0.32]} />
              <meshStandardMaterial color={CONVEYOR_FRAME} metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.32, 0.16, width]} />
              <meshStandardMaterial color={CONVEYOR_FRAME} metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        )
      })}

      {/* Main Extruded Aluminum Conveyor Bed Frame */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.46, width]} />
        <meshStandardMaterial color={CONVEYOR_FRAME} metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Motorized Moving Rubber Belt Surface */}
      <mesh position={[0, 0.46, 0]} receiveShadow>
        <boxGeometry args={[length - 0.2, 0.08, width - 0.45]} />
        <meshStandardMaterial color={BELT_COLOR} roughness={0.9} metalness={0.15} />
      </mesh>

      {/* Side Guard Rails */}
      <mesh position={[0, 0.68, -width / 2 + 0.1]} castShadow>
        <boxGeometry args={[length, 0.38, 0.15]} />
        <meshStandardMaterial color={0x0b1322} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.68, width / 2 - 0.1]} castShadow>
        <boxGeometry args={[length, 0.38, 0.15]} />
        <meshStandardMaterial color={0x0b1322} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Cyber Neon Guide Trim Lines */}
      <mesh position={[0, 0.52, -width / 2 + 0.05]}>
        <boxGeometry args={[length, 0.06, 0.06]} />
        <meshStandardMaterial color={ACCENT_CYAN} emissive={ACCENT_CYAN} emissiveIntensity={3.0} />
      </mesh>
      <mesh position={[0, 0.52, width / 2 - 0.05]}>
        <boxGeometry args={[length, 0.06, 0.06]} />
        <meshStandardMaterial color={ACCENT_CYAN} emissive={ACCENT_CYAN} emissiveIntensity={3.0} />
      </mesh>

      {/* Automated Optical Barcode Scan Tunnel */}
      <group position={[0, 1.9, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 2.9, width + 0.7]} />
          <meshStandardMaterial color={0x0b1322} metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[1.6, 2.3, width + 0.15]} />
          <meshStandardMaterial color={0x020617} />
        </mesh>

        {/* Laser Scanner Light Strip */}
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.09, 0.09, width - 0.2]} />
          <meshStandardMaterial
            color={SCANNER_EMERALD}
            emissive={SCANNER_EMERALD}
            emissiveIntensity={4.5}
          />
        </mesh>
        {/* Volumetric Laser Sheet */}
        <mesh position={[0, -0.35, 0]}>
          <planeGeometry args={[width - 0.2, 1.9]} />
          <meshBasicMaterial
            color={SCANNER_EMERALD}
            transparent
            opacity={0.38}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight
          ref={scannerLightRef}
          position={[0, 0.6, 0]}
          color={SCANNER_EMERALD}
          intensity={2.5}
          distance={7}
        />
      </group>

      {/* Instanced Moving Packages */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, packageCount]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.3} />
      </instancedMesh>
    </group>
  )
}
