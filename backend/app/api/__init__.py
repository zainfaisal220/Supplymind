"""API routes package for SUPPLYMIND."""

from app.api.routes import chat, documents, datasets, inventory, purchase_orders, sales, suppliers

__all__ = [
    "chat",
    "documents",
    "datasets",
    "inventory",
    "purchase_orders",
    "sales",
    "suppliers",
]