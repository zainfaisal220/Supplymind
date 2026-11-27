"""FastAPI application for SUPPLYMIND."""

import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Ensure environment variables from .env are loaded into os.environ
_base_dir = Path(__file__).resolve().parent.parent  # = d:\Supplymind\backend
load_dotenv(_base_dir / ".env", override=True)
load_dotenv(_base_dir.parent / ".env", override=False)
load_dotenv(override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.postgres import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    # Initialize database (create tables if they don't exist)
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization warning: {e}")

    yield

    # Shutdown
    pass


app = FastAPI(
    title="SUPPLYMIND API",
    description="Autonomous Supply Chain Intelligence Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    from app.database.postgres import engine
    from sqlalchemy import text

    db_status = "disconnected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass

    return {
        "status": "healthy",
        "database": db_status,
        "version": "0.1.0",
    }


# Import and include routers
from app.api.routes import datasets, inventory, sales, purchase_orders, suppliers, documents, chat

app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(sales.router, prefix="/api/sales", tags=["sales"])
app.include_router(purchase_orders.router, prefix="/api/purchase-orders", tags=["purchase-orders"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["suppliers"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])