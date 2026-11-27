"""Preprocessing package for SUPPLYMIND structured data."""

from app.preprocessing.cleaner import clean_dataframe, CleaningReport
from app.preprocessing.normalizer import normalize_dataframe, NormalizedRecord
from app.preprocessing.reader import read_csv, read_excel, read_structured_file, SheetData, inspect_dataframe
from app.preprocessing.transformer import preprocess_file, preprocess_sheet_dataframe, PreprocessingResult
from app.preprocessing.validator import (
    ValidationIssue,
    ValidationReport,
    validate_dataframe,
    detect_column_mapping,
    classify_dataset,
)

__all__ = [
    # Reader
    "read_csv",
    "read_excel",
    "read_structured_file",
    "SheetData",
    "inspect_dataframe",
    # Validator
    "ValidationIssue",
    "ValidationReport",
    "validate_dataframe",
    "detect_column_mapping",
    "classify_dataset",
    # Cleaner
    "clean_dataframe",
    "CleaningReport",
    # Normalizer
    "normalize_dataframe",
    "NormalizedRecord",
    # Transformer
    "preprocess_file",
    "preprocess_sheet_dataframe",
    "PreprocessingResult",
]