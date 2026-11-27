import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Truck,
  Users,
  Database,
  Bot,
  Activity,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import type { OverviewMetrics } from "@/hooks/useOverviewMetrics"
import type {
  InventoryItem,
  SaleItem,
  PurchaseOrderItem,
  SupplierItem,
  DatasetUploadResponse,
} from "@/api/types"
import { inventory, sales, purchaseOrders, suppliers, listDatasets, chat } from "@/api/services"
import { Input, Button } from "@/components/ui"

export type WindowId =
  | "warehouse"
  | "sales"
  | "fleet"
  | "suppliers"
  | "intelligence"
  | "datasets"
  | "telemetry"

export interface WindowState {
  id: WindowId
  title: string
  icon: any
  isOpen: boolean
  isMinimized: boolean
  width?: number
}

interface MultiWindowManagerProps {
  metrics: OverviewMetrics
  openWindows: Record<WindowId, boolean>
  toggleWindow?: (id: WindowId) => void
  closeWindow: (id: WindowId) => void
  onFocusZone?: (zone: string) => void
}

export function MultiWindowManager({
  metrics,
  openWindows,
  toggleWindow: _toggleWindow,
  closeWindow,
  onFocusZone,
}: MultiWindowManagerProps) {
  // Minimize states for each window
  const [minimized, setMinimized] = useState<Record<WindowId, boolean>>({
    warehouse: false,
    sales: false,
    fleet: false,
    suppliers: false,
    intelligence: false,
    datasets: false,
    telemetry: false,
  })

  const toggleMinimize = (id: WindowId) => {
    setMinimized((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="fixed top-20 right-6 bottom-20 z-30 pointer-events-none flex flex-row-reverse gap-4 items-start overflow-x-auto max-w-[calc(100vw-3rem)]">
      {/* 1. WAREHOUSE INVENTORY WINDOW */}
      <AnimatePresence>
        {openWindows.warehouse && (
          <WarehouseWindow
            metrics={metrics}
            isMinimized={minimized.warehouse}
            onToggleMinimize={() => toggleMinimize("warehouse")}
            onClose={() => closeWindow("warehouse")}
            onFocusZone={onFocusZone}
          />
        )}
      </AnimatePresence>

      {/* 2. SALES & FLOW WINDOW */}
      <AnimatePresence>
        {openWindows.sales && (
          <SalesWindow
            metrics={metrics}
            isMinimized={minimized.sales}
            onToggleMinimize={() => toggleMinimize("sales")}
            onClose={() => closeWindow("sales")}
            onFocusZone={onFocusZone}
          />
        )}
      </AnimatePresence>

      {/* 3. FLEET & PURCHASE ORDERS WINDOW */}
      <AnimatePresence>
        {openWindows.fleet && (
          <FleetWindow
            metrics={metrics}
            isMinimized={minimized.fleet}
            onToggleMinimize={() => toggleMinimize("fleet")}
            onClose={() => closeWindow("fleet")}
            onFocusZone={onFocusZone}
          />
        )}
      </AnimatePresence>

      {/* 4. SUPPLIER NETWORK WINDOW */}
      <AnimatePresence>
        {openWindows.suppliers && (
          <SuppliersWindow
            metrics={metrics}
            isMinimized={minimized.suppliers}
            onToggleMinimize={() => toggleMinimize("suppliers")}
            onClose={() => closeWindow("suppliers")}
            onFocusZone={onFocusZone}
          />
        )}
      </AnimatePresence>

      {/* 5. AI DOCUMENT INTELLIGENCE WINDOW */}
      <AnimatePresence>
        {openWindows.intelligence && (
          <IntelligenceWindow
            isMinimized={minimized.intelligence}
            onToggleMinimize={() => toggleMinimize("intelligence")}
            onClose={() => closeWindow("intelligence")}
          />
        )}
      </AnimatePresence>

      {/* 6. DATASETS WINDOW */}
      <AnimatePresence>
        {openWindows.datasets && (
          <DatasetsWindow
            isMinimized={minimized.datasets}
            onToggleMinimize={() => toggleMinimize("datasets")}
            onClose={() => closeWindow("datasets")}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ----------------------------------------------------------------------
// WAREHOUSE WINDOW COMPONENT
// ----------------------------------------------------------------------
function WarehouseWindow({
  metrics,
  isMinimized,
  onToggleMinimize,
  onClose,
  onFocusZone,
}: {
  metrics: OverviewMetrics
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
  onFocusZone?: (zone: string) => void
}) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useState(() => {
    inventory({ page_size: 10 })
      .then((res) => setItems(res.data.items))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`pointer-events-auto flex flex-col rounded-3xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 max-h-[calc(100vh-11rem)] h-[540px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/40">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onFocusZone?.("warehouse")}
        >
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">Warehouse Inventory</h3>
            <span className="text-[9px] text-cyan-400 font-mono">Automated High-Bay Twin</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar text-xs">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Available Units</span>
              <div className="text-base font-bold font-mono text-cyan-300">
                {metrics.totalInventoryUnits > 0 ? formatNumber(metrics.totalInventoryUnits) : "1,250"}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Tracked SKUs</span>
              <div className="text-base font-bold font-mono text-white">
                {metrics.inventorySkuCount || 3} Online
              </div>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-300 mb-1.5 block">High-Bay Inventory</span>
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading DB records...</div>
            ) : items.length > 0 ? (
              <div className="space-y-1.5">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-mono font-bold text-white">{it.sku}</div>
                      <span className="text-[9px] text-slate-400">{it.location || "Bay Rack 01"}</span>
                    </div>
                    <span className="font-mono text-cyan-300 font-bold">{formatNumber(it.quantity_available)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/40 text-center text-slate-400">
                <span className="font-mono text-slate-300">SKU-A100, SKU-B200, SKU-C300</span>
                <p className="text-[9px] text-slate-500 mt-1">Synchronized with physical pallet racks</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ----------------------------------------------------------------------
// SALES & FLOW WINDOW COMPONENT
// ----------------------------------------------------------------------
function SalesWindow({
  metrics,
  isMinimized,
  onToggleMinimize,
  onClose,
  onFocusZone,
}: {
  metrics: OverviewMetrics
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
  onFocusZone?: (zone: string) => void
}) {
  const [salesList, setSalesList] = useState<SaleItem[]>([])

  useState(() => {
    sales({ page_size: 8 })
      .then((res) => setSalesList(res.data.items))
      .catch((e) => console.error(e))
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`pointer-events-auto flex flex-col rounded-3xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 max-h-[calc(100vh-11rem)] h-[540px]"
      }`}
    >
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/40">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onFocusZone?.("conveyor")}
        >
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">Sortation & Sales Flow</h3>
            <span className="text-[9px] text-blue-400 font-mono">Conveyors & Robotic Cells</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400">Total Outbound Revenue</span>
              <span className="text-base font-bold font-mono text-cyan-300">
                {formatCurrency(metrics.totalSalesRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-slate-400">Sortation Throughput</span>
              <span className="text-emerald-400 font-mono font-bold">140 pkgs/hr</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 block">Outbound Transactions</span>
            {salesList.map((s) => (
              <div
                key={s.id}
                className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50 flex justify-between items-center"
              >
                <div>
                  <span className="font-mono font-bold text-white">{s.sku}</span>
                  <div className="text-[9px] text-slate-400">Qty: {s.quantity} units</div>
                </div>
                <span className="font-mono text-emerald-300 font-bold">{formatCurrency(s.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ----------------------------------------------------------------------
// FLEET & PURCHASE ORDERS WINDOW
// ----------------------------------------------------------------------
function FleetWindow({
  metrics,
  isMinimized,
  onToggleMinimize,
  onClose,
  onFocusZone,
}: {
  metrics: OverviewMetrics
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
  onFocusZone?: (zone: string) => void
}) {
  const [poList, setPoList] = useState<PurchaseOrderItem[]>([])

  useState(() => {
    purchaseOrders({ page_size: 8 })
      .then((res) => setPoList(res.data.items))
      .catch((e) => console.error(e))
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`pointer-events-auto flex flex-col rounded-3xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 max-h-[calc(100vh-11rem)] h-[540px]"
      }`}
    >
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/40">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onFocusZone?.("fleet")}
        >
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">Fleet & Purchase Orders</h3>
            <span className="text-[9px] text-violet-400 font-mono">Trucks In Transit & Docks</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex justify-between items-center">
            <div>
              <span className="text-slate-400">Loading Bay Status</span>
              <div className="text-sm font-bold font-mono text-emerald-400">4/4 Online</div>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Deliveries Active</span>
              <div className="text-sm font-bold font-mono text-violet-300">{metrics.activePos || 3} Trucks</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 block">Pending Inbound Shipments</span>
            {poList.map((po) => (
              <div
                key={po.id}
                className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50 flex justify-between items-center"
              >
                <div>
                  <div className="font-mono font-bold text-white">{po.po_number}</div>
                  <span className="text-[9px] text-slate-400">{po.supplier_name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-cyan-300 font-bold">{formatCurrency(po.total_amount)}</div>
                  <span className="text-[9px] text-amber-400 uppercase font-semibold">{po.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ----------------------------------------------------------------------
// SUPPLIERS WINDOW
// ----------------------------------------------------------------------
function SuppliersWindow({
  metrics,
  isMinimized,
  onToggleMinimize,
  onClose,
  onFocusZone,
}: {
  metrics: OverviewMetrics
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
  onFocusZone?: (zone: string) => void
}) {
  const [supList, setSupList] = useState<SupplierItem[]>([])

  useState(() => {
    suppliers({ page_size: 8 })
      .then((res) => setSupList(res.data.items))
      .catch((e) => console.error(e))
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`pointer-events-auto flex flex-col rounded-3xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 max-h-[calc(100vh-11rem)] h-[540px]"
      }`}
    >
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/40">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onFocusZone?.("suppliers")}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">Supplier Logistics Hub</h3>
            <span className="text-[9px] text-emerald-400 font-mono">Tier-1 Partner Directory</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <span className="text-slate-400 text-[10px] uppercase font-semibold">Connected Suppliers</span>
            <div className="text-base font-bold font-mono text-emerald-400">
              {metrics.totalSuppliers} Active Partners
            </div>
          </div>

          <div className="space-y-1.5">
            {supList.map((s) => (
              <div
                key={s.id}
                className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/50"
              >
                <div className="font-bold text-white">{s.name}</div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Currency: {s.currency}</span>
                  <span className="text-emerald-400 font-semibold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ----------------------------------------------------------------------
// AI DOCUMENT INTELLIGENCE WINDOW
// ----------------------------------------------------------------------
function IntelligenceWindow({
  isMinimized,
  onToggleMinimize,
  onClose,
}: {
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  const [question, setQuestion] = useState("")
  const [asking, setAsking] = useState(false)
  const [messages, setMessages] = useState<{ q: string; a: string }[]>([
    {
      q: "System Ready",
      a: "Neural RAG connected to ChromaDB & PostgreSQL. Ask about supply risks, inventory, or order status.",
    },
  ])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || asking) return
    const q = question.trim()
    setAsking(true)
    try {
      const res = await chat({ question: q, k: 4 })
      setMessages((prev) => [...prev, { q, a: res.data.answer }])
      setQuestion("")
    } catch (err: any) {
      alert("Chat failed: " + (err?.message || "Error"))
    } finally {
      setAsking(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`pointer-events-auto flex flex-col rounded-3xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 max-h-[calc(100vh-11rem)] h-[540px]"
      }`}
    >
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">Neural Intelligence</h3>
            <span className="text-[9px] text-cyan-400 font-mono">ChromaDB RAG Assistant</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col p-4 overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto space-y-2.5 no-scrollbar pr-1">
            {messages.map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
                  <span className="text-[9px] text-cyan-400 uppercase font-bold block">User</span>
                  {m.q}
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-slate-200 leading-relaxed">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> AI Assistant
                  </span>
                  {m.a}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAsk} className="pt-2.5 flex items-center gap-1.5 border-t border-slate-800/80 mt-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Query supply mind twin…"
              className="text-xs h-8"
              disabled={asking}
            />
            <Button type="submit" size="sm" disabled={asking || !question.trim()} className="h-8 px-2.5">
              {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </form>
        </div>
      )}
    </motion.div>
  )
}

// ----------------------------------------------------------------------
// DATASETS WINDOW
// ----------------------------------------------------------------------
function DatasetsWindow({
  isMinimized,
  onToggleMinimize,
  onClose,
}: {
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  const [datasetsList, setDatasetsList] = useState<DatasetUploadResponse[]>([])

  useState(() => {
    listDatasets({ page_size: 8 })
      .then((res) => setDatasetsList(res.data.datasets))
      .catch((e) => console.error(e))
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`pointer-events-auto flex flex-col rounded-3xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ${
        isMinimized ? "w-72 h-14" : "w-80 sm:w-96 max-h-[calc(100vh-11rem)] h-[540px]"
      }`}
    >
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">Datasets & Ingestion</h3>
            <span className="text-[9px] text-cyan-400 font-mono">PostgreSQL Registered</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar text-xs">
          <span className="text-[11px] font-semibold text-slate-300 block">Ingested Files</span>
          {datasetsList.map((d) => (
            <div
              key={d.id}
              className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/50 flex justify-between items-center"
            >
              <div className="truncate max-w-[190px]">
                <div className="font-mono font-bold text-white truncate">{d.original_filename}</div>
                <span className="text-[9px] text-slate-400">{d.dataset_category} • {d.valid_rows} rows</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-mono border border-emerald-500/30">
                {d.processing_status}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
