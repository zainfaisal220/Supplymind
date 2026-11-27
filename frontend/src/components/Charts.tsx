export interface ChartDataPoint {
  label: string
  value: number
  sublabel?: string
  color?: string
}

interface BarChartCardProps {
  title: string
  subtitle?: string
  data: ChartDataPoint[]
  valueFormatter?: (v: number) => string
  emptyText?: string
}

/**
 * Lightweight responsive horizontal/vertical bar chart in royal-blue-to-midnight glass theme.
 */
export function BarChartCard({
  title,
  subtitle,
  data,
  valueFormatter = (v) => v.toLocaleString(),
  emptyText = "No data available yet to visualize.",
}: BarChartCardProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 p-5 shadow-lg shadow-black/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-[#B8B0A0] mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20">
          {data.length} items
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-[#B8B0A0] border border-dashed border-[#EDE6D8]/20 rounded-xl bg-[#1A1711]/50">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {data.slice(0, 8).map((item, idx) => {
            const pct = Math.max(4, Math.round((item.value / maxVal) * 100))
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#F5F2EB] truncate max-w-[60%]">
                    {item.label}
                    {item.sublabel && (
                      <span className="text-[#B8B0A0] font-normal ml-1.5">({item.sublabel})</span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {valueFormatter(item.value)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#1A1711] border border-[#EDE6D8]/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background:
                        item.color ||
                        "linear-gradient(90deg, #B8AE9B 0%, #FFFFFF 100%)",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface AreaChartCardProps {
  title: string
  subtitle?: string
  data: ChartDataPoint[]
  valueFormatter?: (v: number) => string
  emptyText?: string
}

/**
 * Lightweight responsive SVG area/line chart in royal-blue-to-midnight glass theme.
 */
export function AreaChartCard({
  title,
  subtitle,
  data,
  valueFormatter = (v) => v.toLocaleString(),
  emptyText = "No trend data available yet.",
}: AreaChartCardProps) {
  const width = 520
  const height = 180
  const padX = 24
  const padY = 20

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? width / 2
        : padX + (i / (data.length - 1)) * (width - padX * 2)
    const y = height - padY - (d.value / maxVal) * (height - padY * 2)
    return { x, y, ...d }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padY} L ${points[0].x.toFixed(1)} ${height - padY} Z`
      : ""

  return (
    <div className="rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 p-5 shadow-lg shadow-black/30">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-[#B8B0A0] mt-0.5">{subtitle}</p>}
        </div>
        {data.length > 0 && (
          <span className="text-xs font-mono font-semibold text-white">
            Peak: {valueFormatter(maxVal)}
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-[#B8B0A0] border border-dashed border-[#EDE6D8]/20 rounded-xl bg-[#1A1711]/50">
          {emptyText}
        </div>
      ) : (
        <div className="w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="smBlueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2B261C" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75].map((g, idx) => {
              const gy = padY + g * (height - padY * 2)
              return (
                <line
                  key={idx}
                  x1={padX}
                  x2={width - padX}
                  y1={gy}
                  y2={gy}
                  stroke="rgba(237, 230, 216, 0.14)"
                  strokeDasharray="4 4"
                />
              )
            })}

            {points.length > 1 && <path d={areaPath} fill="url(#smBlueAreaGrad)" />}
            {points.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill="#2B261C"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <title>{`${p.label}: ${valueFormatter(p.value)}`}</title>
              </g>
            ))}
          </svg>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#B8B0A0] px-2 mt-1">
            {data.slice(0, 6).map((d, i) => (
              <span key={i} className="truncate max-w-[80px]">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DonutChartCardProps {
  title: string
  subtitle?: string
  data: ChartDataPoint[]
  emptyText?: string
}

const DONUT_COLORS = ["#FFFFFF", "#CFC6B4", "#8F8572", "#5E5647", "#E5DCCA"]

/**
 * Lightweight SVG Donut breakdown card.
 */
export function DonutChartCard({
  title,
  subtitle,
  data,
  emptyText = "No breakdown data available.",
}: DonutChartCardProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0)
  const radius = 44
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <div className="rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 p-5 shadow-lg shadow-black/30">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-[#B8B0A0] mt-0.5">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-[#B8B0A0] border border-dashed border-[#EDE6D8]/20 rounded-xl bg-[#1A1711]/50">
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
              <circle
                cx="55"
                cy="55"
                r={radius}
                fill="none"
                stroke="rgba(237,230,216,0.12)"
                strokeWidth="12"
              />
              {data.map((item, idx) => {
                const frac = item.value / total
                const dash = frac * circumference
                const offset = -cumulative * circumference
                cumulative += frac
                const color = item.color || DONUT_COLORS[idx % DONUT_COLORS.length]
                return (
                  <circle
                    key={idx}
                    cx="55"
                    cy="55"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="12"
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                  />
                )
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-mono text-white">{total}</span>
              <span className="text-[10px] text-[#B8B0A0] uppercase">Total</span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            {data.map((item, idx) => {
              const color = item.color || DONUT_COLORS[idx % DONUT_COLORS.length]
              const pct = Math.round((item.value / total) * 100)
              return (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[#F5F2EB] capitalize">{item.label}</span>
                  </div>
                  <span className="font-mono text-white">
                    {item.value} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
