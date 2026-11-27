import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface SupplyRouteProps {
  start?: [number, number, number]
  end?: [number, number, number]
  color?: number
  speed?: number
  arcHeight?: number
}

export function SupplyRoute({
  start = [-45, 1, -25],
  end = [0, 1, 0],
  color = 0x06b6d4,
  speed = 0.6,
  arcHeight = 6,
}: SupplyRouteProps) {
  const pulsesRef = useRef<THREE.Group>(null)
  const pulseOffsets = useMemo(() => [0, 0.25, 0.5, 0.75], [])

  // Create smooth parabolic/catenary arc curve between points
  const curve = useMemo(() => {
    const p1 = new THREE.Vector3(...start)
    const p2 = new THREE.Vector3(...end)
    const mid = new THREE.Vector3()
      .addVectors(p1, p2)
      .multiplyScalar(0.5)
    mid.y += arcHeight

    return new THREE.QuadraticBezierCurve3(p1, mid, p2)
  }, [start, end, arcHeight])

  // Static line object for the optical waveguide line
  const { lineObject, pulseGeo } = useMemo(() => {
    const points = curve.getPoints(60)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
    })
    const line = new THREE.Line(lineGeo, lineMat)
    const pulseGeo = new THREE.SphereGeometry(0.4, 12, 12)
    return { lineObject: line, pulseGeo }
  }, [curve, color])

  useFrame((state) => {
    if (!pulsesRef.current) return
    const t = state.clock.elapsedTime * speed

    pulsesRef.current.children.forEach((child, i) => {
      const progress = (t + pulseOffsets[i]) % 1.0
      const pos = curve.getPointAt(progress)
      child.position.copy(pos)
      // Pulse scale breathing
      const s = 0.8 + Math.sin(progress * Math.PI) * 0.6
      child.scale.set(s, s, s)
    })
  })

  return (
    <group>
      {/* Static Glowing Optical Line */}
      <primitive object={lineObject} />

      {/* Flowing Energy Pulses */}
      <group ref={pulsesRef}>
        {pulseOffsets.map((_, i) => (
          <mesh key={`pulse-${i}`} geometry={pulseGeo}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={3.5}
              roughness={0.1}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
