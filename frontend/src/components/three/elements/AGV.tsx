import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const CHASSIS_COLOR = 0x0f172a
const ACCENT_COLOR = 0x06b6d4
const BUMPER_COLOR = 0x1e293b
const BEACON_AMBER = 0xf59e0b

interface AGVProps {
  initialPosition?: [number, number, number]
  waypoints?: [number, number][]
  speed?: number
  label?: string
  carryingPallet?: boolean
  onClick?: () => void
}

export function AGV({
  waypoints = [
    [-18, 12],
    [-4, 12],
    [8, 12],
    [8, -2],
    [-4, -2],
    [-18, -2],
  ],
  speed = 4.0,
  label: _label = "AGV-01",
  carryingPallet = true,
  onClick,
}: AGVProps) {
  const groupRef = useRef<THREE.Group>(null)
  const beaconRef = useRef<THREE.PointLight>(null)
  const progressRef = useRef(Math.random() * waypoints.length)

  // Construct closed path from 2D waypoints
  const pathPoints = waypoints.map(([x, z]) => new THREE.Vector3(x, 0.45, z))
  const curve = useRef(new THREE.CatmullRomCurve3(pathPoints, true, "centripetal"))

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Advance position along curve
    const loopDuration = (curve.current.getLength() / speed)
    progressRef.current = (progressRef.current + delta / loopDuration) % 1.0

    const t = progressRef.current
    const currentPos = curve.current.getPointAt(t)
    const nextPos = curve.current.getPointAt((t + 0.01) % 1.0)

    groupRef.current.position.copy(currentPos)

    // Calculate facing orientation
    const dir = new THREE.Vector3().subVectors(nextPos, currentPos).normalize()
    if (dir.lengthSq() > 0.0001) {
      const angle = Math.atan2(dir.x, dir.z)
      groupRef.current.rotation.y = angle
    }

    // Beacon pulsing effect
    if (beaconRef.current) {
      beaconRef.current.intensity = 1.0 + Math.sin(state.clock.elapsedTime * 8) * 0.8
    }
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      {/* AGV Chassis Base */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.35, 3.2]} />
        <meshStandardMaterial
          color={CHASSIS_COLOR}
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* Safety Perimeter Bumper (Hazard Yellow/Orange) */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[2.4, 0.18, 3.4]} />
        <meshStandardMaterial
          color={BUMPER_COLOR}
          roughness={0.6}
          metalness={0.3}
          emissive={0xf59e0b}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Wheels */}
      {[-1.15, 1.15].map((x, i) => (
        <group key={`wheels-${i}`} position={[x, 0.18, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.2, 16]} />
            <meshStandardMaterial color={0x020617} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 1.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.15, 16]} />
            <meshStandardMaterial color={0x020617} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, -1.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.15, 16]} />
            <meshStandardMaterial color={0x020617} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Front Headlights / Optical Navigation Sensor */}
      <mesh position={[0, 0.25, 1.62]}>
        <boxGeometry args={[1.4, 0.1, 0.05]} />
        <meshStandardMaterial
          color={ACCENT_COLOR}
          emissive={ACCENT_COLOR}
          emissiveIntensity={2.5}
        />
      </mesh>
      <spotLight
        position={[0, 0.3, 1.7]}
        target-position={[0, 0, 6]}
        color={0x38bdf8}
        intensity={1.5}
        distance={8}
        angle={0.6}
        penumbra={0.5}
      />

      {/* Rear Brake / Status LEDs */}
      <mesh position={[0, 0.25, -1.62]}>
        <boxGeometry args={[1.4, 0.1, 0.05]} />
        <meshStandardMaterial
          color={0xef4444}
          emissive={0xef4444}
          emissiveIntensity={1.8}
        />
      </mesh>

      {/* Top Deck Plate */}
      <mesh position={[0, 0.42, 0]} receiveShadow>
        <boxGeometry args={[2.0, 0.08, 3.0]} />
        <meshStandardMaterial color={0x1e293b} roughness={0.7} metalness={0.5} />
      </mesh>

      {/* LIDAR Scanner Turret */}
      <group position={[0, 0.55, 1.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.22, 0.2, 16]} />
          <meshStandardMaterial color={0x0f172a} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 16]} />
          <meshStandardMaterial
            color={ACCENT_COLOR}
            emissive={ACCENT_COLOR}
            emissiveIntensity={2.0}
          />
        </mesh>
      </group>

      {/* Flashing Amber Safety Beacon Mast */}
      <group position={[0.85, 0.8, -1.2]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
          <meshStandardMaterial color={0x475569} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial
            color={BEACON_AMBER}
            emissive={BEACON_AMBER}
            emissiveIntensity={3.0}
          />
        </mesh>
        <pointLight
          ref={beaconRef}
          position={[0, 0.45, 0]}
          color={BEACON_AMBER}
          intensity={1.2}
          distance={6}
          decay={2}
        />
      </group>

      {/* Cargo: Pallet + Stacked Totes / Cartons */}
      {carryingPallet && (
        <group position={[0, 0.5, 0]}>
          {/* Wooden Pallet */}
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.12, 2.4]} />
            <meshStandardMaterial color={0x785338} roughness={0.9} />
          </mesh>

          {/* Stacking Totes / Boxes */}
          <mesh position={[-0.45, 0.45, -0.55]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.65, 1.0]} />
            <meshStandardMaterial
              color={0x0284c7}
              metalness={0.3}
              roughness={0.4}
              emissive={0x0284c7}
              emissiveIntensity={0.15}
            />
          </mesh>
          <mesh position={[0.45, 0.45, -0.55]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.65, 1.0]} />
            <meshStandardMaterial
              color={0x7c3aed}
              metalness={0.3}
              roughness={0.4}
              emissive={0x7c3aed}
              emissiveIntensity={0.15}
            />
          </mesh>
          <mesh position={[0, 0.45, 0.55]} castShadow receiveShadow>
            <boxGeometry args={[1.65, 0.65, 1.0]} />
            <meshStandardMaterial
              color={0x059669}
              metalness={0.3}
              roughness={0.4}
              emissive={0x059669}
              emissiveIntensity={0.15}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}
