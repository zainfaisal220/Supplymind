"""Structured data reader for SUPPLYMIND.

Reads CSV and Excel files into Pandas DataFrames with metadata preservation.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class SheetData:
    """Data for a single sheet in a spreadsheet."""

    name: str
    dataframe: pd.DataFrame
    row_count: int
    column_count: int


@dataclass
class ReadResult:
    """Result of reading a structured file."""

    sheets: list[SheetData]
    file_path: str
    file_type: str
    total_rows: int
    total_columns: int

    @property
    def sheet_names(self) -> list[str]:
        return [s.name for s in self.sheets]


def read_csv(file_path: str | Path, **kwargs) -> ReadResult:
    """Read a CSV file into a DataFrame.

    Args:
        file_path: Path to the CSV file.
        **kwargs: Additional arguments passed to pd.read_csv.

    Returns:
        ReadResult with single sheet data.

    Raises:
        ValueError: If file cannot be read.
    """
    path = Path(file_path)

    # Try multiple encodings
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    last_error = None

    for encoding in encodings:
        try:
            df = pd.read_csv(path, encoding=encoding, **kwargs)
            break
        except (UnicodeDecodeError, UnicodeError) as e:
            last_error = e
            continue
        except Exception as e:
            raise ValueError(f"Failed to read CSV: {e}") from e
    else:
        raise ValueError(f"Unable to decode CSV with supported encodings: {last_error}")

    sheet = SheetData(
        name="Sheet1",
        dataframe=df,
        row_count=len(df),
        column_count=len(df.columns),
    )

    return ReadResult(
        sheets=[sheet],
        file_path=str(path),
        file_type="csv",
        total_rows=len(df),
        total_columns=len(df.columns),
    )


def read_excel(file_path: str | Path, **kwargs) -> ReadResult:
    """Read an Excel file into DataFrames.

    Args:
        file_path: Path to the Excel file.
        **kwargs: Additional arguments passed to pd.read_excel.

    Returns:
        ReadResult with one sheet per worksheet.

    Raises:
        ValueError: If file cannot be read.
    """
    path = Path(file_path)

    try:
        excel_file = pd.ExcelFile(path, engine="openpyxl")
        sheet_names = excel_file.sheet_names
    except Exception as e:
        raise ValueError(f"Failed to open Excel file: {e}") from e

    if not sheet_names:
        raise ValueError("Excel file contains no worksheets")

    sheets: list[SheetData] = []
    total_rows = 0
    total_columns = 0

    for sheet_name in sheet_names:
        try:
            df = pd.read_excel(excel_file, sheet_name=sheet_name, **kwargs)
        except Exception as e:
            raise ValueError(f"Failed to read sheet '{sheet_name}': {e}") from e

        # Drop fully empty rows and columns
        df = df.dropna(how="all").dropna(axis=1, how="all")

        sheet = SheetData(
            name=sheet_name,
            dataframe=df,
            row_count=len(df),
            column_count=len(df.columns),
        )
        sheets.append(sheet)
        total_rows += len(df)
        total_columns = max(total_columns, len(df.columns))

    return ReadResult(
        sheets=sheets,
        file_path=str(path),
        file_type="xlsx" if path.suffix.lower() == ".xlsx" else "xls",
        total_rows=total_rows,
        total_columns=total_columns,
    )


def read_structured_file(file_path: str | Path, **kwargs) -> ReadResult:
    """Read a structured file (CSV or Excel) based on extension.

    Args:
        file_path: Path to the file.
        **kwargs: Additional arguments passed to the reader.

    Returns:
        ReadResult with sheet data.

    Raises:
        ValueError: If file format is not supported.
    """
    path = Path(file_path)
    extension = path.suffix.lower()

    if extension == ".csv":
        return read_csv(path, **kwargs)
    elif extension in (".xlsx", ".xls"):
        return read_excel(path, **kwargs)
    else:
        raise ValueError(f"Unsupported file format: {extension}")


def inspect_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    """Inspect a DataFrame and return metadata.

    Args:
        df: DataFrame to inspect.

    Returns:
        Dictionary with inspection results.
    """
    if df.empty:
        return {
            "columns": [],
            "dtypes": {},
            "missing_counts": {},
            "duplicate_rows": 0,
            "sample_values": {},
        }

    missing_counts = df.isnull().sum().to_dict()
    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

    # Sample values (non-null, up to 5 per column)
    sample_values = {}
    for col in df.columns:
        non_null = df[col].dropna()
        if len(non_null) > 0:
            sample_values[col] = non_null.head(5).tolist()

    return {
        "columns": df.columns.tolist(),
        "dtypes": dtypes,
        "missing_counts": missing_counts,
        "duplicate_rows": int(df.duplicated().sum()),
        "sample_values": sample_values,
    }