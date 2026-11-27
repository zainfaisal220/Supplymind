"""Documents API routes for SUPPLYMIND RAG integration."""

import os
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.postgres import get_db
from app.rag.ingestion import ingest_document

router = APIRouter()


class DocumentUploadResponse(BaseModel):
    status: str
    file_name: str
    chunks_stored: int
    message: str | None = None


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and process an unstructured document (PDF, DOCX, TXT, HTML)."""
    # Validate file extension
    allowed_extensions = {".pdf", ".docx", ".txt", ".html", ".htm"}
    file_ext = Path(file.filename or "").suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}",
        )

    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE} bytes",
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Save file temporarily
    upload_dir = Path(settings.UPLOAD_DIR) / "documents"
    upload_dir.mkdir(parents=True, exist_ok=True)

    temp_filename = f"{uuid4().hex}_{file.filename}"
    temp_path = upload_dir / temp_filename

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Ingest document using existing RAG pipeline
        result = ingest_document(str(temp_path))

        # Record upload in dataset_uploads table so it appears in the catalog
        from app.database.models import DatasetUpload, DatasetCategory, ProcessingStatus
        chunks = result.get("chunks_stored", 0)
        upload = DatasetUpload(
            original_filename=file.filename or "uploaded_document.pdf",
            file_type=file_ext.lstrip(".").lower() or "pdf",
            dataset_category=DatasetCategory.UNKNOWN,
            processing_status=ProcessingStatus.COMPLETED,
            total_rows=chunks,
            valid_rows=chunks,
            rejected_rows=0,
            sheet_names=["ChromaDB Vector Chunks"],
            preprocessing_report={
                "type": "unstructured_rag_ingestion",
                "format": file_ext.upper(),
                "chunks_stored": chunks,
                "status": "indexed_in_chromadb",
            },
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)

        return DocumentUploadResponse(
            status=result.get("status", "unknown"),
            file_name=file.filename or "unknown",
            chunks_stored=result.get("chunks_stored", 0),
            message=result.get("message"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document ingestion failed: {str(e)}")
    finally:
        # Clean up temp file
        if temp_path.exists():
            temp_path.unlink()