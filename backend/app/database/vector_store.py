# Re-export from the canonical singleton in app.rag.vector_store.
# This ensures the entire process shares one embedding model instance
# and one Chroma client, preventing expensive reloads on each request.
from app.rag.vector_store import (  # noqa: F401
    add_documents,
    get_embedding_singleton,
    get_vector_store,
)
