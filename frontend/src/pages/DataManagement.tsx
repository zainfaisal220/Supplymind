import { useState, useEffect, useCallback } from "react"
import { uploadDataset, listDatasets, previewDataset, deleteDataset, uploadDocument } from "@/api/services"
import type { DatasetListResponse, DatasetPreviewResponse } from "@/api/types"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { formatNumber, getErrorMessage } from "@/lib/utils"
import { Link } from "react-router-dom"
import {
  Upload,
  Database,
  RefreshCw,
  Eye,
  X,
  Loader2,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  CheckCircle2,
  Layers,
  Trash2,
} from "lucide-react"

export function DataManagementPage() {
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [datasets, setDatasets] = useState<DatasetListResponse>({
    datasets: [],
    total: 0,
    page: 1,
    page_size: 20,
  })
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listDatasets({
        page: datasets.page,
        page_size: datasets.page_size,
      })
      setDatasets(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [datasets.page, datasets.page_size])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Auto-route PDF and unstructured documents to Document Intelligence RAG
    if (/\.(pdf|docx|txt|html|htm)$/i.test(file.name)) {
      setUploading(true)
      setUploadSuccess(null)
      try {
        const res = await uploadDocument(file)
        setUploadSuccess(
          `Document "${res.data.file_name}" (${res.data.chunks_stored} sections) has been processed and added to your workspace.`
        )
        loadData()
      } catch (err: any) {
        alert(getErrorMessage(err))
      } finally {
        setUploading(false)
        e.target.value = ""
      }
      return
    }

    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      alert("Please upload a CSV, Excel, or PDF document.")
      return
    }
    setUploading(true)
    setUploadSuccess(null)
    try {
      const res = await uploadDataset(file)
      setDatasets((p) => ({
        ...p,
        datasets: [res.data, ...p.datasets],
        total: p.total + 1,
      }))
      setUploadSuccess(`Successfully ingested "${res.data.original_filename}" (${res.data.valid_rows} rows).`)
    } catch (err: any) {
      alert(getErrorMessage(err))
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handlePreview = async (id: number) => {
    setPreviewLoading(true)
    try {
      const res = await previewDataset(id)
      setPreview(res.data)
    } catch (err: any) {
      alert(getErrorMessage(err))
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDelete = async (id: number, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete dataset "${filename}"?`)) return
    setDeletingId(id)
    try {
      await deleteDataset(id)
      setDatasets((p) => ({
        ...p,
        datasets: p.datasets.filter((d) => d.id !== id),
        total: Math.max(0, p.total - 1),
      }))
      if (preview?.dataset_id === id) {
        setPreview(null)
      }
    } catch (err: any) {
      alert(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDE6D8]/15">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-[#EDE6D8]" />
            Datasets & Data Management
          </h1>
          <p className="text-sm text-[#B8B0A0] mt-1">
            Upload and manage your supply chain spreadsheets and contract documents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* AI Copilot Quick Route Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/10 border border-[#EDE6D8]/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#EDE6D8]/20 flex items-center justify-center text-[#EDE6D8] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Query your spreadsheets & contracts with AI Copilot</h3>
            <p className="text-[11px] text-[#B8B0A0]">
              All uploaded Excel/CSV datasets and PDF documents are automatically available for AI Copilot Q&A and data analysis.
            </p>
          </div>
        </div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-[#1C1913] hover:bg-[#EDE6D8] text-xs font-semibold shrink-0 transition-colors shadow-sm"
        >
          <span>Open AI Copilot</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#1C1913]" />
        </Link>
      </div>

      {/* Top Section: Upload Box & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Card */}
        <Card className="md:col-span-2 bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
          <CardHeader className="pb-3 border-b border-[#EDE6D8]/15">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#EDE6D8]" />
              Upload Dataset (Excel / CSV / PDF)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-xs text-[#B8B0A0] leading-relaxed">
              Upload CSV or Excel spreadsheets containing sales records, inventory snapshots, purchase orders, or supplier profiles. Columns will be auto-mapped and validated.
            </p>

            <div className="rounded-xl border border-dashed border-[#EDE6D8]/15 bg-[#1E1A13]/55 p-5 text-center">
              <input
                type="file"
                id="dataset-upload"
                accept=".csv,.xlsx,.xls,.pdf,.docx,.txt"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
              <label
                htmlFor="dataset-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 border border-[#EDE6D8]/20 flex items-center justify-center text-[#EDE6D8]">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#EDE6D8] hover:underline">
                    Select a CSV, Excel, or PDF file to upload
                  </span>
                  <p className="text-[11px] text-[#A89F8E] mt-0.5">
                    Supports .xlsx, .csv, and .pdf documents
                  </p>
                </div>
              </label>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-[#EDE6D8] bg-white/10 border border-[#EDE6D8]/20 p-2.5 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Validating and importing your file...</span>
              </div>
            )}

            {uploadSuccess && !uploading && (
              <div className="flex items-center gap-2 text-xs text-[#EDE6D8] bg-white/10 border border-[#EDE6D8]/20 p-2.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[#EDE6D8]/15">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#EDE6D8]" />
              Pipeline Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="p-3 rounded-xl bg-[#1E1A13]/60 border border-[#EDE6D8]/15">
              <span className="text-xs text-[#B8B0A0] block mb-1">Total Registered Datasets</span>
              <span className="text-2xl font-bold font-mono text-white">{datasets.total}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#1E1A13]/60 border border-[#EDE6D8]/15">
              <span className="text-xs text-[#B8B0A0] block mb-1">Workspace Storage</span>
              <span className="text-xs font-medium text-[#EDE6D8]">Cloud Synced</span>
            </div>
            <div className="p-3 rounded-xl bg-[#1E1A13]/60 border border-[#EDE6D8]/15">
              <span className="text-xs text-[#B8B0A0] block mb-1">Status</span>
              <span className="text-xs font-medium text-[#EDE6D8] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Ready for Uploads
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dataset Preview (If open) */}
      {preview && (
        <Card className="bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/20 shadow-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#EDE6D8]/15 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-[#EDE6D8] flex items-center gap-2">
                {preview.file_type === "pdf" ? (
                  <FileText className="w-4 h-4 text-[#EDE6D8]" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-[#EDE6D8]" />
                )}
                Preview: {preview.file_name.replace(/^demo_/, "")}
              </CardTitle>
              <p className="text-xs text-[#B8B0A0] font-mono mt-0.5">
                {preview.file_type === "pdf"
                  ? `Displaying ${preview.sample_rows?.length || 0} structured rules & benchmarks extracted from document`
                  : `Displaying first ${preview.sample_rows?.length || 0} sample rows of ${formatNumber(preview.total_rows)} total rows`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreview(null)}
              className="text-[#B8B0A0] hover:text-white h-8 px-2"
            >
              <X className="w-4 h-4 mr-1" /> Close
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs font-mono">
                <thead className="bg-[#1E1A13] sticky top-0 border-b border-[#EDE6D8]/15 text-[#B8B0A0]">
                  <tr>
                    {preview.columns?.map((c) => (
                      <th key={c} className="py-2.5 px-4 text-left font-semibold whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE6D8]/10 bg-[#2B261C]/40">
                  {preview.sample_rows?.map((r: Record<string, any>, i: number) => (
                    <tr key={i} className="hover:bg-[#3D3628]/40 transition-colors">
                      {preview.columns?.map((c) => (
                        <td key={c} className="py-2 px-4 whitespace-nowrap text-[#E5DCCA]">
                          {String(r[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registered Datasets Table */}
      <Card className="bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15 overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#EDE6D8]/15">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-[#EDE6D8]" />
            Registered Datasets Catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-[#A89F8E] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#EDE6D8]" />
              Loading registered datasets…
            </div>
          ) : datasets.datasets.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#B8B0A0]">
              No datasets uploaded yet. Upload a CSV or Excel file above to populate.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E1A13]/70 border-b border-[#EDE6D8]/15 text-[#B8B0A0] uppercase tracking-wider text-[11px] font-mono">
                  <tr>
                    <th className="py-3 px-4">Dataset Filename</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Valid Rows</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE6D8]/10 font-mono">
                  {datasets.datasets.map((d) => (
                    <tr key={d.id} className="hover:bg-[#3D3628]/40 transition-colors">
                      <td className="py-3 px-4 text-white font-semibold">
                        <div className="flex items-center gap-2">
                          {d.file_type === "pdf" ? (
                            <FileText className="w-4 h-4 text-[#EDE6D8] shrink-0" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-[#EDE6D8] shrink-0" />
                          )}
                          <span>{d.original_filename.replace(/^demo_/, "")}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] uppercase font-semibold py-0.5 px-2 ${
                            d.file_type === "pdf" || d.dataset_category === "unknown"
                              ? "text-[#EDE6D8] border-[#EDE6D8]/20 bg-white/10"
                              : "text-[#EDE6D8] border-[#EDE6D8]/20 bg-white/10"
                          }`}
                        >
                          {d.file_type === "pdf" || d.dataset_category === "unknown"
                            ? "SLA & CONTRACTS (PDF)"
                            : d.dataset_category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-[#E5DCCA]">
                        {d.file_type === "pdf"
                          ? `${d.valid_rows} clauses`
                          : formatNumber(d.valid_rows)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="success" className="text-[10px]">
                          {d.processing_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(d.id)}
                            disabled={previewLoading}
                            className="text-xs text-[#EDE6D8] hover:text-white hover:bg-white/10 h-8 px-2.5"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(d.id, d.original_filename)}
                            disabled={deletingId === d.id}
                            className="text-xs text-rose-400 hover:text-white hover:bg-rose-950/40 h-8 px-2.5"
                          >
                            {deletingId === d.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
