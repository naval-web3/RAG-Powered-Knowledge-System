"""Per-user usage routes.

Every number here is measured from the user's own rows: queries, response
times, chunks retrieved, documents and bytes on disk. The *ceilings* they are
measured against are invented, because this project bills nobody and meters
nothing. They live in one block at the top so it is obvious which half of the
panel is real and which half is scaffolding for a plan that does not exist.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Document, QueryLog, User
from app.schemas import DayCount, UsageBucket, UsageOut

router = APIRouter(prefix="/api/usage", tags=["usage"])

# --- the invented half -------------------------------------------------------
# A session is a fixed 5-hour block of the clock, the way a metered plan usually
# works, so "resets in" is a real countdown to a real boundary even though the
# allowance itself is made up.
SESSION_HOURS = 5
SESSION_QUERY_LIMIT = 40
WEEKLY_QUERY_LIMIT = 500
STORAGE_LIMIT_BYTES = 100 * 1024 * 1024
PLAN_NAME = "Local tier"


def _session_window(now: datetime) -> tuple[datetime, datetime]:
    """The 5-hour block `now` falls in, as (start, end)."""
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elapsed = (now - midnight).total_seconds() / 3600
    index = int(elapsed // SESSION_HOURS)
    start = midnight + timedelta(hours=index * SESSION_HOURS)
    return start, start + timedelta(hours=SESSION_HOURS)


def _week_start(now: datetime) -> datetime:
    """Monday 00:00 of the week `now` falls in."""
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight - timedelta(days=midnight.weekday())


@router.get("", response_model=UsageOut)
def my_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UsageOut:
    uid: uuid.UUID = current_user.user_id
    now = datetime.now(timezone.utc)
    mine = db.query(QueryLog).filter(QueryLog.user_id == uid)

    session_start, session_end = _session_window(now)
    session_used = mine.filter(QueryLog.created_at >= session_start).count()
    week_used = mine.filter(QueryLog.created_at >= _week_start(now)).count()

    totals = (
        db.query(
            func.count(QueryLog.log_id),
            func.coalesce(func.avg(QueryLog.response_time_ms), 0),
            func.coalesce(func.sum(QueryLog.chunks_retrieved), 0),
        )
        .filter(QueryLog.user_id == uid)
        .one()
    )
    queries_total, avg_ms, chunks_retrieved = totals

    docs = (
        db.query(
            func.count(Document.document_id),
            func.coalesce(func.sum(Document.chunk_count), 0),
            func.coalesce(func.sum(Document.file_size), 0),
        )
        .filter(Document.user_id == uid)
        .one()
    )
    doc_count, chunks_indexed, storage_bytes = docs

    by_model = dict(
        db.query(QueryLog.model_name, func.count(QueryLog.log_id))
        .filter(QueryLog.user_id == uid)
        .group_by(QueryLog.model_name)
        .all()
    )

    # Last 14 days, gaps filled with zero so the sparkline stays continuous.
    start_day = now.date() - timedelta(days=13)
    day_rows = (
        db.query(func.date(QueryLog.created_at), func.count(QueryLog.log_id))
        .filter(QueryLog.user_id == uid, QueryLog.created_at >= start_day)
        .group_by(func.date(QueryLog.created_at))
        .all()
    )
    counts = {str(d): c for d, c in day_rows}
    by_day = [
        DayCount(
            date=str(start_day + timedelta(days=i)),
            count=counts.get(str(start_day + timedelta(days=i)), 0),
        )
        for i in range(14)
    ]

    return UsageOut(
        session=UsageBucket(
            used=session_used,
            limit=SESSION_QUERY_LIMIT,
            resets_in_minutes=max(0, int((session_end - now).total_seconds() // 60)),
        ),
        week=UsageBucket(used=week_used, limit=WEEKLY_QUERY_LIMIT),
        storage=UsageBucket(used=int(storage_bytes), limit=STORAGE_LIMIT_BYTES),
        queries_total=int(queries_total),
        avg_response_ms=round(float(avg_ms), 2),
        chunks_retrieved=int(chunks_retrieved),
        documents=int(doc_count),
        chunks_indexed=int(chunks_indexed),
        by_model={str(m): int(c) for m, c in by_model.items()},
        by_day=by_day,
    )
