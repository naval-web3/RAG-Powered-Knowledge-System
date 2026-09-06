"""
Security utilities: password hashing (bcrypt), JWT creation/validation, and
the opaque refresh tokens that let a short-lived access token be renewed.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # jti makes each token its own string. Without it the payload is just the
    # user, the role and an expiry counted in whole seconds, so two tokens
    # issued to the same person in the same second come out byte for byte
    # identical: a renewed token would be indistinguishable from the one it
    # replaced, in a log or in a test.
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "jti": secrets.token_hex(8),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ---------- Refresh tokens ----------
#
# Unlike the access token, a refresh token carries no claims. It is a random
# string that means nothing except "the refresh_tokens table has a row for
# this", which is exactly the property that lets the server take it back.

def new_refresh_token() -> str:
    """A fresh opaque refresh token: 48 random bytes, URL-safe."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """The form stored in the database. See models.RefreshToken for why SHA-256."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
