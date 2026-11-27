"""Document builder for SUPPLYMIND RAG architecture.

Standardizes, cleans, and structures incoming texts, rows, or loaded content
into fully-formed LangChain Document objects with consistent identifiers and metadata.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from langchain_core.documents import Document


class DocumentBuilder:
    """Builder for constructing standardized LangChain Document objects for RAG."""

    @staticmethod
    def generate_document_id(content: str, source: str, extra_key: Optional[str] = None) -> str:
        """Generate a deterministic content-addressable hash ID for a document."""
        hash_seed = f"{source}:{extra_key or ''}:{content}"
        return hashlib.sha256(hash_seed.encode("utf-8")).hexdigest()[:16]

    @classmethod
    def build_document(
        cls,
        content: str,
        source: str,
        document_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None,
    ) -> Document:
        """Create a single standardized LangChain Document object.

        Args:
            content: Raw text content of the document.
            source: Filename or origin source identifier.
            document_type: Canonical type ('pdf', 'csv', 'xlsx', 'docx', 'txt', 'html').
            metadata: Additional domain-specific metadata.
            doc_id: Optional unique identifier. Defaults to deterministic SHA-256 hash.

        Returns:
            LangChain Document object.
        """
        clean_content = content.strip() if content else ""
        meta = dict(metadata) if metadata else {}

        doc_id = doc_id or cls.generate_document_id(
            clean_content,
            source,
            str(meta.get("page") or meta.get("row_index") or meta.get("sheet_name") or ""),
        )

        std_metadata: Dict[str, Any] = {
            "doc_id": doc_id,
            "source": source,
            "document_type": document_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Merge additional metadata while preserving standard keys
        for key, val in meta.items():
            if val is not None and key not in std_metadata:
                std_metadata[key] = val

        return Document(page_content=clean_content, metadata=std_metadata)

    @classmethod
    def build_batch(
        cls,
        items: List[Dict[str, Any]],
        default_document_type: str = "text",
    ) -> List[Document]:
        """Construct multiple Document objects from raw dictionaries.

        Args:
            items: List of dictionaries containing at least 'content' and 'source'.
            default_document_type: Fallback document type if missing.

        Returns:
            List of standardized Document objects.
        """
        documents: List[Document] = []
        for item in items:
            content = item.get("content", "")
            source = item.get("source", "unknown")
            doc_type = item.get("document_type", default_document_type)
            meta = {k: v for k, v in item.items() if k not in ("content", "source", "document_type")}
            documents.append(cls.build_document(content=content, source=source, document_type=doc_type, metadata=meta))
        return documents
