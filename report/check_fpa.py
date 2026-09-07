"""
Check that the function point analysis in section 2.3.2 still matches the system.

The report prints a function point count and says it was taken from the delivered
system rather than from the proposal. That is a claim about the code, and it is
the only quantitative claim in the report that a reader cannot check by looking
at the thing itself: they would have to redo the count. This recomputes it and
compares the result against the numbers actually printed in the report.

    python check_fpa.py

It also cross-checks the classification against the routes that exist, so a
route added to app/api/ and not classified here is an error rather than a
silent omission.

The classification below is the judgement part and cannot be derived: whether
GET /api/admin/stats derives data (an external output) or merely retrieves it
(an external inquiry) is a reading of what the route does. The arithmetic over
it is not a judgement, and that is what this file exists to keep honest.
"""

import glob
import io
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
BACKEND = HERE.parent / "backend"

# IFPUG unadjusted weights.
WEIGHTS = {
    "EI":  {"simple": 3, "average": 4, "complex": 6},
    "EO":  {"simple": 4, "average": 5, "complex": 7},
    "EQ":  {"simple": 3, "average": 4, "complex": 6},
    "ILF": {"simple": 7, "average": 10, "complex": 15},
    "EIF": {"simple": 5, "average": 7, "complex": 10},
}

# Every route in app/api/, classified. The rationale for each complexity rating
# is the number of files it maintains and the number of data elements crossing
# the boundary, which is what the IFPUG matrices are counting.
TRANSACTIONS = [
    # (path, method, type, complexity, what it does)
    ("/api/auth/register", "POST", "EI", "average", "Creates a user and a session"),
    ("/api/auth/login", "POST", "EI", "average", "Verifies a password, records last_login, opens a session"),
    ("/api/auth/refresh", "POST", "EI", "average", "Rotates a refresh token: revokes one row, writes another"),
    ("/api/auth/logout", "POST", "EI", "simple", "Revokes one refresh token"),
    ("/api/auth/forgot-password", "POST", "EI", "simple", "Writes a single-use reset code"),
    ("/api/auth/reset-password", "POST", "EI", "average", "Sets a password and withdraws every session"),
    ("/api/auth/me", "PATCH", "EI", "average", "Updates profile, standing instructions and work role"),
    ("/api/auth/change-password", "POST", "EI", "average", "Sets a password, withdraws sessions, reissues one"),
    ("/api/auth/account", "DELETE", "EI", "complex", "Cascades across six tables, the vector index and the file store"),
    ("/api/documents", "POST", "EI", "complex", "Validates, seals and stores a file, then starts ingestion"),
    ("/api/documents/{id}", "PATCH", "EI", "simple", "Renames or pins a document"),
    ("/api/documents/{id}", "DELETE", "EI", "average", "Removes the row, the file and every vector"),
    ("/api/chat", "POST", "EI", "complex", "Retrieval, generation, a conversation, two messages and a log row"),
    ("/api/chat/stream", "POST", "EI", "complex", "The same turn, delivered as server-sent events"),
    ("/api/conversations/{id}", "PATCH", "EI", "simple", "Renames, pins or marks a conversation read"),
    ("/api/conversations/{id}", "DELETE", "EI", "simple", "Deletes a conversation and its messages"),
    ("/api/projects", "POST", "EI", "average", "Creates a workspace with its own instructions"),
    ("/api/projects/{id}", "PATCH", "EI", "average", "Updates a project's instructions and scope"),
    ("/api/projects/{id}/open", "POST", "EI", "simple", "Records that a project was opened"),
    ("/api/projects/{id}/documents", "PUT", "EI", "average", "Replaces the whole set of attached documents"),
    ("/api/projects/{id}", "DELETE", "EI", "average", "Deletes a project and frees its conversations"),
    ("/api/settings", "PATCH", "EI", "average", "Persists runtime settings over the environment defaults"),

    ("/api/admin/stats", "GET", "EO", "complex", "Counts across four tables and a mean response time"),
    ("/api/admin/system", "GET", "EO", "average", "Live status of each dependency, computed on request"),
    ("/api/usage", "GET", "EO", "average", "Session, weekly and lifetime counts, derived per user"),
    ("/api/documents/{id}/content", "GET", "EO", "complex", "Re-extracts the document, OCR included, within a budget"),
    ("/api/documents/{id}/thumbnail", "GET", "EO", "average", "Renders page one of a sealed PDF as a PNG"),
    ("/api/documents/{id}/pages", "GET", "EO", "simple", "A page count derived from the index rather than the file"),

    ("/api/auth/me", "GET", "EQ", "simple", "The current user"),
    ("/api/models", "GET", "EQ", "simple", "The models the runtime reports as installed"),
    ("/api/settings", "GET", "EQ", "simple", "The effective settings"),
    ("/api/documents/{id}", "GET", "EQ", "simple", "One document's record"),
    ("/api/documents/{id}/file", "GET", "EQ", "simple", "The original upload, unsealed on the way out"),
    ("/api/documents", "GET", "EQ", "average", "The library, filtered by owner and by processing state"),
    ("/api/documents/{id}/chunks", "GET", "EQ", "average", "The indexed chunks of one document"),
    ("/api/conversations", "GET", "EQ", "average", "The sidebar, ordered by most recently touched"),
    ("/api/conversations/{id}", "GET", "EQ", "average", "One transcript with its messages and citations"),
    ("/api/projects", "GET", "EQ", "average", "The projects list with its counts"),
    ("/api/projects/{id}", "GET", "EQ", "average", "One project with its attached documents"),
    ("/api/admin/users", "GET", "EQ", "average", "Every user, with per-user counts"),
    ("/api/admin/query-logs", "GET", "EQ", "average", "The recent query log, newest first"),
]

DATA_FUNCTIONS = [
    # (name, type, complexity, RETs, DETs, note)
    ("User account", "ILF", "average", 3, 23,
     "users, with password_reset_tokens and refresh_tokens as record types of the same logical file"),
    ("Document", "ILF", "simple", 1, 16,
     "documents, together with the sealed file each row points at"),
    ("Conversation", "ILF", "simple", 2, 16, "conversations and messages"),
    ("Project", "ILF", "simple", 2, 11, "projects and project_documents"),
    ("Query log", "ILF", "simple", 1, 10, "query_logs, written by the system and read by the dashboard"),
    ("Vector index", "ILF", "simple", 1, 9,
     "the Chroma collection: one embedding and seven metadata fields per chunk"),
    ("Runtime settings", "ILF", "simple", 1, 10,
     "the settings a user may change without restarting the server"),
    ("Model registry", "EIF", "simple", 1, 4,
     "the models Ollama reports as installed. Read, never written"),
    ("Cloud model catalogue", "EIF", "simple", 1, 4,
     "the OpenAI models and embeddings, referenced when the cloud provider is selected"),
]

# The fourteen general system characteristics, rated 0 to 5, each with the fact
# about this system that fixes the rating.
GSC = [
    ("Data communications", 4,
     "A browser talks to an API over HTTP, or HTTPS in the networked deployment, and one route streams server-sent events."),
    ("Distributed data processing", 2,
     "Ingestion runs in a separate operating-system process from the API, so that a hung extraction cannot block it. It is not distributed across machines."),
    ("Performance", 4,
     "The proposal sets a five-second answer, and NFR-2 a tighter budget for retrieval alone. Performance decided the chunk size, the batch size and the existence of the streaming route."),
    ("Heavily used configuration", 2,
     "One machine, and a 4 GB graphics card that decided which model the system defaults to."),
    ("Transaction rate", 1,
     "A single organisation with no stated peak. Nothing in the design is sized for a transaction rate."),
    ("Online data entry", 5,
     "Every function is interactive. There is no batch entry anywhere in the system."),
    ("End-user efficiency", 5,
     "Eleven interface languages, a layout responsive to 414 px, live ingestion progress, a dark theme, drag-and-drop upload, and a retrieval line under every answer."),
    ("Online update", 4,
     "Documents, conversations, projects and settings are all maintained online, with recovery for documents left mid-processing by a restart."),
    ("Complex processing", 5,
     "Embedding, approximate nearest-neighbour search, an OCR fallback for pages with no text layer, a relevance floor that decides whether to generate at all, and an instruction hierarchy in the prompt."),
    ("Reusability", 3,
     "The provider factory and the embedding backend are each replaceable by adding one class. The code is layered for reuse but is not packaged as a library."),
    ("Installation ease", 4,
     "An installation guide written for a machine with none of the software on it, a disc build that fails if it finds a secret, a backup script and a Docker Compose deployment."),
    ("Operational ease", 3,
     "One double-click to start, automatic recovery of stuck documents, a health report and a schedulable backup. It is not unattended."),
    ("Multiple sites", 2,
     "Docker Compose and a TLS deployment make a second site installable. There is no multi-tenancy."),
    ("Facilitate change", 4,
     "Settings changeable at runtime, swappable providers, and a layered backend with no upward dependencies."),
]

# The measured facts this section compares itself against, all of them stated
# elsewhere in the report or countable in the tree.
CRITICAL_PATH_DAYS = 85
WORKING_DAYS_PER_MONTH = 20
TOTAL_LOC = 24522


def _tally(rows, key_type):
    counts = {"simple": 0, "average": 0, "complex": 0}
    for row in rows:
        if row[key_type[0]] == key_type[1]:
            counts[row[key_type[2]]] += 1
    return counts


def fpa_numbers():
    """Every figure the section quotes, computed rather than typed."""
    tx = {}
    for _p, _m, kind, complexity, _n in TRANSACTIONS:
        tx.setdefault(kind, {"simple": 0, "average": 0, "complex": 0})
        tx[kind][complexity] += 1

    data = {}
    for _n, kind, complexity, _r, _d, _note in DATA_FUNCTIONS:
        data.setdefault(kind, {"simple": 0, "average": 0, "complex": 0})
        data[kind][complexity] += 1

    counts = dict(tx)
    counts.update(data)

    ufp = 0
    per_type = {}
    for kind, by_complexity in counts.items():
        total = sum(n * WEIGHTS[kind][c] for c, n in by_complexity.items())
        per_type[kind] = {"counts": by_complexity, "fp": total,
                          "n": sum(by_complexity.values())}
        ufp += total

    tdi = sum(rating for _name, rating, _why in GSC)
    vaf = 0.65 + 0.01 * tdi
    afp = ufp * vaf

    actual_months = CRITICAL_PATH_DAYS / WORKING_DAYS_PER_MONTH
    return {
        "per_type": per_type,
        "ufp": ufp,
        "tdi": tdi,
        "vaf": vaf,
        "afp": afp,
        "afp_rounded": int(round(afp)),
        "actual_months": actual_months,
        "achieved_rate": afp / actual_months,
        "loc_per_fp": TOTAL_LOC / afp,
    }

# ---------------------------------------------------------------- the checks

def routes_in_code():
    """Every route the application actually defines, normalised for comparison."""
    found = set()
    for path in sorted(glob.glob(str(BACKEND / "app" / "api" / "*.py"))):
        text = io.open(path, encoding="utf-8").read()
        match = re.search(r'APIRouter\(prefix="([^"]*)"', text)
        prefix = match.group(1) if match else ""
        for m in re.finditer(r'@router\.(get|post|patch|put|delete)\(\s*"([^"]*)"', text):
            route = re.sub(r"\{[a-z_]+\}", "{id}", prefix + m.group(2))
            found.add((route, m.group(1).upper()))
    return found


def main() -> int:
    problems = []
    n = fpa_numbers()

    # 1. The classification covers exactly the routes that exist.
    real = routes_in_code()
    mine = {(re.sub(r"\{[a-z_]+\}", "{id}", p), m) for p, m, _k, _c, _note in TRANSACTIONS}
    for route in sorted(real - mine):
        problems.append("route exists but is not classified: %s %s" % (route[1], route[0]))
    for route in sorted(mine - real):
        problems.append("classified but no such route: %s %s" % (route[1], route[0]))

    # 2. The numbers the report prints are the numbers this computes.
    report = io.open(SRC / "02-system-analysis.md", encoding="utf-8").read()
    expected = {
        "unadjusted function point count is **%d**" % n["ufp"]: "UFP",
        "0.01 x %d) = " % n["tdi"]: "total degree of influence",
        "**%.2f**" % n["vaf"]: "VAF",
        "**%.1f function points**" % n["afp"]: "adjusted count",
        "rounds to **%d**" % n["afp_rounded"]: "rounded adjusted count",
    }
    for text, label in expected.items():
        if text not in report:
            problems.append("the report does not print the computed %s (%r)" % (label, text))

    print("%d transactions, %d data functions" % (len(TRANSACTIONS), len(DATA_FUNCTIONS)))
    print("UFP %d, TDI %d, VAF %.2f, AFP %.1f -> %d"
          % (n["ufp"], n["tdi"], n["vaf"], n["afp"], n["afp_rounded"]))
    print("%.0f function points per person-month achieved, %.0f lines per function point"
          % (n["achieved_rate"], n["loc_per_fp"]))

    if problems:
        print("\n%d problem(s):" % len(problems))
        for problem in problems:
            print("  " + problem)
        return 1

    print("\nThe count matches the code, and the report prints the count.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
