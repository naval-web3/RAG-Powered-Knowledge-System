"""Runtime RAG settings routes (read + update the tunable config)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app import runtime_settings
from app.config import settings as app_settings
from app.database import get_db  # noqa: F401 (kept for parity / future use)
from app.deps import get_current_user, require_admin
from app.models import User
from app.schemas import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _current_out() -> SettingsOut:
    cur = runtime_settings.current()
    return SettingsOut(
        **cur,
        openai_enabled=bool(app_settings.OPENAI_API_KEY),
        ollama_base_url=app_settings.OLLAMA_BASE_URL,
    )


@router.get("", response_model=SettingsOut)
def get_settings(_: User = Depends(get_current_user)) -> SettingsOut:
    """Return the current effective RAG settings (any authenticated user)."""
    return _current_out()


@router.patch("", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    _: User = Depends(require_admin),
) -> SettingsOut:
    """Update tunable RAG settings (admin only). Persists across restarts."""
    try:
        runtime_settings.update(payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _current_out()
