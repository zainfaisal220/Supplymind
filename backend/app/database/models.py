"""SQLAlchemy database models for SUPPLYMIND structured data."""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base


class DatasetCategory(str, enum.Enum):
    """Supported dataset categories."""

    INVENTORY = "inventory"
    SALES = "sales"
    PURCHASE_ORDERS = "purchase_orders"
    SUPPLIER = "supplier"
    UNKNOWN = "unknown"


class ProcessingStatus(str, enum.Enum):
    """Dataset processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DatasetUpload(Base):
    """Metadata for uploaded structured datasets (CSV/Excel)."""

    __tablename__ = "dataset_uploads"
    __table_args__ = {"schema": "supplymind"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_category: Mapped[DatasetCategory] = mapped_column(
        Enum(DatasetCategory), default=DatasetCategory.UNKNOWN, nullable=False
    )
    upload_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus), default=ProcessingStatus.PENDING, nullable=False
    )
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0)
    rejected_rows: Mapped[int] = mapped_column(Integer, default=0)
    sheet_names: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    preprocessing_report: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    records = relationship("StructuredRecord", back_populates="upload", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<DatasetUpload(id={self.id}, filename={self.original_filename}, category={self.dataset_category})>"


class StructuredRecord(Base):
    """Generic table for structured business records with lineage to upload."""

    __tablename__ = "structured_records"
    __table_args__ = (
        Index("ix_structured_records_upload_id", "upload_id"),
        Index("ix_structured_records_category", "category"),
        Index("ix_structured_records_product_id", "product_id"),
        Index("ix_structured_records_supplier_id", "supplier_id"),
        Index("ix_structured_records_order_id", "order_id"),
        Index("ix_structured_records_date", "record_date"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("supplymind.dataset_uploads.id", ondelete="CASCADE"), nullable=False
    )
    sheet_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    row_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    product_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sku: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    supplier_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    order_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    record_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    quantity: Mapped[Optional[float]] = mapped_column(nullable=True)
    unit_price: Mapped[Optional[float]] = mapped_column(nullable=True)
    total_amount: Mapped[Optional[float]] = mapped_column(nullable=True)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    upload = relationship("DatasetUpload", back_populates="records")

    def __repr__(self) -> str:
        return f"<StructuredRecord(id={self.id}, category={self.category}, product_id={self.product_id})>"


class Product(Base):
    """Product/Inventory master data."""

    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_sku", "sku", unique=True),
        Index("ix_products_supplier_id", "supplier_id"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    product_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    unit_of_measure: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("supplymind.suppliers.id", ondelete="SET NULL"), nullable=True
    )
    unit_cost: Mapped[Optional[float]] = mapped_column(nullable=True)
    unit_price: Mapped[Optional[float]] = mapped_column(nullable=True)
    reorder_point: Mapped[Optional[int]] = mapped_column(nullable=True)
    lead_time_days: Mapped[Optional[int]] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    supplier = relationship("Supplier", back_populates="products")

    def __repr__(self) -> str:
        return f"<Product(sku={self.sku}, name={self.product_name})>"


class Inventory(Base):
    """Inventory levels over time."""

    __tablename__ = "inventory"
    __table_args__ = (
        Index("ix_inventory_product_id", "product_id"),
        Index("ix_inventory_date", "record_date"),
        Index("ix_inventory_location", "location"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("supplymind.products.id", ondelete="CASCADE"), nullable=False
    )
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    record_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity_on_hand: Mapped[float] = mapped_column(default=0, nullable=False)
    quantity_allocated: Mapped[float] = mapped_column(default=0, nullable=False)
    quantity_available: Mapped[float] = mapped_column(default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product = relationship("Product")

    def __repr__(self) -> str:
        return f"<Inventory(product_id={self.product_id}, date={self.record_date}, qty={self.quantity_on_hand})>"


class Sale(Base):
    """Sales transactions."""

    __tablename__ = "sales"
    __table_args__ = (
        Index("ix_sales_product_id", "product_id"),
        Index("ix_sales_date", "sale_date"),
        Index("ix_sales_order_id", "order_id"),
        Index("ix_sales_customer_id", "customer_id"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("supplymind.products.id", ondelete="SET NULL"), nullable=True
    )
    order_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sale_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(nullable=False)
    total_amount: Mapped[float] = mapped_column(nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product = relationship("Product")

    def __repr__(self) -> str:
        return f"<Sale(product_id={self.product_id}, date={self.sale_date}, qty={self.quantity})>"


class PurchaseOrder(Base):
    """Purchase orders to suppliers."""

    __tablename__ = "purchase_orders"
    __table_args__ = (
        Index("ix_purchase_orders_supplier_id", "supplier_id"),
        Index("ix_purchase_orders_order_date", "order_date"),
        Index("ix_purchase_orders_status", "status"),
        Index("ix_purchase_orders_po_number", "po_number"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("supplymind.suppliers.id", ondelete="SET NULL"), nullable=True
    )
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expected_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    total_amount: Mapped[Optional[float]] = mapped_column(nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order")

    def __repr__(self) -> str:
        return f"<PurchaseOrder(po_number={self.po_number}, supplier_id={self.supplier_id}, status={self.status})>"


class PurchaseOrderItem(Base):
    """Line items for purchase orders."""

    __tablename__ = "purchase_order_items"
    __table_args__ = (
        Index("ix_po_items_purchase_order_id", "purchase_order_id"),
        Index("ix_po_items_product_id", "product_id"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("supplymind.purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("supplymind.products.id", ondelete="SET NULL"), nullable=True
    )
    sku: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity_ordered: Mapped[float] = mapped_column(nullable=False)
    quantity_received: Mapped[float] = mapped_column(default=0, nullable=False)
    unit_price: Mapped[float] = mapped_column(nullable=False)
    total_price: Mapped[float] = mapped_column(nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")

    def __repr__(self) -> str:
        return f"<PurchaseOrderItem(po_id={self.purchase_order_id}, sku={self.sku}, qty={self.quantity_ordered})>"


class Supplier(Base):
    """Supplier master data."""

    __tablename__ = "suppliers"
    __table_args__ = (
        Index("ix_suppliers_name", "name"),
        Index("ix_suppliers_email", "email"),
        {"schema": "supplymind"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    products = relationship("Product", back_populates="supplier")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier(id={self.id}, name={self.name})>"