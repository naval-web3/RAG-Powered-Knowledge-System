"""
Unit tests for encryption at rest.

Sealing and unsealing are pure functions over bytes, so all of this runs without
a database, a server or an upload. What it is really checking is that the stored
form is genuinely unreadable and genuinely reversible, and that a file written
before encryption existed still opens. That last one decides whether this change
can be installed on top of an existing set of documents or destroys them.
"""

import os

import pytest

from app.services import file_store


SAMPLE = b"Leave requests are approved by the reporting manager.\n" * 40


# ------------------------------------------------------- the stored form

def test_sealing_hides_the_content():
    sealed = file_store.seal(SAMPLE)
    assert SAMPLE not in sealed
    # Not merely absent as a whole: no readable run of it survives either.
    assert b"reporting manager" not in sealed


def test_the_stored_form_announces_itself():
    assert file_store.is_sealed(file_store.seal(SAMPLE))


def test_plaintext_is_not_mistaken_for_the_stored_form():
    assert not file_store.is_sealed(SAMPLE)
    assert not file_store.is_sealed(b"%PDF-1.7\n")
    assert not file_store.is_sealed(b"")


def test_the_overhead_is_the_documented_thirty_six_bytes():
    # Eight of magic, twelve of nonce, sixteen of authentication tag. It matters
    # because the size shown in the library is the size of the document, not of
    # what is on the disk, and the two must be known to differ.
    assert len(file_store.seal(SAMPLE)) == len(SAMPLE) + file_store.OVERHEAD
    assert file_store.OVERHEAD == 36


def test_the_same_file_seals_differently_every_time():
    # A fresh nonce per write. Identical files stored twice must not produce
    # identical ciphertext, or the store leaks which documents match.
    assert file_store.seal(SAMPLE) != file_store.seal(SAMPLE)


# ------------------------------------------------------- reversibility

def test_unsealing_gives_back_exactly_what_went_in():
    assert file_store.unseal(file_store.seal(SAMPLE)) == SAMPLE


def test_an_empty_file_survives_the_round_trip():
    assert file_store.unseal(file_store.seal(b"")) == b""


def test_binary_content_survives_the_round_trip():
    # PDFs are the common case and they are not text.
    blob = bytes(range(256)) * 500
    assert file_store.unseal(file_store.seal(blob)) == blob


def test_unsealing_plaintext_returns_it_untouched():
    # The compatibility path, in one line: files stored before this existed.
    assert file_store.unseal(SAMPLE) == SAMPLE


# ------------------------------------------------------- tampering

def test_a_modified_file_refuses_to_open():
    from cryptography.exceptions import InvalidTag

    sealed = bytearray(file_store.seal(SAMPLE))
    sealed[-1] ^= 0x01  # one bit, in the last byte
    with pytest.raises(InvalidTag):
        file_store.unseal(bytes(sealed))


def test_a_swapped_nonce_refuses_to_open():
    from cryptography.exceptions import InvalidTag

    a = bytearray(file_store.seal(SAMPLE))
    b = file_store.seal(SAMPLE)
    start = len(file_store.MAGIC)
    a[start : start + file_store.NONCE_BYTES] = b[start : start + file_store.NONCE_BYTES]
    with pytest.raises(InvalidTag):
        file_store.unseal(bytes(a))


def test_a_truncated_file_refuses_to_open():
    from cryptography.exceptions import InvalidTag

    sealed = file_store.seal(SAMPLE)
    with pytest.raises(InvalidTag):
        file_store.unseal(sealed[:-20])


# ------------------------------------------------------- on disk

def test_a_written_file_is_unreadable_on_disk_and_readable_through_the_store(tmp_path):
    path = os.path.join(str(tmp_path), "handbook.txt")
    file_store.write(path, SAMPLE)

    with open(path, "rb") as handle:
        on_disk = handle.read()
    assert SAMPLE not in on_disk
    assert file_store.read(path) == SAMPLE


def test_a_plaintext_file_on_disk_still_reads(tmp_path):
    path = os.path.join(str(tmp_path), "older.txt")
    with open(path, "wb") as handle:
        handle.write(SAMPLE)
    assert not file_store.file_is_sealed(path)
    assert file_store.read(path) == SAMPLE


def test_file_is_sealed_reports_what_is_actually_there(tmp_path):
    sealed_path = os.path.join(str(tmp_path), "new.txt")
    plain_path = os.path.join(str(tmp_path), "old.txt")
    file_store.write(sealed_path, SAMPLE)
    with open(plain_path, "wb") as handle:
        handle.write(SAMPLE)

    assert file_store.file_is_sealed(sealed_path)
    assert not file_store.file_is_sealed(plain_path)
    assert not file_store.file_is_sealed(os.path.join(str(tmp_path), "gone.txt"))


def test_the_wrong_key_gives_a_message_rather_than_a_stack_trace(tmp_path):
    # What an installation looks like after SECRET_KEY is regenerated. The
    # message has to name the cause, because the symptom on its own looks like
    # a corrupt file and sends people to the wrong problem.
    path = os.path.join(str(tmp_path), "sealed.txt")
    file_store.write(path, SAMPLE)

    file_store._key_cache.clear()
    original = file_store.settings.FILE_ENCRYPTION_KEY
    file_store.settings.FILE_ENCRYPTION_KEY = "a-completely-different-key"
    try:
        with pytest.raises(ValueError) as caught:
            file_store.read(path)
        assert "key" in str(caught.value).lower()
    finally:
        file_store.settings.FILE_ENCRYPTION_KEY = original
        file_store._key_cache.clear()


def test_the_key_survives_a_settings_change_and_change_back(tmp_path):
    # The cache is keyed on the material, so putting the old key back must open
    # the file again rather than serving a stale derived key.
    path = os.path.join(str(tmp_path), "sealed.txt")
    file_store.write(path, SAMPLE)

    original = file_store.settings.FILE_ENCRYPTION_KEY
    file_store.settings.FILE_ENCRYPTION_KEY = "something-else-entirely"
    try:
        with pytest.raises(ValueError):
            file_store.read(path)
    finally:
        file_store.settings.FILE_ENCRYPTION_KEY = original
    assert file_store.read(path) == SAMPLE


def test_encryption_can_be_switched_off_without_breaking_reads(tmp_path):
    # Turning it off writes plaintext. Files sealed earlier must still open,
    # or switching it off would be a way to lose everything already stored.
    sealed_path = os.path.join(str(tmp_path), "before.txt")
    file_store.write(sealed_path, SAMPLE)

    original = file_store.settings.ENCRYPT_UPLOADS
    file_store.settings.ENCRYPT_UPLOADS = False
    try:
        plain_path = os.path.join(str(tmp_path), "after.txt")
        file_store.write(plain_path, SAMPLE)
        with open(plain_path, "rb") as handle:
            assert handle.read() == SAMPLE
        assert file_store.read(sealed_path) == SAMPLE
    finally:
        file_store.settings.ENCRYPT_UPLOADS = original
