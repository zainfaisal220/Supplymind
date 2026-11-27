"""Inventory API routes for SUPPLYMIND."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.database.models import Inventory, Product
from app.services.dataset_service import get_inventory

router = APIRouter()


class InventoryItem(BaseModel):
    id: int
    product_id: int
    sku: str
    product_name: Optional[str] = None
    location: Optional[str] = None
    record_date: str
    quantity_on_hand: float
    quantity_allocated: float
    quantity_available: float


class InventoryResponse(BaseModel):
    items: list[InventoryItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=InventoryResponse)
async def list_inventory(
    sku: Optional[str] = Query(None, description="Filter by SKU"),
    product_id: Optional[int] = Query(None, description="Filter by product ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get inventory records with optional filtering."""
    items = get_inventory(db, sku=sku, product_id=product_id, skip=(page - 1) * page_size, limit=page_size)

    # Get total count
    from sqlalchemy import func, select
    stmt = select(func.count(Inventory.id))
    if sku:
        product = db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none()
        if product:
            stmt = stmt.where(Inventory.product_id == product.id)
        else:
            return InventoryResponse(items=[], total=0, page=page, page_size=page_size)
    elif product_id:
        stmt = stmt.where(Inventory.product_id == product_id)
    total = db.execute(stmt).scalar_one()

    # Build response with product info
    response_items = []
    for inv in items:
        product = db.get(Product, inv.product_id)
        response_items.append(
            InventoryItem(
                id=inv.id,
                product_id=inv.product_id,
                sku=product.sku if product else "unknown",
                product_name=product.product_name if product else None,
                location=inv.location,
                record_date=inv.record_date.isoformat(),
                quantity_on_hand=inv.quantity_on_hand,
                quantity_allocated=inv.quantity_allocated,
                quantity_available=inv.quantity_available,
            )
        )

    return InventoryResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/{item_id}")
async def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Delete an inventory record by ID."""
    item = db.get(Inventory, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"Inventory item {item_id} deleted"}


@router.delete("")
@router.delete("/")
async def clear_all_inventory(
    db: Session = Depends(get_db),
):
    """Delete all inventory records."""
    from sqlalchemy import delete
    db.execute(delete(Inventory))
    db.commit()
    return {"status": "success", "message": "All inventory records cleared"}
