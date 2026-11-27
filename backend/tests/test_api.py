"""Tests for SUPPLYMIND API routes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock

from app.main import app
from app.database.postgres import get_db
from app.database.models import Base, DatasetUpload, ProcessingStatus, DatasetCategory

# Create test database with attached schema for SQLite compatibility
from sqlalchemy import text
test_engine = create_engine("sqlite:///:memory:")
with test_engine.begin() as conn:
    conn.execute(text("ATTACH DATABASE ':memory:' AS supplymind"))
Base.metadata.create_all(test_engine)


def override_get_db():
    db = Session(test_engine)
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


class TestHealthCheck:
    def test_health_check(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data


class TestDatasetUpload:
    def test_upload_csv_success(self):
        csv_content = "SKU,Stock,Location\nSKU-001,100,WH1\nSKU-002,200,WH2"
        files = {"file": ("test.csv", csv_content, "text/csv")}

        response = client.post("/api/datasets/upload", files=files)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "completed"
        assert data["dataset_category"] == "inventory"
        assert data["valid_rows"] == 2

    def test_upload_excel_success(self):
        import pandas as pd
        import io

        df = pd.DataFrame({"SKU": ["SKU-001"], "Units Sold": [50], "Date": ["2024-01-15"]})
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        buffer.seek(0)

        files = {"file": ("test.xlsx", buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}

        response = client.post("/api/datasets/upload", files=files)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "completed"
        assert data["dataset_category"] == "sales"

    def test_upload_invalid_extension(self):
        files = {"file": ("test.txt", b"content", "text/plain")}
        response = client.post("/api/datasets/upload", files=files)
        assert response.status_code == 400
        assert "Unsupported file format" in response.json()["detail"]

    def test_upload_empty_file(self):
        files = {"file": ("empty.csv", b"", "text/csv")}
        response = client.post("/api/datasets/upload", files=files)
        assert response.status_code == 400
        assert "Empty file" in response.json()["detail"]

    def test_upload_missing_columns_error(self):
        # CSV without required columns
        csv_content = "RandomCol,AnotherCol\n1,2"
        files = {"file": ("test.csv", csv_content, "text/csv")}

        response = client.post("/api/datasets/upload", files=files)
        assert response.status_code == 201
        data = response.json()
        # Should still upload but with errors
        assert data["processing_status"] in ["completed", "failed"]


class TestDatasetList:
    def test_list_datasets_empty(self):
        response = client.get("/api/datasets")
        assert response.status_code == 200
        data = response.json()
        assert data["datasets"] == []
        assert data["total"] == 0

    def test_list_datasets_with_data(self):
        # First upload a dataset
        csv_content = "SKU,Stock\nSKU-001,100"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        client.post("/api/datasets/upload", files=files)

        response = client.get("/api/datasets")
        assert response.status_code == 200
        data = response.json()
        assert len(data["datasets"]) == 1
        assert data["total"] == 1

    def test_list_datasets_pagination(self):
        for i in range(5):
            csv_content = f"SKU,Stock\nSKU-{i:03d},{i*10}"
            files = {"file": (f"test{i}.csv", csv_content, "text/csv")}
            client.post("/api/datasets/upload", files=files)

        response = client.get("/api/datasets?page=1&page_size=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["datasets"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2


class TestDatasetDetail:
    def test_get_dataset(self):
        csv_content = "SKU,Stock\nSKU-001,100"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        upload_response = client.post("/api/datasets/upload", files=files)
        dataset_id = upload_response.json()["id"]

        response = client.get(f"/api/datasets/{dataset_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == dataset_id
        assert data["original_filename"] == "test.csv"

    def test_get_dataset_not_found(self):
        response = client.get("/api/datasets/99999")
        assert response.status_code == 404


class TestDatasetPreview:
    def test_preview_dataset(self):
        csv_content = "SKU,Stock,Location\nSKU-001,100,WH1\nSKU-002,200,WH2"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        upload_response = client.post("/api/datasets/upload", files=files)
        dataset_id = upload_response.json()["id"]

        response = client.get(f"/api/datasets/{dataset_id}/preview")
        assert response.status_code == 200
        data = response.json()
        assert data["dataset_id"] == dataset_id
        assert "SKU" in data["columns"]
        assert "Stock" in data["columns"]
        assert len(data["sample_rows"]) > 0


class TestInventoryAPI:
    def test_list_inventory_empty(self):
        response = client.get("/api/inventory")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []

    def test_list_inventory_with_data(self):
        csv_content = "SKU,Stock,Location\nSKU-001,100,WH1"
        files = {"file": ("inv.csv", csv_content, "text/csv")}
        client.post("/api/datasets/upload", files=files)

        response = client.get("/api/inventory")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["sku"] == "SKU-001"
        assert data["items"][0]["quantity_on_hand"] == 100


class TestSalesAPI:
    def test_list_sales_empty(self):
        response = client.get("/api/sales")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []

    def test_list_sales_with_data(self):
        csv_content = "SKU,Units Sold,Date,Unit Price\nSKU-001,50,2024-01-15,10.0"
        files = {"file": ("sales.csv", csv_content, "text/csv")}
        client.post("/api/datasets/upload", files=files)

        response = client.get("/api/sales")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["sku"] == "SKU-001"
        assert data["items"][0]["quantity"] == 50


class TestPurchaseOrdersAPI:
    def test_list_purchase_orders_empty(self):
        response = client.get("/api/purchase-orders")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []

    def test_list_purchase_orders_with_data(self):
        csv_content = "PO Number,Supplier,SKU,Order Date,Qty,Price\nPO-001,Acme Corp,SKU-001,2024-01-15,100,50.0"
        files = {"file": ("po.csv", csv_content, "text/csv")}
        client.post("/api/datasets/upload", files=files)

        response = client.get("/api/purchase-orders")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["po_number"] == "PO-001"
        assert data["items"][0]["supplier_name"] == "Acme Corp"


class TestSuppliersAPI:
    def test_list_suppliers_empty(self):
        response = client.get("/api/suppliers")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []

    def test_list_suppliers_with_data(self):
        csv_content = "PO Number,Supplier,SKU,Order Date,Qty,Price\nPO-001,Acme Corp,SKU-001,2024-01-15,100,50.0"
        files = {"file": ("po.csv", csv_content, "text/csv")}
        client.post("/api/datasets/upload", files=files)

        response = client.get("/api/suppliers")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "Acme Corp"


class TestDocumentsAPI:
    @patch("app.api.routes.documents.ingest_document")
    def test_upload_document(self, mock_ingest):
        mock_ingest.return_value = {
            "status": "success",
            "file_name": "test.pdf",
            "chunks_stored": 5,
        }

        files = {"file": ("test.pdf", b"PDF content", "application/pdf")}
        response = client.post("/api/documents/upload", files=files)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "success"
        assert data["chunks_stored"] == 5

    def test_upload_document_invalid_extension(self):
        files = {"file": ("test.xyz", b"content", "application/octet-stream")}
        response = client.post("/api/documents/upload", files=files)
        assert response.status_code == 400


class TestChatAPI:
    @patch("app.api.routes.chat.get_rag_chain")
    def test_chat_success(self, mock_get_rag_chain):
        mock_rag = MagicMock()
        mock_rag.ask.return_value = {
            "answer": "Test answer",
            "sources": [{"source": "test.pdf", "document_type": "pdf", "page": 1}],
        }
        mock_get_rag_chain.return_value = mock_rag

        response = client.post("/api/chat", json={"question": "What is the inventory?"})
        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "Test answer"
        assert len(data["sources"]) == 1

    def test_chat_empty_question(self):
        response = client.post("/api/chat", json={"question": ""})
        assert response.status_code == 400
        assert "cannot be empty" in response.json()["detail"].lower()