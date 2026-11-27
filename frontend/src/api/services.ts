import { api } from "./client"
import type {
  SalesResponse, InventoryResponse, PurchaseOrdersResponse,
  SuppliersResponse, DatasetListResponse, DatasetUploadResponse,
  DatasetPreviewResponse, DocumentUploadResponse, ChatResponse,
  ChatRequest, HealthResponse,
} from "./types"

export const health = () => api.get<HealthResponse>("/health")

export const sales = (params?: {
  sku?: string | null
  product_id?: number | null
  start_date?: string | null
  end_date?: string | null
  page?: number
  page_size?: number
}) => api.get<SalesResponse>("/sales", { params })

export const inventory = (params?: {
  sku?: string | null
  product_id?: number | null
  page?: number
  page_size?: number
}) => api.get<InventoryResponse>("/inventory", { params })

export const purchaseOrders = (params?: {
  supplier_id?: number | null
  status?: string | null
  po_number?: string | null
  page?: number
  page_size?: number
}) => api.get<PurchaseOrdersResponse>("/purchase-orders", { params })

export const deletePurchaseOrder = (id: number) =>
  api.delete<{ status: string; message: string }>(`/purchase-orders/${id}`)

export const clearPurchaseOrders = () =>
  api.delete<{ status: string; message: string }>("/purchase-orders")

export const deleteInventoryItem = (id: number) =>
  api.delete<{ status: string; message: string }>(`/inventory/${id}`)

export const clearInventory = () =>
  api.delete<{ status: string; message: string }>("/inventory")

export const deleteSale = (id: number) =>
  api.delete<{ status: string; message: string }>(`/sales/${id}`)

export const clearSales = () =>
  api.delete<{ status: string; message: string }>("/sales")

export const suppliers = (params?: { page?: number; page_size?: number }) =>
  api.get<SuppliersResponse>("/suppliers", { params })

export const deleteSupplier = (id: number) =>
  api.delete<{ status: string; message: string }>(`/suppliers/${id}`)

export const clearSuppliers = () =>
  api.delete<{ status: string; message: string }>("/suppliers")

export const listDatasets = (params?: { page?: number; page_size?: number }) =>
  api.get<DatasetListResponse>("/datasets", { params })

export const getDataset = (id: number) => api.get<DatasetUploadResponse>(`/datasets/${id}`)

export const deleteDataset = (id: number) =>
  api.delete<{ status: string; message: string }>(`/datasets/${id}`)

export const previewDataset = (id: number, sheet?: string) =>
  api.get<DatasetPreviewResponse>(`/datasets/${id}/preview`, { params: { sheet } })

export const uploadDataset = (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return api.postForm<DatasetUploadResponse>("/datasets/upload", form)
}

export const uploadDocument = (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return api.postForm<DocumentUploadResponse>("/documents/upload", form)
}

export const chat = (body: ChatRequest) => api.post<ChatResponse>("/chat", body)
