"""Unit tests for the refresh token primitives.

What can be tested here is the part that does not need a database: how a token
is generated, how it is reduced to the form that gets stored, and how long it
lasts. The rotation itself is a query against Postgres and is exercised against
a running server instead.

The properties below are the ones a mistake would quietly break. A token that is
not random enough, or a hash that is not a hash, would both still pass a login
test and still let a session refresh; nothing would look wrong until someone
went looking for it.
"""

import re
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.ratelimit import is_credential_path
from app.security import (
    create_access_token,
    decode_access_token,
    hash_refresh_token,
    new_refresh_token,
    refresh_token_expiry,
)


# ------------------------------------------------------- generation

def test_every_token_is_different():
    tokens = {new_refresh_token() for _ in range(200)}
    assert len(tokens) == 200


def test_a_token_carries_enough_randomness_to_be_unguessable():
    # 48 bytes, base64url encoded: 64 characters, and no padding to trim.
    token = new_refresh_token()
    assert len(token) == 64
    assert re.fullmatch(r"[A-Za-z0-9_-]+", token)


def test_a_token_is_url_and_json_safe():
    # It travels in a JSON body and gets written to localStorage, so anything
    # needing an escape would be a problem waiting for the wrong character.
    for _ in range(50):
        token = new_refresh_token()
        assert '"' not in token and "\\" not in token and "/" not in token


# ------------------------------------------------------- hashing

def test_the_stored_form_is_a_sha256_digest():
    digest = hash_refresh_token("some-token")
    assert re.fullmatch(r"[0-9a-f]{64}", digest)


def test_the_same_token_always_hashes_the_same_way():
    # Lookup is by hash equality, so a hash that varied per call would make
    # every refresh fail with "invalid token".
    token = new_refresh_token()
    assert hash_refresh_token(token) == hash_refresh_token(token)


def test_different_tokens_hash_differently():
    assert hash_refresh_token("a") != hash_refresh_token("b")


def test_the_hash_does_not_contain_the_token():
    token = new_refresh_token()
    assert token not in hash_refresh_token(token)


def test_one_changed_character_changes_the_hash():
    token = new_refresh_token()
    tampered = ("a" if token[0] != "a" else "b") + token[1:]
    assert hash_refresh_token(token) != hash_refresh_token(tampered)


# ------------------------------------------------------- lifetimes

def test_a_refresh_token_outlives_an_access_token():
    # The whole arrangement rests on this. If they were the other way round,
    # renewing would be impossible and every session would end in an hour.
    access = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    assert refresh > access


def test_the_access_token_is_short_enough_to_be_worth_revoking_against():
    # A revoked session keeps working until its access token expires, so this
    # number is the real window a sign-out leaves open.
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES <= 120


def test_the_expiry_is_the_configured_number_of_days_away():
    before = datetime.now(timezone.utc)
    expiry = refresh_token_expiry()
    after = datetime.now(timezone.utc)
    span = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    assert before + span <= expiry <= after + span


def test_the_expiry_is_timezone_aware():
    # It is compared against now() in UTC on every refresh; a naive datetime
    # would raise rather than compare.
    assert refresh_token_expiry().tzinfo is not None


# ------------------------------------------------------- the access token half

def test_the_access_token_still_carries_the_user_and_role():
    token = create_access_token(subject="abc-123", role="admin")
    payload = decode_access_token(token)
    assert payload["sub"] == "abc-123"
    assert payload["role"] == "admin"


def test_the_access_token_expiry_follows_the_shortened_setting():
    payload = decode_access_token(create_access_token(subject="u", role="user"))
    expiry = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    remaining = expiry - datetime.now(timezone.utc)
    assert remaining <= timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    assert remaining > timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES - 2)


def test_a_refresh_token_is_not_a_jwt():
    # Opaque is the point: it says nothing, so it can be withdrawn.
    assert decode_access_token(new_refresh_token()) is None


# ------------------------------------------------------- rate limiting

def test_the_refresh_endpoint_counts_as_a_credential_path():
    # Guessing a refresh token is worth as much as guessing a password, so it
    # gets the strict limit rather than the ordinary one.
    assert is_credential_path("/api/auth/refresh")


def test_logging_out_is_not_rate_limited_as_a_credential():
    # Throwing a token away is not an attack, and a user signing out of several
    # tabs at once should not be turned away.
    assert not is_credential_path("/api/auth/logout")
