"""File detection and security validation module for SUPPLYMIND document ingestion.

Centralizes supported file format definitions, extension parsing, file existence,
size limits, magic-byte signatures, and path traversal checks.
"""

from pathlib import Path
from typing import Dict, Optional, Set, Union

from app.ingestion.exceptions import (
    DocumentFileNotFoundError,
    DocumentSecurityError,
    EmptyFileError,
    FileCorruptedError,
    FileSizeLimitExceededError,
    UnsupportedFileTypeError,
)

# Default maximum file size: 50 MB
DEFAULT_MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024

# Centralized mapping of supported extensions to canonical document types
SUPPORTED_EXTENSION_MAP: Dict[str, str] = {
    ".pdf": "pdf",
    ".csv": "csv",
    ".docx": "docx",
    ".txt": "txt",
    ".html": "html",
    ".htm": "html",
    ".xlsx": "xlsx",
    ".xls": "xlsx",
}

SUPPORTED_EXTENSIONS: Set[str] = set(SUPPORTED_EXTENSION_MAP.keys())

# Known binary signatures (magic bytes) for non-plain-text formats
MAGIC_BYTE_SIGNATURES: Dict[str, list[bytes]] = {
    "pdf": [b"%PDF-"],
    # ZIP-based container format used by DOCX and modern XLSX
    "docx": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
    "xlsx": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],  # includes OLE2 (.xls)
}

# Dangerous executable signatures to guard against disguised files
EXECUTABLE_SIGNATURES: list[bytes] = [
    b"MZ",  # Windows PE executable / DLL
    b"\x7fELF",  # Linux ELF executable
    b"\xca\xfe\xba\xbe",  # Java class / Mach-O universal binary
]


def resolve_and_validate_path(
    file_path: Union[str, Path],
    allowed_base_dir: Optional[Union[str, Path]] = None,
) -> Path:
    """Resolve file path and guard against path traversal vulnerabilities.

    Args:
        file_path: Path to the target document.
        allowed_base_dir: Optional directory root outside of which access is forbidden.

    Returns:
        Resolved Path object.

    Raises:
        DocumentFileNotFoundError: If the target does not exist.
        DocumentSecurityError: If path traversal or directory escaping is detected.
    """
    raw_path_str = str(file_path)

    # Reject null bytes and obvious directory traversal patterns in raw input
    if "\x00" in raw_path_str:
        raise DocumentSecurityError("Null bytes are not allowed in file paths", file_path=raw_path_str)

    try:
        path = Path(file_path).resolve()
    except Exception as exc:
        raise DocumentSecurityError(f"Invalid file path structure: {exc}", file_path=raw_path_str) from exc

    if not path.exists():
        raise DocumentFileNotFoundError(f"Document file does not exist: {file_path}", file_path=raw_path_str)

    if not path.is_file():
        raise DocumentSecurityError(f"Target path is not a regular file: {file_path}", file_path=raw_path_str)

    # Enforce base directory jail if configured
    if allowed_base_dir:
        base = Path(allowed_base_dir).resolve()
        try:
            path.relative_to(base)
        except ValueError as exc:
            raise DocumentSecurityError(
                f"Path traversal detected: {path} is outside allowed directory {base}",
                file_path=raw_path_str,
            ) from exc

    return path


def validate_file_size(path: Path, max_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES) -> None:
    """Validate that the file is neither empty nor exceeds maximum size limit.

    Args:
        path: Resolved Path of the document.
        max_size_bytes: Maximum allowed file size in bytes.

    Raises:
        EmptyFileError: If file size is 0 bytes.
        FileSizeLimitExceededError: If file exceeds max_size_bytes.
    """
    size = path.stat().st_size
    if size == 0:
        raise EmptyFileError(f"File is empty (0 bytes): {path.name}", file_path=str(path))

    if size > max_size_bytes:
        raise FileSizeLimitExceededError(
            f"File size ({size} bytes) exceeds limit ({max_size_bytes} bytes): {path.name}",
            file_path=str(path),
        )


def validate_file_signature(path: Path, doc_type: str) -> None:
    """Verify file magic bytes against executable signatures and format expectations.

    Args:
        path: Path to the file.
        doc_type: Normalized document type identifier (e.g. 'pdf', 'docx').

    Raises:
        DocumentSecurityError: If file matches known executable binary patterns.
        FileCorruptedError: If file signature does not match expected format headers.
    """
    try:
        with open(path, "rb") as f:
            header = f.read(16)
    except Exception as exc:
        raise FileCorruptedError(f"Cannot read file header for verification: {exc}", file_path=str(path)) from exc

    # Reject executable headers
    for sig in EXECUTABLE_SIGNATURES:
        if header.startswith(sig):
            raise DocumentSecurityError(
                f"Executable binary content detected. Refusing to process file: {path.name}",
                file_path=str(path),
            )

    # Verify signature for binary formats
    expected_signatures = MAGIC_BYTE_SIGNATURES.get(doc_type)
    if expected_signatures:
        if not any(header.startswith(sig) for sig in expected_signatures):
            raise FileCorruptedError(
                f"File signature mismatch: {path.name} is not a valid {doc_type.upper()} file.",
                file_path=str(path),
            )


def detect_file_type(
    file_path: Union[str, Path],
    allowed_base_dir: Optional[Union[str, Path]] = None,
    max_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
    verify_signatures: bool = True,
) -> str:
    """Detect and validate the file format of a document.

    Performs full end-to-end validation:
    1. Resolves path and checks against path traversal.
    2. Verifies file existence and regular file type.
    3. Checks file size bounds (rejects 0 bytes and oversized files).
    4. Detects extension (case-insensitive) and maps to canonical type.
    5. Rejects unsupported extensions.
    6. Verifies file magic bytes / signature (security check).

    Args:
        file_path: File system path to the document.
        allowed_base_dir: Optional base directory to restrict access.
        max_size_bytes: Upper limit for document size.
        verify_signatures: Whether to inspect header magic bytes.

    Returns:
        Canonical document type string: 'pdf', 'csv', 'docx', 'txt', 'html', or 'xlsx'.

    Raises:
        DocumentFileNotFoundError: If the file does not exist.
        EmptyFileError: If the file is 0 bytes.
        UnsupportedFileTypeError: If the format is not supported.
        FileSizeLimitExceededError: If the file exceeds size limits.
        DocumentSecurityError: On path traversal or executable file detection.
        FileCorruptedError: On magic-byte header mismatch.
    """
    path = resolve_and_validate_path(file_path, allowed_base_dir=allowed_base_dir)

    validate_file_size(path, max_size_bytes=max_size_bytes)

    extension = path.suffix.lower()
    if not extension or extension not in SUPPORTED_EXTENSION_MAP:
        raise UnsupportedFileTypeError(
            f"Unsupported file format '{extension}'. Supported extensions: {sorted(SUPPORTED_EXTENSIONS)}",
            file_path=str(path),
        )

    doc_type = SUPPORTED_EXTENSION_MAP[extension]

    if verify_signatures:
        validate_file_signature(path, doc_type)

    return doc_type
