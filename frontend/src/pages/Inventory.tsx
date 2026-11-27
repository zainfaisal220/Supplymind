import { useState, useEffect } from "react"
import { inventory, deleteInventoryItem, clearInventory } from "@/api/services"
import type { InventoryResponse } from "@/api/types"
import { DataTable } from "@/components/DataTable"
import { BarChartCard } from "@/components/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatDate, formatNumber, getErrorMessage } from "@/lib/utils"
import { Package } from "lucide-react"

export function InventoryPage() {
  const [data, setData] = useState<InventoryResponse>({
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
        const res = await inventory({
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

  const totalUnits = data.items.reduce<number>(
    (acc, b) => acc + b.quantity_available,
    0
  )

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Delete inventory record for SKU ${row.sku}?`)) return
    try {
      await deleteInventoryItem(row.id)
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
    if (!window.confirm("Are you sure you want to delete ALL inventory records?")) return
    try {
      await clearInventory()
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
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Warehouse Inventory</h1>
            <p className="text-xs text-[#B8B0A0] mt-0.5">
              Live stock quantities, SKU locations, and warehouse balances
            </p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Total Available Units
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatNumber(totalUnits)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Tracked SKUs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-white">
              {formatNumber(data.items.length)}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Warehouse Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatNumber(new Set(data.items.map((i) => i.location || "Main Warehouse")).size)}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Stock Distribution Chart */}
      <BarChartCard
        title="Available Stock by SKU"
        subtitle="Real-time warehouse balance across tracked SKUs"
        data={data.items.map((item) => ({
          label: item.sku,
          sublabel: item.location || "Main Warehouse",
          value: item.quantity_available,
        }))}
        valueFormatter={(v) => `${formatNumber(v)} units`}
        emptyText="No inventory records yet. Upload an inventory spreadsheet to see stock charts."
      />

      {/* Interactive Data Table */}
      <DataTable
        title="Inventory Records"
        columns={[
          { key: "sku", label: "SKU" },
          { key: "location", label: "Location" },
          {
            key: "quantity_available",
            label: "Available Units",
            render: (v) => formatNumber(v),
          },
          {
            key: "record_date",
            label: "Record Date",
            render: (v) => formatDate(v),
          },
        ]}
        data={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
        onPageChange={(page: number) => setData({ ...data, page })}
        loading={loading}
        statusColumn={{ key: "quantity_available", label: "Stock" }}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />
    </div>
  )
}
