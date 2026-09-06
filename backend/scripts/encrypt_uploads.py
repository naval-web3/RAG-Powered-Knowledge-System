"""
Encrypt documents that were stored before encryption at rest was switched on.

New uploads are sealed automatically. Files already sitting in UPLOAD_DIR are
not, and the application goes on reading them as it always did, because the
reader recognises both forms. This converts them, so that nothing is left in
the clear.

Usage (from the backend/ directory, venv active, application stopped):

    python -m scripts.encrypt_uploads --dry-run     # say what would change
    python -m scripts.encrypt_uploads               # do it

Stop the application first. A file being converted is rewritten in place, and a
request arriving mid-write would read half of one form and half of the other.

Each file is written to a temporary name beside itself and then moved over the
original, so a power cut leaves either the old file or the new one and never a
half-written one. Every file is decrypted and compared against what went in
before the original is replaced: a conversion that cannot be undone is not a
conversion worth making.

This is one-way in the sense that matters. Losing SECRET_KEY (or
FILE_ENCRYPTION_KEY, when one is set) after running it means losing the
documents. Take a backup first; scripts/backup-db.ps1 in the project root
makes one.
"""

import argparse
import os
import sys

from app.config import settings
from app.services import file_store


def find_plaintext(root: str) -> list[str]:
    found = []
    for folder, _dirs, names in os.walk(root):
        for name in names:
            path = os.path.join(folder, name)
            try:
                if not file_store.file_is_sealed(path):
                    found.append(path)
            except OSError:
                pass
    return found


def convert(path: str) -> None:
    with open(path, "rb") as handle:
        plain = handle.read()

    sealed = file_store.seal(plain)
    if file_store.unseal(sealed) != plain:
        raise RuntimeError("the encrypted copy did not decrypt back to the original")

    temp = path + ".sealing"
    with open(temp, "wb") as handle:
        handle.write(sealed)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Encrypt documents stored in the clear.")
    parser.add_argument("--dry-run", action="store_true", help="list the files, change nothing")
    parser.add_argument("--dir", default=settings.UPLOAD_DIR, help="where the documents are")
    args = parser.parse_args()

    root = args.dir
    if not os.path.isdir(root):
        print("No such directory: %s" % root)
        return 2

    if not file_store.enabled():
        print("ENCRYPT_UPLOADS is off in the configuration. Turn it on first,")
        print("or the application will keep writing new files in the clear.")
        return 2

    plaintext = find_plaintext(root)
    if not plaintext:
        print("Nothing to do: every file under %s is already encrypted." % root)
        return 0

    total = sum(os.path.getsize(p) for p in plaintext)
    print("%d file(s) stored in the clear, %.1f MB in total:" % (len(plaintext), total / 1048576))
    for path in plaintext[:20]:
        print("  " + os.path.relpath(path, root))
    if len(plaintext) > 20:
        print("  ... and %d more" % (len(plaintext) - 20))

    if args.dry_run:
        print("\nDry run: nothing was changed.")
        return 0

    print("\nConverting. Do not interrupt.")
    done = 0
    for path in plaintext:
        try:
            convert(path)
            done += 1
        except Exception as exc:  # noqa: BLE001 - report and carry on with the rest
            print("  failed: %s (%s)" % (os.path.relpath(path, root), exc))

    print("\n%d of %d file(s) encrypted." % (done, len(plaintext)))
    if done < len(plaintext):
        print("The ones that failed are untouched and still readable.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
