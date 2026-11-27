"""Chat API routes for SUPPLYMIND RAG question-answering."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.rag.ragchain import SupplyMindRAGChain

router = APIRouter()


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question to ask")
    k: int = Field(default=4, ge=1, le=20, description="Number of documents to retrieve")


class SourceInfo(BaseModel):
    source: str
    document_type: str
    page: int | None = None
    sheet_name: str | None = None
    row_index: int | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]


# Global RAG chain instance (initialized on first use)
_rag_chain: SupplyMindRAGChain | None = None


def get_rag_chain() -> SupplyMindRAGChain:
    """Get or create the RAG chain instance."""
    global _rag_chain
    if _rag_chain is None:
        _rag_chain = SupplyMindRAGChain()
    return _rag_chain


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    """Ask a question using the RAG pipeline."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        rag = get_rag_chain()
        result = rag.ask(request.question, k=request.k, db=db)

        sources = []
        for src in result.get("sources", []):
            sources.append(
                SourceInfo(
                    source=src.get("source", "Unknown"),
                    document_type=src.get("document_type", "unknown"),
                    page=src.get("page"),
                    sheet_name=src.get("sheet_name"),
                    row_index=src.get("row_index"),
                )
            )

        return ChatResponse(
            answer=result.get("answer", "No answer generated"),
            sources=sources,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")