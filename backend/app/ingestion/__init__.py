"""Ingestion module for SUPPLYMIND.

Exposes the DocumentLoader, file detector, and custom exceptions.
"""

from app.ingestion.exceptions import (
    DocumentFileNotFoundError,
    DocumentLoadError,
    DocumentSecurityError,
    EmptyFileError,
    FileCorruptedError,
    FileSizeLimitExceededError,
    IngestionError,
    UnsupportedFileTypeError,
)
from app.ingestion.file_detector import (
    DEFAULT_MAX_FILE_SIZE_BYTES,
    SUPPORTED_EXTENSION_MAP,
    SUPPORTED_EXTENSIONS,
    detect_file_type,
    resolve_and_validate_path,
)
from app.ingestion.loader import DocumentLoader, load_document

__all__ = [
    "DocumentLoader",
    "load_document",
    "detect_file_type",
    "resolve_and_validate_path",
    "SUPPORTED_EXTENSION_MAP",
    "SUPPORTED_EXTENSIONS",
    "DEFAULT_MAX_FILE_SIZE_BYTES",
    "IngestionError",
    "DocumentFileNotFoundError",
    "EmptyFileError",
    "UnsupportedFileTypeError",
    "FileSizeLimitExceededError",
    "DocumentSecurityError",
    "DocumentLoadError",
    "FileCorruptedError",
]
