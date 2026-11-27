"""Sales API routes for SUPPLYMIND."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.database.models import Product, Sale
from app.services.dataset_service import get_sales

router = APIRouter()


class SaleItem(BaseModel):
    id: int
    product_id: Optional[int] = None
    sku: Optional[str] = None
    product_name: Optional[str] = None
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    sale_date: str
    quantity: float
    unit_price: float
    total_amount: float
    currency: str


class SalesResponse(BaseModel):
    items: list[SaleItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=SalesResponse)
async def list_sales(
    sku: Optional[str] = Query(None, description="Filter by SKU"),
    product_id: Optional[int] = Query(None, description="Filter by product ID"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get sales records with optional filtering."""
    parsed_start = None
    parsed_end = None

    if start_date:
        try:
            parsed_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            pass

    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            pass

    items = get_sales(
        db,
        sku=sku,
        product_id=product_id,
        start_date=parsed_start,
        end_date=parsed_end,
        skip=(page - 1) * page_size,
        limit=page_size,
    )

    # Get total count
    from sqlalchemy import func, select
    stmt = select(func.count(Sale.id))
    if sku:
        product = db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none()
        if product:
            stmt = stmt.where(Sale.product_id == product.id)
        else:
            return SalesResponse(items=[], total=0, page=page, page_size=page_size)
    elif product_id:
        stmt = stmt.where(Sale.product_id == product_id)
    if parsed_start:
        stmt = stmt.where(Sale.sale_date >= parsed_start)
    if parsed_end:
        stmt = stmt.where(Sale.sale_date <= parsed_end)
    total = db.execute(stmt).scalar_one()

    # Build response with product info
    response_items = []
    for sale in items:
        product = db.get(Product, sale.product_id) if sale.product_id else None
        response_items.append(
            SaleItem(
                id=sale.id,
                product_id=sale.product_id,
                sku=product.sku if product else None,
                product_name=product.product_name if product else None,
                order_id=sale.order_id,
                customer_id=sale.customer_id,
                sale_date=sale.sale_date.isoformat(),
                quantity=sale.quantity,
                unit_price=sale.unit_price,
                total_amount=sale.total_amount,
                currency=sale.currency,
            )
        )

    return SalesResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
):
    """Delete a sales record by ID."""
    sale = db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    db.delete(sale)
    db.commit()
    return {"status": "success", "message": f"Sale {sale_id} deleted"}


@router.delete("")
@router.delete("/")
async def clear_all_sales(
    db: Session = Depends(get_db),
):
    """Delete all sales records."""
    from sqlalchemy import delete
    db.execute(delete(Sale))
    db.commit()
    return {"status": "success", "message": "All sales records cleared"}
