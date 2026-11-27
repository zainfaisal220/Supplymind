"""Document loader implementation for SUPPLYMIND.

Converts multiple business document formats (PDF, CSV, DOCX, TXT, HTML, XLSX)
into standardized LangChain Document objects with rich, consistent metadata.
"""

import os
from pathlib import Path
from typing import List, Optional, Union

import pandas as pd
from langchain_community.document_loaders import (
    BSHTMLLoader,
    CSVLoader,
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
)
from langchain_core.documents import Document

from app.ingestion.exceptions import (
    DocumentFileNotFoundError,
    DocumentLoadError,
    EmptyFileError,
    FileCorruptedError,
    UnsupportedFileTypeError,
)
from app.ingestion.file_detector import (
    DEFAULT_MAX_FILE_SIZE_BYTES,
    detect_file_type,
    resolve_and_validate_path,
)

ENCODING_CANDIDATES = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]


def load_document(file_path: Union[str, Path]) -> List[Document]:
    """Load a document based on its extension.
    
    This matches the core interview/presentation workflow:
    1. Inspects the file extension in lowercase.
    2. Routes to the matching LangChain loader via if/elif conditions.
    3. Returns standardized LangChain Document objects.
    """
    extension = Path(file_path).suffix.lower()

    if extension == ".pdf":
        loader = PyPDFLoader(str(file_path))
        return loader.load()

    elif extension == ".csv":
        loader = CSVLoader(str(file_path))
        return loader.load()

    elif extension == ".docx":
        loader = Docx2txtLoader(str(file_path))
        return loader.load()

    elif extension == ".txt":
        loader = TextLoader(
            str(file_path),
            encoding="utf-8",
        )
        return loader.load()

    elif extension in (".html", ".htm"):
        loader = BSHTMLLoader(str(file_path))
        return loader.load()

    elif extension in (".xlsx", ".xls"):
        return DocumentLoader().load_excel(file_path)

    else:
        raise ValueError(f"Unsupported file format: {extension}")


class DocumentLoader:
    """Production-grade multi-format document loader for SUPPLYMIND."""

    def __init__(
        self,
        allowed_base_dir: Optional[Union[str, Path]] = None,
        max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
        verify_signatures: bool = True,
    ):
        """Initialize DocumentLoader.

        Args:
            allowed_base_dir: Optional boundary directory for path traversal protection.
            max_file_size_bytes: Configurable upper size limit for ingested files.
            verify_signatures: Whether to validate magic-byte signatures during type detection.
        """
        self.allowed_base_dir = allowed_base_dir
        self.max_file_size_bytes = max_file_size_bytes
        self.verify_signatures = verify_signatures

    def load_file(self, file_path: Union[str, Path]) -> List[Document]:
        """Validate, detect format, and route document to the appropriate loader.

        Args:
            file_path: Path to the target document.

        Returns:
            List of standardized LangChain Document objects.

        Raises:
            DocumentFileNotFoundError: If the file does not exist.
            EmptyFileError: If the file is empty or yields no content.
            UnsupportedFileTypeError: If the format is not supported.
            FileCorruptedError: If file structure or parsing fails due to corruption.
            DocumentLoadError: If loading fails unexpectedly.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        doc_type = detect_file_type(
            path,
            allowed_base_dir=self.allowed_base_dir,
            max_size_bytes=self.max_file_size_bytes,
            verify_signatures=self.verify_signatures,
        )

        if doc_type == "pdf":
            return self.load_pdf(path)
        elif doc_type == "csv":
            return self.load_csv(path)
        elif doc_type == "docx":
            return self.load_docx(path)
        elif doc_type == "txt":
            return self.load_txt(path)
        elif doc_type == "html":
            return self.load_html(path)
        elif doc_type == "xlsx":
            return self.load_excel(path)
        else:
            raise UnsupportedFileTypeError(
                f"No loader configured for detected document type: {doc_type}",
                file_path=str(path),
            )

    def load_pdf(self, file_path: Union[str, Path]) -> List[Document]:
        """Load PDF document using PyPDFLoader and preserve page numbers.

        Args:
            file_path: Path to the PDF file.

        Returns:
            List of Document objects, one per page.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        source_name = path.name

        try:
            loader = PyPDFLoader(str(path))
            raw_docs = loader.load()
        except Exception as exc:
            raise FileCorruptedError(
                f"Failed to load or parse PDF file ({exc})",
                file_path=str(path),
            ) from exc

        if not raw_docs:
            raise EmptyFileError(f"PDF contains no extractable pages or text: {source_name}", file_path=str(path))

        standardized_docs: List[Document] = []
        for doc in raw_docs:
            raw_page = doc.metadata.get("page", 0)
            page_number = int(raw_page) + 1  # Standardize to 1-indexed page numbering

            metadata = {
                "source": source_name,
                "document_type": "pdf",
                "page": page_number,
                "file_path": str(path),
            }
            standardized_docs.append(Document(page_content=doc.page_content, metadata=metadata))

        return standardized_docs

    def load_csv(self, file_path: Union[str, Path]) -> List[Document]:
        """Load CSV document preserving row indexes and handling encodings gracefully.

        Args:
            file_path: Path to the CSV file.

        Returns:
            List of Document objects, one per row.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        source_name = path.name

        raw_docs = None
        last_exception = None

        for encoding in ENCODING_CANDIDATES:
            try:
                loader = CSVLoader(file_path=str(path), encoding=encoding)
                raw_docs = loader.load()
                break
            except (UnicodeDecodeError, UnicodeError) as exc:
                last_exception = exc
                continue
            except RuntimeError as exc:
                if isinstance(exc.__cause__, (UnicodeDecodeError, UnicodeError)):
                    last_exception = exc.__cause__
                    continue
                raise FileCorruptedError(
                    f"Corrupted or invalid CSV format ({exc})",
                    file_path=str(path),
                ) from exc
            except Exception as exc:
                raise FileCorruptedError(
                    f"Corrupted or invalid CSV format ({exc})",
                    file_path=str(path),
                ) from exc

        if raw_docs is None:
            raise DocumentLoadError(
                f"Unable to decode CSV file with supported encodings ({ENCODING_CANDIDATES}): {last_exception}",
                file_path=str(path),
            )

        if not raw_docs:
            raise EmptyFileError(f"CSV contains no data rows: {source_name}", file_path=str(path))

        standardized_docs: List[Document] = []
        for idx, doc in enumerate(raw_docs, start=1):
            raw_row = doc.metadata.get("row")
            if raw_row is not None and isinstance(raw_row, int):
                row_number = raw_row + 1
            else:
                row_number = idx

            metadata = {
                "source": source_name,
                "document_type": "csv",
                "row_index": row_number,
                "file_path": str(path),
            }
            standardized_docs.append(Document(page_content=doc.page_content, metadata=metadata))

        return standardized_docs

    def load_docx(self, file_path: Union[str, Path]) -> List[Document]:
        """Load DOCX document using Docx2txtLoader.

        Args:
            file_path: Path to the DOCX file.

        Returns:
            List of Document objects.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        source_name = path.name

        try:
            loader = Docx2txtLoader(str(path))
            raw_docs = loader.load()
        except Exception as exc:
            raise FileCorruptedError(
                f"Failed to load or parse DOCX document ({exc})",
                file_path=str(path),
            ) from exc

        # Filter out empty or whitespace-only documents
        valid_docs = [d for d in raw_docs if d.page_content and d.page_content.strip()]
        if not valid_docs:
            raise EmptyFileError(f"DOCX document contains no text content: {source_name}", file_path=str(path))

        standardized_docs: List[Document] = []
        for doc in valid_docs:
            metadata = {
                "source": source_name,
                "document_type": "docx",
                "file_path": str(path),
            }
            standardized_docs.append(Document(page_content=doc.page_content.strip(), metadata=metadata))

        return standardized_docs

    def load_txt(self, file_path: Union[str, Path]) -> List[Document]:
        """Load TXT document with multi-encoding fallback.

        Args:
            file_path: Path to the TXT file.

        Returns:
            List containing a Document object for the text file.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        source_name = path.name

        raw_docs = None
        last_exception = None

        for encoding in ENCODING_CANDIDATES:
            try:
                loader = TextLoader(str(path), encoding=encoding)
                raw_docs = loader.load()
                break
            except (UnicodeDecodeError, UnicodeError) as exc:
                last_exception = exc
                continue
            except RuntimeError as exc:
                if isinstance(exc.__cause__, (UnicodeDecodeError, UnicodeError)):
                    last_exception = exc.__cause__
                    continue
                raise FileCorruptedError(
                    f"Failed to read TXT file ({exc})",
                    file_path=str(path),
                ) from exc
            except Exception as exc:
                raise FileCorruptedError(
                    f"Failed to read TXT file ({exc})",
                    file_path=str(path),
                ) from exc

        if raw_docs is None:
            raise DocumentLoadError(
                f"Unable to decode text file with supported encodings ({ENCODING_CANDIDATES}): {last_exception}",
                file_path=str(path),
            )

        valid_docs = [d for d in raw_docs if d.page_content and d.page_content.strip()]
        if not valid_docs:
            raise EmptyFileError(f"TXT document contains only empty whitespace: {source_name}", file_path=str(path))

        standardized_docs: List[Document] = []
        for doc in valid_docs:
            metadata = {
                "source": source_name,
                "document_type": "txt",
                "file_path": str(path),
            }
            standardized_docs.append(Document(page_content=doc.page_content.strip(), metadata=metadata))

        return standardized_docs

    def load_html(self, file_path: Union[str, Path]) -> List[Document]:
        """Load HTML document using BSHTMLLoader and extract title metadata.

        Args:
            file_path: Path to the HTML file.

        Returns:
            List containing a Document object.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        source_name = path.name

        raw_docs = None
        last_exception = None

        for encoding in ENCODING_CANDIDATES:
            try:
                loader = BSHTMLLoader(str(path), open_encoding=encoding)
                raw_docs = loader.load()
                break
            except (UnicodeDecodeError, UnicodeError) as exc:
                last_exception = exc
                continue
            except RuntimeError as exc:
                if isinstance(exc.__cause__, (UnicodeDecodeError, UnicodeError)):
                    last_exception = exc.__cause__
                    continue
                raise FileCorruptedError(
                    f"Failed to parse HTML document ({exc})",
                    file_path=str(path),
                ) from exc
            except Exception as exc:
                raise FileCorruptedError(
                    f"Failed to parse HTML document ({exc})",
                    file_path=str(path),
                ) from exc

        if raw_docs is None:
            raise DocumentLoadError(
                f"Unable to decode HTML file with supported encodings ({ENCODING_CANDIDATES}): {last_exception}",
                file_path=str(path),
            )

        valid_docs = [d for d in raw_docs if d.page_content and d.page_content.strip()]
        if not valid_docs:
            raise EmptyFileError(f"HTML document contains no extractable text: {source_name}", file_path=str(path))

        standardized_docs: List[Document] = []
        for doc in valid_docs:
            title = doc.metadata.get("title")
            metadata = {
                "source": source_name,
                "document_type": "html",
                "file_path": str(path),
            }
            if title:
                metadata["title"] = title

            standardized_docs.append(Document(page_content=doc.page_content.strip(), metadata=metadata))

        return standardized_docs

    def load_excel(self, file_path: Union[str, Path]) -> List[Document]:
        """Load Excel (.xlsx, .xls) workbook preserving all worksheets and row context.

        Converts each worksheet row into a structured document representation with
        column names and values, preserving worksheet names and row identifiers in metadata.

        Args:
            file_path: Path to the Excel workbook.

        Returns:
            List of Document objects representing rows across all worksheets.
        """
        path = resolve_and_validate_path(file_path, allowed_base_dir=self.allowed_base_dir)
        source_name = path.name

        try:
            excel_file = pd.ExcelFile(str(path), engine="openpyxl")
            sheet_names = excel_file.sheet_names
        except Exception as exc:
            raise FileCorruptedError(
                f"Failed to open or parse Excel workbook ({exc})",
                file_path=str(path),
            ) from exc

        if not sheet_names:
            raise EmptyFileError(f"Excel workbook contains no worksheets: {source_name}", file_path=str(path))

        standardized_docs: List[Document] = []

        for sheet in sheet_names:
            try:
                df = pd.read_excel(excel_file, sheet_name=sheet)
            except Exception as exc:
                raise FileCorruptedError(
                    f"Failed reading worksheet '{sheet}' in Excel file ({exc})",
                    file_path=str(path),
                ) from exc

            # Drop fully empty rows/columns
            df = df.dropna(how="all")

            if df.empty:
                # If a worksheet is empty, generate an informative record preserving the sheet metadata
                content = f"Worksheet '{sheet}' is empty."
                metadata = {
                    "source": source_name,
                    "document_type": "xlsx",
                    "sheet_name": sheet,
                    "row_index": None,
                    "file_path": str(path),
                }
                standardized_docs.append(Document(page_content=content, metadata=metadata))
                continue

            for row_idx, (_, row) in enumerate(df.iterrows(), start=1):
                # Represent row meaningfully with non-null column headers and values
                fields = [f"{col}: {val}" for col, val in row.items() if pd.notna(val)]
                row_content = " | ".join(fields) if fields else f"Row {row_idx} is empty"

                metadata = {
                    "source": source_name,
                    "document_type": "xlsx",
                    "sheet_name": sheet,
                    "row_index": row_idx,
                    "file_path": str(path),
                }
                standardized_docs.append(Document(page_content=row_content, metadata=metadata))

        if not standardized_docs:
            raise EmptyFileError(f"Excel workbook contains no extractable data: {source_name}", file_path=str(path))

        return standardized_docs
