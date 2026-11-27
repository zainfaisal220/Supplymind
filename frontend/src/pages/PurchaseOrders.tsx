import { useState, useEffect } from "react"
import { purchaseOrders, deletePurchaseOrder, clearPurchaseOrders } from "@/api/services"
import type { PurchaseOrdersResponse } from "@/api/types"
import { DataTable } from "@/components/DataTable"
import { BarChartCard, DonutChartCard } from "@/components/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency, formatDate, formatNumber, getErrorMessage } from "@/lib/utils"
import { Truck } from "lucide-react"

export function PurchaseOrdersPage() {
  const [data, setData] = useState<PurchaseOrdersResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await purchaseOrders({
          page: data.page,
          page_size: data.page_size,
        })
        if (!cancelled) setData(res.data)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [data.page, data.page_size])

  const totalValue = data.items.reduce<number>(
    (acc, b) => acc + (b.total_amount || 0),
    0
  )

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Delete purchase order ${row.po_number}?`)) return
    try {
      await deletePurchaseOrder(row.id)
      setData((p) => ({
        ...p,
        items: p.items.filter((item) => item.id !== row.id),
        total: Math.max(0, p.total - 1),
      }))
    } catch (err) {
      alert(getErrorMessage(err))
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL purchase orders?")) return
    try {
      await clearPurchaseOrders()
      setData((p) => ({
        ...p,
        items: [],
        total: 0,
      }))
    } catch (err) {
      alert(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#EDE6D8]/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#EDE6D8]/20 flex items-center justify-center text-[#EDE6D8]">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Purchase Orders & Inbound</h1>
            <p className="text-xs text-[#B8B0A0] mt-0.5">
              Vendor purchase orders, active shipments, and dock intake statuses
            </p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Total PO Value
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatCurrency(totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Active Shipments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatNumber(data.items.length)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Pending Intake
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatNumber(data.items.filter((p) => (p.status || "").toLowerCase() === "pending").length)} Pending
            </div>
          </CardContent>
        </Card>
      </div>


      {/* PO Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard
          title="Purchase Order Spend by PO"
          subtitle="Total value across active and pending purchase orders"
          data={data.items.map((po) => ({
            label: po.po_number,
            sublabel: po.supplier_name || undefined,
            value: po.total_amount || 0,
          }))}
          valueFormatter={(v) => formatCurrency(v)}
          emptyText="No purchase orders yet. Upload a PO spreadsheet to view spend charts."
        />
        <DonutChartCard
          title="PO Status Breakdown"
          subtitle="Distribution by fulfillment stage"
          data={Object.entries(
            data.items.reduce<Record<string, number>>((acc, po) => {
              const key = (po.status || "pending").toLowerCase()
              acc[key] = (acc[key] || 0) + 1
              return acc
            }, {})
          ).map(([label, value]) => ({ label, value }))}
          emptyText="No purchase order status data available yet."
        />
      </div>

      {/* Table */}
      <DataTable
        title="Purchase Orders"
        columns={[
          { key: "po_number", label: "PO #" },
          { key: "supplier_name", label: "Supplier" },
          {
            key: "total_amount",
            label: "Total Amount",
            render: (v) => formatCurrency(v),
          },
          {
            key: "order_date",
            label: "Order Date",
            render: (v) => formatDate(v),
          },
        ]}
        data={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
        onPageChange={(page: number) => setData({ ...data, page })}
        loading={loading}
        statusColumn={{ key: "status", label: "Status" }}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />
    </div>
  )
}
