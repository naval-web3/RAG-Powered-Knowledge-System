"""
End-to-end check of the refresh token flow, against a running server.

The unit tests in backend/tests cover the parts that are pure: how a token is
generated, hashed and dated. Rotation is not pure. It is a sequence of queries
against Postgres whose whole point is what the *second* request sees, and the
only honest way to test that is to make the requests.

Usage (from the backend/ directory, venv active, server running):

    python -m scripts.check_refresh_flow --base http://127.0.0.1:8000

It registers a throwaway account, puts it through every path a session can
take, and deletes the account again. Nothing else in the database is touched.

The two scenarios worth reading are 4 and 6. Scenario 4 is theft: a rotated
token presented twice means two clients hold it, and every session for that
account ends. Scenario 6 is the ordinary case that must not be mistaken for
theft, namely signing out of one browser while another stays signed in. An
earlier version of this code failed 6, because it treated every revoked token
as stolen, and one sign-out would have logged the user out everywhere.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

failures = 0


def check(label: str, condition: bool, extra: object = "") -> None:
    global failures
    tail = "   [%s]" % extra if extra != "" else ""
    print(("  ok    " if condition else "  FAIL  ") + label + tail)
    if not condition:
        failures += 1


class Api:
    """A tiny client that waits out the rate limiter instead of tripping over it.

    Auth routes allow ten requests a minute per address, and this script makes
    more than that. A real client never does, so the limit is right and the
    script is what has to give way.
    """

    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")

    def __call__(self, method, path, body=None, token=None, _retried=False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req) as response:
                raw = response.read().decode()
                return response.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and not _retried:
                wait = int(exc.headers.get("Retry-After", "60")) + 1
                print("  ..    rate limited, waiting %ds" % wait)
                time.sleep(wait)
                return self(method, path, body, token, _retried=True)
            raw = exc.read().decode()
            try:
                return exc.code, json.loads(raw)
            except ValueError:
                return exc.code, raw


def main() -> int:
    parser = argparse.ArgumentParser(description="Check the refresh token flow.")
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    api = Api(args.base)

    status, _ = api("GET", "/api/health")
    if status != 200:
        print("No server at %s. Start it first." % args.base)
        return 2

    stamp = str(int(time.time()))
    email = "refreshcheck%s@example.com" % stamp
    password = "checkpass123"

    print("\n1. Registering issues both halves of a session")
    status, a = api(
        "POST",
        "/api/auth/register",
        {"username": "refreshcheck" + stamp, "email": email, "password": password},
    )
    check("register returns 201", status == 201, status)
    if status != 201:
        return 1
    check("an access token came back", bool(a.get("access_token")))
    check("a refresh token came back", len(a.get("refresh_token", "")) == 64)
    check("the refresh token is opaque, not a JWT", "." not in a["refresh_token"])
    check("expires_in matches the access token lifetime", a.get("expires_in") == 3600, a.get("expires_in"))

    print("\n2. The access token authenticates")
    status, _ = api("GET", "/api/auth/me", token=a["access_token"])
    check("GET /api/auth/me returns 200", status == 200, status)

    print("\n3. Refreshing rotates both tokens")
    status, b = api("POST", "/api/auth/refresh", {"refresh_token": a["refresh_token"]})
    check("refresh returns 200", status == 200, status)
    check("the refresh token is a new one", b["refresh_token"] != a["refresh_token"])
    check("the access token is a new one", b["access_token"] != a["access_token"])
    check("the user comes with it", b["user"]["email"] == email)
    status, _ = api("GET", "/api/auth/me", token=b["access_token"])
    check("the new access token authenticates", status == 200, status)

    print("\n4. A rotated token presented twice ends every session")
    status, _ = api("POST", "/api/auth/refresh", {"refresh_token": a["refresh_token"]})
    check("replaying the spent token returns 401", status == 401, status)
    status, _ = api("POST", "/api/auth/refresh", {"refresh_token": b["refresh_token"]})
    check("and the token that replaced it is withdrawn too", status == 401, status)

    print("\n5. Logging in starts a fresh session")
    status, c = api("POST", "/api/auth/login", {"email": email, "password": password})
    check("login returns 200", status == 200, status)
    check("login carries a refresh token", len(c.get("refresh_token", "")) == 64)

    print("\n6. Signing out of one session leaves the others alone")
    status, second = api("POST", "/api/auth/login", {"email": email, "password": password})
    check("a second sign-in on another device returns 200", status == 200, status)
    status, _ = api("POST", "/api/auth/logout", {"refresh_token": second["refresh_token"]})
    check("signing that one out returns 204", status == 204, status)
    status, _ = api("POST", "/api/auth/refresh", {"refresh_token": second["refresh_token"]})
    check("its refresh token stops working", status == 401, status)
    status, c = api("POST", "/api/auth/refresh", {"refresh_token": c["refresh_token"]})
    check("the other session still refreshes", status == 200, status)
    if status != 200:
        print("        a sign-out was mistaken for a stolen token")
        return 1

    print("\n7. Changing the password ends other sessions but not this one")
    status, d = api(
        "POST",
        "/api/auth/change-password",
        {"current_password": password, "new_password": "changed4567"},
        token=c["access_token"],
    )
    check("change-password returns 200 with a body", status == 200, status)
    check("it hands back a replacement pair", len(d.get("refresh_token", "")) == 64)
    status, _ = api("POST", "/api/auth/refresh", {"refresh_token": c["refresh_token"]})
    check("the refresh token from before the change is dead", status == 401, status)
    status, e = api("POST", "/api/auth/refresh", {"refresh_token": d["refresh_token"]})
    check("the replacement still refreshes", status == 200, status)
    live = e if status == 200 else d

    print("\n8. Nonsense is refused rather than crashed on")
    status, _ = api("POST", "/api/auth/refresh", {"refresh_token": "not-a-real-token"})
    check("an invented token returns 401", status == 401, status)
    status, _ = api("POST", "/api/auth/refresh", {})
    check("a missing token returns 422", status == 422, status)

    print("\n9. Cleaning up")
    status, _ = api("DELETE", "/api/auth/account", token=live["access_token"])
    check("the throwaway account is deleted", status == 204, status)

    print("\n" + ("Every check passed." if failures == 0 else "%d check(s) failed." % failures))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
