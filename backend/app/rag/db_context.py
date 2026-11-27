"""Database and Preprocessing Context Extractor for SUPPLYMIND.

Queries live PostgreSQL tables and preprocessing pipeline reports to enrich
LLM prompts with real-time operational data alongside vectorized PDF knowledge.
"""

from typing import Any, Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    DatasetUpload,
    Inventory,
    Product,
    PurchaseOrder,
    Sale,
    StructuredRecord,
    Supplier,
)


def build_db_and_preprocessing_context(
    db: Session, query: str = ""
) -> Tuple[str, List[Dict[str, Any]]]:
    """Extract operational context from PostgreSQL and preprocessing reports.

    Returns:
        tuple of (formatted_context_string, list_of_source_metadata)
    """
    if db is None:
        return "No database session available.", []

    sections: List[str] = []
    sources: List[Dict[str, Any]] = []

    # 1. DATA PREPROCESSING & DATASET INGESTION PIPELINE
    try:
        uploads = (
            db.query(DatasetUpload)
            .order_by(DatasetUpload.upload_timestamp.desc())
            .limit(10)
            .all()
        )
        total_uploads = db.query(func.count(DatasetUpload.id)).scalar() or 0

        if uploads:
            prep_lines = [
                f"### Data Ingestion & Preprocessing Engine Status (Total Registered Datasets: {total_uploads})"
            ]
            for u in uploads:
                clean_name = u.original_filename.replace("demo_", "")
                cat = getattr(u.dataset_category, "value", str(u.dataset_category))
                status = getattr(u.processing_status, "value", str(u.processing_status))
                line = (
                    f"- Dataset #{u.id}: \"{clean_name}\" ({u.file_type.upper()}) | "
                    f"Category: {cat} | Status: {status.upper()} | "
                    f"Valid Rows: {u.valid_rows} | Rejected Rows: {u.rejected_rows} | Total: {u.total_rows}"
                )
                if u.sheet_names:
                    line += f" | Extracted Sheets: {', '.join(u.sheet_names)}"

                # Preprocessing report details
                if u.preprocessing_report:
                    val = u.preprocessing_report.get("validation", {})
                    cleaning = u.preprocessing_report.get("cleaning", [])
                    err_count = val.get("errors", 0)
                    warn_count = val.get("warnings", 0)
                    line += f"\n  * Preprocessing Validation: {err_count} errors, {warn_count} warnings detected."
                    if cleaning:
                        clean_ops = [
                            f"{c.get('column')}: {c.get('operation')}"
                            for c in cleaning[:3]
                            if isinstance(c, dict)
                        ]
                        if clean_ops:
                            line += f" Cleaned: {'; '.join(clean_ops)}."
                prep_lines.append(line)

            sections.append("\n".join(prep_lines))
            sources.append(
                {
                    "source": f"Pipeline: dataset_preprocessing ({total_uploads} datasets)",
                    "document_type": "preprocessing",
                }
            )

            # 1b. UPLOADED EXCEL / CSV SPREADSHEET ROWS (from StructuredRecord)
            for u in uploads:
                if u.file_type.lower() in {"xlsx", "xls", "csv"}:
                    clean_name = u.original_filename.replace("demo_", "")
                    records = (
                        db.query(StructuredRecord)
                        .filter(StructuredRecord.upload_id == u.id)
                        .order_by(StructuredRecord.sheet_name, StructuredRecord.row_index)
                        .limit(100)
                        .all()
                    )
                    if records:
                        sheet_lines = [f"### Uploaded Spreadsheet Data: \"{clean_name}\" ({len(records)} rows)"]
                        current_sheet = None
                        for rec in records:
                            sname = rec.sheet_name or "Sheet1"
                            if sname != current_sheet:
                                current_sheet = sname
                                sheet_lines.append(f"Sheet [{sname}]:")
                            row_str = ", ".join(f"{k}: {v}" for k, v in (rec.raw_data or {}).items())
                            sheet_lines.append(f"  - Row {(rec.row_index or 0) + 1}: {row_str}")
                        sections.append("\n".join(sheet_lines))
                        sources.append(
                            {
                                "source": clean_name,
                                "document_type": "spreadsheet",
                            }
                        )
        else:
            sections.append("### Data Ingestion & Preprocessing: No structured datasets uploaded yet.")
    except Exception as e:
        sections.append(f"### Data Preprocessing: Error reading uploads: {e}")

    # 2. SUPPLIERS
    try:
        suppliers = db.query(Supplier).order_by(Supplier.name).all()
        total_suppliers = len(suppliers)

        if suppliers:
            sup_lines = [f"### Live Database: Registered Suppliers (Total: {total_suppliers})"]
            for s in suppliers:
                details = [f"Name: {s.name}", f"ID: {s.id}"]
                if s.contact_person:
                    details.append(f"Contact: {s.contact_person}")
                if s.email:
                    details.append(f"Email: {s.email}")
                if s.phone:
                    details.append(f"Phone: {s.phone}")
                if s.city or s.country:
                    loc = ", ".join(filter(None, [s.city, s.country]))
                    details.append(f"Location: {loc}")
                if s.payment_terms:
                    details.append(f"Terms: {s.payment_terms}")
                sup_lines.append(f"- {' | '.join(details)}")
            sections.append("\n".join(sup_lines))
            sources.append(
                {
                    "source": f"PostgreSQL: suppliers table ({total_suppliers} records)",
                    "document_type": "database",
                }
            )
        else:
            sections.append("### Live Database: No suppliers currently registered in database.")
    except Exception as e:
        sections.append(f"### Live Database: Error reading suppliers: {e}")

    # 3. INVENTORY & STOCK LEVELS
    try:
        inv_items = db.query(Inventory).join(Product, isouter=True).limit(25).all()
        total_inv_count = db.query(func.count(Inventory.id)).scalar() or 0
        total_qty = db.query(func.sum(Inventory.quantity_on_hand)).scalar() or 0

        # Also check StructuredRecord for inventory if empty
        if not inv_items:
            structured_inv = (
                db.query(StructuredRecord)
                .filter(StructuredRecord.category == "inventory")
                .limit(20)
                .all()
            )
        else:
            structured_inv = []

        if inv_items:
            inv_lines = [
                f"### Live Database: Current Inventory & Stock Levels (Total SKUs: {total_inv_count}, Total Units: {total_qty:,.0f})"
            ]
            for item in inv_items:
                sku = item.product.sku if item.product else f"Product#{item.product_id}"
                name = (item.product.product_name if item.product and item.product.product_name else "Standard SKU")
                loc = item.location or "Main Warehouse"
                reorder = item.product.reorder_point if item.product else None

                status_alert = ""
                if reorder and item.quantity_on_hand <= reorder:
                    status_alert = " [CRITICAL: BELOW REORDER POINT]"

                inv_lines.append(
                    f"- SKU: {sku} ({name}) | Qty on Hand: {item.quantity_on_hand:,.0f} | "
                    f"Allocated: {item.quantity_allocated:,.0f} | Available: {item.quantity_available:,.0f} | "
                    f"Location: {loc}{status_alert}"
                )
            sections.append("\n".join(inv_lines))
            sources.append(
                {
                    "source": f"PostgreSQL: inventory table ({total_inv_count} SKUs)",
                    "document_type": "database",
                }
            )
        elif structured_inv:
            inv_lines = [
                f"### Live Database: Ingested Inventory Records (Total: {len(structured_inv)} records)"
            ]
            for r in structured_inv:
                inv_lines.append(
                    f"- SKU: {r.sku or 'N/A'} | Qty: {r.quantity or 0} | Data: {r.raw_data}"
                )
            sections.append("\n".join(inv_lines))
            sources.append(
                {
                    "source": "PostgreSQL: structured_records (inventory)",
                    "document_type": "database",
                }
            )
        else:
            sections.append("### Live Database: Inventory is currently empty.")
    except Exception as e:
        sections.append(f"### Live Database: Error reading inventory: {e}")

    # 4. PURCHASE ORDERS & INBOUND SHIPMENTS
    try:
        pos = (
            db.query(PurchaseOrder)
            .order_by(PurchaseOrder.order_date.desc())
            .limit(15)
            .all()
        )
        total_pos = db.query(func.count(PurchaseOrder.id)).scalar() or 0
        total_po_val = db.query(func.sum(PurchaseOrder.total_amount)).scalar() or 0

        # Also check StructuredRecord for purchase orders
        structured_pos = (
            db.query(StructuredRecord)
            .filter(StructuredRecord.category == "purchase_orders")
            .limit(20)
            .all()
        )

        if pos:
            po_lines = [
                f"### Live Database: Purchase Orders & Inbound (Total POs: {total_pos}, Total Value: ${total_po_val:,.2f})"
            ]
            for po in pos:
                sup_name = po.supplier.name if po.supplier else f"Supplier#{po.supplier_id}"
                po_lines.append(
                    f"- PO #{po.po_number} | Supplier: {sup_name} | Date: {po.order_date.strftime('%Y-%m-%d')} | "
                    f"Status: {po.status.upper()} | Amount: ${po.total_amount or 0:,.2f}"
                )
            sections.append("\n".join(po_lines))
            sources.append(
                {
                    "source": f"PostgreSQL: purchase_orders ({total_pos} POs)",
                    "document_type": "database",
                }
            )
        elif structured_pos:
            total_val = sum(r.total_amount or 0 for r in structured_pos)
            po_lines = [
                f"### Live Database: Purchase Orders from Ingested Datasets (Total Records: {len(structured_pos)}, Total Value: ${total_val:,.2f})"
            ]
            for r in structured_pos:
                po_lines.append(
                    f"- PO: {r.order_id or r.raw_data.get('po_number', 'N/A')} | "
                    f"Supplier: {r.supplier_name or r.raw_data.get('supplier_name', 'N/A')} | "
                    f"SKU: {r.sku or 'N/A'} | Qty: {r.quantity or 0} | "
                    f"Total: ${r.total_amount or 0:,.2f} | "
                    f"Status: {r.raw_data.get('status', 'pending')}"
                )
            sections.append("\n".join(po_lines))
            sources.append(
                {
                    "source": f"PostgreSQL: structured_records (purchase_orders, {len(structured_pos)} records)",
                    "document_type": "database",
                }
            )
        else:
            sections.append("### Live Database: No purchase orders currently on record.")
    except Exception as e:
        sections.append(f"### Live Database: Error reading purchase orders: {e}")

    # 5. SALES & FLOW
    try:
        sales = db.query(Sale).order_by(Sale.sale_date.desc()).limit(15).all()
        total_sales = db.query(func.count(Sale.id)).scalar() or 0
        total_revenue = db.query(func.sum(Sale.total_amount)).scalar() or 0

        if sales:
            sales_lines = [
                f"### Live Database: Sales Transactions & Flow (Total Orders: {total_sales}, Revenue: ${total_revenue:,.2f})"
            ]
            for s in sales:
                sku = s.product.sku if s.product else f"Product#{s.product_id}"
                sales_lines.append(
                    f"- Order #{s.order_id} | SKU: {sku} | Qty: {s.quantity} | Total: ${s.total_amount:,.2f} | Date: {s.sale_date.strftime('%Y-%m-%d')}"
                )
            sections.append("\n".join(sales_lines))
            sources.append(
                {
                    "source": f"PostgreSQL: sales table ({total_sales} records)",
                    "document_type": "database",
                }
            )
        else:
            # Check structured records for sales
            structured_sales = (
                db.query(StructuredRecord)
                .filter(StructuredRecord.category == "sales")
                .limit(10)
                .all()
            )
            if structured_sales:
                sales_lines = [
                    f"### Live Database: Sales Records (Total: {len(structured_sales)})"
                ]
                for r in structured_sales:
                    sales_lines.append(
                        f"- SKU: {r.sku} | Qty: {r.quantity} | Total: ${r.total_amount:,.2f}"
                    )
                sections.append("\n".join(sales_lines))
                sources.append(
                    {
                        "source": "PostgreSQL: structured_records (sales)",
                        "document_type": "database",
                    }
                )
            else:
                sections.append("### Live Database: No sales transactions recorded yet.")
    except Exception as e:
        sections.append(f"### Live Database: Error reading sales: {e}")

    full_context = "\n\n".join(sections)
    return full_context, sources
