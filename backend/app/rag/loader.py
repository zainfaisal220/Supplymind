from pathlib import Path

from langchain_community.document_loaders import (
    PyPDFLoader,
    CSVLoader,
    Docx2txtLoader,
    TextLoader,
    BSHTMLLoader
)


def load_document(file_path):
    file_path = str(file_path)
    extension = Path(file_path).suffix.lower()

    if extension == ".pdf":
        loader = PyPDFLoader(file_path)

    elif extension == ".csv":
        loader = CSVLoader(file_path)

    elif extension == ".docx":
        loader = Docx2txtLoader(file_path)

    elif extension == ".txt":
        loader = TextLoader(
            file_path,
            encoding="utf-8"
        )

    elif extension in (".html", ".htm"):
        loader = BSHTMLLoader(file_path)

    else:
        raise ValueError("Unsupported file format")

    return loader.load()
