"""RAG (Retrieval-Augmented Generation) module for SUPPLYMIND.

Exposes document loading, chunking, embeddings, vector store, and retrieval.
"""

from app.rag.chunker import chunk_documents
from app.rag.embeddings import get_embedding_model
from app.rag.loader import load_document
from app.rag.ragchain import SupplyMindRAGChain, create_rag_chain
from app.rag.retriever import SupplyMindRetriever

__all__ = [
    "load_document",
    "chunk_documents",
    "get_embedding_model",
    "SupplyMindRetriever",
    "SupplyMindRAGChain",
    "create_rag_chain",
]