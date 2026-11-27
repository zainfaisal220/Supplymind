"""Data validation for SUPPLYMIND structured preprocessing.

Validates business data integrity and identifies issues.
"""

from dataclasses import dataclass, field
from typing import Any

import pandas as pd


@dataclass
class ValidationIssue:
    """A single validation issue."""

    severity: str  # "error", "warning", "info"
    code: str
    message: str
    column: str | None = None
    row_indices: list[int] = field(default_factory=list)
    count: int = 0


@dataclass
class ValidationReport:
    """Complete validation report for a dataset."""

    issues: list[ValidationIssue] = field(default_factory=list)
    total_rows: int = 0
    total_columns: int = 0

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def add_issue(
        self,
        severity: str,
        code: str,
        message: str,
        column: str | None = None,
        row_indices: list[int] | None = None,
        count: int = 0,
    ) -> None:
        """Add a validation issue."""
        self.issues.append(
            ValidationIssue(
                severity=severity,
                code=code,
                message=message,
                column=column,
                row_indices=row_indices or [],
                count=count,
            )
        )


# Column mapping patterns for supply chain data
COLUMN_PATTERNS = {
    "product_id": [
        "sku",
        "product_id",
        "product code",
        "item_id",
        "item code",
        "part_number",
        "part number",
        "product_number",
        "product number",
    ],
    "quantity": [
        "quantity",
        "qty",
        "units",
        "units_sold",
        "sales_qty",
        "stock",
        "inventory",
        "available_stock",
        "on_hand",
        "quantity_on_hand",
    ],
    "inventory_qty": [
        "stock",
        "inventory",
        "available_stock",
        "on_hand",
        "quantity_on_hand",
        "current_stock",
    ],
    "sales_qty": [
        "units_sold",
        "sales_qty",
        "quantity_sold",
        "sold_quantity",
    ],
    "supplier_id": [
        "supplier_id",
        "vendor_id",
        "supplier code",
        "vendor_code",
        "supplier_number",
    ],
    "supplier_name": [
        "supplier_name",
        "vendor_name",
        "supplier",
        "vendor",
        "supplier_name",
    ],
    "order_id": [
        "order_id",
        "order_number",
        "po_number",
        "po number",
        "purchase_order_number",
        "purchase order number",
        "po_num",
    ],
    "date": [
        "date",
        "order_date",
        "sale_date",
        "transaction_date",
        "created_date",
        "record_date",
    ],
    "unit_price": [
        "unit_price",
        "price",
        "unit_cost",
        "cost",
        "selling_price",
    ],
    "total_amount": [
        "total_amount",
        "total",
        "amount",
        "revenue",
        "sales_amount",
    ],
    "category": [
        "category",
        "product_category",
        "type",
        "product_type",
    ],
}


def detect_column_mapping(columns: list[str]) -> dict[str, str]:
    """Detect likely business column mappings from column names.

    Args:
        columns: List of column names.

    Returns:
        Dictionary mapping business field -> detected column name.
    """
    normalized = {col.lower().strip(): col for col in columns}
    mapping = {}

    for business_field, patterns in COLUMN_PATTERNS.items():
        for pattern in patterns:
            pattern_lower = pattern.lower()
            # Exact match first
            if pattern_lower in normalized:
                mapping[business_field] = normalized[pattern_lower]
                break
            # Partial match
            for col_lower, col_original in normalized.items():
                if pattern_lower in col_lower or col_lower in pattern_lower:
                    mapping[business_field] = col_original
                    break
            if business_field in mapping:
                break

    return mapping


def classify_dataset(columns: list[str], mapping: dict[str, str]) -> str:
    """Classify dataset category based on detected columns.

    Args:
        columns: List of column names.
        mapping: Detected column mapping.

    Returns:
        Dataset category string.
    """
    has_product = "product_id" in mapping or "sku" in mapping
    has_inventory_qty = "inventory_qty" in mapping
    has_sales_qty = "sales_qty" in mapping or "quantity" in mapping
    has_supplier = "supplier_id" in mapping or "supplier_name" in mapping
    has_order = "order_id" in mapping

    # Inventory: inventory quantity present (product id may be missing -> reported as error below)
    if has_inventory_qty:
        return "inventory"
    # Purchase Orders: order + supplier + product + date (more specific than sales)
    if has_order and has_supplier and has_product and "date" in mapping:
        return "purchase_orders"
    # Sales: product + quantity (date is validated separately; missing date is an error below)
    if has_product and has_sales_qty:
        return "sales"
    # Supplier: supplier info only
    if has_supplier and not has_product and not has_order:
        return "supplier"

    return "unknown"


def validate_dataframe(df: pd.DataFrame, mapping: dict[str, str] | None = None) -> ValidationReport:
    """Validate a DataFrame for business data quality.

    Args:
        df: DataFrame to validate.
        mapping: Optional pre-detected column mapping.

    Returns:
        ValidationReport with issues found.
    """
    if mapping is None:
        mapping = detect_column_mapping(df.columns.tolist())

    report = ValidationReport(total_rows=len(df), total_columns=len(df.columns))

    if df.empty:
        report.add_issue("warning", "EMPTY_DATAFRAME", "DataFrame contains no rows")
        return report

    # Check for completely empty columns
    empty_cols = [col for col in df.columns if df[col].isnull().all()]
    for col in empty_cols:
        report.add_issue(
            "warning",
            "EMPTY_COLUMN",
            f"Column '{col}' contains only null values",
            column=col,
            count=len(df),
        )

    # Check for duplicate rows
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        dup_indices = df[df.duplicated(keep=False)].index.tolist()
        report.add_issue(
            "warning",
            "DUPLICATE_ROWS",
            f"Found {dup_count} duplicate row(s)",
            row_indices=dup_indices[:100],
            count=dup_count,
        )

    # Validate required fields for each category
    category = classify_dataset(df.columns.tolist(), mapping)

    if category == "inventory":
        _validate_inventory(df, mapping, report)
    elif category == "sales":
        _validate_sales(df, mapping, report)
    elif category == "purchase_orders":
        _validate_purchase_orders(df, mapping, report)
    elif category == "supplier":
        _validate_supplier(df, mapping, report)

    # General numeric validation
    _validate_numeric_columns(df, mapping, report)

    # General date validation
    _validate_date_columns(df, mapping, report)

    return report


def _validate_inventory(
    df: pd.DataFrame, mapping: dict[str, str], report: ValidationReport
) -> None:
    """Validate inventory-specific fields."""
    if "product_id" not in mapping:
        report.add_issue(
            "error",
            "MISSING_PRODUCT_ID",
            "No product identifier column detected (SKU, Product ID, Item ID, etc.)",
        )
    if "inventory_qty" not in mapping and "quantity" not in mapping:
        report.add_issue(
            "warning",
            "MISSING_INVENTORY_QTY",
            "No inventory quantity column detected (Stock, Inventory, On Hand, etc.)",
        )


def _validate_sales(
    df: pd.DataFrame, mapping: dict[str, str], report: ValidationReport
) -> None:
    """Validate sales-specific fields."""
    if "product_id" not in mapping:
        report.add_issue(
            "error",
            "MISSING_PRODUCT_ID",
            "No product identifier column detected for sales data",
        )
    if "sales_qty" not in mapping and "quantity" not in mapping:
        report.add_issue(
            "warning",
            "MISSING_SALES_QTY",
            "No sales quantity column detected",
        )
    if "date" not in mapping:
        report.add_issue(
            "error",
            "MISSING_DATE",
            "No date column detected for sales data",
        )


def _validate_purchase_orders(
    df: pd.DataFrame, mapping: dict[str, str], report: ValidationReport
) -> None:
    """Validate purchase order specific fields."""
    if "order_id" not in mapping:
        report.add_issue(
            "error",
            "MISSING_ORDER_ID",
            "No order identifier column detected (PO Number, Order Number, etc.)",
        )
    if "supplier_id" not in mapping and "supplier_name" not in mapping:
        report.add_issue(
            "warning",
            "MISSING_SUPPLIER",
            "No supplier column detected",
        )
    if "product_id" not in mapping:
        report.add_issue(
            "warning",
            "MISSING_PRODUCT_ID",
            "No product identifier column detected",
        )
    if "date" not in mapping:
        report.add_issue(
            "error",
            "MISSING_DATE",
            "No date column detected for purchase orders",
        )


def _validate_supplier(
    df: pd.DataFrame, mapping: dict[str, str], report: ValidationReport
) -> None:
    """Validate supplier-specific fields."""
    if "supplier_id" not in mapping and "supplier_name" not in mapping:
        report.add_issue(
            "error",
            "MISSING_SUPPLIER_IDENTIFIER",
            "No supplier identifier or name column detected",
        )


def _validate_numeric_columns(
    df: pd.DataFrame, mapping: dict[str, str], report: ValidationReport
) -> None:
    """Validate numeric columns for invalid values."""
    numeric_fields = ["quantity", "inventory_qty", "sales_qty", "unit_price", "total_amount"]

    for field in numeric_fields:
        if field in mapping:
            col = mapping[field]
            if col in df.columns:
                # Try to convert to numeric
                converted = pd.to_numeric(df[col], errors="coerce")
                invalid_mask = converted.isna() & df[col].notna()
                invalid_count = int(invalid_mask.sum())
                if invalid_count > 0:
                    invalid_indices = df[invalid_mask].index.tolist()
                    report.add_issue(
                        "warning",
                        "INVALID_NUMERIC",
                        f"Column '{col}' ({field}) contains {invalid_count} non-numeric value(s)",
                        column=col,
                        row_indices=invalid_indices[:100],
                        count=invalid_count,
                    )

                # Check for negative values where inappropriate
                if field in ("quantity", "inventory_qty", "sales_qty"):
                    negative_mask = converted < 0
                    negative_count = int(negative_mask.sum())
                    if negative_count > 0:
                        negative_indices = df[negative_mask].index.tolist()
                        report.add_issue(
                            "warning",
                            "NEGATIVE_QUANTITY",
                            f"Column '{col}' contains {negative_count} negative value(s)",
                            column=col,
                            row_indices=negative_indices[:100],
                            count=negative_count,
                        )


def _validate_date_columns(
    df: pd.DataFrame, mapping: dict[str, str], report: ValidationReport
) -> None:
    """Validate date columns."""
    if "date" in mapping:
        col = mapping["date"]
        if col in df.columns:
            converted = pd.to_datetime(df[col], errors="coerce")
            invalid_mask = converted.isna() & df[col].notna()
            invalid_count = int(invalid_mask.sum())
            if invalid_count > 0:
                invalid_indices = df[invalid_mask].index.tolist()
                report.add_issue(
                    "warning",
                    "INVALID_DATE",
                    f"Column '{col}' contains {invalid_count} unparseable date value(s)",
                    column=col,
                    row_indices=invalid_indices[:100],
                    count=invalid_count,
                )