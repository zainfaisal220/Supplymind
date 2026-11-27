"""Preprocessing pipeline orchestrator for SUPPLYMIND.

Coordinates reading, validation, cleaning, and normalization of structured data.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from app.preprocessing.reader import read_structured_file, SheetData
from app.preprocessing.validator import ValidationReport, validate_dataframe
from app.preprocessing.cleaner import clean_dataframe, CleaningReport
from app.preprocessing.normalizer import normalize_dataframe, NormalizedRecord


@dataclass
class PreprocessingResult:
    """Complete result of preprocessing a structured file."""

    file_path: str
    file_type: str
    sheet_names: list[str]
    total_rows: int
    valid_rows: int
    rejected_rows: int
    category: str
    validation_report: ValidationReport
    cleaning_report: CleaningReport
    records: list[NormalizedRecord] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def preprocess_file(file_path: str | Path) -> PreprocessingResult:
    """Run the complete preprocessing pipeline on a structured file.

    Args:
        file_path: Path to CSV or Excel file.

    Returns:
        PreprocessingResult with all processing details.
    """
    path = Path(file_path)

    # 1. Read file
    read_result = read_structured_file(path)
    sheet_names = read_result.sheet_names

    all_records: list[NormalizedRecord] = []
    all_validation_issues = []
    all_cleaning_ops = []
    total_rows = read_result.total_rows
    valid_rows = 0

    # Process each sheet
    for sheet in read_result.sheets:
        df = sheet.dataframe

        if df.empty:
            continue

        # 2. Validate
        mapping = None
        # We need to use original column names for validation
        # The reader preserves original column names
        validation_report = validate_dataframe(df)
        all_validation_issues.extend(validation_report.issues)

        # 3. Clean
        # First normalize column names for consistent processing
        df_cleaned, cleaning_report = clean_dataframe(df)
        all_cleaning_ops.extend(cleaning_report.operations)

        # 4. Normalize (detect mapping on cleaned columns)
        mapping = None
        if not df_cleaned.empty:
            mapping = {}
            # Re-detect on cleaned columns
            from app.preprocessing.validator import detect_column_mapping
            mapping = detect_column_mapping(df_cleaned.columns.tolist())

            category = validate_dataframe(df_cleaned, mapping).issues[0].code if validate_dataframe(df_cleaned, mapping).issues else "unknown"
            # Actually classify properly
            from app.preprocessing.validator import classify_dataset
            category = classify_dataset(df_cleaned.columns.tolist(), mapping)

            records, _ = normalize_dataframe(df_cleaned, mapping, category)
            all_records.extend(records)
            valid_rows += len(records)

    # Determine overall category from first sheet with data
    overall_category = "unknown"
    for sheet in read_result.sheets:
        if not sheet.dataframe.empty:
            mapping = detect_column_mapping(sheet.dataframe.columns.tolist())
            overall_category = classify_dataset(sheet.dataframe.columns.tolist(), mapping)
            break

    # Collect errors
    errors = []
    for issue in all_validation_issues:
        if issue.severity == "error":
            errors.append(f"{issue.code}: {issue.message}")

    return PreprocessingResult(
        file_path=str(path),
        file_type=read_result.file_type,
        sheet_names=sheet_names,
        total_rows=total_rows,
        valid_rows=valid_rows,
        rejected_rows=total_rows - valid_rows,
        category=overall_category,
        validation_report=ValidationReport(issues=all_validation_issues, total_rows=total_rows),
        cleaning_report=CleaningReport(operations=all_cleaning_ops),
        records=all_records,
        errors=errors,
    )


def preprocess_sheet_dataframe(df: pd.DataFrame) -> PreprocessingResult:
    """Run preprocessing on a single DataFrame (for API preview)."""
    if df.empty:
        return PreprocessingResult(
            file_path="",
            file_type="",
            sheet_names=[],
            total_rows=0,
            valid_rows=0,
            rejected_rows=0,
            category="unknown",
            validation_report=ValidationReport(),
            cleaning_report=CleaningReport(),
            records=[],
            errors=["Empty DataFrame"],
        )

    validation_report = validate_dataframe(df)
    df_cleaned, cleaning_report = clean_dataframe(df)
    mapping = None
    if not df_cleaned.empty:
        from app.preprocessing.validator import detect_column_mapping, classify_dataset
        mapping = detect_column_mapping(df_cleaned.columns.tolist())
        category = classify_dataset(df_cleaned.columns.tolist(), mapping)
        records, _ = normalize_dataframe(df_cleaned, mapping, category)
    else:
        category = "unknown"
        records = []

    errors = [f"{i.code}: {i.message}" for i in validation_report.issues if i.severity == "error"]

    return PreprocessingResult(
        file_path="",
        file_type="",
        sheet_names=["Sheet1"],
        total_rows=len(df),
        valid_rows=len(records),
        rejected_rows=len(df) - len(records),
        category=category,
        validation_report=validation_report,
        cleaning_report=cleaning_report,
        records=records,
        errors=errors,
    )