"""
Runtime-overridable settings.

The base configuration comes from .env / config.py, but a few RAG-tuning knobs
can be changed at runtime from the Settings screen. Because the whole app reads
the shared `settings` singleton live, we override values by mutating that
singleton in place and persisting the overrides to a small JSON file so they
survive a restart.
"""

import json
import os

from app.config import settings

# Only these keys may be changed at runtime (with their expected types).
EDITABLE: dict[str, type] = {
    "DEFAULT_LLM_PROVIDER": str,
    "OLLAMA_MODEL": str,
    "OPENAI_CHAT_MODEL": str,
    "RETRIEVAL_TOP_K": int,
    "LLM_TEMPERATURE": float,
    "CHUNK_SIZE": int,
    "CHUNK_OVERLAP": int,
}

# Persisted next to the working directory (backend/) when the server runs.
_STORE_PATH = os.path.join(os.getcwd(), "runtime_settings.json")


def _coerce(key: str, value):
    caster = EDITABLE[key]
    if caster is bool:
        return bool(value)
    return caster(value)


def apply_saved() -> None:
    """Load persisted overrides (if any) and apply them to the settings singleton."""
    if not os.path.exists(_STORE_PATH):
        return
    try:
        with open(_STORE_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return
    for key, value in data.items():
        if key in EDITABLE:
            try:
                setattr(settings, key, _coerce(key, value))
            except (TypeError, ValueError):
                continue


def current() -> dict:
    """Return the current effective values of the editable settings."""
    return {key: getattr(settings, key) for key in EDITABLE}


def update(changes: dict) -> dict:
    """Validate + apply changes to the settings singleton and persist them.

    Returns the new effective settings. Unknown keys are ignored; bad values
    raise ValueError."""
    applied: dict = {}
    for key, value in changes.items():
        if key not in EDITABLE or value is None:
            continue
        applied[key] = _coerce(key, value)

    # Basic sanity clamps so a bad value can't break retrieval.
    if "RETRIEVAL_TOP_K" in applied:
        applied["RETRIEVAL_TOP_K"] = max(1, min(int(applied["RETRIEVAL_TOP_K"]), 20))
    if "LLM_TEMPERATURE" in applied:
        applied["LLM_TEMPERATURE"] = max(0.0, min(float(applied["LLM_TEMPERATURE"]), 1.0))
    if "CHUNK_SIZE" in applied:
        applied["CHUNK_SIZE"] = max(200, min(int(applied["CHUNK_SIZE"]), 4000))
    if "CHUNK_OVERLAP" in applied:
        applied["CHUNK_OVERLAP"] = max(0, min(int(applied["CHUNK_OVERLAP"]), 1000))
    if applied.get("DEFAULT_LLM_PROVIDER") and applied["DEFAULT_LLM_PROVIDER"] not in ("ollama", "openai"):
        raise ValueError("DEFAULT_LLM_PROVIDER must be 'ollama' or 'openai'")

    for key, value in applied.items():
        setattr(settings, key, value)

    # Persist the full current editable set so the file is self-contained.
    try:
        with open(_STORE_PATH, "w", encoding="utf-8") as fh:
            json.dump(current(), fh, indent=2)
    except OSError:
        pass

    return current()
