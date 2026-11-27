import { Text, Billboard } from "@react-three/drei"

const STATUS_COLOR: Record<string, number> = {
  active: 0x22d3ee,
  warning: 0xf59e0b,
  error: 0xf43f5e,
  idle: 0x64748b,
}

export function StatusIndicator({
  position = [0, 0, 0],
  label = "Node",
  status = "active",
  color = STATUS_COLOR[status] ?? 0x22d3ee,
}: {
  position?: [number, number, number]
  label?: string
  status?: string
  color?: number
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color={color} transparent={true} opacity={0.35} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <Billboard>
        <Text
          fontSize={0.8}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#e2e8f0"
          strokeColor="#050a14"
          strokeWidth={0.15}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}
