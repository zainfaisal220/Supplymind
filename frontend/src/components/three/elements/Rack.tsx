import { useMemo } from "react"

const UPRIGHT_COLOR = 0x0284c7 // Industrial Blue
const BEAM_ORANGE = 0xf97316 // Industrial Orange
const SHELF_DECK = 0x0f172a
const PALLET_WOOD = 0x78350f

const BOX_COLORS = [
  0x0ea5e9, // sky
  0x8b5cf6, // violet
  0x10b981, // emerald
  0xf59e0b, // amber
  0x06b6d4, // cyan
  0x64748b, // slate
]

interface RackProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  levels?: number
  width?: number
  depth?: number
  onClick?: () => void
}

export function Rack({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  levels = 4,
  width = 6.2,
  depth = 2.4,
  onClick,
}: RackProps) {
  const height = levels * 3.2

  // Generate deterministic cargo placements
  const cargoSlots = useMemo(() => {
    const slots = []
    for (let l = 0; l < levels; l++) {
      const y = l * 3.2 + 0.6
      for (let s = 0; s < 2; s++) {
        const x = s === 0 ? -width / 4 : width / 4
        slots.push({
          x,
          y,
          color1: BOX_COLORS[(l * 2 + s) % BOX_COLORS.length],
          color2: BOX_COLORS[(l * 2 + s + 1) % BOX_COLORS.length],
        })
      }
    }
    return slots
  }, [levels, width])

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Vertical Upright Columns (4 corners + middle support) */}
      {[
        [-width / 2, -depth / 2],
        [width / 2, -depth / 2],
        [-width / 2, depth / 2],
        [width / 2, depth / 2],
        [0, -depth / 2],
        [0, depth / 2],
      ].map(([cx, cz], i) => (
        <mesh
          key={`upright-${i}`}
          position={[cx, height / 2, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.2, height, 0.2]} />
          <meshStandardMaterial color={UPRIGHT_COLOR} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Horizontal Shelving Levels */}
      {Array.from({ length: levels }).map((_, l) => {
        const y = l * 3.2 + 0.2
        return (
          <group key={`level-${l}`} position={[0, y, 0]}>
            {/* Front & Back Orange Load Beams */}
            <mesh position={[0, 0, -depth / 2]} castShadow>
              <boxGeometry args={[width, 0.25, 0.12]} />
              <meshStandardMaterial color={BEAM_ORANGE} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, depth / 2]} castShadow>
              <boxGeometry args={[width, 0.25, 0.12]} />
              <meshStandardMaterial color={BEAM_ORANGE} metalness={0.6} roughness={0.4} />
            </mesh>

            {/* Wire Mesh / Solid Shelf Decking */}
            <mesh position={[0, 0.08, 0]} receiveShadow>
              <boxGeometry args={[width - 0.2, 0.06, depth - 0.2]} />
              <meshStandardMaterial color={SHELF_DECK} roughness={0.8} metalness={0.5} />
            </mesh>
          </group>
        )
      })}

      {/* Stored Pallets and Cargo Cartons */}
      {cargoSlots.map((slot, idx) => (
        <group key={`cargo-${idx}`} position={[slot.x, slot.y, 0]}>
          {/* Wood Pallet */}
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[width / 2 - 0.4, 0.18, depth - 0.4]} />
            <meshStandardMaterial color={PALLET_WOOD} roughness={0.9} />
          </mesh>

          {/* Stored Cartons (2 side-by-side) */}
          <mesh position={[-0.6, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.4, depth - 0.6]} />
            <meshStandardMaterial
              color={slot.color1}
              metalness={0.2}
              roughness={0.4}
              emissive={slot.color1}
              emissiveIntensity={0.12}
            />
          </mesh>
          <mesh position={[0.6, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.4, depth - 0.6]} />
            <meshStandardMaterial
              color={slot.color2}
              metalness={0.2}
              roughness={0.4}
              emissive={slot.color2}
              emissiveIntensity={0.12}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
