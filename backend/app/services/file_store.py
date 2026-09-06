"""
Encryption at rest for uploaded documents.

The proposal requires that user data and documents be encrypted at rest as well
as in transit. In transit is TLS, which is deploy/Caddyfile's job. At rest is
this: every file written to UPLOAD_DIR is sealed with AES-256-GCM before it
touches the disk, so a stolen drive, a backup archive that ends up somewhere it
should not, or anyone with a file manager and no database access, gets bytes
that mean nothing.

The shape of a stored file:

    RAGENC1\\0        8 bytes   so a reader can tell at a glance what this is
    nonce           12 bytes   fresh random for every write, never reused
    ciphertext + tag           AES-256-GCM, which authenticates as well as hides

GCM rather than CBC because it detects tampering. A file edited on disk fails to
decrypt rather than decrypting into something subtly wrong, and for a document
that gets fed to a language model and quoted back to the user, silently altered
content is the failure worth ruling out.

Whole files are read and written at once rather than streamed. The upload limit
is MAX_UPLOAD_MB, twenty-five by default, and every reader downstream (pypdf,
PyMuPDF, python-docx) is handed the bytes anyway.

Reading tolerates plaintext. A file without the magic prefix is returned as it
is found, which is what makes this change safe to introduce on an installation
that already has documents in it, and what lets the sample data on the disc stay
readable under a SECRET_KEY the person installing it generated themselves.
Convert them with scripts/encrypt_uploads.py when there is a reason to.
"""

import hashlib
import os
import secrets

from app.config import settings

MAGIC = b"RAGENC1\0"
NONCE_BYTES = 12
# 8 for the magic, 12 for the nonce, 16 for the GCM tag.
OVERHEAD = len(MAGIC) + NONCE_BYTES + 16

_key_cache: dict[str, bytes] = {}


def _key() -> bytes:
    """The 32-byte key files are sealed with.

    Taken from FILE_ENCRYPTION_KEY when one is set. Otherwise derived from
    SECRET_KEY, so that an installation that follows INSTALL.md gets encryption
    without a second key to generate and a second thing to lose. The derivation
    is one-way and domain-separated, so the file key cannot be worked backwards
    into the token signing key.

    The cost of the default is that SECRET_KEY then has two jobs, and changing
    it makes stored files unreadable as well as signing everyone out. Set
    FILE_ENCRYPTION_KEY if you expect to rotate one without the other.
    """
    configured = (settings.FILE_ENCRYPTION_KEY or "").strip()
    material = configured or settings.SECRET_KEY
    # Cached on the material rather than computed each time: the derivation is
    # deliberately slow, and it would otherwise run on every page of every
    # document read. Keying the cache on the material means a changed setting
    # still produces a changed key.
    if material not in _key_cache:
        _key_cache[material] = hashlib.pbkdf2_hmac(
            "sha256", material.encode("utf-8"), b"rag-file-store-v1", 100_000, dklen=32
        )
    return _key_cache[material]


def enabled() -> bool:
    return bool(settings.ENCRYPT_UPLOADS)


def is_sealed(blob: bytes) -> bool:
    return blob[: len(MAGIC)] == MAGIC


def seal(data: bytes) -> bytes:
    """Plaintext in, stored form out."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = secrets.token_bytes(NONCE_BYTES)
    return MAGIC + nonce + AESGCM(_key()).encrypt(nonce, data, None)


def unseal(blob: bytes) -> bytes:
    """Stored form in, plaintext out. Plaintext in, the same plaintext out."""
    if not is_sealed(blob):
        return blob
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    start = len(MAGIC)
    nonce = blob[start : start + NONCE_BYTES]
    return AESGCM(_key()).decrypt(nonce, blob[start + NONCE_BYTES :], None)


def write(path: str, data: bytes) -> None:
    """Store a file, sealed unless encryption is switched off."""
    with open(path, "wb") as handle:
        handle.write(seal(data) if enabled() else data)


def read(path: str) -> bytes:
    """The plaintext of a stored file, whether or not it was sealed.

    A file that is sealed but will not open raises. That is the right outcome:
    the alternative is handing back ciphertext and letting a PDF reader report
    a corrupt document, which sends whoever is looking into it in the wrong
    direction entirely.
    """
    with open(path, "rb") as handle:
        blob = handle.read()
    if not is_sealed(blob):
        return blob
    from cryptography.exceptions import InvalidTag

    try:
        return unseal(blob)
    except InvalidTag as exc:
        raise ValueError(
            "This file is encrypted and the current key does not open it. "
            "SECRET_KEY or FILE_ENCRYPTION_KEY has changed since it was stored."
        ) from exc


def file_is_sealed(path: str) -> bool:
    """Whether the file on disk is encrypted, read without loading all of it."""
    if not os.path.exists(path):
        return False
    with open(path, "rb") as handle:
        return handle.read(len(MAGIC)) == MAGIC
