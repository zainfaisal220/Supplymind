import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const HUB_METAL = 0x1e293b
const HUB_ACCENT = 0x334155
const ACCENT_CYAN = 0x06b6d4
const ACCENT_VIOLET = 0x8b5cf6
const GLASS = 0x0284c7

interface DistributionCenterProps {
  position?: [number, number, number]
  scale?: number
  name?: string
  accentColor?: "cyan" | "violet"
  onClick?: () => void
}

export function DistributionCenter({
  position = [0, 0, 0],
  scale = 1,
  accentColor = "cyan",
  onClick,
}: DistributionCenterProps) {
  const [hovered, setHovered] = useState(false)
  const ringRef = useRef<THREE.Group>(null)
  const dishRef = useRef<THREE.Group>(null)

  const glowColor = accentColor === "cyan" ? ACCENT_CYAN : ACCENT_VIOLET

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.4
    }
    if (dishRef.current) {
      dishRef.current.rotation.y += delta * 0.2
    }
  })

  return (
    <group
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = "auto"
      }}
    >
      {/* Heavy Base Octagonal Plinth */}
      <mesh position={[0, 0.4, 0]} receiveShadow>
        <cylinderGeometry args={[14, 15, 0.8, 8]} />
        <meshStandardMaterial color={0x0a101d} roughness={0.8} />
      </mesh>

      {/* Rotating Holographic Node Ring on Floor */}
      <group ref={ringRef} position={[0, 0.9, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[13.5, 14.5, 32]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={hovered ? 0.8 : 0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Pulsing Satellite Node Points along ring */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
          <mesh
            key={`node-${i}`}
            position={[Math.cos(angle) * 14, 0.2, Math.sin(angle) * 14]}
          >
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={3}
            />
          </mesh>
        ))}
      </group>

      {/* Internal Facility Glow */}
      <pointLight position={[0, 9, 0]} intensity={3.5} color={glowColor} distance={45} />

      {/* Tier 1 Main Building Block */}
      <mesh position={[0, 6, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 11, 15]} />
        <meshStandardMaterial color={HUB_METAL} roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Tier 1 Neon Perimeter Accent Line */}
      <mesh position={[0, 11.6, 0]}>
        <boxGeometry args={[18.4, 0.25, 15.4]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={3.5} />
      </mesh>

      {/* Tier 1 Glass Window Bands */}
      <mesh position={[0, 7.5, 7.55]} castShadow>
        <boxGeometry args={[16, 2.5, 0.1]} />
        <meshStandardMaterial
          color={GLASS}
          emissive={glowColor}
          emissiveIntensity={hovered ? 2.0 : 1.0}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Tier 2 Upper Logistics Pavilion */}
      <mesh position={[0, 13, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 4.5, 10]} />
        <meshStandardMaterial color={HUB_ACCENT} roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Tier 2 Neon Accent Line */}
      <mesh position={[0, 15.2, 0]}>
        <boxGeometry args={[12.3, 0.2, 10.3]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={3.5} />
      </mesh>

      {/* Rooftop Helipad Deck */}
      <mesh position={[0, 15.3, 0]} receiveShadow>
        <cylinderGeometry args={[5.2, 5.2, 0.2, 24]} />
        <meshStandardMaterial color={0x0b1324} roughness={0.9} />
      </mesh>
      {/* Helipad Yellow Ring & "H" Marking */}
      <mesh position={[0, 15.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 4.6, 24]} />
        <meshBasicMaterial color={0xfacc15} />
      </mesh>
      <mesh position={[0, 15.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 0.6]} />
        <meshBasicMaterial color={0xfacc15} />
      </mesh>

      {/* Rotating Satellite Communication Dish Array */}
      <group ref={dishRef} position={[4.5, 16.5, 3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.15, 2.2, 8]} />
          <meshStandardMaterial color={0x94a3b8} metalness={0.9} />
        </mesh>
        <mesh position={[0, 1.2, 0]} rotation={[0.4, 0, 0]}>
          <sphereGeometry args={[1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={0x0f172a}
            metalness={0.8}
            roughness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Cyber Corner Beacons */}
      {[
        [-9.2, 11.5, -7.7],
        [9.2, 11.5, -7.7],
        [-9.2, 11.5, 7.7],
        [9.2, 11.5, 7.7],
      ].map((p, i) => (
        <mesh key={`pylon-${i}`} position={p as [number, number, number]}>
          <boxGeometry args={[0.8, 1.6, 0.8]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={glowColor}
            emissiveIntensity={hovered ? 3.5 : 2.0}
          />
        </mesh>
      ))}

      {/* Hub Ambient Point Light */}
      <pointLight
        position={[0, 14, 0]}
        color={glowColor}
        intensity={2.2}
        distance={22}
        decay={2}
      />
    </group>
  )
}
