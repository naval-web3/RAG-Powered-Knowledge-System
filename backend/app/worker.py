"""
Standalone document-processing worker.

Run as a subprocess:  python -m app.worker <document_id>

Heavy ingest work (PDF rendering with PyMuPDF, OCR with onnxruntime, local
embeddings with torch) is run here, in its own OS process, instead of inside a
FastAPI background task. Doing that native work in the server's shared thread
pool can deadlock the worker thread (onnxruntime/torch + the event-loop thread
pool), which left uploads stuck on "processing" forever. A separate process is
isolated: it runs exactly like a plain script (which works), it can be given a
hard timeout, and if it dies the parent still sees a non-zero exit code.
"""

import sys
import uuid

from app.database import SessionLocal
from app.models import Document
from app.services.document_processor import process_document


def run(document_id: str) -> int:
    db = SessionLocal()
    try:
        doc = db.get(Document, uuid.UUID(document_id))
        if doc is None:
            print(f"worker: document {document_id} not found", file=sys.stderr)
            return 2
        process_document(db, doc)
        return 0
    except Exception as exc:  # noqa: BLE001 - process_document already persisted 'failed'
        print(f"worker: processing failed: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: python -m app.worker <document_id>", file=sys.stderr)
        raise SystemExit(64)
    raise SystemExit(run(sys.argv[1]))


if __name__ == "__main__":
    main()
