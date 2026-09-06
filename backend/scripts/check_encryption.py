"""
End-to-end check of encryption at rest, against a running server.

The unit tests in backend/tests prove that sealing and unsealing are correct.
They cannot prove that the application actually uses them, which is the claim
worth checking: a file could be sealed perfectly and still be written to disk
in the clear by a code path nobody remembered.

So this uploads real documents through the API and then looks at the bytes on
the disk with its own eyes, and reads the same documents back through every
route that serves them.

Usage (from the backend/ directory, venv active, server running):

    python -m scripts.check_encryption --base http://127.0.0.1:8000

It signs in as the demo user, uploads a text file and a small PDF, checks them,
and deletes both again. Run it on the machine hosting the server: it reads
UPLOAD_DIR directly, which only works locally.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

from app.config import settings
from app.services import file_store

failures = 0


def check(label: str, condition: bool, extra: object = "") -> None:
    global failures
    tail = "   [%s]" % extra if extra != "" else ""
    print(("  ok    " if condition else "  FAIL  ") + label + tail)
    if not condition:
        failures += 1


def request(base, method, path, body=None, token=None, raw=None, content_type=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(base + path, data=data, method=method)
    if content_type:
        req.add_header("Content-Type", content_type)
    elif data and raw is None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def multipart(filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = "----ragcheck" + uuid.uuid4().hex
    body = b"".join([
        ("--%s\r\n" % boundary).encode(),
        ('Content-Disposition: form-data; name="file"; filename="%s"\r\n' % filename).encode(),
        b"Content-Type: application/octet-stream\r\n\r\n",
        content,
        ("\r\n--%s--\r\n" % boundary).encode(),
    ])
    return body, "multipart/form-data; boundary=" + boundary


# The smallest PDF that PyMuPDF and pypdf both agree is a one-page document.
TINY_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R"
    b"/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b"4 0 obj<</Length 62>>stream\n"
    b"BT /F1 12 Tf 20 100 Td (Encryption at rest check) Tj ET\n"
    b"endstream endobj\n"
    b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
)

MARKER = "Casual leave is capped at twelve days a year."
TEXT_DOC = ("# Encryption check\n\n" + MARKER + "\n").encode()


def newest_upload(suffix: str, after: float, tries: int = 20) -> str | None:
    """The most recently written file under UPLOAD_DIR with this extension.

    Waits for it: the upload response returns once the database row is
    committed, and the bytes land a moment later.
    """
    for _ in range(tries):
        best, best_mtime = None, after
        for folder, _dirs, names in os.walk(settings.UPLOAD_DIR):
            for name in names:
                if not name.lower().endswith(suffix):
                    continue
                candidate = os.path.join(folder, name)
                mtime = os.path.getmtime(candidate)
                if mtime >= best_mtime:
                    best, best_mtime = candidate, mtime
        if best:
            return best
        time.sleep(0.25)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Check encryption at rest.")
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--email", default="demo@example.com")
    parser.add_argument("--password", default="demo1234")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    status, _ = request(base, "GET", "/api/health")
    if status != 200:
        print("No server at %s. Start it first." % base)
        return 2

    print("\n0. Configuration")
    check("ENCRYPT_UPLOADS is on", file_store.enabled(), settings.ENCRYPT_UPLOADS)
    if not file_store.enabled():
        return 1

    status, payload = request(base, "POST", "/api/auth/login",
                              {"email": args.email, "password": args.password})
    if status != 200:
        print("Could not sign in as %s: %s" % (args.email, payload[:200]))
        return 2
    token = json.loads(payload)["access_token"]

    # A little slack: the file clock and this one need not agree exactly.
    started = time.time() - 2
    created = []
    try:
        print("\n1. A text document, uploaded through the API")
        body, ctype = multipart("encryption-check.md", TEXT_DOC)
        status, payload = request(base, "POST", "/api/documents", raw=body, token=token, content_type=ctype)
        check("upload returns 201", status == 201, status)
        if status != 201:
            print(payload[:300])
            return 1
        doc = json.loads(payload)
        created.append(doc["document_id"])
        check("the stored size is the document's size, not the stored form's",
              doc["file_size"] == len(TEXT_DOC), doc["file_size"])

        print("\n2. What is actually on the disk")
        # The API does not hand out storage paths, and rightly so, so the file
        # is found the way anyone holding the disk would find it: by looking.
        path = newest_upload(".md", after=started)
        check("the uploaded file is on the disk", bool(path), path)
        if not path:
            return 1

        with open(path, "rb") as handle:
            on_disk = handle.read()
        check("it does not begin with anything a reader would recognise",
              not on_disk.startswith(b"# Encryption"))
        check("the document's text is nowhere in the stored bytes", MARKER.encode() not in on_disk)
        check("it carries the encrypted-file marker", file_store.is_sealed(on_disk))
        check("it is the plaintext size plus the documented overhead",
              len(on_disk) == len(TEXT_DOC) + file_store.OVERHEAD, len(on_disk))

        print("\n3. Reading it back through the application")
        status, payload = request(base, "GET", "/api/documents/%s/file" % doc["document_id"], token=token)
        check("downloading returns 200", status == 200, status)
        check("the download is the original, byte for byte", payload == TEXT_DOC)

        status, payload = request(base, "GET", "/api/documents/%s/content" % doc["document_id"], token=token)
        check("the reader returns 200", status == 200, status)
        if status == 200:
            text = " ".join(page["text"] for page in json.loads(payload)["pages"])
            check("the extracted text is the document's text", MARKER in text)

        print("\n4. A PDF, which is read by a library that cannot see the key")
        body, ctype = multipart("encryption-check.pdf", TINY_PDF)
        status, payload = request(base, "POST", "/api/documents", raw=body, token=token, content_type=ctype)
        check("upload returns 201", status == 201, status)
        if status == 201:
            pdf_doc = json.loads(payload)
            created.append(pdf_doc["document_id"])
            pdf_path = newest_upload(".pdf", after=started)
            if pdf_path:
                with open(pdf_path, "rb") as handle:
                    head = handle.read(8)
                check("the stored PDF does not start with %PDF", head != b"%PDF-1.4"[:8])
                check("it carries the encrypted-file marker", head == file_store.MAGIC)

            status, payload = request(base, "GET", "/api/documents/%s/file" % pdf_doc["document_id"], token=token)
            check("downloading the PDF gives back a PDF", payload.startswith(b"%PDF"), payload[:8])

            status, payload = request(base, "GET", "/api/documents/%s/thumbnail" % pdf_doc["document_id"], token=token)
            check("the thumbnail renders from the encrypted file", status == 200, status)
            if status == 200:
                check("and it is a PNG", payload.startswith(b"\x89PNG"), payload[:4])

        print("\n5. Cleaning up")
        for document_id in list(created):
            status, _ = request(base, "DELETE", "/api/documents/%s" % document_id, token=token)
            check("test document deleted", status == 204, status)
            if status == 204:
                created.remove(document_id)
    finally:
        for document_id in created:
            request(base, "DELETE", "/api/documents/%s" % document_id, token=token)

    print("\n" + ("Every check passed." if failures == 0 else "%d check(s) failed." % failures))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
