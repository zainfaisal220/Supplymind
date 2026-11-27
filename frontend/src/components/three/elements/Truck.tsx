import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const CAB_COLOR = 0x09111e
const TRAILER_BODY = 0x162032
const CHROME = 0x94a3b8
const WHEEL_RUBBER = 0x020617
const ACCENT_CYAN = 0x06b6d4

interface TruckProps {
  start?: [number, number, number]
  end?: [number, number, number]
  duration?: number
  offset?: number
  onClick?: () => void
}

export function Truck({
  start = [-58, 1.4, -32],
  end = [-18, 1.4, 23],
  duration = 20,
  offset = 0,
  onClick,
}: TruckProps) {
  const truckGroupRef = useRef<THREE.Group>(null)
  const wheelsRef = useRef<THREE.Group[]>([])
  const progress = useRef(offset / duration)

  // Construct realistic CatmullRom spline highway curve
  const curve = useMemo(() => {
    const midX = (start[0] + end[0]) / 2 + (start[0] < end[0] ? 14 : -14)
    const midZ = (start[2] + end[2]) / 2 + 10
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(midX, start[1], midZ),
      new THREE.Vector3(end[0], end[1], end[2] + 9),
      new THREE.Vector3(...end),
    ])
  }, [start, end])

  useFrame((_, delta) => {
    if (!truckGroupRef.current) return

    progress.current = (progress.current + delta / duration) % 1.0
    const t = progress.current

    const currentPos = curve.getPointAt(t)
    const nextPos = curve.getPointAt((t + 0.008) % 1.0)

    truckGroupRef.current.position.copy(currentPos)

    // Calculate heading direction
    const dir = new THREE.Vector3().subVectors(nextPos, currentPos).normalize()
    if (dir.lengthSq() > 0.0001) {
      const angle = Math.atan2(dir.x, dir.z)
      truckGroupRef.current.rotation.y = angle
    }

    // Wheel rotation speed
    wheelsRef.current.forEach((w) => {
      if (w) w.rotation.x += delta * 14
    })
  })

  return (
    <group ref={truckGroupRef} onClick={onClick}>
      {/* Tractor Cab */}
      <group position={[0, 0, 4.4]}>
        {/* Main Cab Chassis */}
        <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.1, 2.7, 4.0]} />
          <meshStandardMaterial color={CAB_COLOR} roughness={0.25} metalness={0.8} />
        </mesh>

        {/* Aerodynamic High Roof Fairing */}
        <mesh position={[0, 3.5, -0.2]} castShadow>
          <boxGeometry args={[2.9, 0.9, 3.4]} />
          <meshStandardMaterial color={0x0b1322} roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Front Chrome Radiator Grille */}
        <mesh position={[0, 1.55, 2.02]}>
          <boxGeometry args={[2.3, 1.7, 0.1]} />
          <meshStandardMaterial color={CHROME} metalness={0.95} roughness={0.08} />
        </mesh>

        {/* Windshield / Cab Glass */}
        <mesh position={[0, 2.4, 1.35]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[2.7, 1.25, 0.85]} />
          <meshStandardMaterial
            color={0x0284c7}
            roughness={0.05}
            metalness={0.95}
            transparent
            opacity={0.8}
            emissive={0x0369a1}
            emissiveIntensity={0.4}
          />
        </mesh>

        {/* High-intensity LED Headlights with Dynamic Forward Spotlights */}
        {[-1.15, 1.15].map((x, i) => (
          <group key={`headlight-${i}`} position={[x, 1.15, 2.05]}>
            <mesh>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshStandardMaterial color={0xffffff} emissive={0xffffff} emissiveIntensity={5} />
            </mesh>
            <spotLight
              position={[0, 0, 0.3]}
              target-position={[0, -0.8, 16]}
              color={0xffffff}
              intensity={3.0}
              distance={22}
              angle={0.45}
              penumbra={0.6}
            />
          </group>
        ))}

        {/* Dual Vertical Chrome Exhaust Stacks */}
        {[-1.45, 1.45].map((x, i) => (
          <mesh key={`exhaust-${i}`} position={[x, 3.3, -1.7]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 3.4, 12]} />
            <meshStandardMaterial color={CHROME} metalness={0.98} roughness={0.05} />
          </mesh>
        ))}
      </group>

      {/* Cargo Trailer */}
      <group position={[0, 0, -3.2]}>
        {/* Large 53ft Box Trailer */}
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.3, 3.3, 10.8]} />
          <meshStandardMaterial color={TRAILER_BODY} roughness={0.35} metalness={0.6} />
        </mesh>

        {/* Glowing SupplyMind Cyber Neon Stripes along trailer sides */}
        <mesh position={[-1.67, 2.5, 0]}>
          <boxGeometry args={[0.05, 0.4, 10.3]} />
          <meshStandardMaterial
            color={ACCENT_CYAN}
            emissive={ACCENT_CYAN}
            emissiveIntensity={3.2}
          />
        </mesh>
        <mesh position={[1.67, 2.5, 0]}>
          <boxGeometry args={[0.05, 0.4, 10.3]} />
          <meshStandardMaterial
            color={ACCENT_CYAN}
            emissive={ACCENT_CYAN}
            emissiveIntensity={3.2}
          />
        </mesh>

        {/* Rear Door Trim & Red LED Taillights */}
        <mesh position={[0, 2.5, -5.42]}>
          <boxGeometry args={[3.1, 3.1, 0.05]} />
          <meshStandardMaterial color={0x0b1322} />
        </mesh>
        {[-1.35, 1.35].map((x, i) => (
          <mesh key={`taillight-${i}`} position={[x, 1.25, -5.45]}>
            <boxGeometry args={[0.32, 0.55, 0.05]} />
            <meshStandardMaterial color={0xef4444} emissive={0xef4444} emissiveIntensity={3.5} />
          </mesh>
        ))}
      </group>

      {/* Multi-Axle Rolling Wheel Sets */}
      {[
        [1.35, 0.65, 5.4],
        [-1.35, 0.65, 5.4],
        [1.35, 0.65, 3.0],
        [-1.35, 0.65, 3.0],
        [1.35, 0.65, 1.6],
        [-1.35, 0.65, 1.6],
        [1.35, 0.65, -6.3],
        [-1.35, 0.65, -6.3],
        [1.35, 0.65, -7.7],
        [-1.35, 0.65, -7.7],
      ].map((p, idx) => (
        <group
          key={`wheel-${idx}`}
          position={p as [number, number, number]}
          ref={(el) => {
            if (el) wheelsRef.current[idx] = el
          }}
        >
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.65, 0.65, 0.48, 20]} />
            <meshStandardMaterial color={WHEEL_RUBBER} roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.38, 0.38, 0.52, 16]} />
            <meshStandardMaterial color={CHROME} metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
