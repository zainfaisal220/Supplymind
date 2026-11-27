import { useState, useEffect } from "react"
import { sales, deleteSale, clearSales } from "@/api/services"
import type { SalesResponse } from "@/api/types"
import { DataTable } from "@/components/DataTable"
import { AreaChartCard } from "@/components/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency, formatDate, formatNumber, getErrorMessage } from "@/lib/utils"
import { Activity } from "lucide-react"

export function SalesPage() {
  const [data, setData] = useState<SalesResponse>({
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
        const res = await sales({
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

  const totalRevenue = data.items.reduce<number>(
    (acc, b) => acc + b.total_amount,
    0
  )
  const totalQty = data.items.reduce<number>((acc, b) => acc + b.quantity, 0)

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Delete sales transaction for SKU ${row.sku}?`)) return
    try {
      await deleteSale(row.id)
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
    if (!window.confirm("Are you sure you want to delete ALL sales transactions?")) return
    try {
      await clearSales()
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
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sales & Outbound Flow</h1>
            <p className="text-xs text-[#B8B0A0] mt-0.5">
              Live transaction records, revenue throughput, and order velocity
            </p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Total Units Sold
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-white">
              {formatNumber(totalQty)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Avg Order Value
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatCurrency(data.items.length > 0 ? totalRevenue / data.items.length : 0)}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Revenue Flow Chart */}
      <AreaChartCard
        title="Sales Revenue Flow"
        subtitle="Revenue per SKU across recorded transactions"
        data={data.items.map((item) => ({
          label: item.sku || "SKU",
          value: item.total_amount,
        }))}
        valueFormatter={(v) => formatCurrency(v)}
        emptyText="No sales transactions yet. Upload sales data to view revenue trends."
      />

      {/* Table */}
      <DataTable
        title="Sales Transactions"
        columns={[
          { key: "sku", label: "SKU" },
          {
            key: "quantity",
            label: "Quantity",
            render: (v) => formatNumber(v),
          },
          {
            key: "unit_price",
            label: "Unit Price",
            render: (v) => formatCurrency(v),
          },
          {
            key: "total_amount",
            label: "Total Amount",
            render: (v) => formatCurrency(v),
          },
          {
            key: "sale_date",
            label: "Date",
            render: (v) => formatDate(v),
          },
        ]}
        data={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
        onPageChange={(page: number) => setData({ ...data, page })}
        loading={loading}
        statusColumn={{ key: "total_amount", label: "Amount" }}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />
    </div>
  )
}
