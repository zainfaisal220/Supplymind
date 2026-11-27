import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const ROBOT_ORANGE = 0xf97316
const INDUSTRIAL_DARK = 0x0f172a
const ACCENT_CYAN = 0x06b6d4
const CHROME = 0x94a3b8

interface RoboticArmProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  speedMultiplier?: number
  onClick?: () => void
}

export function RoboticArm({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  speedMultiplier = 1,
  onClick,
}: RoboticArmProps) {
  const baseTurretRef = useRef<THREE.Group>(null)
  const lowerArmRef = useRef<THREE.Group>(null)
  const upperArmRef = useRef<THREE.Group>(null)
  const wristRef = useRef<THREE.Group>(null)
  const gripperRef = useRef<THREE.Group>(null)
  const laserRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speedMultiplier * 1.6

    // Smooth robotic articulation cycles
    if (baseTurretRef.current) {
      // Base rotates back and forth between conveyor and pallet drop point
      baseTurretRef.current.rotation.y = Math.sin(t * 0.8) * 0.85
    }

    if (lowerArmRef.current) {
      // Lower arm dips to pick then lifts
      lowerArmRef.current.rotation.z = -0.3 + Math.sin(t * 1.6) * 0.25
    }

    if (upperArmRef.current) {
      // Upper arm flexes counter-cyclically to keep end effector controlled
      upperArmRef.current.rotation.z = 0.5 + Math.cos(t * 1.6) * 0.35
    }

    if (wristRef.current) {
      wristRef.current.rotation.z = -Math.sin(t * 1.6) * 0.4
    }

    if (gripperRef.current) {
      // Gripper fingers open and close at endpoints
      const gripPhase = Math.sin(t * 1.6)
      const fingerSpread = gripPhase > 0.6 ? 0.35 : 0.15
      gripperRef.current.scale.set(fingerSpread, 1, 1)
    }

    if (laserRef.current) {
      laserRef.current.visible = Math.sin(t * 3.2) > -0.2
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {/* Heavy Base Stand & Bolt Ring */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.4, 0.8, 16]} />
        <meshStandardMaterial color={INDUSTRIAL_DARK} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.08, 16]} />
        <meshStandardMaterial color={ROBOT_ORANGE} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Rotating Turret Column (Yaw) */}
      <group ref={baseTurretRef} position={[0, 0.86, 0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.85, 1.2, 16]} />
          <meshStandardMaterial color={ROBOT_ORANGE} metalness={0.5} roughness={0.4} />
        </mesh>

        {/* Counterweight Box */}
        <mesh position={[-0.6, 0.8, 0]} castShadow>
          <boxGeometry args={[0.8, 0.7, 0.9]} />
          <meshStandardMaterial color={INDUSTRIAL_DARK} metalness={0.7} roughness={0.4} />
        </mesh>

        {/* Lower Shoulder Joint Pivot */}
        <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 1.1, 16]} />
          <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Lower Arm Segment (Pitch) */}
        <group ref={lowerArmRef} position={[0, 1.2, 0]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[0.55, 3.2, 0.65]} />
            <meshStandardMaterial color={ROBOT_ORANGE} metalness={0.5} roughness={0.4} />
          </mesh>

          {/* Hydraulic Cylinder */}
          <mesh position={[-0.35, 1.4, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 2.2, 8]} />
            <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.15} />
          </mesh>

          {/* Elbow Joint Pivot */}
          <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.9, 16]} />
            <meshStandardMaterial color={INDUSTRIAL_DARK} metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Upper Arm Segment (Forearm) */}
          <group ref={upperArmRef} position={[0, 3.2, 0]}>
            <mesh position={[0, 1.3, 0]} castShadow>
              <boxGeometry args={[0.45, 2.6, 0.5]} />
              <meshStandardMaterial color={ROBOT_ORANGE} metalness={0.5} roughness={0.4} />
            </mesh>

            {/* Glowing Cyber Accent Ring on Forearm */}
            <mesh position={[0, 1.3, 0]}>
              <boxGeometry args={[0.48, 0.15, 0.54]} />
              <meshStandardMaterial
                color={ACCENT_CYAN}
                emissive={ACCENT_CYAN}
                emissiveIntensity={2.5}
              />
            </mesh>

            {/* Wrist Assembly */}
            <group ref={wristRef} position={[0, 2.6, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color={INDUSTRIAL_DARK} metalness={0.9} roughness={0.2} />
              </mesh>

              {/* Tool Flange */}
              <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
                <meshStandardMaterial color={CHROME} metalness={0.8} />
              </mesh>

              {/* End-Effector / Gripper Module */}
              <group position={[0, 0.5, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.6, 0.2, 0.3]} />
                  <meshStandardMaterial color={INDUSTRIAL_DARK} />
                </mesh>

                {/* Gripper Claws */}
                <group ref={gripperRef}>
                  <mesh position={[-0.22, 0.3, 0]} castShadow>
                    <boxGeometry args={[0.08, 0.45, 0.15]} />
                    <meshStandardMaterial color={CHROME} metalness={0.9} />
                  </mesh>
                  <mesh position={[0.22, 0.3, 0]} castShadow>
                    <boxGeometry args={[0.08, 0.45, 0.15]} />
                    <meshStandardMaterial color={CHROME} metalness={0.9} />
                  </mesh>
                </group>

                {/* Optical Targeting Laser Beam */}
                <mesh ref={laserRef} position={[0, 1.2, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 2.2, 8]} />
                  <meshBasicMaterial color={ACCENT_CYAN} transparent opacity={0.65} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
