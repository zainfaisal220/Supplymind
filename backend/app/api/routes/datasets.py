"""Dataset API routes for SUPPLYMIND."""

import os
import shutil
from pathlib import Path
from typing import Any

import pandas as pd

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.postgres import get_db
from app.preprocessing import preprocess_file
from app.services.dataset_service import (
    count_dataset_uploads,
    create_dataset_upload,
    delete_dataset_upload,
    get_dataset_upload,
    list_dataset_uploads,
    store_structured_records,
    update_dataset_upload_status,
    upsert_inventory_from_records,
    upsert_products_from_records,
    upsert_purchase_orders_from_records,
    upsert_sales_from_records,
    upsert_suppliers_from_records,
)

router = APIRouter()


# Pydantic models
class DatasetUploadResponse(BaseModel):
    id: int
    original_filename: str
    file_type: str
    dataset_category: str
    upload_timestamp: str
    processing_status: str
    total_rows: int
    valid_rows: int
    rejected_rows: int
    sheet_names: list[str] | None = None
    preprocessing_report: dict | None = None
    error_message: str | None = None


class DatasetPreviewResponse(BaseModel):
    dataset_id: int
    file_name: str
    file_type: str
    dataset_category: str
    columns: list[str]
    dtypes: dict[str, str]
    missing_counts: dict[str, int]
    duplicate_rows: int
    sample_rows: list[dict[str, Any]]
    validation_warnings: list[str]
    total_rows: int


class DatasetListResponse(BaseModel):
    datasets: list[DatasetUploadResponse]
    total: int
    page: int
    page_size: int


@router.post("/upload", response_model=DatasetUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and process a CSV or Excel dataset."""
    # Validate file extension
    allowed_extensions = {".csv", ".xlsx", ".xls"}
    file_ext = Path(file.filename or "").suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}",
        )

    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset

    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE} bytes",
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Save file temporarily
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    temp_filename = f"{uuid.uuid4().hex}_{file.filename}"
    temp_path = upload_dir / temp_filename

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file.file.close()

        # Preprocess the file
        result = preprocess_file(temp_path)

        # Create upload record
        upload = create_dataset_upload(
            db=db,
            filename=file.filename or "unknown",
            file_type=result.file_type,
            category=result.category,
            total_rows=result.total_rows,
            sheet_names=result.sheet_names,
            preprocessing_report={
                "validation": {
                    "errors": len(result.validation_report.errors),
                    "warnings": len(result.validation_report.warnings),
                    "issues": [
                        {"code": i.code, "message": i.message, "severity": i.severity}
                        for i in result.validation_report.issues
                    ],
                },
                "cleaning": result.cleaning_report.operations,
            },
        )

        # Store structured records
        if result.records:
            store_structured_records(db, upload.id, result.records)

            # Upsert master data based on category
            upsert_products_from_records(db, result.records)
            upsert_suppliers_from_records(db, result.records)

            if result.category == "inventory":
                upsert_inventory_from_records(db, result.records)
            elif result.category == "sales":
                upsert_sales_from_records(db, result.records)
            elif result.category == "purchase_orders":
                upsert_purchase_orders_from_records(db, result.records)

        # Update status
        update_dataset_upload_status(
            db,
            upload.id,
            status="completed" if not result.errors else "failed",
            valid_rows=result.valid_rows,
            rejected_rows=result.rejected_rows,
            error_message="; ".join(result.errors) if result.errors else None,
        )

        db.commit()

        return DatasetUploadResponse(
            id=upload.id,
            original_filename=upload.original_filename,
            file_type=upload.file_type,
            dataset_category=upload.dataset_category.value,
            upload_timestamp=upload.upload_timestamp.isoformat(),
            processing_status=upload.processing_status.value,
            total_rows=upload.total_rows,
            valid_rows=upload.valid_rows,
            rejected_rows=upload.rejected_rows,
            sheet_names=upload.sheet_names,
            preprocessing_report=upload.preprocessing_report,
            error_message=upload.error_message,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        # Clean up temp file (best-effort; may be locked on Windows)
        if temp_path.exists():
            try:
                temp_path.unlink()
            except PermissionError:
                pass


@router.get("", response_model=DatasetListResponse)
async def list_datasets(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """List all uploaded datasets with pagination."""
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20

    skip = (page - 1) * page_size
    datasets = list_dataset_uploads(db, skip=skip, limit=page_size)
    total = count_dataset_uploads(db)

    return DatasetListResponse(
        datasets=[
            DatasetUploadResponse(
                id=d.id,
                original_filename=d.original_filename,
                file_type=d.file_type,
                dataset_category=d.dataset_category.value,
                upload_timestamp=d.upload_timestamp.isoformat(),
                processing_status=d.processing_status.value,
                total_rows=d.total_rows,
                valid_rows=d.valid_rows,
                rejected_rows=d.rejected_rows,
                sheet_names=d.sheet_names,
                preprocessing_report=d.preprocessing_report,
                error_message=d.error_message,
            )
            for d in datasets
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{dataset_id}", response_model=DatasetUploadResponse)
async def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
):
    """Get dataset upload details by ID."""
    upload = get_dataset_upload(db, dataset_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return DatasetUploadResponse(
        id=upload.id,
        original_filename=upload.original_filename,
        file_type=upload.file_type,
        dataset_category=upload.dataset_category.value,
        upload_timestamp=upload.upload_timestamp.isoformat(),
        processing_status=upload.processing_status.value,
        total_rows=upload.total_rows,
        valid_rows=upload.valid_rows,
        rejected_rows=upload.rejected_rows,
        sheet_names=upload.sheet_names,
        preprocessing_report=upload.preprocessing_report,
        error_message=upload.error_message,
    )


@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
async def preview_dataset(
    dataset_id: int,
    sheet: str | None = None,
    db: Session = Depends(get_db),
):
    """Preview dataset with column info and sample rows."""
    upload = get_dataset_upload(db, dataset_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # If it is a PDF or unstructured document, return real extracted chunks from ChromaDB
    if upload.file_type.lower() in {"pdf", "docx", "txt", "html", "htm"}:
        from app.database.vector_store import get_vector_store
        import re as _re

        clean_target = _re.sub(r"^demo_", "", upload.original_filename).lower()
        doc_rows: list[dict[str, Any]] = []
        try:
            vs = get_vector_store()
            raw = vs._collection.get(include=["documents", "metadatas"])
            docs = raw.get("documents") or []
            metas = raw.get("metadatas") or []
            for idx, (content, meta) in enumerate(zip(docs, metas)):
                src = str((meta or {}).get("source", ""))
                src_name = Path(src).name if ("\\" in src or "/" in src) else src
                src_name = _re.sub(r"^[0-9a-fA-F]{32}_", "", src_name)
                src_name = _re.sub(r"^demo_", "", src_name).lower()
                if src_name == clean_target:
                    page_num = (meta or {}).get("page")
                    doc_rows.append({
                        "Section": f"Section {len(doc_rows) + 1}",
                        "Page": str(page_num + 1) if isinstance(page_num, int) else "1",
                        "Content_Preview": (content or "").strip()[:300],
                    })
        except Exception:
            doc_rows = []

        return DatasetPreviewResponse(
            dataset_id=upload.id,
            file_name=upload.original_filename,
            file_type=upload.file_type,
            dataset_category=upload.dataset_category.value,
            columns=["Section", "Page", "Content_Preview"],
            dtypes={
                "Section": "string",
                "Page": "string",
                "Content_Preview": "string",
            },
            missing_counts={},
            duplicate_rows=0,
            sample_rows=doc_rows[:20],
            validation_warnings=[],
            total_rows=len(doc_rows),
        )

    # For preview, we need to re-read the file
    # In a production system, you might store the parsed data or a preview
    # For now, return the preprocessing report info
    from app.preprocessing.reader import read_structured_file, inspect_dataframe
    from app.preprocessing.validator import validate_dataframe

    # Find the file (this is a simplification - in production you'd store the file path)
    upload_dir = Path(settings.UPLOAD_DIR)
    files = [
        f for f in upload_dir.glob(f"*_{upload.original_filename}")
        if f.is_file() and f.suffix.lower() in {".csv", ".xlsx", ".xls"}
    ]
    if not files:
        # Try to find any file that might be the upload
        files = [
            f for f in upload_dir.glob("*")
            if f.is_file() and f.suffix.lower() in {".csv", ".xlsx", ".xls"}
        ]

    if not files:
        raise HTTPException(status_code=404, detail="Source file not found for preview")

    # Sort by modification time, newest first, to pick the most recent upload
    file_path = sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)[0]
    read_result = read_structured_file(file_path)

    # Use specified sheet or first sheet
    target_sheet = None
    if sheet:
        target_sheet = next((s for s in read_result.sheets if s.name == sheet), None)
    if not target_sheet:
        target_sheet = read_result.sheets[0] if read_result.sheets else None

    if not target_sheet:
        raise HTTPException(status_code=404, detail="No data found in dataset")

    df = target_sheet.dataframe
    inspection = inspect_dataframe(df)
    validation = validate_dataframe(df)

    # Convert numpy/pandas types to native Python for JSON serialization
    missing_counts = {k: int(v) for k, v in inspection["missing_counts"].items()}

    # Sample rows (first 10) - convert numpy/pandas types to native Python
    sample_rows = []
    for _, row in df.head(10).iterrows():
        row_dict = {}
        for col in df.columns:
            val = row[col]
            if pd.isna(val):
                row_dict[col] = None
            elif isinstance(val, (pd.Timestamp, pd.Timedelta)):
                row_dict[col] = str(val)
            elif hasattr(val, "item"):
                row_dict[col] = val.item()
            else:
                row_dict[col] = val
        sample_rows.append(row_dict)

    return DatasetPreviewResponse(
        dataset_id=upload.id,
        file_name=upload.original_filename,
        file_type=upload.file_type,
        dataset_category=upload.dataset_category.value,
        columns=inspection["columns"],
        dtypes=inspection["dtypes"],
        missing_counts=missing_counts,
        duplicate_rows=inspection["duplicate_rows"],
        sample_rows=sample_rows,
        validation_warnings=[i.message for i in validation.warnings],
        total_rows=len(df),
    )


@router.delete("/{dataset_id}", status_code=status.HTTP_200_OK)
async def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
):
    """Delete a dataset upload and its associated structured records or vector chunks."""
    upload = get_dataset_upload(db, dataset_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # For PDF/document types: delete matching ChromaDB vectors in a background thread
    # so the HTTP response is instant (embedding model reload is expensive).
    if upload.file_type.lower() in {"pdf", "docx", "txt", "html", "htm"}:
        import re as _re
        import threading

        clean_target = _re.sub(r"^demo_", "", upload.original_filename).lower()

        def _delete_vectors(target: str) -> None:
            try:
                from app.database.vector_store import get_vector_store
                vs = get_vector_store()
                raw = vs._collection.get(include=["metadatas"])
                ids_to_delete = []
                for doc_id, meta in zip(raw.get("ids") or [], raw.get("metadatas") or []):
                    src = str((meta or {}).get("source", ""))
                    src_name = Path(src).name if ("\\" in src or "/" in src) else src
                    src_name = _re.sub(r"^[0-9a-fA-F]{32}_", "", src_name)
                    src_name = _re.sub(r"^demo_", "", src_name).lower()
                    if src_name == target:
                        ids_to_delete.append(doc_id)
                if ids_to_delete:
                    vs._collection.delete(ids=ids_to_delete)
            except Exception:
                pass

        threading.Thread(target=_delete_vectors, args=(clean_target,), daemon=True).start()

    success = delete_dataset_upload(db, dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"status": "success", "message": f"Dataset {dataset_id} deleted successfully"}



# Import uuid at the top
import uuid