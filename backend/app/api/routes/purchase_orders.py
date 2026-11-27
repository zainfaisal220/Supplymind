"""Purchase Orders API routes for SUPPLYMIND."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.database.models import (
    PurchaseOrder,
    PurchaseOrderItem as POModelItem,
    Product,
    Supplier,
)
from app.services.dataset_service import get_purchase_orders

router = APIRouter()


class POItem(BaseModel):
    id: int
    product_id: Optional[int] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity_ordered: float
    quantity_received: float
    unit_price: float
    total_price: float


class PurchaseOrderItem(BaseModel):
    id: int
    po_number: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    order_date: str
    expected_date: Optional[str] = None
    status: str
    total_amount: Optional[float] = None
    currency: str
    items: list[POItem] = []


class PurchaseOrdersResponse(BaseModel):
    items: list[PurchaseOrderItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=PurchaseOrdersResponse)
async def list_purchase_orders(
    supplier_id: Optional[int] = Query(None, description="Filter by supplier ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    po_number: Optional[str] = Query(None, description="Filter by PO number (partial match)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get purchase orders with optional filtering."""
    items = get_purchase_orders(
        db,
        supplier_id=supplier_id,
        status=status,
        po_number=po_number,
        skip=(page - 1) * page_size,
        limit=page_size,
    )

    # Get total count
    from sqlalchemy import func, select
    stmt = select(func.count(PurchaseOrder.id))
    if supplier_id:
        stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if po_number:
        stmt = stmt.where(PurchaseOrder.po_number.ilike(f"%{po_number}%"))
    total = int(db.execute(stmt).scalar_one())

    # Build response with items
    response_items = []
    for po in items:
        supplier = db.get(Supplier, po.supplier_id) if po.supplier_id else None
        po_items = db.execute(
            select(POModelItem).where(POModelItem.purchase_order_id == po.id)
        ).scalars().all()

        item_list = []
        for item in po_items:
            product = db.get(Product, item.product_id) if item.product_id else None
            item_list.append(
                POItem(
                    id=item.id,
                    product_id=item.product_id,
                    sku=item.sku or (product.sku if product else None),
                    description=item.description,
                    quantity_ordered=item.quantity_ordered,
                    quantity_received=item.quantity_received,
                    unit_price=item.unit_price,
                    total_price=item.total_price,
                )
            )

        response_items.append(
            PurchaseOrderItem(
                id=po.id,
                po_number=po.po_number,
                supplier_id=po.supplier_id,
                supplier_name=supplier.name if supplier else None,
                order_date=po.order_date.isoformat(),
                expected_date=po.expected_date.isoformat() if po.expected_date else None,
                status=po.status,
                total_amount=po.total_amount,
                currency=po.currency,
                items=item_list,
            )
        )

    return PurchaseOrdersResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/{po_id}")
async def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
):
    """Delete a single purchase order by ID."""
    from sqlalchemy import delete
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    db.execute(delete(POModelItem).where(POModelItem.purchase_order_id == po_id))
    db.delete(po)
    db.commit()
    return {"status": "success", "message": f"Purchase order {po_id} deleted"}


@router.delete("")
@router.delete("/")
async def clear_all_purchase_orders(
    db: Session = Depends(get_db),
):
    """Delete all purchase orders."""
    from sqlalchemy import delete
    db.execute(delete(POModelItem))
    db.execute(delete(PurchaseOrder))
    db.commit()
    return {"status": "success", "message": "All purchase orders cleared"}
