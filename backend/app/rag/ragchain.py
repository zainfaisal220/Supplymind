"""RAG Chain for SUPPLYMIND.

Retrieve from ChromaDB + generate with Groq LLM.
"""

import os
import re
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv

# Ensure environment variables are loaded (backend/.env is 3 levels up from this file)
_backend_dir = Path(__file__).resolve().parents[2]  # d:\Supplymind\backend
load_dotenv(_backend_dir / ".env", override=True)
load_dotenv(_backend_dir.parent / ".env", override=False)
load_dotenv(override=False)

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import settings
from app.rag.chunker import chunk_documents
from app.rag.document_builder import DocumentBuilder
from app.rag.loader import load_document
from app.rag.retriever import retrieve_documents
from app.rag.vector_store import add_documents, get_vector_store


RAG_PROMPT = ChatPromptTemplate.from_template(
    """You are SUPPLYMIND, an intelligent operational copilot for enterprise supply chain management.

OPERATIONAL DATABASE & INGESTION STATUS:
{db_context}

CONTRACTS, SLAS & KNOWLEDGE DOCUMENTS:
{doc_context}

USER QUESTION:
{question}

RESPONSE GUIDELINES:
- Write like a sharp, professional human supply chain manager speaking directly to a colleague.
- Tone MUST be natural, conversational, direct, and human.
- ABSOLUTELY NO markdown asterisks (never use ** or *), NO hashtag headers (never use #), and NO markdown pipe tables (|---|).
- Write in clean, normal prose and simple bullet points (- Item: detail).
- NEVER use robotic AI headings like "Key Points", "Contractor Snapshot", "Summary", or "Overview". Start directly with the answer.
- NEVER sound like a chatbot: do not say "As an AI", "In summary", "Key takeaways", "I hope this helps", or "Feel free to ask".
- Give exact figures, counts, and financial values directly and clearly.
- If answering about suppliers, inventory, or orders, explain the status clearly in plain English.

Answer:"""
)


def _humanize_response(text: str) -> str:
    """Strip robotic AI artifacts, asterisks, pipe table markdown, and format as clean human language."""
    if not text:
        return ""
    # Strip markdown bold/italic asterisks: **text** -> text, *text* -> text
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    # Strip markdown headers: ### Header -> Header
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Strip robotic section tags if generated like "Key Points:", "Summary:", "Overview:"
    text = re.sub(
        r"^(Key Points|Summary|Overview|Snapshot|Important Notes|Key Takeaways|Executive Summary):\s*",
        "",
        text,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    # Clean up any leftover markdown table pipes into clean human sentences / bullets
    lines = text.split("\n")
    cleaned_lines = []
    table_headers = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        # Table separator line: |---|---|
        if re.match(r"^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?$", stripped):
            in_table = True
            continue
        # Table row: | col1 | col2 | ...
        if stripped.startswith("|") and stripped.endswith("|"):
            parts = [p.strip() for p in stripped.strip("|").split("|")]
            if not in_table and not table_headers:
                table_headers = parts
                continue
            elif in_table or table_headers:
                if table_headers and len(parts) == len(table_headers):
                    row_desc = ", ".join(f"{h}: {v}" for h, v in zip(table_headers, parts) if v and h != "#")
                    cleaned_lines.append(f"• {row_desc}")
                else:
                    cleaned_lines.append("• " + " — ".join(p for p in parts if p))
                continue
        in_table = False
        table_headers = []
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)
    # Clean up any residual asterisks
    text = text.replace("**", "").replace("*", "")
    # Clean up excess blank lines
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def _clean_source_name(raw_source: str) -> str:
    clean_name = Path(raw_source).name if ("\\" in raw_source or "/" in raw_source) else raw_source
    clean_name = re.sub(r"^[0-9a-fA-F]{32}_", "", clean_name)
    clean_name = re.sub(r"^demo_", "", clean_name)
    return clean_name


def _is_greeting_or_chitchat(question: str) -> bool:
    q = re.sub(r"[^\w\s]", "", question.lower()).strip()
    greetings = {
        "hi", "hello", "hey", "hola", "yo", "sup",
        "good morning", "good afternoon", "good evening",
        "how are you", "whats up", "what is up",
        "thanks", "thank you", "thx", "bye", "goodbye", "ok", "okay",
    }
    return q in greetings or len(q) <= 2


def clean_and_deduplicate_sources(
    sources: List[Dict[str, Any]],
    answer_text: str = "",
    question: str = "",
    active_upload_names: set[str] | None = None,
) -> List[Dict[str, Any]]:
    """Clean up source names, filter irrelevant/unused entries, and deduplicate."""
    if _is_greeting_or_chitchat(question):
        return []

    ans_lower = answer_text.lower()
    if any(
        phrase in ans_lower
        for phrase in [
            "could not find",
            "no data available",
            "no relevant information",
            "no uploaded",
            "haven't uploaded",
            "not uploaded",
        ]
    ):
        return []

    seen_names = set()
    cleaned: List[Dict[str, Any]] = []
    text_context = (question + " " + answer_text).lower()

    for s in sources:
        raw_source = s.get("source", "")
        doc_type = s.get("document_type", "document")

        if not raw_source or "temp" in raw_source.lower() or "tmp" in raw_source.lower():
            continue

        clean_name = _clean_source_name(raw_source)

        # Relevance filtering for database sources
        if "postgresql" in clean_name.lower():
            if "supplier" in clean_name.lower() and not any(k in text_context for k in ["supplier", "vendor", "sla"]):
                continue
            if "inventory" in clean_name.lower() and not any(k in text_context for k in ["inventory", "sku", "product", "stock", "count", "item", "warehouse", "unit"]):
                continue
            if "purchase_orders" in clean_name.lower() and not any(k in text_context for k in ["purchase", "po", "order", "shipment", "spend"]):
                continue
            if "sales" in clean_name.lower() and not any(k in text_context for k in ["sale", "revenue", "flow", "customer", "sold"]):
                continue

        if "dataset_preprocessing" in clean_name.lower() and not any(k in text_context for k in ["preprocess", "dataset", "upload", "file", "ingest", "sheet"]):
            continue

        # Spreadsheet sources only if question/answer actually involves data/spreadsheets
        if doc_type == "spreadsheet":
            if active_upload_names is not None and clean_name.lower() not in active_upload_names:
                continue
            if not any(
                k in text_context
                for k in ["sheet", "excel", "xlsx", "csv", "row", "po", "sku", "inventory", "stock", "sale", "revenue", "supplier", "product", "order", "total", "dataset", "file", clean_name.lower()]
            ):
                continue

        # Document/PDF sources only if still registered in DB and actually relevant
        if doc_type in {"document", "pdf", "text"}:
            if active_upload_names is not None and clean_name.lower() not in active_upload_names:
                continue

        if clean_name not in seen_names:
            seen_names.add(clean_name)
            cleaned.append({
                "source": clean_name,
                "document_type": doc_type,
                "page": s.get("page"),
                "sheet_name": s.get("sheet_name"),
                "row_index": s.get("row_index"),
            })

    return cleaned


def get_llm() -> ChatGroq:
    """Initialize Groq LLM."""
    api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured. Please add GROQ_API_KEY to your .env file.")
    model_name = settings.GROQ_MODEL or os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    return ChatGroq(
        model=model_name,
        api_key=api_key,
        temperature=0.2,
    )


def format_context(documents: List[Document]) -> str:
    """Format retrieved documents into context string."""
    if not documents:
        return "No relevant context found."
    return "\n\n".join(doc.page_content for doc in documents)


class SupplyMindRAGChain:
    """End-to-end RAG: load -> chunk -> index (ChromaDB) -> retrieve -> generate."""

    def __init__(self):
        self._llm = None
        self._vector_store = None
        self._chain = None

    @property
    def llm(self):
        if self._llm is None:
            self._llm = get_llm()
        return self._llm

    @property
    def vector_store(self):
        if self._vector_store is None:
            self._vector_store = get_vector_store()
        return self._vector_store

    @property
    def chain(self):
        if self._chain is None:
            self._chain = RAG_PROMPT | self.llm | StrOutputParser()
        return self._chain

    def load_and_index_file(self, file_path: str) -> List[str]:
        raw_docs = load_document(file_path)
        if not raw_docs:
            return []
        docs = [
            DocumentBuilder.build_document(
                content=doc.page_content,
                source=doc.metadata.get("source", file_path),
                document_type="pdf",
                metadata=doc.metadata,
            )
            for doc in raw_docs
        ]
        chunks = chunk_documents(docs)
        return add_documents(self.vector_store, chunks) if chunks else []

    def index_texts(self, texts: List[str]) -> List[str]:
        docs = [
            DocumentBuilder.build_document(
                content=text,
                source="manual_input",
                document_type="text",
            )
            for text in texts
        ]
        chunks = chunk_documents(docs)
        return add_documents(self.vector_store, chunks) if chunks else []

    def retrieve(self, question: str, k: int = 4) -> List[Document]:
        return retrieve_documents(vector_store=self.vector_store, query=question, k=k)

    def ask(self, question: str, k: int = 4, db: Any = None) -> Dict[str, Any]:
        if not question.strip():
            raise ValueError("Question cannot be empty.")

        # 1. Retrieve DB and Preprocessing context if session provided
        db_context = ""
        combined_sources: List[Dict[str, Any]] = []
        active_upload_names: set[str] | None = None
        if db is not None:
            from app.database.models import DatasetUpload
            from app.rag.db_context import build_db_and_preprocessing_context

            active_upload_names = {
                _clean_source_name(u.original_filename).lower()
                for u in db.query(DatasetUpload.original_filename).all()
                if u.original_filename
            }
            db_context, db_sources = build_db_and_preprocessing_context(db, question)
            combined_sources.extend(db_sources)
        else:
            db_context = "No live database session provided."

        # 2. Retrieve Document vector store context (only from currently registered uploads)
        documents: List[Document] = []
        if not _is_greeting_or_chitchat(question):
            try:
                raw_docs = self.retrieve(question, k=k)
                for doc in raw_docs:
                    src = _clean_source_name(str(doc.metadata.get("source", ""))).lower()
                    if active_upload_names is None or src in active_upload_names:
                        documents.append(doc)
            except Exception:
                documents = []

        doc_context = (
            format_context(documents)
            if documents
            else "No relevant document passages retrieved."
        )
        for doc in documents:
            combined_sources.append(doc.metadata)

        # 3. If neither context has meaningful information
        if not documents and (not db or "No live database" in db_context):
            return {
                "answer": "I could not find relevant information in the live database or uploaded documents.",
                "sources": [],
            }

        # 4. Generate answer with Groq LLM
        answer = self.chain.invoke(
            {
                "db_context": db_context,
                "doc_context": doc_context,
                "question": question,
            }
        )
        answer = _humanize_response(answer)

        # 5. Clean up, filter relevance, and deduplicate sources
        cleaned_sources = clean_and_deduplicate_sources(
            combined_sources,
            answer_text=answer,
            question=question,
            active_upload_names=active_upload_names,
        )

        return {"answer": answer, "sources": cleaned_sources}


def create_rag_chain() -> SupplyMindRAGChain:
    return SupplyMindRAGChain()