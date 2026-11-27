"""Suppliers API routes for SUPPLYMIND."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.database.models import Supplier
from app.services.dataset_service import get_suppliers

router = APIRouter()


class SupplierItem(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[str] = None
    currency: str
    is_active: bool
    created_at: str


class SuppliersResponse(BaseModel):
    items: list[SupplierItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=SuppliersResponse)
async def list_suppliers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get all suppliers with pagination."""
    items = get_suppliers(db, skip=(page - 1) * page_size, limit=page_size)

    # Get total count
    from sqlalchemy import func, select
    total = db.execute(select(func.count(Supplier.id)).where(Supplier.is_active)).scalar_one()

    response_items = [
        SupplierItem(
            id=s.id,
            name=s.name,
            contact_person=s.contact_person,
            email=s.email,
            phone=s.phone,
            address=s.address,
            city=s.city,
            country=s.country,
            payment_terms=s.payment_terms,
            currency=s.currency,
            is_active=s.is_active,
            created_at=s.created_at.isoformat(),
        )
        for s in items
    ]

    return SuppliersResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
):
    """Delete a supplier by ID."""
    s = db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(s)
    db.commit()
    return {"status": "success", "message": f"Supplier {supplier_id} deleted"}


@router.delete("")
@router.delete("/")
async def clear_all_suppliers(
    db: Session = Depends(get_db),
):
    """Delete all suppliers."""
    from sqlalchemy import delete
    db.execute(delete(Supplier))
    db.commit()
    return {"status": "success", "message": "All suppliers cleared"}
