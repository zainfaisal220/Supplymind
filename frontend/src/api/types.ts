// API types matching the FastAPI backend schemas.
// Base URL is resolved from VITE_API_BASE_URL, defaulting to relative /api
// (Vite dev server proxies /api -> http://localhost:8000).

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"

export interface SaleItem {
  id: number
  product_id: number | null
  sku: string | null
  product_name: string | null
  order_id: string | null
  customer_id: string | null
  sale_date: string
  quantity: number
  unit_price: number
  total_amount: number
  currency: string
}

export interface SalesResponse {
  items: SaleItem[]
  total: number
  page: number
  page_size: number
}

export interface InventoryItem {
  id: number
  product_id: number
  sku: string
  product_name: string | null
  location: string | null
  record_date: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
}

export interface InventoryResponse {
  items: InventoryItem[]
  total: number
  page: number
  page_size: number
}

export interface POItem {
  id: number
  product_id: number | null
  sku: string | null
  description: string | null
  quantity_ordered: number
  quantity_received: number
  unit_price: number
  total_price: number
}

export interface PurchaseOrderItem {
  id: number
  po_number: string
  supplier_id: number | null
  supplier_name: string | null
  order_date: string
  expected_date: string | null
  status: string
  total_amount: number | null
  currency: string
  items: POItem[]
}

export interface PurchaseOrdersResponse {
  items: PurchaseOrderItem[]
  total: number
  page: number
  page_size: number
}

export interface SupplierItem {
  id: number
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  payment_terms: string | null
  currency: string
  is_active: boolean
  created_at: string
}

export interface SuppliersResponse {
  items: SupplierItem[]
  total: number
  page: number
  page_size: number
}

export interface DatasetUploadResponse {
  id: number
  original_filename: string
  file_type: string
  dataset_category: string
  upload_timestamp: string
  processing_status: string
  total_rows: number
  valid_rows: number
  rejected_rows: number
  sheet_names: string[] | null
  preprocessing_report: any | null
  error_message: string | null
}

export interface DatasetListResponse {
  datasets: DatasetUploadResponse[]
  total: number
  page: number
  page_size: number
}

export interface DatasetPreviewResponse {
  dataset_id: number
  file_name: string
  file_type: string
  dataset_category: string
  columns: string[]
  dtypes: Record<string, string>
  missing_counts: Record<string, number>
  duplicate_rows: number
  sample_rows: Record<string, any>[]
  validation_warnings: string[]
  total_rows: number
}

export interface DocumentUploadResponse {
  status: string
  file_name: string
  chunks_stored: number
  message: string | null
}

export interface ChatRequest {
  question: string
  k?: number
}

export interface SourceInfo {
  source: string
  document_type: string
  page: number | null
  sheet_name: string | null
  row_index: number | null
}

export interface ChatResponse {
  answer: string
  sources: SourceInfo[]
}

export interface HealthResponse {
  status: string
  database: string
  version: string
}
