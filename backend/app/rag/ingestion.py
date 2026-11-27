from app.rag.loader import load_document
from app.rag.chunker import chunk_documents
from app.database.vector_store import get_vector_store, add_documents


def ingest_document(file_path: str) -> dict:
    """Load, chunk, and store an uploaded document."""

    # 1. Load document
    documents = load_document(file_path)

    # 2. Split into chunks
    chunks = chunk_documents(documents)

    if not chunks:
        return {
            "status": "failed",
            "message": "No readable content found.",
            "chunks_stored": 0
        }

    # 3. Initialize vector store
    vector_store = get_vector_store()

    # 4. Store chunks and embeddings
    ids = add_documents(vector_store, chunks)

    return {
        "status": "success",
        "file_name": file_path,
        "chunks_stored": len(ids)
    }