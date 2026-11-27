import { NavLink, Outlet, useLocation } from "react-router-dom"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useOverviewMetrics } from "@/hooks/useOverviewMetrics"
import {
  LayoutDashboard,
  Package,
  Activity,
  Truck,
  Users,
  FileText,
  Database,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/sales", label: "Sales & Flow", icon: Activity },
  { path: "/purchase-orders", label: "Purchase Orders", icon: Truck },
  { path: "/suppliers", label: "Suppliers", icon: Users },
  { path: "/documents", label: "AI Copilot", icon: FileText },
  { path: "/data", label: "Datasets", icon: Database },
]

export function Shell() {
  const location = useLocation()
  const metrics = useOverviewMetrics()

  const isHealthy = metrics.health?.status === "healthy"

  return (
    <div
      className="min-h-screen text-[#F5F2EB] flex flex-col font-sans selection:bg-white/30 selection:text-white"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(112, 99, 73, 0.45) 0%, transparent 70%), linear-gradient(180deg, #3D3628 0%, #262219 50%, #15130E 100%)",
      }}
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-[#EDE6D8]/15 bg-[#231F17]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-[#1C1913]" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                SUPPLY<span className="text-[#D8CFC0]">MIND</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[#EDE6D8] border border-white/15">
                  v2.0
                </span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#1A1711]/70 p-1 rounded-xl border border-[#EDE6D8]/15">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-[#1C1913] shadow-sm"
                      : "text-[#D5CEC0] hover:text-white hover:bg-white/10 border border-transparent"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#1C1913]" : "text-[#B8B0A0]"}`} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Workspace Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2B261C]/80 border border-[#EDE6D8]/20 text-xs font-medium">
            {isHealthy ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span className="text-white font-semibold">Workspace Active</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-[#D8CFC0] animate-pulse" />
                <span className="text-[#D8CFC0] font-semibold">Connecting...</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorBoundary
          fallback={() => (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">Page Component Error</h3>
              <p className="text-sm text-slate-400 mb-4 max-w-md">
                There was a problem loading this section.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors"
              >
                Reload Page
              </button>
            </div>
          )}
        >
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Lightweight Clean Footer */}
      <footer className="border-t border-[#EDE6D8]/15 bg-[#1E1A13]/80 backdrop-blur-md py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-[#B8B0A0]">
          <span>SupplyMind — Supply Chain Intelligence Platform</span>
          <span className="text-[#E5DCCA]">Real-time Operations & Document Analytics</span>
        </div>
      </footer>
    </div>
  )
}
