import { useState, useEffect } from "react"
import { sales, inventory, purchaseOrders, suppliers, listDatasets, health } from "@/api/services"
import type {
  SalesResponse, InventoryResponse, PurchaseOrdersResponse, SuppliersResponse, DatasetListResponse,
} from "@/api/types"

export interface OverviewMetrics {
  totalSalesRevenue: number
  totalSalesCount: number
  totalInventoryUnits: number
  inventorySkuCount: number
  activePos: number
  pendingPos: number
  totalSuppliers: number
  totalDatasets: number
  health: { status: string; database: string } | null
  loading: boolean
  error: string | null
}

export function useOverviewMetrics() {
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    totalSalesRevenue: 0,
    totalSalesCount: 0,
    totalInventoryUnits: 0,
    inventorySkuCount: 0,
    activePos: 0,
    pendingPos: 0,
    totalSuppliers: 0,
    totalDatasets: 0,
    health: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [salesRes, invRes, poRes, supRes, dsRes, healthRes] = await Promise.all([
          sales({ page_size: 100 }),
          inventory({ page_size: 100 }),
          purchaseOrders({ page_size: 100 }),
          suppliers({ page_size: 100 }),
          listDatasets({ page_size: 100 }),
          health(),
        ])

        const s = salesRes.data as SalesResponse
        const inv = invRes.data as InventoryResponse
        const po = poRes.data as PurchaseOrdersResponse
        const sup = supRes.data as SuppliersResponse
        const ds = dsRes.data as DatasetListResponse

        const totalSalesRevenue = s.items.reduce<number>((acc, it) => acc + (it.total_amount || 0), 0)
        const totalInventoryUnits = inv.items.reduce<number>((acc, it) => acc + (it.quantity_available || 0), 0)
        const activePos = po.items.filter((p) => p.status.toLowerCase().includes("active") || p.status.toLowerCase() === "pending").length
        const pendingPos = po.items.filter((p) => p.status.toLowerCase() === "pending").length

        if (!cancelled) {
          setMetrics({
            totalSalesRevenue,
            totalSalesCount: s.items.length,
            totalInventoryUnits,
            inventorySkuCount: new Set(inv.items.map((i) => i.sku).filter(Boolean)).size,
            activePos,
            pendingPos,
            totalSuppliers: sup.items.length,
            totalDatasets: ds.datasets.length,
            health: { status: healthRes.data.status, database: healthRes.data.database },
            loading: false,
            error: null,
          })
        }
      } catch (err: any) {
        if (!cancelled) {
          setMetrics((p) => ({ ...p, loading: false, error: err?.message ?? "Failed to load metrics" }))
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return metrics
}
