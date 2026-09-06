"""
Check the exported PDF for the faults that only exist once it is paginated.

verify.py checks the sources. These are different faults: a figure that lands on
one page while its caption lands on the next, a page left blank by a plate that
would not fit, a page number that restarts because a section break carried the
wrong numbering forward. None of them are visible in the Markdown, and all of
them are obvious to an examiner holding the printed copy.

    python verify_pdf.py

Three things needed care, and each is a rule about where to look rather than
what to look for:

  * The List of Figures is page after page of caption text with no images. A
    whole page is recognised as a contents page by counting its dot leaders,
    and then skipped. Filtering line by line does not work, because a wrapped
    entry puts the leader on a different line from the "Figure 3.7:" that
    starts it. Skipping by page number does not work either: the front matter
    is numbered in the same sequence as the body.
  * A caption is "Figure 3.7: ..." with the colon. Without it the check also
    matches every sentence of prose that opens by naming a figure.
  * The page number is read from the bottom inch of the sheet and nowhere else.
    Scanning the whole page for a line of digits finds the contents of tables.
"""

import os
import re
import sys

import fitz  # PyMuPDF

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "report.pdf")

FOOTER_INCHES = 1.0
CAPTION = re.compile(r"^(Figure|Table) (\d+\.\d+):")
# Dot leaders: the mark of a contents entry rather than a caption.
LEADER = re.compile(r"\.{4,}")


def footer_number(page):
    """The page number printed at the foot of this sheet, if there is one."""
    band = fitz.Rect(0, page.rect.height - FOOTER_INCHES * 72,
                     page.rect.width, page.rect.height)
    text = page.get_text(clip=band).strip()
    found = re.findall(r"\b(\d{1,3})\b", text)
    return int(found[-1]) if found else None


def main() -> int:
    if not os.path.exists(PDF):
        print("No report.pdf. Run export-pdf.ps1 first.")
        return 2

    doc = fitz.open(PDF)
    sheets = []
    for number, page in enumerate(doc, start=1):
        sheets.append({
            "sheet": number,
            "text": page.get_text().strip(),
            "images": len(page.get_images(full=True)),
            "landscape": page.rect.width > page.rect.height,
            "folio": footer_number(page),
        })

    # A page with several dot leaders on it is a table of contents, a list of
    # figures or a list of tables, and its "captions" are entries pointing at
    # figures that live elsewhere.
    body = [s for s in sheets if len(LEADER.findall(s["text"])) < 5]
    contents = [s["sheet"] for s in sheets if s not in body]

    problems = []
    figures = tables = 0

    for sheet in body:
        for line in sheet["text"].splitlines():
            match = CAPTION.match(line.strip())
            if not match:
                continue
            if match.group(1) == "Table":
                tables += 1
                continue
            figures += 1
            if sheet["images"] == 0:
                problems.append("sheet %d: figure caption '%s' with no image on the page"
                                % (sheet["sheet"], line.strip()[:70]))

    blank = [s["sheet"] for s in sheets if len(s["text"]) < 40 and s["images"] == 0]
    if blank:
        problems.append("blank pages: %s" % ", ".join(str(n) for n in blank))

    # Page numbers run over every sheet, contents pages included: skipping those
    # for the caption check must not put a hole in this sequence.
    folios = [(s["sheet"], s["folio"]) for s in sheets if s["folio"] is not None]
    # Sheet 1 is the title page, which carries no number by design.
    missing = [s["sheet"] for s in sheets if s["folio"] is None and s["sheet"] != 1]
    if missing:
        problems.append("sheets with no page number: %s" % ", ".join(str(n) for n in missing))
    for (sheet_a, folio_a), (_sheet_b, folio_b) in zip(folios, folios[1:]):
        if folio_b != folio_a + 1:
            problems.append("page number goes %d to %d after sheet %d"
                            % (folio_a, folio_b, sheet_a))

    landscape = [s["sheet"] for s in sheets if s["landscape"]]
    print("%d sheets, %d numbered pages (the title page carries none)"
          % (doc.page_count, len(folios)))
    print("contents pages skipped: %s" % ", ".join(str(n) for n in contents))
    print("%d figure captions, %d table captions, %d landscape plates"
          % (figures, tables, len(landscape)))
    print("landscape plates on sheets: %s" % ", ".join(str(n) for n in landscape))

    if problems:
        print("\n%d problem(s):" % len(problems))
        for problem in problems:
            print("  " + problem)
        return 1

    print("\nNo blank pages, no orphaned captions, page numbering continuous.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
