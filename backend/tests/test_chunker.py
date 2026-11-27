"""Tests for SUPPLYMIND document chunking module.

Verifies:
- chunk_documents function with RecursiveCharacterTextSplitter.
- Small documents handling.
- Large documents splitting and chunk overlap.
- Metadata preservation (source, page, etc.).
- Empty documents removal.
- Handling empty list input.
"""

from langchain_core.documents import Document

from app.rag.chunker import chunk_documents


class TestChunkDocuments:
    def test_empty_list(self):
        assert chunk_documents([]) == []

    def test_small_document_preserves_content(self):
        """Small document (<= 800 chars) is processed and original metadata is preserved."""
        small_text = "SUPPLYMIND tracks supplier lead times and warehouse stock levels."
        doc = Document(
            page_content=small_text,
            metadata={"source": "memo.txt", "document_type": "txt"},
        )
        chunks = chunk_documents([doc], chunk_size=800, chunk_overlap=120)

        assert len(chunks) == 1
        assert chunks[0].page_content == small_text
        assert chunks[0].metadata["source"] == "memo.txt"
        assert chunks[0].metadata["document_type"] == "txt"

    def test_large_document_splitting_and_overlap(self):
        """Large document (> 800 chars) is split into chunks with overlap."""
        paragraphs = [
            f"Section {i}: In supply chain logistics, reliable freight tracking is essential. "
            f"Shipment {i} details transit through major ports and customs clearance hubs."
            for i in range(1, 20)
        ]
        large_text = "\n\n".join(paragraphs)
        assert len(large_text) > 2000

        doc = Document(
            page_content=large_text,
            metadata={"source": "logistics_manual.pdf", "page": 4},
        )
        chunks = chunk_documents([doc], chunk_size=800, chunk_overlap=120)

        assert len(chunks) > 2

        # Verify chunk sizing
        for chunk in chunks:
            assert len(chunk.page_content) <= 850

        # Verify chunk overlap between consecutive chunks
        assert (
            chunks[0].page_content[-40:] in chunks[1].page_content
            or chunks[0].page_content.split()[-2] in chunks[1].page_content
        )

        # Verify original metadata is preserved across all chunks
        for chunk in chunks:
            assert chunk.metadata["source"] == "logistics_manual.pdf"
            assert chunk.metadata["page"] == 4

    def test_pdf_page_metadata_preservation(self):
        """Multiple PDF pages maintain discrete page identifiers."""
        docs = [
            Document(page_content="Terms on warranty and liabilities.", metadata={"source": "contract.pdf", "page": 1}),
            Document(page_content="Delivery schedules and penalties.", metadata={"source": "contract.pdf", "page": 2}),
        ]
        chunks = chunk_documents(docs)
        assert len(chunks) == 2
        assert chunks[0].metadata["page"] == 1
        assert chunks[1].metadata["page"] == 2

    def test_empty_documents_removal(self):
        """Empty documents or whitespace-only documents are cleanly filtered out."""
        docs = [
            Document(page_content="", metadata={"source": "empty1.txt"}),
            Document(page_content="   \n\n  ", metadata={"source": "empty2.txt"}),
            Document(page_content="Valid short content", metadata={"source": "valid.txt"}),
        ]
        chunks = chunk_documents(docs)
        assert len(chunks) == 1
        assert chunks[0].metadata["source"] == "valid.txt"
