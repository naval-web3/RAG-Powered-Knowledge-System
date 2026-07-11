"""Admin dashboard analytics routes (synopsis Module 7)."""

from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import require_admin
from app.models import Document, QueryLog, User
from app.schemas import (
    AdminStats,
    AdminUserOut,
    DayCount,
    QueryLogOut,
    ServiceStatus,
    SystemStatus,
)

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

    by_type_rows = (
        db.query(Document.file_type, func.count(Document.document_id))
        .group_by(Document.file_type)
        .all()
    )

    # Queries per day for the last 14 days (fill gaps with zero so the chart is
    # continuous even on days with no activity).
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=13)
    day_rows = (
        db.query(func.date(QueryLog.created_at), func.count(QueryLog.log_id))
        .filter(QueryLog.created_at >= start)
        .group_by(func.date(QueryLog.created_at))
        .all()
    )
    day_counts = {str(d): c for d, c in day_rows}
    queries_by_day = [
        DayCount(date=str(start + timedelta(days=i)), count=day_counts.get(str(start + timedelta(days=i)), 0))
        for i in range(14)
    ]

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_documents=total_documents,
        total_queries=total_queries,
        avg_response_time_ms=round(float(avg_rt), 2),
        queries_by_provider={p: c for p, c in by_provider_rows},
        queries_by_day=queries_by_day,
        documents_by_type={t: c for t, c in by_type_rows},
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[AdminUserOut]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    doc_counts = dict(
        db.query(Document.user_id, func.count(Document.document_id)).group_by(Document.user_id).all()
    )
    query_counts = dict(
        db.query(QueryLog.user_id, func.count(QueryLog.log_id)).group_by(QueryLog.user_id).all()
    )
    out: list[AdminUserOut] = []
    for u in users:
        row = AdminUserOut.model_validate(u)
        row.document_count = int(doc_counts.get(u.user_id, 0))
        row.query_count = int(query_counts.get(u.user_id, 0))
        out.append(row)
    return out


@router.get("/query-logs", response_model=list[QueryLogOut])
def query_logs(
    limit: int = 25,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[QueryLogOut]:
    """Most recent query logs, joined with the issuing user's username."""
    limit = max(1, min(limit, 200))
    rows = (
        db.query(QueryLog, User.username)
        .outerjoin(User, QueryLog.user_id == User.user_id)
        .order_by(QueryLog.created_at.desc())
        .limit(limit)
        .all()
    )
    out: list[QueryLogOut] = []
    for log, username in rows:
        item = QueryLogOut.model_validate(log)
        item.username = username
        out.append(item)
    return out


@router.get("/system", response_model=SystemStatus)
def system_status(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> SystemStatus:
    """Live reachability of the backing services shown on the dashboard."""
    services: list[ServiceStatus] = []

    # PostgreSQL — count tables in the public schema.
    try:
        n = db.execute(
            text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        ).scalar()
        services.append(ServiceStatus(name="PostgreSQL", ok=True, detail=f":{settings.POSTGRES_PORT} · {n} tables"))
    except Exception as exc:  # noqa: BLE001
        services.append(ServiceStatus(name="PostgreSQL", ok=False, detail=str(exc)[:80]))

    # ChromaDB — vector count in the collection.
    try:
        from app.services import vector_store

        count = vector_store.get_collection().count()
        services.append(ServiceStatus(name="ChromaDB vector store", ok=True, detail=f"{count} vectors"))
    except Exception as exc:  # noqa: BLE001
        services.append(ServiceStatus(name="ChromaDB vector store", ok=False, detail=str(exc)[:80]))

    # Ollama — list loaded models via /api/tags.
    try:
        resp = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        detail = f":11434 · {', '.join(models[:3]) or 'no models'}" if models else ":11434 · no models"
        services.append(ServiceStatus(name="Ollama runtime", ok=True, detail=detail))
    except Exception:  # noqa: BLE001
        services.append(ServiceStatus(name="Ollama runtime", ok=False, detail=":11434 · unreachable"))

    # OpenAI — configured / not configured (no network call to avoid cost).
    if settings.OPENAI_API_KEY:
        services.append(ServiceStatus(name="OpenAI API", ok=True, detail=f"configured · {settings.OPENAI_CHAT_MODEL}"))
    else:
        services.append(ServiceStatus(name="OpenAI API", ok=False, detail="no API key"))

    # Embeddings backend (always local in this deployment).
    services.append(
        ServiceStatus(name="Embeddings", ok=True, detail=f"local · {settings.LOCAL_EMBEDDING_MODEL}")
    )

    return SystemStatus(services=services)
