"""Unit tests for the request rate limiter.

The counting and the path classification are pure, so they are tested here
without a server, a socket, or a clock that has to be waited on: the counter
takes the time as an argument precisely so that a window can be crossed in a
test without sleeping through it.
"""

from app.ratelimit import (
    CREDENTIAL_PATHS,
    EXEMPT_PATHS,
    FixedWindowCounter,
    is_credential_path,
    is_exempt,
)


# ------------------------------------------------------- the counter

def test_requests_under_the_limit_are_allowed():
    c = FixedWindowCounter(window_seconds=60)
    for _ in range(5):
        allowed, _ = c.hit("1.2.3.4", limit=5, now=1000.0)
        assert allowed


def test_the_request_over_the_limit_is_refused():
    c = FixedWindowCounter(window_seconds=60)
    for _ in range(5):
        c.hit("1.2.3.4", limit=5, now=1000.0)
    allowed, _ = c.hit("1.2.3.4", limit=5, now=1000.0)
    assert not allowed


def test_the_window_resets():
    c = FixedWindowCounter(window_seconds=60)
    for _ in range(9):
        c.hit("1.2.3.4", limit=5, now=1000.0)
    assert not c.hit("1.2.3.4", limit=5, now=1000.0)[0]
    # 1000 and 1100 are in different 60-second windows
    assert c.hit("1.2.3.4", limit=5, now=1100.0)[0]


def test_one_client_cannot_exhaust_another_client_s_allowance():
    c = FixedWindowCounter(window_seconds=60)
    for _ in range(20):
        c.hit("1.2.3.4", limit=5, now=1000.0)
    assert c.hit("5.6.7.8", limit=5, now=1000.0)[0]


def test_retry_after_is_the_time_left_in_the_window():
    c = FixedWindowCounter(window_seconds=60)
    # 1010 is ten seconds into the window that began at 960
    _, retry = c.hit("1.2.3.4", limit=1, now=1010.0)
    assert 1 <= retry <= 61


def test_old_windows_are_forgotten_so_memory_stays_bounded():
    c = FixedWindowCounter(window_seconds=60)
    for i in range(5000):
        c.hit("client-%d" % i, limit=1, now=1000.0)
    # the prune runs past 4096 keys and drops everything older than the
    # previous window, so the map cannot grow without limit
    c.hit("trigger", limit=1, now=100000.0)
    assert len(c._hits) < 5000


# --------------------------------------------- path classification

def test_credential_paths_are_recognised():
    for p in CREDENTIAL_PATHS:
        assert is_credential_path(p)
    assert is_credential_path("/api/auth/login?next=/")


def test_ordinary_paths_are_not_credential_paths():
    assert not is_credential_path("/api/documents")
    assert not is_credential_path("/api/chat")
    # /api/auth/me reads the signed-in user and is not a guessing target
    assert not is_credential_path("/api/auth/me")


def test_health_and_docs_are_exempt():
    for p in EXEMPT_PATHS:
        assert is_exempt(p)


def test_user_endpoints_are_not_exempt():
    assert not is_exempt("/api/documents")
    assert not is_exempt("/api/chat")
