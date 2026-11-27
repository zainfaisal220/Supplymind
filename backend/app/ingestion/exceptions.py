"""Custom exceptions for SUPPLYMIND document ingestion module.

Provides a unified error hierarchy for file validation, unsupported formats,
missing/empty files, corrupted content, and loader failures.
"""

from typing import Optional


class IngestionError(Exception):
    """Base exception for all document ingestion and loader errors."""

    def __init__(self, message: str, file_path: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.file_path = str(file_path) if file_path else None

    def __str__(self) -> str:
        if self.file_path:
            return f"[{self.file_path}] {self.message}"
        return self.message


class DocumentFileNotFoundError(IngestionError, FileNotFoundError):
    """Raised when the target document does not exist at the given path."""
    pass


class EmptyFileError(IngestionError):
    """Raised when the document file is zero bytes or has no extractable content."""
    pass


class UnsupportedFileTypeError(IngestionError):
    """Raised when the document format or extension is not supported."""
    pass


class FileSizeLimitExceededError(IngestionError):
    """Raised when the file size exceeds the configured maximum allowed size."""
    pass


class DocumentSecurityError(IngestionError):
    """Raised when security validation fails (e.g. path traversal or malicious content)."""
    pass


class DocumentLoadError(IngestionError):
    """Raised when an error occurs while extracting or parsing a document."""
    pass


class FileCorruptedError(DocumentLoadError):
    """Raised when the file is structurally damaged, incomplete, or unreadable."""
    pass
