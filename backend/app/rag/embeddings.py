"""Embedding model factory for SUPPLYMIND.

Supports multiple providers via EMBEDDING_PROVIDER env var:
- huggingface (default): local sentence-transformers
- openai: text-embedding-3-small / text-embedding-3-large
- cohere: embed-english-v3.0 / embed-multilingual-v3.0
- voyage: voyage-2 / voyage-large-2
"""

import os
from langchain_core.embeddings import Embeddings


def get_embedding_model() -> Embeddings:
    """Initialize and return the configured embedding model."""
    provider = os.getenv("EMBEDDING_PROVIDER", "huggingface").lower()

    if provider == "huggingface":
        from langchain_huggingface import HuggingFaceEmbeddings

        model_name = os.getenv("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        return HuggingFaceEmbeddings(model_name=model_name)

    elif provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set")
        model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        return OpenAIEmbeddings(model=model, api_key=api_key)

    elif provider == "cohere":
        from langchain_cohere import CohereEmbeddings

        api_key = os.getenv("COHERE_API_KEY")
        if not api_key:
            raise RuntimeError("COHERE_API_KEY not set")
        model = os.getenv("COHERE_EMBEDDING_MODEL", "embed-english-v3.0")
        return CohereEmbeddings(model=model, cohere_api_key=api_key)

    elif provider == "voyage":
        from langchain_voyageai import VoyageAIEmbeddings

        api_key = os.getenv("VOYAGE_API_KEY")
        if not api_key:
            raise RuntimeError("VOYAGE_API_KEY not set")
        model = os.getenv("VOYAGE_EMBEDDING_MODEL", "voyage-2")
        return VoyageAIEmbeddings(model=model, voyage_api_key=api_key)

    else:
        raise ValueError(f"Unknown EMBEDDING_PROVIDER: {provider}")
