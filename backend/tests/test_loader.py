"""Unit and integration tests for SUPPLYMIND multi-format DocumentLoader.

Tests all supported formats, error handling, metadata integrity, security checks,
and multi-worksheet Excel extraction.
"""

from pathlib import Path
import pytest
import pandas as pd
from docx import Document as DocxDocument
from reportlab.pdfgen import canvas

from app.ingestion.exceptions import (
    DocumentFileNotFoundError,
    DocumentSecurityError,
    EmptyFileError,
    FileCorruptedError,
    FileSizeLimitExceededError,
    UnsupportedFileTypeError,
)
from app.ingestion.file_detector import detect_file_type
from app.ingestion.loader import DocumentLoader, load_document


@pytest.fixture
def sample_pdf(tmp_path: Path) -> Path:
    """Create a 2-page sample PDF file."""
    pdf_path = tmp_path / "supplier_contract.pdf"
    c = canvas.Canvas(str(pdf_path))
    c.drawString(100, 750, "SUPPLYMIND Supplier Contract Page 1: Terms and Conditions")
    c.showPage()
    c.drawString(100, 750, "SUPPLYMIND Supplier Contract Page 2: Delivery Schedules")
    c.save()
    return pdf_path


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    """Create a sample CSV file with multiple supply chain records."""
    csv_path = tmp_path / "inventory.csv"
    content = "item_id,item_name,quantity,unit_price\n" \
              "SKU-001,Steel Bearing,500,12.50\n" \
              "SKU-002,Hydraulic Valve,150,45.00\n" \
              "SKU-003,Copper Wire,1200,3.25\n"
    csv_path.write_text(content, encoding="utf-8")
    return csv_path


@pytest.fixture
def sample_docx(tmp_path: Path) -> Path:
    """Create a sample DOCX document."""
    docx_path = tmp_path / "logistics_policy.docx"
    doc = DocxDocument()
    doc.add_heading("SUPPLYMIND Global Logistics Policy", level=1)
    doc.add_paragraph("All international shipments require valid customs declarations.")
    doc.save(str(docx_path))
    return docx_path


@pytest.fixture
def sample_txt(tmp_path: Path) -> Path:
    """Create a sample plain text file."""
    txt_path = tmp_path / "vendor_notes.txt"
    txt_path.write_text("Vendor A: Reliable lead times. Vendor B: Discount on bulk orders.", encoding="utf-8")
    return txt_path


@pytest.fixture
def sample_html(tmp_path: Path) -> Path:
    """Create a sample HTML document with title and body."""
    html_path = tmp_path / "warehouse_bulletin.html"
    content = (
        "<!DOCTYPE html>"
        "<html>"
        "<head><title>Warehouse Operations Bulletin</title></head>"
        "<body>"
        "<h1>Q3 Logistics Update</h1>"
        "<p>Port congestion expected in Rotterdam terminal.</p>"
        "</body>"
        "</html>"
    )
    html_path.write_text(content, encoding="utf-8")
    return html_path


@pytest.fixture
def sample_excel_multi_sheet(tmp_path: Path) -> Path:
    """Create a multi-sheet Excel workbook."""
    xlsx_path = tmp_path / "supply_chain_data.xlsx"
    df_suppliers = pd.DataFrame({
        "supplier_id": ["SUP-01", "SUP-02"],
        "name": ["Apex Logistics", "Beacon Freight"],
        "rating": [4.8, 4.5],
    })
    df_shipments = pd.DataFrame({
        "tracking_num": ["TRK-9001", "TRK-9002", "TRK-9003"],
        "origin": ["Shanghai", "Hamburg", "Singapore"],
        "status": ["In Transit", "Delivered", "Customs Hold"],
    })

    with pd.ExcelWriter(str(xlsx_path), engine="openpyxl") as writer:
        df_suppliers.to_excel(writer, sheet_name="Suppliers", index=False)
        df_shipments.to_excel(writer, sheet_name="Shipments", index=False)

    return xlsx_path


class TestDocumentLoader:
    """Test suite for DocumentLoader functionality and error boundaries."""

    def test_pdf_extraction(self, sample_pdf: Path):
        loader = DocumentLoader()
        docs = loader.load_file(sample_pdf)

        assert len(docs) == 2
        assert docs[0].metadata["source"] == "supplier_contract.pdf"
        assert docs[0].metadata["document_type"] == "pdf"
        assert docs[0].metadata["page"] == 1
        assert "Page 1" in docs[0].page_content

        assert docs[1].metadata["page"] == 2
        assert "Page 2" in docs[1].page_content

    def test_csv_extraction(self, sample_csv: Path):
        loader = DocumentLoader()
        docs = loader.load_file(sample_csv)

        assert len(docs) == 3
        for idx, doc in enumerate(docs, start=1):
            assert doc.metadata["source"] == "inventory.csv"
            assert doc.metadata["document_type"] == "csv"
            assert doc.metadata["row_index"] == idx
            assert "item_id" in doc.page_content

    def test_docx_extraction(self, sample_docx: Path):
        loader = DocumentLoader()
        docs = loader.load_file(sample_docx)

        assert len(docs) >= 1
        doc = docs[0]
        assert doc.metadata["source"] == "logistics_policy.docx"
        assert doc.metadata["document_type"] == "docx"
        assert "SUPPLYMIND Global Logistics Policy" in doc.page_content

    def test_txt_extraction(self, sample_txt: Path):
        loader = DocumentLoader()
        docs = loader.load_file(sample_txt)

        assert len(docs) == 1
        doc = docs[0]
        assert doc.metadata["source"] == "vendor_notes.txt"
        assert doc.metadata["document_type"] == "txt"
        assert "Vendor A: Reliable lead times" in doc.page_content

    def test_html_extraction(self, sample_html: Path):
        loader = DocumentLoader()
        docs = loader.load_file(sample_html)

        assert len(docs) == 1
        doc = docs[0]
        assert doc.metadata["source"] == "warehouse_bulletin.html"
        assert doc.metadata["document_type"] == "html"
        assert doc.metadata["title"] == "Warehouse Operations Bulletin"
        assert "Port congestion" in doc.page_content

    def test_excel_multi_worksheet_extraction(self, sample_excel_multi_sheet: Path):
        loader = DocumentLoader()
        docs = loader.load_file(sample_excel_multi_sheet)

        # 2 rows in Suppliers + 3 rows in Shipments = 5 docs
        assert len(docs) == 5

        supplier_docs = [d for d in docs if d.metadata["sheet_name"] == "Suppliers"]
        shipment_docs = [d for d in docs if d.metadata["sheet_name"] == "Shipments"]

        assert len(supplier_docs) == 2
        assert len(shipment_docs) == 3

        for doc in docs:
            assert doc.metadata["source"] == "supply_chain_data.xlsx"
            assert doc.metadata["document_type"] == "xlsx"
            assert doc.metadata["row_index"] is not None

        assert "supplier_id: SUP-01" in supplier_docs[0].page_content
        assert "tracking_num: TRK-9001" in shipment_docs[0].page_content

    def test_unsupported_extension(self, tmp_path: Path):
        bad_file = tmp_path / "script.py"
        bad_file.write_text("print('hello')", encoding="utf-8")

        loader = DocumentLoader()
        with pytest.raises(UnsupportedFileTypeError) as exc_info:
            loader.load_file(bad_file)
        assert "Unsupported file format" in str(exc_info.value)

    def test_missing_file(self, tmp_path: Path):
        missing_file = tmp_path / "non_existent.pdf"
        loader = DocumentLoader()
        with pytest.raises(DocumentFileNotFoundError) as exc_info:
            loader.load_file(missing_file)
        assert "does not exist" in str(exc_info.value)

    def test_empty_file(self, tmp_path: Path):
        empty_file = tmp_path / "empty.txt"
        empty_file.write_bytes(b"")

        loader = DocumentLoader()
        with pytest.raises(EmptyFileError) as exc_info:
            loader.load_file(empty_file)
        assert "empty (0 bytes)" in str(exc_info.value)

    def test_corrupted_pdf_file(self, tmp_path: Path):
        corrupt_pdf = tmp_path / "corrupted.pdf"
        # Invalid PDF header/body
        corrupt_pdf.write_bytes(b"This is completely invalid PDF data")

        loader = DocumentLoader()
        with pytest.raises(FileCorruptedError) as exc_info:
            loader.load_file(corrupt_pdf)
        assert "signature mismatch" in str(exc_info.value) or "Failed to load" in str(exc_info.value)

    def test_corrupted_docx_file(self, tmp_path: Path):
        corrupt_docx = tmp_path / "corrupted.docx"
        # Write non-zip data with docx extension
        corrupt_docx.write_bytes(b"NOT_A_ZIP_CONTAINER_CORRUPT_BYTES")

        loader = DocumentLoader()
        with pytest.raises(FileCorruptedError):
            loader.load_file(corrupt_docx)

    def test_path_traversal_prevention(self, tmp_path: Path):
        allowed_dir = tmp_path / "allowed_storage"
        allowed_dir.mkdir()
        secret_file = tmp_path / "secret.txt"
        secret_file.write_text("Confidential supply metrics", encoding="utf-8")

        loader = DocumentLoader(allowed_base_dir=allowed_dir)
        with pytest.raises(DocumentSecurityError) as exc_info:
            loader.load_file(secret_file)
        assert "Path traversal detected" in str(exc_info.value)

    def test_oversized_file_limit(self, tmp_path: Path):
        large_file = tmp_path / "big_log.txt"
        large_file.write_bytes(b"A" * 1024)  # 1 KB

        # Restrict loader to 500 bytes limit
        loader = DocumentLoader(max_file_size_bytes=500)
        with pytest.raises(FileSizeLimitExceededError) as exc_info:
            loader.load_file(large_file)
        assert "exceeds limit" in str(exc_info.value)

    def test_latin1_encoding_csv(self, tmp_path: Path):
        csv_path = tmp_path / "latin1_vendor.csv"
        # Encoded with accented characters in latin-1 (e.g. Café Logistics)
        content = "vendor,region\nCaf\xe9 Express,Europe\n"
        csv_path.write_bytes(content.encode("latin-1"))

        loader = DocumentLoader()
        docs = loader.load_file(csv_path)
        assert len(docs) == 1
        assert "Caf" in docs[0].page_content

    def test_direct_load_document_function(self, sample_txt: Path, sample_csv: Path):
        """Test the concise load_document function directly."""
        docs_txt = load_document(sample_txt)
        assert len(docs_txt) == 1
        assert "Vendor A" in docs_txt[0].page_content

        docs_csv = load_document(sample_csv)
        assert len(docs_csv) == 3
