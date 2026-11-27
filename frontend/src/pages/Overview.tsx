import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useOverviewMetrics } from "@/hooks/useOverviewMetrics"
import { sales, inventory, purchaseOrders, chat } from "@/api/services"
import type { SaleItem, InventoryItem, PurchaseOrderItem } from "@/api/types"
import { BarChartCard, AreaChartCard } from "@/components/Charts"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"
import {
  Package,
  Activity,
  Truck,
  Users,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Bot,
  Send,
  Loader2,
  RefreshCw,
  FileText,
  Database,
} from "lucide-react"

export function Overview() {
  const metrics = useOverviewMetrics()

  const [recentSales, setRecentSales] = useState<SaleItem[]>([])
  const [lowStock, setLowStock] = useState<InventoryItem[]>([])
  const [recentPOs, setRecentPOs] = useState<PurchaseOrderItem[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // AI Assistant Quick Chat State
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiAsking, setAiAsking] = useState(false)

  const loadData = async () => {
    setDataLoading(true)
    try {
      const [sRes, invRes, poRes] = await Promise.all([
        sales({ page: 1, page_size: 5 }),
        inventory({ page: 1, page_size: 10 }),
        purchaseOrders({ page: 1, page_size: 5 }),
      ])
      setRecentSales(sRes.data.items)
      // Sort inventory by lowest quantity to highlight low stock
      const sortedInv = [...invRes.data.items].sort(
        (a, b) => a.quantity_available - b.quantity_available
      )
      setLowStock(sortedInv.slice(0, 5))
      setRecentPOs(poRes.data.items)
    } catch (e) {
      console.error("Failed to load dashboard data", e)
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiQuestion.trim() || aiAsking) return
    setAiAsking(true)
    setAiAnswer(null)
    try {
      const res = await chat({ question: aiQuestion.trim(), k: 4 })
      setAiAnswer(res.data.answer)
    } catch (err: any) {
      setAiAnswer(err?.response?.data?.detail ?? "Failed to query AI assistant.")
    } finally {
      setAiAsking(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Supply Chain Command Center
          </h1>
          <p className="text-sm text-[#B8B0A0] mt-1">
            Real-time telemetry, stock levels, inbound shipments, and AI document intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={dataLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#2B261C] hover:bg-[#3D3628] text-[#E5DCCA] text-xs font-semibold border border-[#EDE6D8]/15 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? "animate-spin text-[#EDE6D8]" : ""}`} />
            <span>Refresh Data</span>
          </button>
          <Link
            to="/documents"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-[#1C1913] hover:bg-[#EDE6D8] text-xs font-bold transition-colors shadow-lg shadow-black/20"
          >
            <Bot className="w-3.5 h-3.5 text-[#1C1913]" />
            <span>AI Copilot</span>
          </Link>
        </div>
      </div>

      {/* 4 Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Sales Flow */}
        <Link
          to="/sales"
          className="group p-5 rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 hover:border-[#EDE6D8]/15 hover:bg-[#2B261C] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#EDE6D8] group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {formatCurrency(metrics.totalSalesRevenue)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#B8B0A0] mt-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#EDE6D8]" />
              <span>{metrics.totalSalesCount} recorded sales orders</span>
            </div>
          </div>
        </Link>

        {/* Metric 2: Warehouse Stock */}
        <Link
          to="/inventory"
          className="group p-5 rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 hover:border-[#EDE6D8]/15 hover:bg-[#2B261C] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Warehouse Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#EDE6D8] group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {formatNumber(metrics.totalInventoryUnits)} Units
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#B8B0A0] mt-1">
              <span>{metrics.inventorySkuCount} distinct SKUs tracked</span>
            </div>
          </div>
        </Link>

        {/* Metric 3: Active Inbound Shipments */}
        <Link
          to="/purchase-orders"
          className="group p-5 rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 hover:border-[#EDE6D8]/15 hover:bg-[#2B261C] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Active POs
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#EDE6D8] group-hover:scale-110 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {metrics.activePos} In Transit
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#B8B0A0] mt-1">
              <span>{metrics.pendingPos} pending dock intake</span>
            </div>
          </div>
        </Link>

        {/* Metric 4: Connected Suppliers */}
        <Link
          to="/suppliers"
          className="group p-5 rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 hover:border-[#EDE6D8]/15 hover:bg-[#2B261C] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Suppliers Network
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#EDE6D8] group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {metrics.totalSuppliers} Partners
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#B8B0A0] mt-1">
              <span>Tier-1 vendors connected</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard
          title="Inventory Stock Distribution"
          subtitle="Lowest & active SKU stock levels"
          data={lowStock.map((item) => ({
            label: item.sku,
            sublabel: item.location || "Warehouse",
            value: item.quantity_available,
          }))}
          valueFormatter={(v) => `${formatNumber(v)} units`}
          emptyText="Upload an inventory dataset to view SKU stock distribution."
        />
        <AreaChartCard
          title="Inbound PO & Sales Value Trend"
          subtitle="Recent order and purchase order amounts"
          data={(recentSales.length > 0
            ? recentSales.map((s) => ({ label: s.sku || "SKU", value: s.total_amount }))
            : recentPOs.map((po) => ({ label: po.po_number || "PO", value: po.total_amount || 0 }))
          )}
          valueFormatter={(v) => formatCurrency(v)}
          emptyText="Upload sales or purchase order data to view value trends."
        />
      </div>

      {/* Main Grid: Data Tables & AI Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Operational Tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Sales Orders Table */}
          <div className="rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#EDE6D8]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#EDE6D8]" />
                <h3 className="text-sm font-bold text-white">Recent Sales & Order Flow</h3>
              </div>
              <Link
                to="/sales"
                className="text-xs font-semibold text-[#EDE6D8] hover:text-[#EDE6D8] flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E1A13]/70 text-[#B8B0A0] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-5 py-3">Order / SKU</th>
                    <th className="px-5 py-3">Units</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE6D8]/10">
                  {recentSales.length > 0 ? (
                    recentSales.map((item) => (
                      <tr key={item.id} className="hover:bg-[#3D3628]/30 transition-colors">
                        <td className="px-5 py-3 font-semibold text-white">
                          <div className="font-mono text-[#EDE6D8]">{item.sku}</div>
                          <div className="text-[11px] text-[#B8B0A0]">{item.product_name}</div>
                        </td>
                        <td className="px-5 py-3 font-mono">{formatNumber(item.quantity)}</td>
                        <td className="px-5 py-3 font-mono font-bold text-[#EDE6D8]">
                          {formatCurrency(item.total_amount)}
                        </td>
                        <td className="px-5 py-3 text-[#B8B0A0] font-mono">
                          {formatDate(item.sale_date)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-[#A89F8E]">
                        {dataLoading ? "Loading recent orders..." : "No recent orders recorded."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Critical Low Stock Alert Table */}
          <div className="rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#EDE6D8]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#EDE6D8]" />
                <h3 className="text-sm font-bold text-white">Inventory Stock Status</h3>
              </div>
              <Link
                to="/inventory"
                className="text-xs font-semibold text-[#EDE6D8] hover:text-[#EDE6D8] flex items-center gap-1"
              >
                <span>Manage stock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E1A13]/70 text-[#B8B0A0] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Item Name</th>
                    <th className="px-5 py-3">Available</th>
                    <th className="px-5 py-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE6D8]/10">
                  {lowStock.length > 0 ? (
                    lowStock.map((item) => (
                      <tr key={item.id} className="hover:bg-[#3D3628]/30 transition-colors">
                        <td className="px-5 py-3 font-mono font-semibold text-white">
                          {item.sku}
                        </td>
                        <td className="px-5 py-3 text-[#E5DCCA]">{item.product_name}</td>
                        <td className="px-5 py-3 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              item.quantity_available < 50
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : "bg-white/10 text-[#EDE6D8] border border-[#EDE6D8]/20"
                            }`}
                          >
                            {formatNumber(item.quantity_available)} units
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#B8B0A0] font-mono text-[11px]">
                          {item.location ?? "Main Warehouse"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-[#A89F8E]">
                        {dataLoading ? "Loading inventory items..." : "All stock levels optimal."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): AI Copilot & Inbound POs */}
        <div className="space-y-6">
          {/* AI Document Intelligence Quick Chat */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-[#EDE6D8]/15/90 p-5 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#EDE6D8]/15">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[#EDE6D8]">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">AI Supply Chain Copilot</h3>
                <p className="text-[11px] text-[#B8B0A0]">RAG Document Intelligence</p>
              </div>
            </div>

            <p className="text-xs text-[#E5DCCA] my-3 leading-relaxed">
              Ask questions across all ingested supplier contracts, purchase orders, and PDF documents.
            </p>

            <form onSubmit={handleAskAI} className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="e.g. Which supplier has the shortest lead time?"
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#1E1A13] border border-[#EDE6D8]/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={aiAsking || !aiQuestion.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-40 transition-opacity"
                >
                  {aiAsking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                </button>
              </div>
            </form>

            {aiAnswer && (
              <div className="mt-3 p-3 rounded-xl bg-[#1E1A13] border border-[#EDE6D8]/15 text-xs text-slate-200 leading-relaxed max-h-40 overflow-y-auto">
                <div className="text-[10px] uppercase font-mono font-bold text-[#EDE6D8] mb-1">
                  Answer
                </div>
                {aiAnswer}
              </div>
            )}
          </div>

          {/* Inbound Purchase Orders Summary */}
          <div className="rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE6D8]/15">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#EDE6D8]" />
                <h3 className="text-sm font-bold text-white">Inbound POs</h3>
              </div>
              <Link to="/purchase-orders" className="text-xs text-[#EDE6D8] hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-[#EDE6D8]/10 mt-2">
              {recentPOs.length > 0 ? (
                recentPOs.map((po) => (
                  <div key={po.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-semibold text-white">{po.po_number}</div>
                      <div className="text-[11px] text-[#B8B0A0]">
                        {po.supplier_name ?? "Supplier"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-200">
                        {po.total_amount ? formatCurrency(po.total_amount) : "—"}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#3D3628] text-[#E5DCCA]">
                        {po.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-[#A89F8E]">
                  {dataLoading ? "Loading purchase orders..." : "No active purchase orders."}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="rounded-2xl bg-[#2B261C]/50 border border-[#EDE6D8]/15/60 p-4">
            <div className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider mb-2">
              Quick Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                to="/data"
                className="flex items-center gap-2 p-2.5 rounded-xl bg-[#2B261C] hover:bg-[#3D3628] border border-[#EDE6D8]/15 text-[#E5DCCA] hover:text-white transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-[#EDE6D8]" />
                <span>Upload Data</span>
              </Link>
              <Link
                to="/documents"
                className="flex items-center gap-2 p-2.5 rounded-xl bg-[#2B261C] hover:bg-[#3D3628] border border-[#EDE6D8]/15 text-[#E5DCCA] hover:text-white transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-[#EDE6D8]" />
                <span>Ingest Docs</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
