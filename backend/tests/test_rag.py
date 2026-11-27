"""Unit and integration tests for SUPPLYMIND RAG module.

Tests DocumentBuilder, DocumentChunker, EmbeddingManager, and SupplyMindRetriever.
"""

import pytest
from langchain_core.documents import Document

from app.rag.chunker import chunk_documents
from app.rag.document_builder import DocumentBuilder
from app.rag.embeddings import get_embedding_model
from app.rag.loader import load_document
from app.rag.retriever import SupplyMindRetriever


class TestRAGLoader:
    def test_load_document_txt(self, tmp_path):
        sample_txt = tmp_path / "rag_notes.txt"
        sample_txt.write_text("SUPPLYMIND RAG context data", encoding="utf-8")
        docs = load_document(sample_txt)
        assert len(docs) == 1
        assert "SUPPLYMIND RAG context data" in docs[0].page_content

    def test_load_document_unsupported(self, tmp_path):
        unsupported = tmp_path / "binary.bin"
        unsupported.write_bytes(b"12345")
        with pytest.raises(ValueError) as exc:
            load_document(unsupported)
        assert "Unsupported file format" in str(exc.value)


class TestDocumentBuilder:
    def test_build_single_document(self):
        doc = DocumentBuilder.build_document(
            content="Apex Logistics is the primary ocean freight carrier.",
            source="carriers.pdf",
            document_type="pdf",
            metadata={"page": 1, "region": "APAC"},
        )
        assert doc.page_content == "Apex Logistics is the primary ocean freight carrier."
        assert doc.metadata["source"] == "carriers.pdf"
        assert doc.metadata["document_type"] == "pdf"
        assert doc.metadata["page"] == 1
        assert doc.metadata["region"] == "APAC"
        assert "doc_id" in doc.metadata

    def test_build_batch(self):
        items = [
            {"content": "Shipment #1 delivered", "source": "s1.csv", "document_type": "csv"},
            {"content": "Shipment #2 delayed", "source": "s2.csv", "document_type": "csv"},
        ]
        docs = DocumentBuilder.build_batch(items)
        assert len(docs) == 2
        assert docs[0].page_content == "Shipment #1 delivered"
        assert docs[1].page_content == "Shipment #2 delayed"


class TestDocumentChunker:
    def test_chunking_with_metadata_preservation(self):
        long_text = "Supply chain risk analysis.\n\n" + ("Component backlog affects lead time. " * 40)
        parent_doc = Document(
            page_content=long_text,
            metadata={
                "source": "risk_report.pdf",
                "document_type": "pdf",
                "page": 3,
            },
        )

        chunks = chunk_documents([parent_doc], chunk_size=200, chunk_overlap=40)

        assert len(chunks) > 1
        for chunk in chunks:
            assert chunk.metadata["source"] == "risk_report.pdf"
            assert chunk.metadata["document_type"] == "pdf"
            assert chunk.metadata["page"] == 3


class TestEmbeddings:
    def test_huggingface_embeddings(self):
        embeddings = get_embedding_model()

        # Embed a single query
        query_vector = embeddings.embed_query("Lead times for suppliers")
        assert isinstance(query_vector, list)
        assert len(query_vector) == 384

        # Embed a list of texts/documents
        doc_vectors = embeddings.embed_documents([
            "Supplier lead time",
            "Warehouse storage cost"
        ])
        assert len(doc_vectors) == 2
        assert len(doc_vectors[0]) == 384
        assert len(doc_vectors[1]) == 384


class TestSupplyMindRetriever:
    def test_indexing_and_retrieval(self):
        docs = [
            Document(
                page_content="Air freight rates increased by 15% due to fuel surcharges.",
                metadata={"source": "freight_rates.pdf", "document_type": "pdf", "page": 1},
            ),
            Document(
                page_content="Warehouse inventory shows 400 surplus units of SKU-101.",
                metadata={"source": "inventory.xlsx", "document_type": "xlsx", "sheet_name": "Inventory", "row_index": 5},
            ),
            Document(
                page_content="Supplier Acme Corp renewed contract for lithium batteries.",
                metadata={"source": "contracts.docx", "document_type": "docx"},
            ),
        ]

        retriever = SupplyMindRetriever()
        retriever.index_documents(docs)

        # Retrieve relevant to inventory
        results = retriever.retrieve("surplus units SKU warehouse", top_k=2)
        assert len(results) > 0

        # Retrieve with metadata filter
        filtered_results = retriever.retrieve("units", top_k=2, filter_metadata={"document_type": "xlsx"})
        for doc in filtered_results:
            assert doc.metadata["document_type"] == "xlsx"

    def test_format_context(self):
        docs = [
            Document(
                page_content="Delay at Suez Canal affects transit time.",
                metadata={"source": "route_status.pdf", "page": 2},
            )
        ]
        context = SupplyMindRetriever.format_context(docs)
        assert "--- [Document 1] Source: route_status.pdf, Page 2 ---" in context
        assert "Delay at Suez Canal" in context
