"""Tests for SUPPLYMIND preprocessing module."""

import pytest
import pandas as pd
import tempfile
import os

from app.preprocessing.reader import read_csv, read_excel, read_structured_file, inspect_dataframe
from app.preprocessing.validator import (
    validate_dataframe,
    detect_column_mapping,
    classify_dataset,
    ValidationReport,
)
from app.preprocessing.cleaner import clean_dataframe, CleaningReport
from app.preprocessing.normalizer import normalize_dataframe, NormalizedRecord
from app.preprocessing.transformer import preprocess_file, preprocess_sheet_dataframe, PreprocessingResult


class TestReader:
    def test_read_csv_basic(self, tmp_path):
        csv_content = "sku,quantity,price\nSKU-001,100,10.50\nSKU-002,200,20.00"
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content)

        result = read_csv(csv_file)
        assert result.file_type == "csv"
        assert result.total_rows == 2
        assert result.total_columns == 3
        assert len(result.sheets) == 1
        assert result.sheets[0].name == "Sheet1"
        assert list(result.sheets[0].dataframe.columns) == ["sku", "quantity", "price"]

    def test_read_csv_with_encoding(self, tmp_path):
        # Test latin-1 encoding
        csv_content = "sku,quantity\nSKU-001,100"
        csv_file = tmp_path / "test_latin1.csv"
        csv_file.write_bytes(csv_content.encode("latin-1"))

        result = read_csv(csv_file)
        assert result.total_rows == 1

    def test_read_excel_multiple_sheets(self, tmp_path):
        excel_file = tmp_path / "test.xlsx"
        df1 = pd.DataFrame({"sku": ["SKU-001"], "qty": [100]})
        df2 = pd.DataFrame({"product_id": ["PROD-001"], "stock": [50]})

        with pd.ExcelWriter(excel_file, engine="openpyxl") as writer:
            df1.to_excel(writer, sheet_name="Inventory", index=False)
            df2.to_excel(writer, sheet_name="Stock", index=False)

        result = read_excel(excel_file)
        assert result.file_type == "xlsx"
        assert len(result.sheets) == 2
        assert result.sheets[0].name == "Inventory"
        assert result.sheets[1].name == "Stock"
        assert result.total_rows == 2

    def test_read_structured_file_auto_detect(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("sku,qty\nSKU-001,100")

        result = read_structured_file(csv_file)
        assert result.file_type == "csv"

        xlsx_file = tmp_path / "test.xlsx"
        pd.DataFrame({"sku": ["SKU-001"]}).to_excel(xlsx_file, index=False)

        result = read_structured_file(xlsx_file)
        assert result.file_type == "xlsx"

    def test_inspect_dataframe(self):
        df = pd.DataFrame({
            "sku": ["SKU-001", "SKU-002", None],
            "quantity": [100, 200, 300],
            "price": [10.5, 20.0, None],
        })
        inspection = inspect_dataframe(df)
        assert inspection["columns"] == ["sku", "quantity", "price"]
        assert inspection["missing_counts"]["sku"] == 1
        assert inspection["missing_counts"]["price"] == 1
        assert inspection["duplicate_rows"] == 0


class TestValidator:
    def test_detect_column_mapping(self):
        columns = ["SKU", "Quantity", "Unit Price", "Supplier Name", "Order Date"]
        mapping = detect_column_mapping(columns)
        assert mapping["product_id"] == "SKU"
        assert mapping["quantity"] == "Quantity"
        assert mapping["unit_price"] == "Unit Price"
        assert mapping["supplier_name"] == "Supplier Name"
        assert mapping["date"] == "Order Date"

    def test_classify_dataset_inventory(self):
        columns = ["SKU", "Stock", "Location"]
        mapping = {"product_id": "SKU", "inventory_qty": "Stock"}
        category = classify_dataset(columns, mapping)
        assert category == "inventory"

    def test_classify_dataset_sales(self):
        columns = ["SKU", "Units Sold", "Sale Date"]
        mapping = {"product_id": "SKU", "sales_qty": "Units Sold", "date": "Sale Date"}
        category = classify_dataset(columns, mapping)
        assert category == "sales"

    def test_classify_dataset_purchase_orders(self):
        columns = ["PO Number", "Supplier", "SKU", "Order Date"]
        mapping = {"order_id": "PO Number", "supplier_name": "Supplier", "product_id": "SKU", "date": "Order Date"}
        category = classify_dataset(columns, mapping)
        assert category == "purchase_orders"

    def test_classify_dataset_supplier(self):
        columns = ["Supplier ID", "Supplier Name", "Email"]
        mapping = {"supplier_id": "Supplier ID", "supplier_name": "Supplier Name"}
        category = classify_dataset(columns, mapping)
        assert category == "supplier"

    def test_classify_dataset_unknown(self):
        columns = ["Random Col", "Another Col"]
        mapping = {}
        category = classify_dataset(columns, mapping)
        assert category == "unknown"

    def test_validate_dataframe_inventory_missing_product_id(self):
        df = pd.DataFrame({"Stock": [100, 200]})
        report = validate_dataframe(df)
        assert report.has_errors
        error = report.errors[0]
        assert error.code == "MISSING_PRODUCT_ID"

    def test_validate_dataframe_sales_missing_date(self):
        df = pd.DataFrame({"SKU": ["SKU-001"], "Units Sold": [10]})
        report = validate_dataframe(df)
        assert report.has_errors
        error = report.errors[0]
        assert error.code == "MISSING_DATE"

    def test_validate_dataframe_invalid_numeric(self):
        df = pd.DataFrame({"SKU": ["SKU-001", "SKU-002"], "Quantity": [100, "invalid"]})
        report = validate_dataframe(df)
        warning = next((w for w in report.warnings if w.code == "INVALID_NUMERIC"), None)
        assert warning is not None
        assert warning.count == 1

    def test_validate_dataframe_negative_quantity(self):
        df = pd.DataFrame({"SKU": ["SKU-001", "SKU-002"], "Quantity": [100, -50]})
        report = validate_dataframe(df)
        warning = next((w for w in report.warnings if w.code == "NEGATIVE_QUANTITY"), None)
        assert warning is not None
        assert warning.count == 1

    def test_validate_dataframe_invalid_date(self):
        df = pd.DataFrame({"SKU": ["SKU-001"], "Date": ["not a date"]})
        report = validate_dataframe(df)
        warning = next((w for w in report.warnings if w.code == "INVALID_DATE"), None)
        assert warning is not None
        assert warning.count == 1


class TestCleaner:
    def test_clean_dataframe_normalize_columns(self):
        df = pd.DataFrame({"SKU Code": ["SKU-001"], "Unit Price": [10.0]})
        cleaned, report = clean_dataframe(df)
        assert "sku_code" in cleaned.columns
        assert "unit_price" in cleaned.columns

    def test_clean_dataframe_strip_whitespace(self):
        df = pd.DataFrame({"sku": [" SKU-001 ", "SKU-002"]})
        cleaned, report = clean_dataframe(df)
        assert cleaned["sku"].iloc[0] == "SKU-001"

    def test_clean_dataframe_convert_numeric(self):
        df = pd.DataFrame({"sku": ["SKU-001", "SKU-002"], "Quantity": ["100", "invalid"]})
        cleaned, report = clean_dataframe(df)
        assert pd.api.types.is_numeric_dtype(cleaned["quantity"])

    def test_clean_dataframe_parse_dates(self):
        df = pd.DataFrame({"sku": ["SKU-001"], "date": ["2024-01-15"]})
        cleaned, report = clean_dataframe(df)
        assert pd.api.types.is_datetime64_any_dtype(cleaned["date"])

    def test_clean_dataframe_fill_missing_product_id(self):
        df = pd.DataFrame({"sku": ["SKU-001", None], "quantity": [100, 200]})
        mapping = {"product_id": "sku"}
        cleaned, report = clean_dataframe(df, mapping)
        assert cleaned["sku"].iloc[1] == "unknown"

    def test_clean_dataframe_no_auto_zero_fill(self):
        """Ensure inventory/sales quantities are NOT auto-filled with zero."""
        df = pd.DataFrame({"sku": ["SKU-001", "SKU-002"], "quantity": [100, None]})
        mapping = {"quantity": "quantity"}
        cleaned, report = clean_dataframe(df, mapping)
        # Should remain NaN, not filled with 0
        assert pd.isna(cleaned["quantity"].iloc[1])


class TestNormalizer:
    def test_normalize_dataframe_inventory(self):
        df = pd.DataFrame({
            "sku": ["SKU-001", "SKU-002"],
            "stock": [100, 200],
            "location": ["WH1", "WH2"],
        })
        mapping = {"product_id": "sku", "inventory_qty": "stock"}
        records, meta = normalize_dataframe(df, mapping, "inventory")
        assert len(records) == 2
        assert records[0].category == "inventory"
        assert records[0].sku == "SKU-001"
        assert records[0].quantity == 100

    def test_normalize_dataframe_sales(self):
        df = pd.DataFrame({
            "sku": ["SKU-001"],
            "units_sold": [50],
            "sale_date": ["2024-01-15"],
            "unit_price": [10.0],
        })
        mapping = {"product_id": "sku", "sales_qty": "units_sold", "date": "sale_date", "unit_price": "unit_price"}
        records, meta = normalize_dataframe(df, mapping, "sales")
        assert len(records) == 1
        assert records[0].category == "sales"
        assert records[0].quantity == 50
        assert records[0].unit_price == 10.0
        assert records[0].total_amount == 500.0

    def test_normalize_dataframe_purchase_orders(self):
        df = pd.DataFrame({
            "po_number": ["PO-001"],
            "supplier": ["Acme Corp"],
            "sku": ["SKU-001"],
            "order_date": ["2024-01-15"],
            "qty": [100],
            "price": [5.0],
        })
        mapping = {
            "order_id": "po_number",
            "supplier_name": "supplier",
            "product_id": "sku",
            "date": "order_date",
            "quantity": "qty",
            "unit_price": "price",
        }
        records, meta = normalize_dataframe(df, mapping, "purchase_orders")
        assert len(records) == 1
        assert records[0].category == "purchase_orders"
        assert records[0].order_id == "PO-001"
        assert records[0].supplier_name == "Acme Corp"


class TestTransformer:
    def test_preprocess_file_csv(self, tmp_path):
        csv_content = "SKU,Stock,Location\nSKU-001,100,WH1\nSKU-002,200,WH2"
        csv_file = tmp_path / "inventory.csv"
        csv_file.write_text(csv_content)

        result = preprocess_file(csv_file)
        assert result.file_type == "csv"
        assert result.category == "inventory"
        assert result.total_rows == 2
        assert result.valid_rows == 2
        assert len(result.records) == 2
        assert result.records[0].sku == "SKU-001"
        assert result.records[0].quantity == 100

    def test_preprocess_file_excel_multiple_sheets(self, tmp_path):
        excel_file = tmp_path / "data.xlsx"
        df1 = pd.DataFrame({"SKU": ["SKU-001"], "Stock": [100]})
        df2 = pd.DataFrame({"SKU": ["SKU-002"], "Units Sold": [50], "Date": ["2024-01-15"]})

        with pd.ExcelWriter(excel_file, engine="openpyxl") as writer:
            df1.to_excel(writer, sheet_name="Inventory", index=False)
            df2.to_excel(writer, sheet_name="Sales", index=False)

        result = preprocess_file(excel_file)
        assert len(result.sheet_names) == 2
        # Should detect first sheet category
        assert result.category in ["inventory", "sales"]

    def test_preprocess_sheet_dataframe(self):
        df = pd.DataFrame({"SKU": ["SKU-001"], "Stock": [100]})
        result = preprocess_sheet_dataframe(df)
        assert result.total_rows == 1
        assert result.valid_rows == 1
        assert len(result.records) == 1