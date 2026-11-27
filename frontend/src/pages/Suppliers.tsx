import { useState, useEffect } from "react"
import { suppliers, deleteSupplier, clearSuppliers } from "@/api/services"
import type { SuppliersResponse } from "@/api/types"
import { DataTable } from "@/components/DataTable"
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui"
import { formatDate, formatNumber, getErrorMessage } from "@/lib/utils"
import { Users, RefreshCw } from "lucide-react"

export function SuppliersPage() {
  const [data, setData] = useState<SuppliersResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  })
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await suppliers({ page: data.page, page_size: data.page_size })
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [data.page, data.page_size])

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Delete supplier ${row.name}?`)) return
    try {
      await deleteSupplier(row.id)
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
    if (!window.confirm("Are you sure you want to delete ALL suppliers?")) return
    try {
      await clearSuppliers()
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
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Supplier Directory</h1>
            <p className="text-xs text-[#B8B0A0] mt-0.5">
              Verified supply vendors, partner lead times, and active contracts
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="h-9 text-xs border-[#EDE6D8]/15 hover:bg-[#3D3628] text-[#E5DCCA]"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh Directory
        </Button>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Connected Suppliers
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
              Active Partners
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatNumber(data.items.filter((s) => s.is_active).length)} Active
            </div>
          </CardContent>
        </Card>

        <Card className="p-4 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="p-0 pb-1">
            <CardTitle className="text-xs font-semibold text-[#B8B0A0] uppercase tracking-wider">
              Settlement Currencies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold font-mono text-[#EDE6D8]">
              {formatNumber(new Set(data.items.map((s) => s.currency || "USD")).size)} Currencies
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <DataTable
        title="Supplier Partners"
        columns={[
          { key: "name", label: "Supplier Name" },
          { key: "currency", label: "Settlement Currency" },
          {
            key: "is_active",
            label: "Status",
            render: (v) => (
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-[#EDE6D8]/20 text-[#EDE6D8] font-semibold uppercase text-[10px]">
                {v ? "Active" : "Inactive"}
              </span>
            ),
          },
          {
            key: "created_at",
            label: "Registered Date",
            render: (v) => formatDate(v),
          },
        ]}
        data={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
        onPageChange={(page: number) => setData({ ...data, page })}
        loading={loading}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />
    </div>
  )
}
