"""Admin dashboard analytics routes (synopsis Module 7)."""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Document, QueryLog, User
from app.schemas import AdminStats, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> AdminStats:
    total_users = db.query(func.count(User.user_id)).scalar() or 0
    active_users = db.query(func.count(User.user_id)).filter(User.is_active.is_(True)).scalar() or 0
    total_documents = db.query(func.count(Document.document_id)).scalar() or 0
    total_queries = db.query(func.count(QueryLog.log_id)).scalar() or 0
    avg_rt = db.query(func.avg(QueryLog.response_time_ms)).scalar() or 0.0

    by_provider_rows = (
        db.query(QueryLog.llm_provider, func.count(QueryLog.log_id))
        .group_by(QueryLog.llm_provider)
        .all()
    )

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_documents=total_documents,
        total_queries=total_queries,
        avg_response_time_ms=round(float(avg_rt), 2),
        queries_by_provider={p: c for p, c in by_provider_rows},
    )


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[UserOut]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserOut.model_validate(u) for u in users]
