"""Application configuration for SUPPLYMIND."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent.parent  # = d:\Supplymind\backend
_env_file = _backend_dir / ".env"
load_dotenv(_env_file, override=True)
load_dotenv(_backend_dir.parent / ".env", override=False)
load_dotenv(override=False)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(str(_env_file), str(_backend_dir.parent / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/supplymind",
        description="PostgreSQL connection string",
    )

    # API
    API_HOST: str = Field(default="0.0.0.0", description="API host")
    API_PORT: int = Field(default=8000, description="API port")
    API_WORKERS: int = Field(default=1, description="Number of worker processes")

    # Upload
    UPLOAD_DIR: str = Field(default="./uploads", description="Upload directory")
    MAX_UPLOAD_SIZE: int = Field(default=50 * 1024 * 1024, description="Max upload size in bytes")

    # LLM (Groq)
    GROQ_API_KEY: Optional[str] = Field(default=None, description="Groq API key")
    GROQ_MODEL: str = Field(default="openai/gpt-oss-20b", description="Groq model name")

    # Embeddings
    EMBEDDING_PROVIDER: str = Field(default="huggingface", description="Embedding provider")
    HF_EMBEDDING_MODEL: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2", description="HF embedding model"
    )
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key")
    OPENAI_EMBEDDING_MODEL: str = Field(default="text-embedding-3-small", description="OpenAI embedding model")
    COHERE_API_KEY: Optional[str] = Field(default=None, description="Cohere API key")
    COHERE_EMBEDDING_MODEL: str = Field(default="embed-english-v3.0", description="Cohere embedding model")
    VOYAGE_API_KEY: Optional[str] = Field(default=None, description="Voyage AI API key")
    VOYAGE_EMBEDDING_MODEL: str = Field(default="voyage-2", description="Voyage embedding model")

    # ChromaDB
    CHROMA_PERSIST_DIR: str = Field(default="./chroma_db", description="ChromaDB persist directory")

    # CORS
    CORS_ORIGINS: list[str] = Field(default=["*"], description="CORS allowed origins")

    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Log level")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()