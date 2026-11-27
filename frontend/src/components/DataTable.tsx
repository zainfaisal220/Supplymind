import { useState } from "react"
import { Badge, Button, Input, Separator } from "@/components/ui"
import { Search, Plus, RefreshCw, Trash2 } from "lucide-react"

interface DataTableProps<T extends Record<string, any>> {
  title: string
  columns: { key: string; label: string; render?: (val: any, row: T) => React.ReactNode }[]
  data: T[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  loading?: boolean
  actions?: React.ReactNode
  statusColumn?: { key: string; label: string }
  onDelete?: (row: T) => void
  onClearAll?: () => void
  renderActions?: (row: T) => React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  loading = false,
  actions,
  statusColumn,
  onDelete,
  onClearAll,
  renderActions,
}: DataTableProps<T>) {
  const [filter, setFilter] = useState("")
  const filtered = data.filter((row) =>
    columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(filter.toLowerCase())) ||
    (statusColumn && String(row[statusColumn.key] ?? "").toLowerCase().includes(filter.toLowerCase())),
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const start = (page - 1) * pageSize
  const pageData = filtered.slice(start, start + pageSize)

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-[#EDE6D8]" />
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onClearAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-950/40"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A89F8E]" />
            <Input
              placeholder="Filter records…"
              className="pl-9 w-64"
              value={filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => onPageChange(1)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      <CardWrapper>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-xs font-medium text-[#B8B0A0] uppercase tracking-wider">
                    {c.label}
                  </th>
                ))}
                {statusColumn && <th className="px-4 py-3 text-xs font-medium text-[#B8B0A0] uppercase tracking-wider">Status</th>}
                <th className="px-4 py-3 text-xs font-medium text-[#B8B0A0] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-sm text-[#E5DCCA]">
                      {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                  {statusColumn && (
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusColor(String(row[statusColumn.key] ?? ""))}>
                        {String(row[statusColumn.key] ?? "—")}
                      </Badge>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">
                    {renderActions ? (
                      renderActions(row)
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-[#A89F8E] hover:text-[#EDE6D8]">
                          View
                        </Button>
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(row)}
                            className="h-8 px-2 text-rose-400 hover:text-white hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (statusColumn ? 2 : 1)} className="px-4 py-8 text-center text-[#A89F8E]">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-[#B8B0A0]">
            Showing <span className="text-white font-medium">{Math.min(start + 1, filtered.length)}</span>{" "}
            to{" "}
            <span className="text-white font-medium">{Math.min(start + pageData.length, filtered.length)}</span> of{" "}
            <span className="text-white font-medium">{filtered.length}</span> entries (total {total})
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1 || loading}
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
            >
              <span className="h-3 w-3">‹</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page === pageCount || loading}
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
            >
              <span className="h-3 w-3">›</span>
            </Button>
            <span className="text-[#A89F8E] mr-2">{page} / {pageCount}</span>
          </div>
        </div>
      </CardWrapper>
    </div>
  )
}

function statusColor(status: string) {
  const s = status.toLowerCase()
  if (s.includes("deliver") || s.includes("completed") || s.includes("received")) return "success"
  if (s.includes("pending") || s.includes("processing") || s.includes("in-transit")) return "warning"
  if (s.includes("fail") || s.includes("cancel") || s.includes("error")) return "error"
  return "default"
}

function CardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel">
      {children}
    </div>
  )
}
