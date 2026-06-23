"""Unit tests for password hashing and JWT handling (no DB required)."""

from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("s3cret-pass")
    assert hashed != "s3cret-pass"
    assert verify_password("s3cret-pass", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_roundtrip():
    token = create_access_token(subject="user-123", role="admin")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["role"] == "admin"


def test_jwt_rejects_tampered_token():
    token = create_access_token(subject="user-123", role="user")
    assert decode_access_token(token + "tampered") is None
