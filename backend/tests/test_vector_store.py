"""Unit tests for SUPPLYMIND Chroma vector store module."""

from pathlib import Path
import pytest
from langchain_core.documents import Document

from app.database.vector_store import add_documents, get_vector_store


class TestVectorStore:
    def test_add_documents_empty(self):
        store = get_vector_store()
        ids = add_documents(store, [])
        assert ids == []

    def test_add_documents_and_search(self, tmp_path: Path):
        from langchain_chroma import Chroma
        from app.rag.embeddings import get_embedding_model

        # Use an isolated temp directory for test persistence
        test_store = Chroma(
            collection_name="test_supplymind",
            embedding_function=get_embedding_model(),
            persist_directory=str(tmp_path / "test_chroma"),
        )

        sample_docs = [
            Document(
                page_content="Lead time for supplier Acme is 10 days.",
                metadata={"source": "acme.txt", "document_type": "txt"},
            ),
            Document(
                page_content="Safety stock for lithium batteries is 500 units.",
                metadata={"source": "stock.txt", "document_type": "txt"},
            ),
        ]

        ids = add_documents(test_store, sample_docs)
        assert len(ids) == 2

        results = test_store.similarity_search("How many lithium batteries in safety stock?", k=1)
        assert len(results) == 1
        assert "lithium batteries" in results[0].page_content
        assert results[0].metadata["source"] == "stock.txt"
