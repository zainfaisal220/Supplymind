import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const STEEL_DARK = 0x334155
const WALL_PANEL = 0x1e293b
const GLASS_CYAN = 0x0284c7
const ACCENT_CYAN = 0x06b6d4
const HAZARD_YELLOW = 0xfacc15
const HAZARD_BLACK = 0x020617

interface WarehouseProps {
  position?: [number, number, number]
  onClick?: () => void
}

export function Warehouse({
  position = [0, 0, 0],
  onClick,
}: WarehouseProps) {
  const [hovered, setHovered] = useState(false)
  const beaconRef = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    if (beaconRef.current) {
      beaconRef.current.intensity = Math.sin(state.clock.elapsedTime * 4) > 0 ? 3.0 : 0.3
    }
  })

  return (
    <group
      position={position}
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
      {/* Heavy Engineered Concrete Base Foundation */}
      <mesh position={[0, 0.45, 0]} receiveShadow>
        <boxGeometry args={[64, 0.9, 44]} />
        <meshStandardMaterial color={0x080e1a} roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Main Structural Enclosure (Architectural Metallic Panels) */}
      <mesh position={[0, 11, -19.6]} castShadow receiveShadow>
        <boxGeometry args={[56, 20.2, 1.2]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[-27.6, 11, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 20.2, 40]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[27.6, 11, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 20.2, 40]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.35} metalness={0.8} />
      </mesh>

      {/* Interior Warehouse High-Bay Illumination */}
      <pointLight position={[0, 10, 0]} intensity={4.5} color="#38bdf8" distance={65} />
      <pointLight position={[-16, 9, 4]} intensity={3.5} color="#f59e0b" distance={50} />
      <pointLight position={[16, 9, 4]} intensity={3.5} color="#f59e0b" distance={50} />

      {/* Front Architectural Glass Façade (Reflective, semi-transparent into automated bays) */}
      <mesh position={[0, 11, 19.5]} castShadow receiveShadow>
        <boxGeometry args={[55, 20, 0.5]} />
        <meshStandardMaterial
          color={GLASS_CYAN}
          roughness={0.1}
          metalness={0.9}
          transparent={true}
          opacity={0.48}
          emissive={ACCENT_CYAN}
          emissiveIntensity={hovered ? 0.55 : 0.28}
        />
      </mesh>

      {/* Structural Steel Mullions with Vertical Cyber Glow Strips */}
      {[-24, -16, -8, 0, 8, 16, 24].map((x) => (
        <group key={`mullion-${x}`} position={[x, 11, 19.8]}>
          <mesh castShadow>
            <boxGeometry args={[1.0, 20.2, 0.7]} />
            <meshStandardMaterial color={STEEL_DARK} metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.38]}>
            <boxGeometry args={[0.16, 19.8, 0.08]} />
            <meshStandardMaterial
              color={ACCENT_CYAN}
              emissive={ACCENT_CYAN}
              emissiveIntensity={hovered ? 3.5 : 1.8}
            />
          </mesh>
        </group>
      ))}

      {/* Roof Deck Structure */}
      <mesh position={[0, 21.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[58.5, 1.2, 42.5]} />
        <meshStandardMaterial color={0x1e293b} roughness={0.65} metalness={0.5} />
      </mesh>

      {/* High-Tech Rooftop Solar Panel Arrays */}
      {[-18, -6, 6, 18].map((x) => (
        <group key={`solar-${x}`} position={[x, 22.3, -5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[8.5, 0.15, 18]} />
            <meshStandardMaterial
              color={0x034b75}
              roughness={0.25}
              metalness={0.85}
              emissive={0x0284c7}
              emissiveIntensity={0.15}
            />
          </mesh>
        </group>
      ))}

      {/* Glowing Neon Cyber Roof Edge Line */}
      <mesh position={[0, 22.3, 0]}>
        <boxGeometry args={[58.8, 0.3, 42.8]} />
        <meshStandardMaterial
          color={ACCENT_CYAN}
          emissive={ACCENT_CYAN}
          emissiveIntensity={hovered ? 3.2 : 2.0}
        />
      </mesh>

      {/* Industrial Roof HVAC Cooling Units */}
      {[
        [-14, 23.4, -8],
        [-14, 23.4, 4],
        [12, 23.4, -6],
      ].map((p, i) => (
        <group key={`hvac-${i}`} position={p as [number, number, number]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[6.0, 2.4, 4.2]} />
            <meshStandardMaterial color={0x1e293b} metalness={0.75} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[1.3, 1.3, 0.15, 16]} />
            <meshStandardMaterial color={0x020617} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* High-Tech Antenna Mast with Flashing Warning Beacon */}
      <group position={[24, 25.8, -16]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.35, 8.5, 8]} />
          <meshStandardMaterial color={0x94a3b8} metalness={0.95} />
        </mesh>
        <mesh position={[0, 4.3, 0]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color={0xef4444} emissive={0xef4444} emissiveIntensity={3.5} />
        </mesh>
        <pointLight
          ref={beaconRef}
          position={[0, 4.3, 0]}
          color={0xef4444}
          intensity={2.0}
          distance={18}
        />
      </group>

      {/* Loading Docks (Bays 01, 02, 03, 04) */}
      {[-18, -6, 6, 18].map((x, idx) => (
        <group key={`dock-${idx}`} position={[x, 0, 20.3]}>
          {/* Concrete Platform Ramp */}
          <mesh position={[0, 0.55, 2.0]} receiveShadow>
            <boxGeometry args={[8.8, 1.0, 4.0]} />
            <meshStandardMaterial color={0x1e293b} roughness={0.8} />
          </mesh>

          {/* High-Contrast Hazard Warning Chevrons */}
          {[-3.6, -1.8, 0, 1.8, 3.6].map((hz) => (
            <group key={`hazard-${hz}`} position={[hz, 1.02, 3.9]}>
              <mesh>
                <boxGeometry args={[0.8, 0.08, 0.18]} />
                <meshStandardMaterial
                  color={HAZARD_YELLOW}
                  emissive={HAZARD_YELLOW}
                  emissiveIntensity={0.6}
                />
              </mesh>
            </group>
          ))}

          {/* Overhead Industrial Sectional Roll-Up Door */}
          <mesh position={[0, 5.0, -0.2]} castShadow receiveShadow>
            <boxGeometry args={[7.4, 8.2, 0.25]} />
            <meshStandardMaterial color={0x0b1324} roughness={0.4} metalness={0.7} />
          </mesh>

          {/* Black Rubber Dock Bumper Pads */}
          <mesh position={[-3.9, 5.0, 0.25]} castShadow>
            <boxGeometry args={[0.55, 8.5, 0.65]} />
            <meshStandardMaterial color={HAZARD_BLACK} roughness={0.9} />
          </mesh>
          <mesh position={[3.9, 5.0, 0.25]} castShadow>
            <boxGeometry args={[0.55, 8.5, 0.65]} />
            <meshStandardMaterial color={HAZARD_BLACK} roughness={0.9} />
          </mesh>
          <mesh position={[0, 9.3, 0.25]} castShadow>
            <boxGeometry args={[8.3, 0.65, 0.65]} />
            <meshStandardMaterial color={HAZARD_BLACK} roughness={0.9} />
          </mesh>

          {/* Traffic Dock Status Light */}
          <mesh position={[4.5, 5.6, 0.4]}>
            <boxGeometry args={[0.35, 0.9, 0.25]} />
            <meshStandardMaterial color={0x0a0f1d} />
          </mesh>
          <mesh position={[4.5, 5.8, 0.52]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? 0x10b981 : 0x06b6d4}
              emissive={idx % 2 === 0 ? 0x10b981 : 0x06b6d4}
              emissiveIntensity={3.5}
            />
          </mesh>
          <pointLight
            position={[4.5, 5.8, 0.7]}
            color={idx % 2 === 0 ? 0x10b981 : 0x06b6d4}
            intensity={0.8}
            distance={5}
          />
        </group>
      ))}

      {/* Internal High-Bay Automated Illumination */}
      <pointLight position={[0, 13, 0]} color={0x06b6d4} intensity={3.5} distance={40} />
      <pointLight position={[-16, 11, -6]} color={0x8b5cf6} intensity={2.8} distance={30} />
      <pointLight position={[16, 11, -6]} color={0x38bdf8} intensity={2.8} distance={30} />

      {/* Warehouse Center High-Tech Canopy Strip */}
      <mesh position={[0, 19.8, 20.1]}>
        <boxGeometry args={[24, 1.8, 0.25]} />
        <meshStandardMaterial color={0x020617} roughness={0.5} />
      </mesh>
      <mesh position={[0, 19.8, 20.25]}>
        <boxGeometry args={[22.5, 0.12, 0.06]} />
        <meshStandardMaterial
          color={ACCENT_CYAN}
          emissive={ACCENT_CYAN}
          emissiveIntensity={3.5}
        />
      </mesh>
    </group>
  )
}
