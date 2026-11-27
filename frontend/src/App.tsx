import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Shell } from "@/components/layout/Shell"
import { Overview } from "@/pages/Overview"
import { InventoryPage } from "@/pages/Inventory"
import { SalesPage } from "@/pages/Sales"
import { PurchaseOrdersPage } from "@/pages/PurchaseOrders"
import { SuppliersPage } from "@/pages/Suppliers"
import { DocumentIntelligencePage } from "@/pages/DocumentIntelligence"
import { DataManagementPage } from "@/pages/DataManagement"
import { ErrorBoundary } from "@/components/ErrorBoundary"

function AppErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-navy-900 flex flex-col items-center justify-center text-white p-6">
      <div className="text-2xl font-mono text-red-400 mb-2">⚠️ App Error</div>
      <div className="text-sm text-slate-300 mb-4 max-w-md text-center break-words">{error.message}</div>
      <button onClick={reset} className="btn-primary">Refresh App</button>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallback={(error, reset) => (
        <AppErrorFallback error={error} reset={reset} />
      )}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Overview />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="documents" element={<DocumentIntelligencePage />} />
            <Route path="data" element={<DataManagementPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
