import { useState, useCallback } from "react"
import { uploadDocument, chat } from "@/api/services"
import type { ChatResponse } from "@/api/types"
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge } from "@/components/ui"
import { getErrorMessage } from "@/lib/utils"
import {
  FileText,
  Send,
  Loader2,
  Bot,
  Sparkles,
  Upload,
  HelpCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react"

const SUGGESTED_QUERIES = [
  "Who are our active suppliers and how are they performing?",
  "What datasets have been uploaded so far?",
  "Show current inventory stock levels and warehouse locations",
  "What are the late delivery penalties in the supplier agreement?",
]

function HumanizedMessage({ text }: { text: string }) {
  if (!text) return null

  // Clean out any raw markdown asterisks, hashes, or robotic headers
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*\*\s*/gm, "• ")

  const lines = clean.split("\n")
  const elements: React.ReactNode[] = []
  let bulletGroup: string[] = []

  const flushBullets = (keyPrefix: string) => {
    if (bulletGroup.length === 0) return
    elements.push(
      <ul key={`${keyPrefix}-ul`} className="space-y-1.5 my-2">
        {bulletGroup.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-[#E5DCCA] leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EDE6D8]/60 mt-2 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
    bulletGroup = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets(`b-${i}`)
      return
    }

    // Check if table row | ... |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushBullets(`t-${i}`)
      if (/^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?$/.test(trimmed)) return
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
      if (cells.length > 0) {
        elements.push(
          <div
            key={`tr-${i}`}
            className="text-xs font-mono bg-[#1E1A13]/60 px-3 py-1.5 rounded-lg border border-[#EDE6D8]/10 my-1 flex flex-wrap gap-3"
          >
            {cells.map((cell, ci) => (
              <span key={ci} className="text-[#E5DCCA]">
                {cell}
              </span>
            ))}
          </div>
        )
      }
      return
    }

    // Bullet point
    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      bulletGroup.push(trimmed.replace(/^[•\-\*]\s*/, ""))
      return
    }

    // Regular paragraph
    flushBullets(`p-${i}`)
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed text-sm text-[#E5DCCA] mb-2 last:mb-0">
        {trimmed}
      </p>
    )
  })

  flushBullets("final")

  return <div className="space-y-1">{elements}</div>
}

export function DocumentIntelligencePage() {
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [asking, setAsking] = useState(false)
  const [messages, setMessages] = useState<{ q?: string; a: ChatResponse }[]>([
    {
      a: {
        answer:
          "Hello! I'm your SupplyMind Copilot. Ask me anything about your inventory, purchase orders, suppliers, uploaded spreadsheets, or supplier contracts.",
        sources: [],
      },
    },
  ])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadStatus(null)
    try {
      const res = await uploadDocument(file)
      const successMsg = `Uploaded "${res.data.file_name}" (${res.data.chunks_stored} sections indexed)`
      setUploadStatus(successMsg)
      setMessages((p) => [
        ...p,
        {
          q: `Uploaded document: ${res.data.file_name}`,
          a: {
            answer: `"${res.data.file_name}" has been processed and added to your workspace knowledge base (${res.data.chunks_stored} sections indexed).` +
              (res.data.message ? ` ${res.data.message}` : ""),
            sources: [
              {
                source: res.data.file_name,
                document_type: "document",
                page: null,
                sheet_name: null,
                row_index: null,
              },
            ],
          },
        },
      ])
    } catch (err: any) {
      alert(getErrorMessage(err))
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }, [])

  const handleAsk = useCallback(
    async (queryText?: string) => {
      const q = (queryText ?? question).trim()
      if (!q || asking) return
      setAsking(true)
      try {
        const res = await chat({ question: q, k: 4 })
        setMessages((p) => [...p, { q, a: res.data }])
        setQuestion("")
      } catch (err: any) {
        const errMsg = getErrorMessage(err)
        setMessages((p) => [
          ...p,
          {
            q,
            a: {
              answer: `⚠️ Error querying Copilot: ${errMsg}`,
              sources: [],
            },
          },
        ])
        alert(errMsg)
      } finally {
        setAsking(false)
      }
    },
    [question, asking]
  )

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleAsk()
  }

  const clearChat = () => {
    setMessages([
      {
        a: {
          answer: "Conversation cleared. How can I help with your supply chain operations?",
          sources: [],
        },
      },
    ])
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDE6D8]/15">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-[#EDE6D8]" />
            SupplyMind AI Copilot
          </h1>
          <p className="text-sm text-[#B8B0A0] mt-1">
            Ask questions across your live operations data, uploaded spreadsheets, and supplier contracts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs py-1 px-2.5 border-[#EDE6D8]/20 text-[#EDE6D8] bg-white/10">
            Live Operations
          </Badge>
          <Badge variant="secondary" className="text-xs py-1 px-2.5 border-[#EDE6D8]/20 text-[#EDE6D8] bg-white/10">
            Uploaded Datasets
          </Badge>
          <Badge variant="secondary" className="text-xs py-1 px-2.5 border-[#EDE6D8]/20 text-[#EDE6D8] bg-white/10">
            Contracts & SLAs
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-xs text-[#B8B0A0] hover:text-white"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear Chat
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Document Ingestion & Quick Prompts */}
        <div className="space-y-6">
          {/* Document Ingestion Card */}
          <Card className="bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
            <CardHeader className="pb-3 border-b border-[#EDE6D8]/15">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#EDE6D8]" />
                Upload Knowledge Document
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-[#B8B0A0] leading-relaxed">
                Upload PDF contracts, supplier SLAs, or procurement documents. Once uploaded, the Copilot can answer questions directly from them.
              </p>

              <div className="rounded-xl border border-dashed border-[#EDE6D8]/15 bg-[#1E1A13]/55 p-4 text-center">
                <input
                  type="file"
                  id="doc-upload"
                  accept=".pdf,.docx,.txt,.html,.htm"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <label
                  htmlFor="doc-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-[#EDE6D8]/20 flex items-center justify-center text-[#EDE6D8]">
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#EDE6D8] hover:underline">
                      Click to choose file
                    </span>
                    <p className="text-[11px] text-[#A89F8E] mt-0.5">
                      PDF, DOCX, TXT, or HTML
                    </p>
                  </div>
                </label>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-xs text-[#EDE6D8] bg-white/10 border border-[#EDE6D8]/20 p-2.5 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Processing and indexing document...</span>
                </div>
              )}

              {uploadStatus && !uploading && (
                <div className="flex items-center gap-2 text-xs text-[#EDE6D8] bg-white/10 border border-[#EDE6D8]/20 p-2.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{uploadStatus}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Prompts */}
          <Card className="bg-[#2B261C]/75 backdrop-blur-md border-[#EDE6D8]/15">
            <CardHeader className="pb-3 border-b border-[#EDE6D8]/15">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#EDE6D8]" />
                Suggested Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {SUGGESTED_QUERIES.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(sq)}
                  disabled={asking}
                  className="w-full text-left p-2.5 rounded-xl bg-[#1E1A13]/60 hover:bg-[#3D3628]/80 border border-[#EDE6D8]/15 hover:border-[#EDE6D8]/20 text-xs text-[#E5DCCA] hover:text-white transition-all flex items-center justify-between group"
                >
                  <span className="line-clamp-2">{sq}</span>
                  <Sparkles className="w-3.5 h-3.5 text-slate-600 group-hover:text-[#EDE6D8] shrink-0 ml-2" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Q&A Chat Feed */}
        <div className="lg:col-span-2 flex flex-col h-[650px] rounded-2xl bg-[#2B261C]/75 backdrop-blur-md border border-[#EDE6D8]/15 overflow-hidden">
          {/* Feed Header */}
          <div className="p-4 border-b border-[#EDE6D8]/15 bg-[#1E1A13]/55 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EDE6D8]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Copilot Conversation Stream
              </span>
            </div>
            <span className="text-xs font-mono text-[#B8B0A0]">
              {messages.length} interaction{messages.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-2">
                {/* User Prompt */}
                {m.q && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-white text-[#1C1913] border border-[#EDE6D8]/15 px-4 py-2.5 text-xs shadow-lg shadow-black/20">
                      <span className="text-[10px] font-mono text-[#2B261C] uppercase tracking-wider block mb-1">
                        You
                      </span>
                      <p className="whitespace-pre-wrap text-[#1C1913] font-medium">{m.q}</p>
                    </div>
                  </div>
                )}

                {/* AI Response */}
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl bg-[#2B261C]/85 border border-[#EDE6D8]/15 p-4 text-xs text-slate-100 shadow-sm space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#EDE6D8] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      SupplyMind Copilot
                    </div>
                    <HumanizedMessage text={m.a.answer} />
                    {m.a.sources && m.a.sources.length > 0 && (
                      <div className="pt-2 border-t border-[#EDE6D8]/15 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-[#A89F8E] font-mono">Sources:</span>
                        {m.a.sources.map((src, sIdx) => {
                          const docType = src.document_type?.toLowerCase() || ""
                          const isDb = docType.includes("database") || docType.includes("postgres")
                          const isPrep = docType.includes("preprocessing") || docType.includes("pipeline")

                          const badgeColor = isDb
                            ? "bg-white/10 border-[#EDE6D8]/20 text-[#EDE6D8]"
                            : isPrep
                            ? "bg-white/10 border-[#EDE6D8]/20 text-[#EDE6D8]"
                            : "bg-white/10 border-[#EDE6D8]/20 text-[#EDE6D8]"

                          return (
                            <Badge
                              key={sIdx}
                              variant="secondary"
                              className={`text-[10px] font-mono py-0.5 px-2 border ${badgeColor}`}
                            >
                              {src.source || "Knowledge Source"}
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {asking && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[#1E1A13]/80 border border-[#EDE6D8]/15 p-4 text-xs text-[#B8B0A0] flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#EDE6D8]" />
                  <span>Analyzing your workspace data and documents...</span>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 border-t border-[#EDE6D8]/15 bg-[#1E1A13]/85 flex items-center gap-2"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about inventory levels, spreadsheets, vendor contracts..."
              className="text-xs h-10 bg-[#2B261C]/90 border-[#EDE6D8]/15 text-white placeholder:text-[#B8B0A0] focus:border-[#EDE6D8]/40"
              disabled={asking}
            />
            <Button
              type="submit"
              disabled={asking || !question.trim()}
              className="h-10 px-4 bg-white text-[#1C1913] hover:bg-[#EDE6D8] font-semibold text-xs shadow-lg shadow-black/20 disabled:opacity-60 disabled:bg-white/40 disabled:text-[#1C1913]/60 transition-colors"
            >
              {asking ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#1C1913]" />
              ) : (
                <span className="flex items-center gap-1.5 text-[#1C1913]">
                  Send <Send className="w-3.5 h-3.5 text-[#1C1913]" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
