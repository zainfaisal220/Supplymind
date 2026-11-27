from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_documents(
    documents: list[Document],
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[Document]:
    """Split a list of text Document objects into chunks.

    Args:
        documents: List of LangChain ``Document`` objects containing textual content.
        chunk_size: Maximum number of characters per chunk.
        chunk_overlap: Number of characters that overlap between consecutive chunks.

    Returns:
        A list of ``Document`` objects where each ``page_content`` is a chunk of the
        original text. Original metadata (including any custom keys) is preserved
        automatically by ``RecursiveCharacterTextSplitter``.
    """

    if not documents:
        return []

    # Filter out empty or whitespace‑only documents.
    valid_documents = [
        doc for doc in documents
        if doc.page_content and doc.page_content.strip()
    ]

    if not valid_documents:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    return splitter.split_documents(valid_documents)


def create_tabular_documents(
    data: list[dict],
    metadata: dict | None = None,
) -> list[Document]:
    """Convert raw tabular rows into ``Document`` objects.

    Each row is transformed into a human‑readable sentence that retains column
    names and values. The function does **not** attempt to summarise or merge
    unrelated rows – it creates a one‑to‑one mapping so downstream chunking or
    storage can keep the original structure.

    Args:
        data: List of dictionaries representing rows (e.g. from CSV or Excel).
        metadata: Optional metadata to attach to every generated document. This
            can include worksheet name, source file, SKU, etc.

    Returns:
        List[Document] where ``page_content`` is a textual representation of the
        row and ``metadata`` contains the supplied metadata plus a ``row_index``
        key.
    """

    if not data:
        return []

    docs: list[Document] = []
    for idx, row in enumerate(data):
        # Build a deterministic, whitespace‑separated string.
        parts = [f"{key}={value}" for key, value in row.items()]
        text = ", ".join(parts)
        doc_meta = dict(metadata or {})
        doc_meta.update({"row_index": idx})
        docs.append(Document(page_content=text, metadata=doc_meta))
    return docs


def create_chunks(
    documents: list[Document] | None = None,
    tabular_data: list[dict] | None = None,
    tabular_metadata: dict | None = None,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[Document]:
    """High‑level helper that prepares both text and tabular inputs and returns
    a unified list of chunked ``Document`` objects.

    The function first creates ``Document`` objects for any provided tabular data
    (preserving row and worksheet metadata) and then runs the recursive splitter
    on the combined collection. Empty inputs are safely ignored.
    """

    docs: list[Document] = []
    if documents:
        docs.extend(documents)
    if tabular_data:
        docs.extend(create_tabular_documents(tabular_data, tabular_metadata))

    # Use the text‑splitting routine for the whole set; it will skip non‑textual
    # content (which we have already turned into plain strings).
    return split_text_documents(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
