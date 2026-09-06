"""
Build variants of the report that differ only in how much source code they print.

The question this answers is a judgement call that belongs to whoever submits
the report, not to whoever writes it: how much of a 24,522 line codebase should
a 142 page report reproduce? Rather than argue it, this builds each answer as a
complete report so they can be compared by reading them.

    python make-variants.py            build every variant
    python make-variants.py C E        build only those

Each variant gets its own source folder under report/variants/src-<name>/ and
its own .docx. The real src/ and report.docx are never touched. Turning the
.docx files into PDFs is a separate step, because that needs Word:

    powershell -ExecutionPolicy Bypass -File export-variants.ps1

The variants:

    A  core appendix      the backend modules that carry the system, in full
    B  full backend       every backend file, all 39 of them
    C  expanded chapter   more excerpts inside chapter 4, no appendix
    D  pointer only       no listings; says where the source is and how big
    E  C and A together   expanded chapter 4 AND the core appendix

Every variant includes D's pointer, in wording that suits it. That part is not
a choice: the report as it stands never tells the examiner that the complete
source is on the disc at all.
"""

import io
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
BACKEND = HERE.parent / "backend"
FRONTEND = HERE.parent / "frontend"
VARIANTS = HERE / "variants"


# --------------------------------------------------------------- code extraction

def whole(path: str) -> str:
    """A complete source file, trailing blank lines trimmed."""
    root = FRONTEND if path.startswith("src/") else BACKEND
    return io.open(root / path, encoding="utf-8").read().rstrip("\n")


def block(path: str, name: str, kind: str = "def") -> str:
    """One Python function or class, found by name rather than by line number.

    Line numbers in a file that is still being edited are a promise that breaks
    silently: the excerpt still renders, it just shows the wrong twenty lines.
    """
    text = io.open(BACKEND / path, encoding="utf-8").read()
    lines = text.splitlines()
    pattern = re.compile(r"^(\s*)(async\s+)?%s\s+%s\b" % (kind, re.escape(name)))
    start = None
    indent = ""
    for i, line in enumerate(lines):
        m = pattern.match(line)
        if m:
            start = i
            indent = m.group(1)
            break
    if start is None:
        raise SystemExit("could not find %s %s in %s" % (kind, name, path))

    # Carry any decorators immediately above it: on a route they are the half
    # that says what the function is. The scan for the end still starts from the
    # def itself, because starting it from a decorator at the same indent ends
    # the block on the very next line.
    definition = start
    while start > 0 and lines[start - 1].lstrip().startswith("@"):
        start -= 1

    end = len(lines)
    for i in range(definition + 1, len(lines)):
        line = lines[i]
        if not line.strip():
            continue
        current = len(line) - len(line.lstrip())
        if current <= len(indent) and not line.lstrip().startswith(("#", ")", "]", "}")):
            end = i
            break
    return "\n".join(lines[start:end]).rstrip()


def js_block(path: str, marker: str, with_comment: bool = True) -> str:
    """A JavaScript statement, from a marker line until its brackets balance.

    Counting brackets rather than matching an end marker, because the obvious
    end markers in this file are not unique: `return inFlight;` appears twice in
    the function that ends with it.
    """
    lines = io.open(FRONTEND / path, encoding="utf-8").read().splitlines()
    start = next(i for i, l in enumerate(lines) if marker in l)

    depth = 0
    end = start
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch in "([{":
                depth += 1
            elif ch in ")]}":
                depth -= 1
        end = i
        if i > start and depth <= 0:
            break

    # The comment above a piece of JavaScript in this codebase is usually the
    # reason it is written that way, which is the half worth printing.
    if with_comment:
        while start > 0 and lines[start - 1].lstrip().startswith("//"):
            start -= 1
    return "\n".join(lines[start:end + 1]).rstrip()


# Two blank lines, the separation PEP 8 puts between top-level definitions, for
# joining two functions lifted out of the same file into one excerpt.
GAP = "\n\n\n"


def fence(code: str, language: str = "python") -> str:
    return "```%s\n%s\n```" % (language, code)


def count(code: str) -> int:
    return len(code.splitlines())


# --------------------------------------------------------------- the appendix

CORE = [
    ("Configuration and startup", [
        ("app/config.py", "Every setting the system reads, in one object, so that no module reaches for an environment variable on its own."),
        ("app/database.py", "The engine, the session factory and the declarative base. Thirty-three lines, and every database access in the system goes through them."),
        ("app/main.py", "The application object: middleware order, the routers, and the startup work that makes an existing installation match the current schema."),
    ]),
    ("The data model", [
        ("app/models.py", "The nine tables, as SQLAlchemy declares them. The cascade rules here are the ones argued for in section 2.6."),
        ("app/schemas.py", "What the API accepts and returns. Separate from the models on purpose: a request body is not a row, and letting one be the other is how a field nobody meant to expose gets exposed."),
    ]),
    ("Security", [
        ("app/security.py", "Password hashing, access tokens, and the opaque refresh tokens described in section 6.2."),
        ("app/deps.py", "The dependency every protected route hangs on. It resolves the token to a row and checks the account is still active, on every request."),
        ("app/ratelimit.py", "The fixed-window limiter of section 6.8, and the path classification that gives password routes a stricter limit than the rest."),
        ("app/services/file_store.py", "Encryption at rest: the stored format, the key derivation, and the plaintext fallback that lets this be introduced on a library that already holds documents."),
    ]),
    ("The RAG engine", [
        ("app/services/rag_engine.py", "The largest module in the system and the one that decides what an answer is. The relevance gate, the prompt construction, the instruction hierarchy, and the small-talk and conversation-question classifiers."),
        ("app/services/vector_store.py", "The only module that talks to Chroma. Section 3.1 explains why that rule is load-bearing rather than merely tidy."),
        ("app/services/embeddings.py", "The embedding backend, local or cloud, behind one interface."),
        ("app/services/llm_providers.py", "The provider factory. Adding a third provider is one class and no other change."),
    ]),
    ("Ingestion", [
        ("app/services/document_processor.py", "Extraction, OCR, chunking, embedding and indexing, with the progress arithmetic that keeps the bar honest."),
        ("app/worker.py", "The separate process ingestion runs in, so that a hung extraction cannot block the API."),
    ]),
    ("The API", [
        ("app/api/auth.py", "Registration, sign-in, the refresh and logout routes, password reset, and account deletion."),
        ("app/api/chat.py", "Asking a question, both the plain route and the streaming one."),
        ("app/api/documents.py", "Upload, listing, reading, the thumbnail, the download, and deletion."),
        ("app/api/projects.py", "Project workspaces and the documents attached to them."),
        ("app/api/admin.py", "The administrator's counts, user list and health report."),
    ]),
]

EXTRA_FOR_B = [
    ("Everything else in the application", [
        ("app/api/settings.py", "Runtime settings a user may change without restarting the server."),
        ("app/api/usage.py", "The personal usage report of section 7.3."),
        ("app/runtime_settings.py", "Persisting those settings, and applying them over the values read from the environment at startup."),
    ]),
    ("Scripts", [
        ("scripts/seed_admin.py", "Creating or promoting an administrator."),
        ("scripts/check_refresh_flow.py", "The end-to-end check of the session handling described in section 6.2. It is here because it is the test that found a real fault reasoning had missed."),
        ("scripts/check_encryption.py", "The end-to-end check that documents really are unreadable on disk, which a unit test cannot establish."),
        ("scripts/encrypt_uploads.py", "Converting documents stored before encryption was switched on."),
    ]),
    ("The test suites", [
        ("tests/test_chunking.py", "Whitespace, heading detection and section attribution."),
        ("tests/test_rag_rules.py", "The relevance floor, the classifiers, and the prompt-injection guard."),
        ("tests/test_progress.py", "The progress reporter's arithmetic."),
        ("tests/test_security.py", "Password and token handling."),
        ("tests/test_ratelimit.py", "The counter and the path classification."),
        ("tests/test_refresh_tokens.py", "Token generation, hashing and lifetimes."),
        ("tests/test_file_store.py", "Sealing, unsealing, tampering and the plaintext fallback."),
    ]),
]


def appendix(groups, title_note):
    out = ["", "## Appendix E: Source Code Listing", "", title_note, ""]
    lines_total = 0
    for group_name, files in groups:
        out.append("### %s" % group_name)
        out.append("")
        for path, note in files:
            code = whole(path)
            lines_total += count(code)
            out.append("**`%s`**  %s" % (path, note))
            out.append("")
            out.append(fence(code))
            out.append("")
    return "\n".join(out), lines_total


# --------------------------------------------------------------- chapter 4 extras

def chapter_extras():
    """The excerpts variant C adds to section 4.4, with what each one shows."""
    items = [
        ("The Upload Handler",
         "Validation happens three times on the way in, and the reasons differ. This is the middle one: the request has been accepted, the extension has been checked, and what is left is the two facts a client can lie about.",
         fence(block("app/api/documents.py", "upload_document")),
         "The size is checked **after** reading rather than from `Content-Length`, because that header is a claim by the client and not a fact. The empty file and the oversized file are separated, because they are different mistakes and deserve different sentences. And the write goes through `file_store.write`, which seals the bytes before they reach the disk, while `file_size` records the size of the document the user uploaded rather than the size of what is stored."),

        ("The Authentication Dependency",
         "One function, hung on every protected route, and the reason authorisation cannot be forgotten on any of them.",
         fence(block("app/deps.py", "get_current_user")),
         "A signed token is valid for its whole lifetime, so an account disabled ten minutes after signing in would keep working until the token expired. That is why this resolves the subject to a row and re-checks `is_active` on every request instead of trusting the claim. The cost is one indexed primary-key lookup per request; the alternative is a disabled account that keeps working for an hour."),

        ("Sealing a Document",
         "Encryption at rest is a few lines of cipher and a great deal of care about the format around them.",
         fence(block("app/services/file_store.py", "seal") + "\n\n\n" + block("app/services/file_store.py", "unseal") + "\n\n\n" + block("app/services/file_store.py", "read")),
         "The nonce is fresh on every write and never reused, so two copies of the same document do not produce the same ciphertext and the store does not leak which documents match. `read` returning plaintext untouched is what allows this to be introduced on an installation that already holds documents, and a file that is sealed but will not open raises rather than returning ciphertext, because handing back ciphertext would make a PDF reader report a corrupt document and send the reader after the wrong problem."),

        ("Refresh Token Rotation",
         "Every renewal spends the token it was given. The distinction in the middle of this function is what stops an ordinary sign-out being mistaken for a theft.",
         fence(block("app/api/auth.py", "refresh")),
         "A revoked token means two quite different things. One with a successor recorded against it was spent in a rotation and is being presented a second time, which means two clients hold it. One with no successor was withdrawn on purpose, by a sign-out or a password change, and meeting it again is a stale tab. The first implementation did not draw that line, and the consequence, found by the end-to-end check and not by reading the code, was that signing out of one browser would have signed the user out of every device they owned."),

        ("The Rate Limiter",
         "A fixed window, counted per address, in front of every route and before authentication runs.",
         fence(block("app/ratelimit.py", "hit")),
         "The counter is in the process's own memory. Redis would survive a restart and would work across several instances, and it is another service to install, run and back up on a system whose entire deployment story is one machine with no internet connection. The window resetting on restart is a real weakness and a small one, since restarting is not something an attacker can cause. It is recorded as a limit in section 6.9 rather than left for a reader to notice."),

        ("The Streaming Route",
         "The same pipeline as the plain chat route, delivered a token at a time so that an answer starts appearing in about a second instead of after six.",
         fence(block("app/api/chat.py", "_sse") + GAP + block("app/api/chat.py", "events")),
         "The generator yields named events rather than bare text, so the client can tell a token from a citation list from a completion. Errors are yielded as events too: once the response has begun, the status code is already sent and an exception can no longer become a 500, so a failure that is not turned into an event becomes a stream that simply stops."),

        ("Renewing a Token in the Browser",
         "The front-end half of section 6.2. What a user sees when an access token expires is one slightly slower request, and this is why.",
         fence(js_block("src/api/client.js", "export function refreshAccessToken"), "javascript"),
         "One refresh at a time, and the comment says what the alternative costs. Several requests can fail together, and each rotation spends the token it was given, so letting them all refresh at once would have the second one present a token the first had already spent. The server reads that as a stolen token and ends every session, which is the correct reading of it and exactly what the client must not provoke."),

        ("The Response Interceptor",
         "Where a rejected request becomes a renewed one, and where a session that is genuinely over becomes a trip to the login screen.",
         fence(js_block("src/api/client.js", "client.interceptors.response.use"), "javascript"),
         "`_retried` is what stops this looping: a request that fails again after a successful renewal is not renewed a second time. The exempt list matters as much. A 401 from the login route is a wrong password, not an expired session, and sending the user to the login screen they are already looking at would replace a readable error with a page reload."),
    ]
    return items


# --------------------------------------------------------------- pointer section

def pointer(where_the_code_is: str, excerpt_note: str) -> str:
    return """
## Where the Complete Source Is

%s

The complete source is on the submitted disc under `02-Source-Code`, and it is
the same tree the application runs from. Its scale is worth stating plainly,
because a report that prints excerpts should say what it is drawing them from.

Table: The codebase, by size

| Part | Files | Lines |
|---|---|---|
| Backend, Python | 39 | 6,008 |
| Front end, JavaScript and JSX | 55 | 14,933 |
| Stylesheet | 1 | 3,581 |
| **Total** | **95** | **24,522** |

%s
""" % (where_the_code_is, excerpt_note)


# --------------------------------------------------------------- variants

def variant_sources(name):
    """Return {filename: text} for the files this variant changes, plus a note."""
    coding = io.open(SRC / "04-coding.md", encoding="utf-8").read()
    appendices = io.open(SRC / "12-appendices.md", encoding="utf-8").read()
    changes = {}
    printed = 231  # the four excerpts already in section 4.4

    if name in ("C", "E"):
        extras = chapter_extras()
        added = []
        for heading, intro, code, note in extras:
            printed += count(code) - 2  # minus the fence lines
            added.append("### %s\n\n%s\n\n%s\n\n%s\n" % (heading, intro, code, note))
        anchor = "## Efficiency"
        assert anchor in coding
        coding = coding.replace(anchor, "\n".join(added) + "\n" + anchor, 1)

    if name in ("A", "E"):
        text, lines = appendix(CORE,
            "This appendix prints the backend modules that carry the system, each in full. "
            "The front end is not printed: at 14,933 lines it would add some two hundred and "
            "fifty pages, and it is on the disc in full.")
        appendices = appendices.rstrip() + "\n" + text
        printed += lines
    elif name == "B":
        text, lines = appendix(CORE + EXTRA_FOR_B,
            "This appendix prints the complete backend, all thirty-nine Python files, each in "
            "full and in package order. Nothing is selected and nothing is left out. The front "
            "end is not printed: at 14,933 lines it would add some two hundred and fifty pages, "
            "and it is on the disc in full.")
        appendices = appendices.rstrip() + "\n" + text
        printed += lines

    if name == "D":
        where = ("This chapter shows the code that carries the system's logic, and the "
                 "conventions every file is written to. It does not reproduce the codebase: at "
                 "8.5 point the listing runs to some four hundred pages, which would bury the "
                 "chapters that explain what the code is for.")
        excerpt = ("The excerpts in the previous section are %d lines of that total, chosen on "
                   "one rule: they are the places where a wrong line would change what the "
                   "system *is* and not merely break it." % printed)
    elif name == "C":
        where = ("This chapter shows the code that carries the system's logic, and the "
                 "conventions every file is written to. It does not reproduce the codebase: at "
                 "8.5 point the listing runs to some four hundred pages, which would bury the "
                 "chapters that explain what the code is for.")
        excerpt = ("The twelve excerpts in the previous section are %d lines of that total, "
                   "chosen on one rule: they are the places where a wrong line would change "
                   "what the system *is* and not merely break it." % printed)
    else:
        where = ("This chapter shows the code that carries the system's logic, and the "
                 "conventions every file is written to. The backend modules are printed in "
                 "full in Appendix E. The front end is not printed, because at 14,933 lines it "
                 "would add some two hundred and fifty pages to this volume.")
        excerpt = ("Appendix E and the excerpts in the previous section are %d lines of that "
                   "total. What is not printed is the front end and the stylesheet, and both "
                   "are on the disc." % printed)

    anchor = "## Efficiency"
    assert anchor in coding
    coding = coding.replace(anchor, pointer(where, excerpt).strip() + "\n\n" + anchor, 1)

    changes["04-coding.md"] = coding
    changes["12-appendices.md"] = appendices
    return changes, printed


NAMES = {
    "A": "A-core-appendix",
    "B": "B-full-backend",
    "C": "C-expanded-chapter",
    "D": "D-pointer-only",
    "E": "E-expanded-plus-appendix",
}


def build(name):
    label = NAMES[name]
    out_src = VARIANTS / ("src-%s" % label)
    if out_src.exists():
        shutil.rmtree(out_src)
    out_src.mkdir(parents=True)
    for path in sorted(SRC.glob("*.md")):
        shutil.copy2(path, out_src / path.name)

    changes, printed = variant_sources(name)
    for filename, text in changes.items():
        io.open(out_src / filename, "w", encoding="utf-8", newline="\n").write(text)

    docx = VARIANTS / ("report-%s.docx" % label)
    result = subprocess.run(
        [sys.executable, str(HERE / "build.py"), "--src", str(out_src), "--out", str(docx)],
        capture_output=True, text=True, cwd=str(HERE),
    )
    tail = [l for l in result.stdout.splitlines() if "words" in l]
    print("  %-26s %s  (%d code lines printed)"
          % (label, tail[-1].strip() if tail else result.stderr.strip()[:60], printed))
    return printed


def main():
    wanted = [a.upper() for a in sys.argv[1:] if a.upper() in NAMES] or list(NAMES)
    VARIANTS.mkdir(exist_ok=True)
    print("building %d variant(s)\n" % len(wanted))
    for name in wanted:
        build(name)
    print("\nnow run:  powershell -ExecutionPolicy Bypass -File export-variants.ps1")


if __name__ == "__main__":
    main()
