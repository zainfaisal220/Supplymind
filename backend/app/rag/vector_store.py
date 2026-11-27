from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.rag.embeddings import get_embedding_model

# Module-level singletons — loaded once per process, reused on every call.
# Avoids reloading the embedding model weights (~23 MB) on every request.
_embedding_model = None
_vector_store: Chroma | None = None


def get_embedding_singleton():
    """Return the process-level embedding model, initialising it on first call."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = get_embedding_model()
    return _embedding_model


def get_vector_store() -> Chroma:
    """Return the process-level Chroma vector store, initialising it on first call."""
    global _vector_store
    if _vector_store is None:
        _vector_store = Chroma(
            collection_name="supplymind_documents",
            embedding_function=get_embedding_singleton(),
            persist_directory="./chroma_db",
        )
    return _vector_store


def add_documents(
    vector_store: Chroma,
    documents: list[Document],
) -> list[str]:
    """Add document chunks to ChromaDB."""
    if not documents:
        return []
    return vector_store.add_documents(documents)
