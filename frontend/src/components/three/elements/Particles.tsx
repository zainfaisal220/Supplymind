import { useRef, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const CYAN = 0x22d3ee

export function Particles({ count = 220 }: { count?: number }) {
  const groupRef = useRef<THREE.Group | null>(null)
  const particlesRef = useRef<THREE.Points | null>(null)
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count)
  const scales = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200
    positions[i * 3 + 1] = (Math.random() - 0.5) * 60 + 20
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200
    velocities[i] = 0.5 + Math.random() * 1.5
    scales[i] = 0.05 + Math.random() * 0.15
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.15,
    color: CYAN,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  particlesRef.current = pts

  useFrame((_state, delta) => {
    if (!particlesRef.current) return
    const pos = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      pos.array[i * 3 + 1] -= delta * velocities[i]
      if (pos.array[i * 3 + 1] < -10) pos.array[i * 3 + 1] = 70
    }
    pos.needsUpdate = true
  })

  useEffect(() => {
    if (groupRef.current) groupRef.current.add(pts)
    return () => { if (groupRef.current) groupRef.current.remove(pts) }
  }, [pts])

  return <group ref={groupRef} />
}
