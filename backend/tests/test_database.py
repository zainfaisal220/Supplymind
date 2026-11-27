"""Tests for SUPPLYMIND database models and services."""

import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.models import (
    Base,
    DatasetUpload,
    Inventory,
    ProcessingStatus,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    Sale,
    StructuredRecord,
    Supplier,
    DatasetCategory,
)
from app.database.postgres import Base as PostgresBase
from app.services.dataset_service import (
    create_dataset_upload,
    update_dataset_upload_status,
    get_dataset_upload,
    list_dataset_uploads,
    count_dataset_uploads,
    store_structured_records,
    upsert_products_from_records,
    upsert_suppliers_from_records,
    upsert_inventory_from_records,
    upsert_sales_from_records,
    upsert_purchase_orders_from_records,
    get_inventory,
    get_sales,
    get_purchase_orders,
    get_suppliers,
    get_products,
)
from app.preprocessing import NormalizedRecord


# Use in-memory SQLite for testing
from sqlalchemy import text

@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("ATTACH DATABASE ':memory:' AS supplymind"))
    Base.metadata.create_all(engine)
    session = Session(engine)
    yield session
    session.close()


class TestDatabaseModels:
    def test_dataset_upload_creation(self, db_session):
        upload = DatasetUpload(
            original_filename="test.csv",
            file_type="csv",
            dataset_category=DatasetCategory.INVENTORY,
            processing_status=ProcessingStatus.COMPLETED,
            total_rows=100,
            valid_rows=95,
            rejected_rows=5,
        )
        db_session.add(upload)
        db_session.commit()
        assert upload.id is not None
        assert upload.dataset_category == DatasetCategory.INVENTORY

    def test_product_creation(self, db_session):
        product = Product(
            sku="SKU-001",
            product_name="Test Product",
            category="Electronics",
            unit_price=100.0,
        )
        db_session.add(product)
        db_session.commit()
        assert product.id is not None
        assert product.sku == "SKU-001"

    def test_supplier_creation(self, db_session):
        supplier = Supplier(
            name="Acme Corp",
            contact_person="John Doe",
            email="john@acme.com",
        )
        db_session.add(supplier)
        db_session.commit()
        assert supplier.id is not None

    def test_inventory_creation(self, db_session):
        product = Product(sku="SKU-001", product_name="Test")
        db_session.add(product)
        db_session.flush()

        inventory = Inventory(
            product_id=product.id,
            record_date=datetime.utcnow(),
            quantity_on_hand=100,
        )
        db_session.add(inventory)
        db_session.commit()
        assert inventory.id is not None

    def test_sale_creation(self, db_session):
        product = Product(sku="SKU-001")
        db_session.add(product)
        db_session.flush()

        sale = Sale(
            product_id=product.id,
            sale_date=datetime.utcnow(),
            quantity=10,
            unit_price=100.0,
            total_amount=1000.0,
        )
        db_session.add(sale)
        db_session.commit()
        assert sale.id is not None

    def test_purchase_order_creation(self, db_session):
        supplier = Supplier(name="Acme Corp")
        db_session.add(supplier)
        db_session.flush()

        po = PurchaseOrder(
            po_number="PO-001",
            supplier_id=supplier.id,
            order_date=datetime.utcnow(),
            status="pending",
        )
        db_session.add(po)
        db_session.flush()

        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            sku="SKU-001",
            quantity_ordered=100,
            unit_price=50.0,
            total_price=5000.0,
        )
        db_session.add(item)
        db_session.commit()
        assert po.id is not None
        assert len(po.items) == 1


class TestDatasetService:
    def test_create_dataset_upload(self, db_session):
        upload = create_dataset_upload(
            db_session,
            filename="test.csv",
            file_type="csv",
            category="inventory",
            total_rows=100,
            sheet_names=["Sheet1"],
        )
        assert upload.id is not None
        assert upload.original_filename == "test.csv"
        assert upload.dataset_category.value == "inventory"

    def test_update_dataset_upload_status(self, db_session):
        upload = create_dataset_upload(
            db_session, "test.csv", "csv", "inventory", 100
        )
        updated = update_dataset_upload_status(
            db_session, upload.id, ProcessingStatus.COMPLETED, 95, 5
        )
        assert updated.processing_status == ProcessingStatus.COMPLETED
        assert updated.valid_rows == 95
        assert updated.rejected_rows == 5

    def test_get_dataset_upload(self, db_session):
        upload = create_dataset_upload(db_session, "test.csv", "csv", "inventory", 100)
        retrieved = get_dataset_upload(db_session, upload.id)
        assert retrieved.id == upload.id

    def test_list_dataset_uploads(self, db_session):
        create_dataset_upload(db_session, "test1.csv", "csv", "inventory", 100)
        create_dataset_upload(db_session, "test2.csv", "csv", "sales", 200)
        uploads = list_dataset_uploads(db_session, skip=0, limit=10)
        assert len(uploads) == 2

    def test_count_dataset_uploads(self, db_session):
        assert count_dataset_uploads(db_session) == 0
        create_dataset_upload(db_session, "test.csv", "csv", "inventory", 100)
        assert count_dataset_uploads(db_session) == 1

    def test_store_structured_records(self, db_session):
        upload = create_dataset_upload(db_session, "test.csv", "csv", "inventory", 100)

        records = [
            NormalizedRecord(
                category="inventory",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=100,
                raw_data={"sku": "SKU-001", "stock": 100},
            ),
            NormalizedRecord(
                category="inventory",
                sku="SKU-002",
                product_id="SKU-002",
                quantity=200,
                raw_data={"sku": "SKU-002", "stock": 200},
            ),
        ]

        stored = store_structured_records(db_session, upload.id, records, "Sheet1")
        assert len(stored) == 2
        assert stored[0].sku == "SKU-001"

    def test_upsert_products_from_records(self, db_session):
        records = [
            NormalizedRecord(
                category="inventory",
                sku="SKU-001",
                product_id="SKU-001",
                raw_data={"sku": "SKU-001", "product_name": "Product 1"},
            ),
            NormalizedRecord(
                category="inventory",
                sku="SKU-002",
                product_id="SKU-002",
                raw_data={"sku": "SKU-002", "product_name": "Product 2"},
            ),
        ]

        products = upsert_products_from_records(db_session, records)
        assert len(products) == 2

        # Test idempotency - should not create duplicates
        products2 = upsert_products_from_records(db_session, records)
        assert len(products2) == 2
        all_products = get_products(db_session)
        assert len(all_products) == 2

    def test_upsert_suppliers_from_records(self, db_session):
        records = [
            NormalizedRecord(
                category="purchase_orders",
                supplier_name="Acme Corp",
                raw_data={"supplier": "Acme Corp"},
            ),
        ]

        suppliers = upsert_suppliers_from_records(db_session, records)
        assert len(suppliers) == 1
        assert suppliers[0].name == "Acme Corp"

    def test_upsert_inventory_from_records(self, db_session):
        # First create products
        records = [
            NormalizedRecord(
                category="inventory",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=100,
                record_date=datetime(2024, 1, 15),
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)

        inventory_records = upsert_inventory_from_records(db_session, records)
        assert len(inventory_records) == 1
        assert inventory_records[0].quantity_on_hand == 100

    def test_upsert_sales_from_records(self, db_session):
        records = [
            NormalizedRecord(
                category="sales",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=10,
                unit_price=100.0,
                total_amount=1000.0,
                record_date=datetime(2024, 1, 15),
                order_id="ORD-001",
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)

        sales_records = upsert_sales_from_records(db_session, records)
        assert len(sales_records) == 1
        assert sales_records[0].quantity == 10

    def test_upsert_purchase_orders_from_records(self, db_session):
        records = [
            NormalizedRecord(
                category="purchase_orders",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=100,
                unit_price=50.0,
                total_amount=5000.0,
                record_date=datetime(2024, 1, 15),
                order_id="PO-001",
                supplier_name="Acme Corp",
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)
        upsert_suppliers_from_records(db_session, records)

        po_records = upsert_purchase_orders_from_records(db_session, records)
        assert len(po_records) == 1
        assert po_records[0].po_number == "PO-001"

    def test_get_inventory(self, db_session):
        records = [
            NormalizedRecord(
                category="inventory",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=100,
                record_date=datetime(2024, 1, 15),
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)
        upsert_inventory_from_records(db_session, records)

        inventory = get_inventory(db_session, sku="SKU-001")
        assert len(inventory) == 1
        assert inventory[0].quantity_on_hand == 100

    def test_get_sales(self, db_session):
        records = [
            NormalizedRecord(
                category="sales",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=10,
                unit_price=100.0,
                total_amount=1000.0,
                record_date=datetime(2024, 1, 15),
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)
        upsert_sales_from_records(db_session, records)

        sales = get_sales(db_session, sku="SKU-001")
        assert len(sales) == 1
        assert sales[0].quantity == 10

    def test_get_purchase_orders(self, db_session):
        records = [
            NormalizedRecord(
                category="purchase_orders",
                sku="SKU-001",
                product_id="SKU-001",
                quantity=100,
                unit_price=50.0,
                total_amount=5000.0,
                record_date=datetime(2024, 1, 15),
                order_id="PO-001",
                supplier_name="Acme Corp",
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)
        upsert_suppliers_from_records(db_session, records)
        upsert_purchase_orders_from_records(db_session, records)

        pos = get_purchase_orders(db_session)
        assert len(pos) == 1
        assert pos[0].po_number == "PO-001"

    def test_get_suppliers(self, db_session):
        records = [
            NormalizedRecord(
                category="purchase_orders",
                supplier_name="Acme Corp",
                raw_data={},
            ),
        ]
        upsert_suppliers_from_records(db_session, records)

        suppliers = get_suppliers(db_session)
        assert len(suppliers) == 1
        assert suppliers[0].name == "Acme Corp"

    def test_get_products(self, db_session):
        records = [
            NormalizedRecord(
                category="inventory",
                sku="SKU-001",
                product_id="SKU-001",
                raw_data={},
            ),
        ]
        upsert_products_from_records(db_session, records)

        products = get_products(db_session)
        assert len(products) == 1
        assert products[0].sku == "SKU-001"