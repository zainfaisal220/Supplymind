import { Html } from "@react-three/drei"
import { LucideIcon } from "lucide-react"

interface FloatingCard3DProps {
  position: [number, number, number]
  title: string
  metric: string
  subtext?: string
  icon?: LucideIcon
  status?: "active" | "warning" | "optimal"
  isSelected?: boolean
  onClick?: () => void
}

export function FloatingCard3D({
  position,
  title,
  metric,
  subtext,
  icon: Icon,
  status = "active",
  isSelected = false,
  onClick,
}: FloatingCard3DProps) {
  const statusColors = {
    active: "bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]",
    optimal: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]",
    warning: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]",
  }

  return (
    <Html
      position={position}
      center
      distanceFactor={60}
      zIndexRange={[100, 0]}
      style={{
        pointerEvents: "auto",
        userSelect: "none",
        transition: "transform 0.2s ease",
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        className={`group relative cursor-pointer rounded-xl border backdrop-blur-md px-3.5 py-2.5 transition-all duration-300 hover:scale-105 active:scale-95 ${
          isSelected
            ? "bg-slate-900/90 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400/40"
            : "bg-slate-950/75 border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:border-cyan-500/50 hover:bg-slate-900/85"
        }`}
      >
        {/* Glow connector pin */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full animate-pulse ${statusColors[status]}`} />
          {Icon && <Icon className="w-3.5 h-3.5 text-cyan-400" />}
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-300 group-hover:text-white transition-colors">
            {title}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold font-mono tracking-tight text-white group-hover:text-cyan-300 transition-colors">
            {metric}
          </span>
          {subtext && (
            <span className="text-[10px] text-slate-400 font-medium">
              {subtext}
            </span>
          )}
        </div>

        {/* Small subtle target triangle at the bottom center pointing to the object */}
        <div
          className={`absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b backdrop-blur-md transition-colors ${
            isSelected
              ? "bg-slate-900 border-cyan-400"
              : "bg-slate-950 border-slate-700/60 group-hover:border-cyan-500/50"
          }`}
        />
      </div>
    </Html>
  )
}
