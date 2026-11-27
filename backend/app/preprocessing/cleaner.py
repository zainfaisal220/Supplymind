"""Data cleaning for SUPPLYMIND structured preprocessing.

Cleans and normalizes structured business data.
"""

from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass
class CleaningReport:
    """Report of cleaning operations performed."""

    operations: list[dict[str, Any]] = None
    rows_before: int = 0
    rows_after: int = 0
    columns_before: int = 0
    columns_after: int = 0

    def __post_init__(self):
        if self.operations is None:
            self.operations = []

    def add_operation(self, operation: str, details: dict[str, Any]) -> None:
        """Record a cleaning operation."""
        self.operations.append({"operation": operation, "details": details})


def clean_dataframe(
    df: pd.DataFrame,
    mapping: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, CleaningReport]:
    """Clean a DataFrame for business data.

    Args:
        df: DataFrame to clean.
        mapping: Optional column mapping for business fields.

    Returns:
        Tuple of (cleaned DataFrame, CleaningReport).
    """
    if df.empty:
        return df, CleaningReport()

    report = CleaningReport(
        rows_before=len(df),
        columns_before=len(df.columns),
    )

    # Work on a copy
    df = df.copy()

    # 1. Normalize column names
    df = _normalize_column_names(df, report)

    # 2. Strip whitespace from string columns
    df = _strip_whitespace(df, report)

    # 3. Handle missing values based on column meaning
    df = _handle_missing_values(df, mapping, report)

    # 4. Convert numeric columns
    df = _convert_numeric_columns(df, mapping, report)

    # 5. Parse date columns
    df = _parse_date_columns(df, mapping, report)

    # 6. Remove fully empty rows
    df = _remove_empty_rows(df, report)

    # 7. Detect and report duplicates (don't auto-remove)
    _report_duplicates(df, report)

    report.rows_after = len(df)
    report.columns_after = len(df.columns)

    return df, report


def _normalize_column_names(df: pd.DataFrame, report: CleaningReport) -> pd.DataFrame:
    """Normalize column names to lowercase with underscores."""
    original_columns = df.columns.tolist()
    new_columns = [
        col.strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")
        for col in original_columns
    ]

    # Handle duplicates after normalization
    seen = {}
    for i, col in enumerate(new_columns):
        if col in seen:
            seen[col] += 1
            new_columns[i] = f"{col}_{seen[col]}"
        else:
            seen[col] = 0

    df.columns = new_columns

    changes = [(o, n) for o, n in zip(original_columns, new_columns) if o != n]
    if changes:
        report.add_operation("normalize_column_names", {"changes": changes})

    return df


def _strip_whitespace(df: pd.DataFrame, report: CleaningReport) -> pd.DataFrame:
    """Strip whitespace from string columns."""
    string_cols = df.select_dtypes(include=["object"]).columns
    stripped_count = 0

    for col in string_cols:
        # Only strip if there are leading/trailing spaces
        has_whitespace = df[col].astype(str).str.match(r"^\s|\s$").any()
        if has_whitespace:
            df[col] = df[col].astype(str).str.strip()
            stripped_count += 1

    if stripped_count > 0:
        report.add_operation("strip_whitespace", {"columns_affected": stripped_count})

    return df


def _handle_missing_values(
    df: pd.DataFrame, mapping: dict[str, str] | None, report: CleaningReport
) -> pd.DataFrame:
    """Handle missing values based on column semantics."""
    if not mapping:
        return df

    # Define fill strategies for business fields
    # IMPORTANT: Never auto-fill inventory/sales quantities with 0
    fill_strategies = {
        "product_id": "unknown",
        "sku": "unknown",
        "supplier_id": "unknown",
        "supplier_name": "Unknown Supplier",
        "category": "Uncategorized",
        "unit_of_measure": "EA",
    }

    for field, fill_value in fill_strategies.items():
        if field in mapping:
            col = mapping[field]
            if col in df.columns:
                missing_before = int(df[col].isna().sum())
                if missing_before > 0:
                    df[col] = df[col].fillna(fill_value)
                    report.add_operation(
                        "fill_missing",
                        {
                            "column": col,
                            "field": field,
                            "fill_value": fill_value,
                            "count": missing_before,
                        },
                    )

    return df


def _convert_numeric_columns(
    df: pd.DataFrame, mapping: dict[str, str] | None, report: CleaningReport
) -> pd.DataFrame:
    """Convert business numeric columns to appropriate types."""
    numeric_fields = [
        "quantity",
        "inventory_qty",
        "sales_qty",
        "unit_price",
        "total_amount",
    ]

    # When no mapping is supplied, auto-detect numeric columns by name so the
    # cleaner can still coerce types (e.g. "quantity", "unit_price").
    if mapping is None:
        mapping = {f: f for f in numeric_fields if f in df.columns}

    if not mapping:
        return df

    for field in numeric_fields:
        if field in mapping:
            col = mapping[field]
            if col in df.columns:
                original_dtype = df[col].dtype
                converted = pd.to_numeric(df[col], errors="coerce")
                invalid_count = int(converted.isna().sum() - df[col].isna().sum())

                if invalid_count > 0:
                    report.add_operation(
                        "convert_numeric",
                        {
                            "column": col,
                            "field": field,
                            "invalid_values_coerced_to_nan": invalid_count,
                        },
                    )

                df[col] = converted

                if str(original_dtype) != str(df[col].dtype):
                    report.add_operation(
                        "convert_numeric",
                        {
                            "column": col,
                            "field": field,
                            "from_type": str(original_dtype),
                            "to_type": str(df[col].dtype),
                        },
                    )

    return df


def _parse_date_columns(
    df: pd.DataFrame, mapping: dict[str, str] | None, report: CleaningReport
) -> pd.DataFrame:
    """Parse date columns to datetime."""
    # When no mapping is supplied, auto-detect a date column by name.
    if mapping is None and "date" in df.columns:
        mapping = {"date": "date"}

    if not mapping:
        return df

    if "date" in mapping:
        col = mapping["date"]
        if col in df.columns:
            original_dtype = df[col].dtype
            converted = pd.to_datetime(df[col], errors="coerce")
            invalid_count = int(converted.isna().sum() - df[col].isna().sum())

            if invalid_count > 0:
                report.add_operation(
                    "parse_date",
                    {
                        "column": col,
                        "invalid_values_coerced_to_nat": invalid_count,
                    },
                )

            df[col] = converted

            if str(original_dtype) != str(df[col].dtype):
                report.add_operation(
                    "parse_date",
                    {
                        "column": col,
                        "from_type": str(original_dtype),
                        "to_type": str(df[col].dtype),
                    },
                )

    return df


def _remove_empty_rows(df: pd.DataFrame, report: CleaningReport) -> pd.DataFrame:
    """Remove rows that are completely empty."""
    before = len(df)
    df = df.dropna(how="all")
    removed = before - len(df)

    if removed > 0:
        report.add_operation("remove_empty_rows", {"rows_removed": removed})

    return df


def _report_duplicates(df: pd.DataFrame, report: CleaningReport) -> None:
    """Report duplicate rows without removing them."""
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        report.add_operation(
            "report_duplicates",
            {
                "duplicate_row_count": dup_count,
                "action": "reported_only_not_removed",
            },
        )