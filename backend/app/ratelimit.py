"""
Per-client request rate limiting.

The approved proposal specifies rate limiting on all API endpoints. This is that,
written as one small in-process middleware with no new dependency, because the
project's central constraint is that it installs on one machine with no network
and every package added is a package that has to come off the disc.

Two buckets, because the two risks are different sizes:

  * every endpoint gets a generous ceiling, high enough that the interface's
    own once-a-second polling during an upload cannot reach it;
  * the credential endpoints get a strict one, because that is where an
    attacker guesses passwords and where a slow bcrypt hash is the only thing
    otherwise standing in the way.

A fixed window, not a sliding one. A sliding window is more precise and needs a
timestamp per request; the point here is to stop a flood, and a flood trips a
fixed window just as reliably.

Limitation, stated rather than discovered: the counters live in this process.
One Uvicorn worker on one machine is the deployment this system is built for
and is what the report measures, but a multi-process deployment would need a
shared store, and each worker would otherwise enforce its own share of the
limit. §6.5 says so.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

# Paths where a wrong guess is worth something to an attacker. Matched as
# prefixes against the request path, so a router prefix change cannot silently
# drop one out of the strict bucket.
CREDENTIAL_PATHS = (
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/change-password",
    # A refresh token is a credential like any other, and guessing one is worth
    # as much as guessing a password. A real client refreshes once an hour, so
    # the strict limit costs it nothing.
    "/api/auth/refresh",
)

# Never limited: the readiness probe, and the interactive docs, neither of which
# touches user data and both of which are wanted when things are going wrong.
EXEMPT_PATHS = ("/api/health", "/docs", "/redoc", "/openapi.json")


class FixedWindowCounter:
    """Counts requests per key inside a window, and forgets old windows.

    Pure and side-effect free apart from its own state, so the whole of the
    limiting decision can be unit tested without a server, a socket or a clock
    that has to be waited on.
    """

    def __init__(self, window_seconds: int = 60) -> None:
        self.window = window_seconds
        self._hits: dict[tuple[str, int], int] = defaultdict(int)
        self._lock = Lock()

    def hit(self, key: str, limit: int, now: float | None = None) -> tuple[bool, int]:
        """Record one request. Returns (allowed, seconds until the window ends).

        The second element is what goes in Retry-After, so a well-behaved client
        is told exactly how long to wait instead of guessing.
        """
        now = time.time() if now is None else now
        bucket = int(now // self.window)
        with self._lock:
            # Drop windows that have passed. Doing it here rather than on a
            # timer keeps the memory bounded without a background thread.
            if len(self._hits) > 4096:
                self._hits = defaultdict(
                    int, {k: v for k, v in self._hits.items() if k[1] >= bucket - 1}
                )
            self._hits[(key, bucket)] += 1
            count = self._hits[(key, bucket)]
        retry_after = int((bucket + 1) * self.window - now) + 1
        return count <= limit, retry_after


_general = FixedWindowCounter()
_credential = FixedWindowCounter()


def client_key(request: Request) -> str:
    """Who is being limited.

    The direct peer address, and deliberately not X-Forwarded-For: this system
    is served on the loopback interface with no reverse proxy in front of it, so
    a forwarded header here would be a value the client chose for itself and a
    limiter keyed on it would be no limiter at all. A deployment that does put a
    proxy in front has to configure the proxy headers before trusting them.
    """
    return request.client.host if request.client else "unknown"


def is_credential_path(path: str) -> bool:
    return any(path.startswith(p) for p in CREDENTIAL_PATHS)


def is_exempt(path: str) -> bool:
    return any(path.startswith(p) for p in EXEMPT_PATHS)


async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if not settings.RATE_LIMIT_ENABLED or is_exempt(path):
        return await call_next(request)

    key = client_key(request)
    if is_credential_path(path):
        allowed, retry = _credential.hit("cred:" + key, settings.RATE_LIMIT_AUTH_PER_MINUTE)
        what = "sign-in attempts"
    else:
        allowed, retry = _general.hit(key, settings.RATE_LIMIT_PER_MINUTE)
        what = "requests"

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Too many {what}. Try again in {retry} second(s)."},
            headers={"Retry-After": str(retry)},
        )
    return await call_next(request)
