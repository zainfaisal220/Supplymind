"""Retriever module for SUPPLYMIND RAG architecture.

Provides vector search, metadata filtering, score ranking, and LLM context formatting.
"""

from typing import Any, Dict, List, Optional, Tuple

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import InMemoryVectorStore
from app.rag.embeddings import get_embedding_model


def retrieve_documents(
    vector_store: Chroma,
    query: str,
    k: int = 4,
) -> List[Document]:
    """Retrieve the most relevant document chunks for a query.

    Args:
        vector_store: Chroma vector store instance.
        query: Search query string.
        k: Number of results to return (default 4).

    Returns:
        List of Document objects ordered by relevance, or an empty list for
        empty queries.
    """
    if not query.strip():
        return []
    return vector_store.similarity_search(query, k=k)


class SupplyMindRetriever:
    """Production retriever for querying indexed supply chain intelligence."""

    def __init__(
        self,
        embeddings: Optional[Embeddings] = None,
        vector_store: Optional[InMemoryVectorStore] = None,
    ):
        """Initialize retriever with embeddings engine and vector index.

        Args:
            embeddings: Optional Embeddings instance. Defaults to get_embedding_model().
            vector_store: Optional pre-existing VectorStore.
        """
        self.embeddings = embeddings or get_embedding_model()
        self.vector_store = vector_store or InMemoryVectorStore(self.embeddings)

    def index_documents(self, documents: List[Document]) -> List[str]:
        """Index a list of chunked Document objects into the vector store.

        Args:
            documents: List of chunked Document objects.

        Returns:
            List of generated document IDs in the vector store.
        """
        if not documents:
            return []
        return self.vector_store.add_documents(documents)

    def retrieve(
        self,
        query: str,
        top_k: int = 4,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        """Retrieve the most relevant documents for a supply chain query.

        Args:
            query: User or agent search query.
            top_k: Number of relevant chunks to retrieve.
            filter_metadata: Optional dictionary of exact-match metadata filters (e.g. {'document_type': 'pdf'}).

        Returns:
            List of matching Document objects ranked by relevance.
        """
        if not filter_metadata:
            return self.vector_store.similarity_search(query, k=top_k)

        # Apply metadata filtering predicate
        def filter_func(doc: Document) -> bool:
            return all(
                doc.metadata.get(key) == expected_val
                for key, expected_val in filter_metadata.items()
            )

        # Retrieve a slightly larger pool then filter
        candidates = self.vector_store.similarity_search(query, k=top_k * 3)
        filtered = [doc for doc in candidates if filter_func(doc)]
        return filtered[:top_k]

    def retrieve_with_scores(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[Tuple[Document, float]]:
        """Retrieve documents alongside their similarity scores.

        Args:
            query: Search query string.
            top_k: Number of top results.
            score_threshold: Minimum similarity threshold (if applicable).

        Returns:
            List of (Document, score) tuples.
        """
        results = self.vector_store.similarity_search_with_score(query, k=top_k)
        if score_threshold is not None:
            results = [(doc, score) for doc, score in results if score >= score_threshold]
        return results

    @staticmethod
    def format_context(documents: List[Document]) -> str:
        """Format retrieved documents into a clean context block for LLM prompts.

        Args:
            documents: List of retrieved Document chunks.

        Returns:
            Formatted string representation with source attribution.
        """
        if not documents:
            return "No relevant context found."

        formatted_sections = []
        for idx, doc in enumerate(documents, start=1):
            source = doc.metadata.get("source", "Unknown Source")
            page = f", Page {doc.metadata['page']}" if "page" in doc.metadata else ""
            sheet = f", Sheet: {doc.metadata['sheet_name']}" if "sheet_name" in doc.metadata else ""
            row = f", Row: {doc.metadata['row_index']}" if "row_index" in doc.metadata else ""

            header = f"--- [Document {idx}] Source: {source}{sheet}{page}{row} ---"
            formatted_sections.append(f"{header}\n{doc.page_content.strip()}")

        return "\n\n".join(formatted_sections)
