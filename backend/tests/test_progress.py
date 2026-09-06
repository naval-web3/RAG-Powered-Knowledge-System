"""Unit tests for the ingest progress reporter.

The progress bar in the library is drawn straight from the two columns this
object writes, so its arithmetic is the difference between a bar that tells the
truth and one that merely moves. Exercised against stand-ins for the document
row and the session, because none of the behaviour under test needs either.
"""

from app.services.document_processor import _COARSE, _Progress


class FakeDoc:
    def __init__(self):
        self.stage = None
        self.progress = 0
        self.processing_status = "pending"
        self.stage_detail = None


class FakeSession:
    def __init__(self):
        self.commits = 0

    def commit(self):
        self.commits += 1


def make():
    db, doc = FakeSession(), FakeDoc()
    return db, doc, _Progress(db, doc)


def test_a_stage_finishes_at_its_own_end_percentage():
    db, doc, report = make()
    report("extracting", 1.0)
    assert doc.progress == _Progress.END["extracting"] == 35


def test_a_fraction_within_a_stage_is_interpolated_across_its_span():
    db, doc, report = make()
    report("extracting", 0.5)
    assert doc.progress == 17          # half of 0 -> 35


def test_ocr_starts_where_extraction_stopped_rather_than_from_a_fixed_table():
    db, doc, report = make()
    report("extracting", 1.0)          # 35
    report("ocr", 0.5)
    # Half way across 35 -> 60, not half way across 0 -> 60.
    assert doc.progress == 47


def test_chunking_takes_the_ocr_span_when_ocr_never_ran():
    db, doc, report = make()
    report("extracting", 1.0)          # 35
    report("chunking", 0.5)
    # Chunking now owns 35 -> 68, which is what keeps the bar continuous on a
    # document that has a text layer.
    assert doc.progress == 51


def test_progress_never_goes_backwards():
    db, doc, report = make()
    report("indexing", 1.0)            # 99
    report("chunking", 0.0)            # would be 68 if it were allowed
    assert doc.progress == 99


def test_a_fraction_outside_zero_to_one_is_clamped():
    db, doc, report = make()
    report("extracting", 5.0)
    assert doc.progress == 35
    db, doc, report = make()
    report("extracting", -3.0)
    assert doc.progress == 0


def test_a_write_is_skipped_when_nothing_visible_changed():
    db, doc, report = make()
    report("extracting", 0.5)
    before = db.commits
    report("extracting", 0.5)          # same stage, same percentage
    assert db.commits == before


def test_force_writes_even_when_nothing_changed():
    db, doc, report = make()
    report("extracting", 0.5)
    before = db.commits
    report("extracting", 0.5, force=True)
    assert db.commits == before + 1


def test_the_fine_stage_sets_the_coarse_status():
    db, doc, report = make()
    report("ocr", 0.0, force=True)
    assert doc.stage == "ocr"
    assert doc.processing_status == "ocr"
    report("embedding", 0.0, force=True)
    assert doc.processing_status == "processing"
    report("done", 1.0, force=True)
    assert doc.processing_status == "done"


def test_every_stage_maps_to_a_status_the_check_constraint_allows():
    allowed = {"pending", "processing", "ocr", "done", "failed"}
    assert set(_COARSE.values()) <= allowed


def test_a_long_detail_is_truncated_to_the_column_width():
    db, doc, report = make()
    report("extracting", 0.1, detail="x" * 400)
    assert len(doc.stage_detail) == 120
