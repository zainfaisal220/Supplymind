"""Data normalization and transformation for SUPPLYMIND structured preprocessing.

Applies column mapping, creates standardized records, and transforms data
into the canonical schema for database storage.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pandas as pd

from app.preprocessing.validator import detect_column_mapping, classify_dataset


@dataclass
class NormalizedRecord:
    """A normalized business record ready for database storage."""

    category: str
    product_id: str | None = None
    sku: str | None = None
    supplier_id: str | None = None
    supplier_name: str | None = None
    order_id: str | None = None
    record_date: pd.Timestamp | None = None
    quantity: float | None = None
    unit_price: float | None = None
    total_amount: float | None = None
    raw_data: dict[str, Any] = None

    def __post_init__(self):
        if self.raw_data is None:
            self.raw_data = {}


def normalize_dataframe(
    df: pd.DataFrame,
    mapping: dict[str, str] | None = None,
    category: str | None = None,
) -> tuple[list[NormalizedRecord], dict[str, Any]]:
    """Normalize a DataFrame into structured records.

    Args:
        df: Cleaned DataFrame.
        mapping: Optional column mapping. If not provided, will be detected.
        category: Optional dataset category. If not provided, will be classified.

    Returns:
        Tuple of (list of NormalizedRecord, metadata dict).
    """
    if df.empty:
        return [], {"category": category or "unknown", "record_count": 0}

    if mapping is None:
        mapping = detect_column_mapping(df.columns.tolist())

    if category is None:
        category = classify_dataset(df.columns.tolist(), mapping)

    records = []

    for idx, row in df.iterrows():
        record = _normalize_row(row, mapping, category)
        records.append(record)

    metadata = {
        "category": category,
        "record_count": len(records),
        "mapping_used": mapping,
        "source_columns": df.columns.tolist(),
    }

    return records, metadata


def _normalize_row(
    row: pd.Series,
    mapping: dict[str, str],
    category: str,
) -> NormalizedRecord:
    """Normalize a single row into a structured record."""

    def get_value(field: str) -> Any:
        """Safely get a value from the row using mapping."""
        if field in mapping:
            col = mapping[field]
            if col in row.index:
                val = row[col]
                if pd.notna(val):
                    return val
        return None

    # Extract values based on mapping
    product_id = get_value("product_id")
    sku = get_value("sku")

    # When a sku column isn't mapped separately, derive it from the product id.
    if sku is None and product_id is not None:
        sku = product_id
    supplier_id = get_value("supplier_id")
    supplier_name = get_value("supplier_name")
    order_id = get_value("order_id")

    # Handle quantity - different fields for different categories
    quantity = None
    if category == "inventory":
        quantity = get_value("inventory_qty")
    elif category == "sales":
        quantity = get_value("sales_qty")
    else:
        quantity = get_value("quantity")

    # Convert to native Python types
    if quantity is not None:
        try:
            quantity = float(quantity)
        except (ValueError, TypeError):
            quantity = None

    unit_price = get_value("unit_price")
    if unit_price is not None:
        try:
            unit_price = float(unit_price)
        except (ValueError, TypeError):
            unit_price = None

    total_amount = get_value("total_amount")
    if total_amount is not None:
        try:
            total_amount = float(total_amount)
        except (ValueError, TypeError):
            total_amount = None

    # Calculate total if missing but we have qty and price
    if total_amount is None and quantity is not None and unit_price is not None:
        total_amount = quantity * unit_price

    # Parse date
    record_date = None
    date_val = get_value("date")
    if date_val is not None:
        try:
            record_date = pd.to_datetime(date_val)
            if pd.isna(record_date):
                record_date = None
        except (ValueError, TypeError):
            record_date = None

    # Build raw data dict (all columns)
    raw_data = {}
    for col in row.index:
        val = row[col]
        if pd.notna(val):
            # Convert pandas types to native Python
            if isinstance(val, (pd.Timestamp, pd.Timedelta, datetime)):
                raw_data[col] = str(val)
            elif isinstance(val, (pd.Int64Dtype, pd.Float64Dtype)):
                raw_data[col] = float(val) if pd.notna(val) else None
            elif isinstance(val, (bool,)):
                raw_data[col] = bool(val)
            else:
                raw_data[col] = val

    return NormalizedRecord(
        category=category,
        product_id=str(product_id) if product_id is not None else None,
        sku=str(sku) if sku is not None else None,
        supplier_id=str(supplier_id) if supplier_id is not None else None,
        supplier_name=str(supplier_name) if supplier_name is not None else None,
        order_id=str(order_id) if order_id is not None else None,
        record_date=record_date,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=total_amount,
        raw_data=raw_data,
    )


def normalize_sheets(
    sheets: list[dict[str, Any]],
) -> dict[str, list[NormalizedRecord]]:
    """Normalize multiple sheets from an Excel file.

    Args:
        sheets: List of sheet data dicts with 'name' and 'dataframe' keys.

    Returns:
        Dictionary mapping sheet name to list of normalized records.
    """
    result = {}

    for sheet in sheets:
        name = sheet["name"]
        df = sheet["dataframe"]
        mapping = detect_column_mapping(df.columns.tolist())
        category = classify_dataset(df.columns.tolist(), mapping)
        records, _ = normalize_dataframe(df, mapping, category)
        result[name] = records

    return result