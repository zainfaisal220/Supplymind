"""Dataset service for SUPPLYMIND.

Handles database operations for structured data uploads and queries.
"""

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database.models import (
    DatasetUpload,
    Inventory,
    ProcessingStatus,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    Sale,
    StructuredRecord,
    Supplier,
)
from app.preprocessing import NormalizedRecord, PreprocessingResult


def create_dataset_upload(
    db: Session,
    filename: str,
    file_type: str,
    category: str,
    total_rows: int,
    sheet_names: list[str] | None = None,
    preprocessing_report: dict | None = None,
) -> DatasetUpload:
    """Create a new dataset upload record."""
    upload = DatasetUpload(
        original_filename=filename,
        file_type=file_type,
        dataset_category=category,
        processing_status=ProcessingStatus.PROCESSING,
        total_rows=total_rows,
        sheet_names=sheet_names,
        preprocessing_report=preprocessing_report,
    )
    db.add(upload)
    db.flush()
    return upload


def update_dataset_upload_status(
    db: Session,
    upload_id: int,
    status: ProcessingStatus,
    valid_rows: int = 0,
    rejected_rows: int = 0,
    error_message: str | None = None,
) -> DatasetUpload | None:
    """Update dataset upload processing status."""
    upload = db.get(DatasetUpload, upload_id)
    if upload:
        upload.processing_status = status
        upload.valid_rows = valid_rows
        upload.rejected_rows = rejected_rows
        if error_message:
            upload.error_message = error_message
        db.flush()
    return upload


def get_dataset_upload(db: Session, upload_id: int) -> DatasetUpload | None:
    """Get dataset upload by ID."""
    return db.get(DatasetUpload, upload_id)


def list_dataset_uploads(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> list[DatasetUpload]:
    """List dataset uploads with pagination."""
    stmt = (
        select(DatasetUpload)
        .order_by(DatasetUpload.upload_timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def count_dataset_uploads(db: Session) -> int:
    """Count total dataset uploads."""
    return db.execute(select(func.count(DatasetUpload.id))).scalar_one()


def delete_dataset_upload(db: Session, upload_id: int) -> bool:
    """Delete a dataset upload and cascade-delete records created from it."""
    upload = db.get(DatasetUpload, upload_id)
    if not upload:
        return False

    # Find all structured records from this upload to cascade delete
    structured_records = db.execute(
        select(StructuredRecord).where(StructuredRecord.upload_id == upload_id)
    ).scalars().all()

    # Clean up associated purchase orders, sales, and inventory
    po_numbers = {r.order_id for r in structured_records if r.category == "purchase_orders" and r.order_id}
    sale_orders = {r.order_id for r in structured_records if r.category == "sales" and r.order_id}

    if po_numbers:
        matching_pos = db.execute(
            select(PurchaseOrder).where(PurchaseOrder.po_number.in_(list(po_numbers)))
        ).scalars().all()
        for po in matching_pos:
            db.execute(delete(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == po.id))
            db.delete(po)

    if sale_orders:
        db.execute(delete(Sale).where(Sale.order_id.in_(list(sale_orders))))

    if upload.dataset_category.value == "inventory":
        skus = {r.sku for r in structured_records if r.sku}
        if skus:
            products = db.execute(select(Product).where(Product.sku.in_(list(skus)))).scalars().all()
            prod_ids = [p.id for p in products]
            if prod_ids:
                db.execute(delete(Inventory).where(Inventory.product_id.in_(prod_ids)))

    # Delete structured records
    db.execute(delete(StructuredRecord).where(StructuredRecord.upload_id == upload_id))

    # Delete the upload record itself
    db.delete(upload)
    db.commit()
    return True


def store_structured_records(
    db: Session,
    upload_id: int,
    records: list[NormalizedRecord],
    sheet_name: str | None = None,
) -> list[StructuredRecord]:
    """Store normalized records in the structured_records table."""
    stored_records = []

    for idx, record in enumerate(records):
        structured = StructuredRecord(
            upload_id=upload_id,
            sheet_name=sheet_name,
            row_index=idx,
            category=record.category,
            product_id=record.product_id,
            sku=record.sku,
            supplier_id=record.supplier_id,
            supplier_name=record.supplier_name,
            order_id=record.order_id,
            record_date=record.record_date.to_pydatetime() if record.record_date else None,
            quantity=record.quantity,
            unit_price=record.unit_price,
            total_amount=record.total_amount,
            raw_data=record.raw_data or {},
        )
        db.add(structured)
        stored_records.append(structured)

    db.flush()
    return stored_records


def upsert_products_from_records(db: Session, records: list[NormalizedRecord]) -> list[Product]:
    """Create or update products from normalized records."""
    products = []
    seen_skus = set()

    for record in records:
        if not record.sku or record.sku in seen_skus:
            continue
        seen_skus.add(record.sku)

        product = db.execute(
            select(Product).where(Product.sku == record.sku)
        ).scalar_one_or_none()

        if not product:
            product = Product(
                sku=record.sku,
                product_name=record.raw_data.get("product_name") if record.raw_data else None,
                category=record.category if record.category != "unknown" else None,
            )
            db.add(product)
        products.append(product)

    db.flush()
    return products


def upsert_suppliers_from_records(db: Session, records: list[NormalizedRecord]) -> list[Supplier]:
    """Create or update suppliers from normalized records."""
    suppliers = []
    seen_names = set()

    for record in records:
        if not record.supplier_name or record.supplier_name in seen_names:
            continue
        seen_names.add(record.supplier_name)

        supplier = db.execute(
            select(Supplier).where(Supplier.name == record.supplier_name)
        ).scalar_one_or_none()

        if not supplier:
            supplier = Supplier(
                name=record.supplier_name,
                contact_person=record.raw_data.get("contact_person") if record.raw_data else None,
                email=record.raw_data.get("email") if record.raw_data else None,
                phone=record.raw_data.get("phone") if record.raw_data else None,
            )
            db.add(supplier)
        suppliers.append(supplier)

    db.flush()
    return suppliers


def upsert_inventory_from_records(db: Session, records: list[NormalizedRecord]) -> list[Inventory]:
    """Create inventory records from normalized inventory data."""
    inventory_records = []

    for record in records:
        if record.category != "inventory" or not record.sku or record.quantity is None:
            continue

        product = db.execute(select(Product).where(Product.sku == record.sku)).scalar_one_or_none()
        if not product:
            continue

        record_date = record.record_date.to_pydatetime() if record.record_date else datetime.utcnow()

        inventory = Inventory(
            product_id=product.id,
            record_date=record_date,
            quantity_on_hand=record.quantity,
            quantity_allocated=0,
            quantity_available=record.quantity,
        )
        db.add(inventory)
        inventory_records.append(inventory)

    db.flush()
    return inventory_records


def upsert_sales_from_records(db: Session, records: list[NormalizedRecord]) -> list[Sale]:
    """Create sales records from normalized sales data."""
    sales_records = []

    for record in records:
        if record.category != "sales" or not record.sku or record.quantity is None:
            continue

        product = db.execute(select(Product).where(Product.sku == record.sku)).scalar_one_or_none()

        record_date = record.record_date.to_pydatetime() if record.record_date else datetime.utcnow()

        sale = Sale(
            product_id=product.id if product else None,
            order_id=record.order_id,
            customer_id=record.raw_data.get("customer_id") if record.raw_data else None,
            sale_date=record_date,
            quantity=record.quantity,
            unit_price=record.unit_price or 0,
            total_amount=record.total_amount or (record.quantity * (record.unit_price or 0)),
        )
        db.add(sale)
        sales_records.append(sale)

    db.flush()
    return sales_records


def upsert_purchase_orders_from_records(db: Session, records: list[NormalizedRecord]) -> list[PurchaseOrder]:
    """Create purchase orders from normalized PO data."""
    po_map: dict[str, PurchaseOrder] = {}

    # First pass: create purchase orders
    for record in records:
        if record.category != "purchase_orders" or not record.order_id:
            continue

        if record.order_id in po_map:
            continue

        supplier = None
        if record.supplier_name:
            supplier = db.execute(
                select(Supplier).where(Supplier.name == record.supplier_name)
            ).scalar_one_or_none()

        record_date = record.record_date.to_pydatetime() if record.record_date else datetime.utcnow()

        po = PurchaseOrder(
            po_number=record.order_id,
            supplier_id=supplier.id if supplier else None,
            order_date=record_date,
            status="pending",
            total_amount=record.total_amount,
        )
        db.add(po)
        db.flush()
        po_map[record.order_id] = po

    # Second pass: create PO items
    for record in records:
        if record.category != "purchase_orders" or not record.order_id or not record.sku:
            continue

        po = po_map.get(record.order_id)
        if not po:
            continue

        product = db.execute(select(Product).where(Product.sku == record.sku)).scalar_one_or_none()

        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=product.id if product else None,
            sku=record.sku,
            description=record.raw_data.get("description") if record.raw_data else None,
            quantity_ordered=record.quantity or 0,
            unit_price=record.unit_price or 0,
            total_price=record.total_amount or (record.quantity or 0) * (record.unit_price or 0),
        )
        db.add(item)

    db.flush()
    return list(po_map.values())


def get_structured_records(
    db: Session,
    upload_id: int,
    skip: int = 0,
    limit: int = 100,
) -> list[StructuredRecord]:
    """Get structured records for an upload."""
    stmt = (
        select(StructuredRecord)
        .where(StructuredRecord.upload_id == upload_id)
        .offset(skip)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def get_inventory(
    db: Session,
    sku: str | None = None,
    product_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Inventory]:
    """Get inventory records with optional filters."""
    stmt = select(Inventory)

    if sku:
        product = db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none()
        if product:
            stmt = stmt.where(Inventory.product_id == product.id)
        else:
            return []
    elif product_id:
        stmt = stmt.where(Inventory.product_id == product_id)

    stmt = stmt.order_by(Inventory.record_date.desc()).offset(skip).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_sales(
    db: Session,
    sku: str | None = None,
    product_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Sale]:
    """Get sales records with optional filters."""
    stmt = select(Sale)

    if sku:
        product = db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none()
        if product:
            stmt = stmt.where(Sale.product_id == product.id)
        else:
            return []
    elif product_id:
        stmt = stmt.where(Sale.product_id == product_id)

    if start_date:
        stmt = stmt.where(Sale.sale_date >= start_date)
    if end_date:
        stmt = stmt.where(Sale.sale_date <= end_date)

    stmt = stmt.order_by(Sale.sale_date.desc()).offset(skip).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_purchase_orders(
    db: Session,
    supplier_id: int | None = None,
    status: str | None = None,
    po_number: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[PurchaseOrder]:
    """Get purchase orders with optional filters."""
    stmt = select(PurchaseOrder)

    if supplier_id:
        stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if po_number:
        stmt = stmt.where(PurchaseOrder.po_number.ilike(f"%{po_number}%"))

    stmt = stmt.order_by(PurchaseOrder.order_date.desc()).offset(skip).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_suppliers(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Supplier]:
    """Get all suppliers."""
    stmt = select(Supplier).where(Supplier.is_active).offset(skip).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_products(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Product]:
    """Get all products."""
    stmt = select(Product).where(Product.is_active).offset(skip).limit(limit)
    return list(db.execute(stmt).scalars().all())